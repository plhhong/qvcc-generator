import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function fetchTranscript(videoId: string): Promise<string> {
  // Strategy 1: Use Supadata free API (no key needed for basic use)
  try {
    const res = await fetch(`https://supadata.ai/api/youtube/transcript?videoId=${videoId}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.content && typeof data.content === 'string' && data.content.length > 50) {
        return data.content;
      }
      if (Array.isArray(data?.content)) {
        const text = data.content.map((s: { text: string }) => s.text).join(' ');
        if (text.length > 50) return text;
      }
    }
  } catch { /* fallthrough */ }

  // Strategy 2: YouTube timedtext API (auto-generated captions)
  // Try multiple language codes
  for (const lang of ['en', 'en-US', 'en-GB', 'a.en']) {
    try {
      const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=json3&xorb=2&xobt=3&xovt=3`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
          'Accept': 'application/json',
        },
      });
      if (res.ok) {
        const text = await res.text();
        if (text && text.length > 10 && text.startsWith('{')) {
          const data = JSON.parse(text);
          const lines = (data?.events || [])
            .filter((e: { segs?: { utf8: string }[] }) => e.segs)
            .map((e: { segs: { utf8: string }[] }) =>
              e.segs.map((s) => s.utf8 || '').join('').replace(/\n/g, ' ').trim()
            )
            .filter(Boolean);
          const transcript = lines.join(' ').trim();
          if (transcript.length > 50) return transcript;
        }
      }
    } catch { /* try next */ }
  }

  // Strategy 3: YouTube timedtext XML format
  for (const lang of ['en', 'en-US']) {
    try {
      const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
      });
      if (res.ok) {
        const xml = await res.text();
        if (xml && xml.includes('<text')) {
          const textMatches = xml.matchAll(/<text[^>]*>(.*?)<\/text>/gs);
          const lines: string[] = [];
          for (const match of textMatches) {
            const clean = match[1]
              .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n/g, ' ').trim();
            if (clean) lines.push(clean);
          }
          const transcript = lines.join(' ').trim();
          if (transcript.length > 50) return transcript;
        }
      }
    } catch { /* try next */ }
  }

  // Strategy 4: List available tracks then fetch
  try {
    const listRes = await fetch(
      `https://www.youtube.com/api/timedtext?v=${videoId}&type=list`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' } }
    );
    if (listRes.ok) {
      const listXml = await listRes.text();
      const trackMatch = listXml.match(/lang_code="([^"]+)"/);
      if (trackMatch) {
        const lang = trackMatch[1];
        const res = await fetch(
          `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=json3`
        );
        if (res.ok) {
          const data = await res.json();
          const lines = (data?.events || [])
            .filter((e: { segs?: { utf8: string }[] }) => e.segs)
            .map((e: { segs: { utf8: string }[] }) =>
              e.segs.map((s) => s.utf8 || '').join('').replace(/\n/g, ' ').trim()
            )
            .filter(Boolean);
          const transcript = lines.join(' ').trim();
          if (transcript.length > 50) return transcript;
        }
      }
    }
  } catch { /* fallthrough */ }

  throw new Error('Could not extract transcript. The video may not have English captions available. Try uploading the transcript manually.');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { url, contentId } = await req.json();
    if (!url) throw new Error('URL is required');

    // Extract video ID
    const videoIdMatch = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/);
    if (!videoIdMatch) throw new Error('Invalid YouTube URL — could not extract video ID');
    const videoId = videoIdMatch[1];

    const transcript = await fetchTranscript(videoId);
    const wordCount = transcript.trim().split(/\s+/).length;

    // Try to get video title from oEmbed
    let title = `YouTube Video (${videoId})`;
    try {
      const oEmbedRes = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
      );
      if (oEmbedRes.ok) {
        const oEmbed = await oEmbedRes.json();
        title = oEmbed.title || title;
      }
    } catch { /* ignore */ }

    // Update the content source
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await supabase.from('content_sources').update({
      title,
      raw_text: transcript,
      word_count: wordCount,
      status: 'draft',
    }).eq('id', contentId);

    return new Response(JSON.stringify({ success: true, title, wordCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('youtube-transcript error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
