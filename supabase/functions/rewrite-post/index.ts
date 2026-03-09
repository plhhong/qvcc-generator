import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { text, action, platform } = await req.json();
    if (!text || !action) throw new Error('text and action are required');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const actionMap: Record<string, string> = {
      'Shorten': 'Rewrite this post to be 30-40% shorter while keeping all key ideas. Remove filler, tighten sentences.',
      'Expand': 'Expand this post by 40-50%, adding more depth, examples, and supporting details. Keep the same voice.',
      'More Persuasive': 'Rewrite this post to be significantly more persuasive. Use stronger verbs, social proof, urgency, and compelling arguments.',
      'More Professional': 'Rewrite this post with a more professional, authoritative tone. More formal language, data-driven, credible.',
      'More Casual': 'Rewrite this post with a casual, conversational, friendly tone. Like you\'re texting a smart friend.',
    };

    const instruction = actionMap[action] || `Apply this transformation to the post: ${action}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are an expert ${platform || 'social media'} copywriter. Rewrite posts while preserving the core message. Output ONLY the rewritten post — no commentary.`,
          },
          {
            role: 'user',
            content: `${instruction}\n\nOriginal post:\n${text}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) throw new Error('Rate limit exceeded');
      if (response.status === 402) throw new Error('AI credits exhausted');
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const rewritten = data.choices?.[0]?.message?.content || text;

    return new Response(JSON.stringify({ rewritten }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('rewrite-post error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message.includes('Rate limit') ? 429 : message.includes('credits') ? 402 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
