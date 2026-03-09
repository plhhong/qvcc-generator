import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { contentId, text } = await req.json();
    if (!text) throw new Error('No text provided');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const systemPrompt = `You are a content intelligence analyst. Extract structured signals from the provided content. Return precise, actionable data.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze the following content and extract structured signals:\n\n${text.slice(0, 8000)}` },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_signals',
              description: 'Extract content signals from the provided text',
              parameters: {
                type: 'object',
                properties: {
                  themes: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '3-6 main themes or topics as short labels (e.g. "AI adoption", "Startup strategy")',
                  },
                  key_quotes: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '2-4 powerful direct quotes or paraphrased key statements from the content',
                  },
                  key_insights: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '3-6 actionable insights or takeaways from the content (full sentences)',
                  },
                  audience_type: {
                    type: 'string',
                    description: 'Primary intended audience (e.g. "Startup founders", "Marketing professionals")',
                  },
                  tone: {
                    type: 'string',
                    description: 'Overall tone of the content (e.g. "Educational", "Inspirational", "Technical")',
                  },
                  summary: {
                    type: 'string',
                    description: 'A 2-3 sentence summary of the content\'s core message and value',
                  },
                },
                required: ['themes', 'key_quotes', 'key_insights', 'audience_type', 'tone', 'summary'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'extract_signals' } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again shortly.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits to your workspace.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error('No tool call in AI response');

    const signals = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify({ signals }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('analyze-content error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
