import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { url, contentId } = await req.json();
    if (!url) throw new Error('URL is required');

    // Extract video ID
    const videoIdMatch = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/);
    if (!videoIdMatch) throw new Error('Invalid YouTube URL — could not extract video ID');
    const videoId = videoIdMatch[1];

    // Fetch transcript from youtubetranscript.com
    const transcriptRes = await fetch(`https://www.youtubetranscript.com/?videoId=${videoId}&lang=en`);
    let transcript = '';
    let title = `YouTube Video (${videoId})`;

    if (transcriptRes.ok) {
      const xml = await transcriptRes.text();
      // Parse XML text elements
      const textMatches = xml.matchAll(/<text[^>]*>(.*?)<\/text>/gs);
      const lines: string[] = [];
      for (const match of textMatches) {
        const clean = match[1]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\n/g, ' ')
          .trim();
        if (clean) lines.push(clean);
      }
      transcript = lines.join(' ');
    }

    if (!transcript) {
      // Fallback: try alternate transcript source
      const altRes = await fetch(`https://api.youtubetranscript.com/?videoId=${videoId}`);
      if (altRes.ok) {
        const data = await altRes.json();
        if (Array.isArray(data)) {
          transcript = data.map((item: { text: string }) => item.text).join(' ');
        }
      }
    }

    if (!transcript) {
      throw new Error('Could not extract transcript. The video may not have captions available.');
    }

    // Try to get video title from oEmbed
    try {
      const oEmbedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
      if (oEmbedRes.ok) {
        const oEmbed = await oEmbedRes.json();
        title = oEmbed.title || title;
      }
    } catch {
      // Ignore title fetch error
    }

    const wordCount = transcript.trim().split(/\s+/).length;

    // Update the content source with fetched data
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
