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

    let transcript = '';
    let title = `YouTube Video (${videoId})`;

    // Step 1: Fetch the watch page to find the caption track URL
    const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!watchRes.ok) throw new Error(`Could not fetch YouTube page: ${watchRes.status}`);

    const html = await watchRes.text();

    // Extract title
    const titleMatch = html.match(/"title":"([^"]+)"/);
    if (titleMatch) title = titleMatch[1].replace(/\\u0026/g, '&').replace(/\\n/g, ' ').trim();

    // Find caption tracks in ytInitialPlayerResponse
    const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});\s*(?:var|window|<\/script)/s);
    if (playerResponseMatch) {
      try {
        const playerResponse = JSON.parse(playerResponseMatch[1]);
        const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (captions && captions.length > 0) {
          // Prefer English, fallback to first available
          const track = captions.find((t: { languageCode: string }) => t.languageCode === 'en')
            || captions.find((t: { languageCode: string }) => t.languageCode?.startsWith('en'))
            || captions[0];

          if (track?.baseUrl) {
            const captionRes = await fetch(track.baseUrl + '&fmt=json3');
            if (captionRes.ok) {
              const captionData = await captionRes.json();
              const lines = captionData?.events
                ?.filter((e: { segs?: { utf8: string }[] }) => e.segs)
                .map((e: { segs: { utf8: string }[] }) =>
                  e.segs.map((s) => s.utf8).join('').replace(/\n/g, ' ').trim()
                )
                .filter(Boolean) || [];
              transcript = lines.join(' ');
            }

            // Fallback: try XML format
            if (!transcript) {
              const captionXmlRes = await fetch(track.baseUrl);
              if (captionXmlRes.ok) {
                const xml = await captionXmlRes.text();
                const textMatches = xml.matchAll(/<text[^>]*>(.*?)<\/text>/gs);
                const lines: string[] = [];
                for (const match of textMatches) {
                  const clean = match[1]
                    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n/g, ' ').trim();
                  if (clean) lines.push(clean);
                }
                transcript = lines.join(' ');
              }
            }
          }
        }
      } catch {
        // JSON parse failed, continue
      }
    }

    // Step 2: Fallback — try YouTube timedtext API directly
    if (!transcript) {
      for (const lang of ['en', 'en-US', 'a.en']) {
        const timedTextRes = await fetch(
          `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=json3`
        );
        if (timedTextRes.ok) {
          try {
            const data = await timedTextRes.json();
            const lines = data?.events
              ?.filter((e: { segs?: { utf8: string }[] }) => e.segs)
              .map((e: { segs: { utf8: string }[] }) =>
                e.segs.map((s) => s.utf8).join('').replace(/\n/g, ' ').trim()
              )
              .filter(Boolean) || [];
            transcript = lines.join(' ');
            if (transcript) break;
          } catch { /* continue */ }
        }
      }
    }

    if (!transcript) {
      throw new Error('Could not extract transcript. The video may not have captions available, or captions may be disabled.');
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
