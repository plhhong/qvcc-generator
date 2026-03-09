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

    const SUPADATA_API_KEY = Deno.env.get('SUPADATA_API_KEY');
    if (!SUPADATA_API_KEY) throw new Error('SUPADATA_API_KEY is not configured');

    // Extract video ID for validation
    const videoIdMatch = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/);
    if (!videoIdMatch) throw new Error('Invalid YouTube URL — could not extract video ID');
    const videoId = videoIdMatch[1];

    // Fetch transcript via Supadata API
    const transcriptRes = await fetch(
      `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&text=true`,
      {
        headers: {
          'x-api-key': SUPADATA_API_KEY,
          'Accept': 'application/json',
        },
      }
    );

    if (!transcriptRes.ok) {
      const errBody = await transcriptRes.text();
      throw new Error(`Supadata API error (${transcriptRes.status}): ${errBody}`);
    }

    const transcriptData = await transcriptRes.json();

    // Supadata returns { content: string } when text=true
    let transcript = '';
    if (typeof transcriptData.content === 'string') {
      transcript = transcriptData.content.trim();
    } else if (Array.isArray(transcriptData.content)) {
      transcript = transcriptData.content.map((s: { text: string }) => s.text).join(' ').trim();
    }

    if (!transcript) {
      throw new Error('No transcript content returned. The video may not have captions available.');
    }

    const wordCount = transcript.split(/\s+/).length;

    // Get video title via oEmbed
    let title = `YouTube Video (${videoId})`;
    try {
      const oEmbedRes = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
      );
      if (oEmbedRes.ok) {
        const oEmbed = await oEmbedRes.json();
        title = oEmbed.title || title;
      }
    } catch { /* ignore title errors */ }

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
