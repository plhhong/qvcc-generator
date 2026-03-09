import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const PLATFORM_TEMPLATES: Record<string, string> = {
  linkedin: `Write an engaging LinkedIn post following this structure:
1. HOOK: A bold opening line that stops the scroll (no "I'm excited to share" nonsense)
2. CONTEXT: 2-3 lines setting up the situation or problem  
3. INSIGHT: The core idea or lesson (most valuable section)
4. TAKEAWAY: Practical implication for the reader
5. CALL TO ACTION: An engaging question or soft CTA

Format: Short paragraphs (1-3 lines each). No bullet overload. Professional but human.
Target length: 150-300 words.`,

  twitter: `Write a Twitter/X thread following this structure:
Tweet 1 (HOOK): Bold claim or counter-intuitive statement that makes people read more
Tweet 2-3: Context and setup
Tweets 4-7: Core insights, one per tweet, each standalone
Tweet 8: The big insight or plot twist
Tweet 9-10: Practical takeaways
Final tweet: Strong closing statement + engagement question

Format: Number each tweet like "1/" "2/" etc. Each tweet max 280 chars. Add thread connector "🧵" to first tweet.`,

  blog: `Write a comprehensive blog post following this structure:
# [Compelling headline]
## Introduction (hook + promise)
## The Problem / Context (why this matters)
## Core Insights (multiple subheadings with depth)
## Real-World Application
## Conclusion + Key Takeaways

Format: Headers with ##, rich prose, subheadings, examples. SEO-friendly. 
Target length: 600-900 words.`,

  reels: `Write a short-form video script (Reels/TikTok) following this structure:
HOOK (0-3 sec): Shocking statement, bold claim, or visual direction
PROBLEM (3-8 sec): Relatable pain point or question
INSIGHT (8-25 sec): Core valuable content — fast, punchy
PROOF/EXAMPLE (25-40 sec): Quick example or stat
CTA (40-45 sec): Tell them what to do next

Format: Include [ACTION] directions for visuals. Use conversational language. Very short sentences. High energy.`,

  newsletter: `Write an email newsletter following this structure:
Subject line: [Write a compelling subject line]
Preview text: [28-char preview]

Opening: Personal, direct address to reader
Story/Hook: Short anecdote or bold statement  
Core Value: The main insight (biggest section)
Application: How to use this insight now
Closing: Warm sign-off + what's coming next

Format: Scannable, conversational, like writing to a friend. Include the subject line and preview text at the top.`,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { contentId, signals, platforms, customPrompt, tone, brandVoice } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const voiceSection = brandVoice
      ? `\n\nBrand Voice Profile:
- Tone: ${brandVoice.tone}
- Audience: ${brandVoice.audience || 'General'}
- Style: ${brandVoice.style_notes || 'Clear and concise'}
- Key vocabulary: ${(brandVoice.vocabulary || []).join(', ') || 'None specified'}`
      : '';

    const signalsSection = `
Content Signals to use:
- Themes: ${signals.themes?.join(', ') || 'Not specified'}
- Key Quotes: ${signals.key_quotes?.map((q: string) => `"${q}"`).join(' | ') || 'None'}
- Key Insights: ${signals.key_insights?.join(' • ') || 'None'}
- Audience: ${signals.audience_type || 'General'}
- Tone: ${signals.tone || tone}
- Summary: ${signals.summary || 'No summary available'}`;

    const customInstruction = customPrompt
      ? `\n\nAdditional instruction from user: ${customPrompt}`
      : '';

    // Generate all platforms in parallel
    const results = await Promise.all(
      platforms.map(async (platform: string) => {
        const template = PLATFORM_TEMPLATES[platform] || 'Write an engaging social media post';
        
        const systemPrompt = `You are an expert content strategist and copywriter. You write high-engagement posts that feel authentic and human, never like generic AI output.

Tone requested: ${tone}${voiceSection}`;

        const userPrompt = `${signalsSection}${customInstruction}

Platform instructions:
${template}

Write the ${platform} content now. Output ONLY the final post content — no meta-commentary, no "Here's the post:", no preamble.`;

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
              { role: 'user', content: userPrompt },
            ],
          }),
        });

        if (!response.ok) {
          if (response.status === 429) throw new Error('Rate limit exceeded');
          if (response.status === 402) throw new Error('AI credits exhausted');
          throw new Error(`AI error for ${platform}: ${response.status}`);
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || '';
        return [platform, text];
      })
    );

    const posts = Object.fromEntries(results);
    return new Response(JSON.stringify({ posts }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('generate-posts error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message.includes('Rate limit') ? 429 : message.includes('credits') ? 402 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
