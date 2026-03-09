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

    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    if (!FIRECRAWL_API_KEY) throw new Error('Firecrawl not configured');

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    // Start a crawl job to get all pages
    const crawlResponse = await fetch('https://api.firecrawl.dev/v1/crawl', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        limit: 50,
        maxDepth: 3,
        scrapeOptions: {
          formats: ['markdown'],
          onlyMainContent: true,
        },
      }),
    });

    const crawlData = await crawlResponse.json();

    if (!crawlResponse.ok) {
      throw new Error(crawlData.error || `Firecrawl crawl error: ${crawlResponse.status}`);
    }

    const crawlId = crawlData.id;
    if (!crawlId) throw new Error('No crawl job ID returned');

    // Poll for crawl completion (max 60 seconds)
    let combinedMarkdown = '';
    let title = url;
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;

      const statusResponse = await fetch(`https://api.firecrawl.dev/v1/crawl/${crawlId}`, {
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}` },
      });

      const statusData = await statusResponse.json();

      if (statusData.status === 'completed' || statusData.status === 'failed') {
        if (statusData.status === 'failed') {
          throw new Error('Crawl job failed');
        }

        const pages = statusData.data || [];
        if (pages.length === 0) throw new Error('No pages could be crawled from this URL');

        // Get title from first page metadata
        title = pages[0]?.metadata?.title || url;

        // Combine all pages with separators
        const pageContents = pages
          .filter((p: { markdown?: string; metadata?: { sourceURL?: string } }) => p.markdown && p.markdown.trim())
          .map((p: { markdown: string; metadata?: { sourceURL?: string; title?: string } }) => {
            const pageTitle = p.metadata?.title || p.metadata?.sourceURL || '';
            const pageUrl = p.metadata?.sourceURL || '';
            return `## ${pageTitle}\n*Source: ${pageUrl}*\n\n${p.markdown}`;
          });

        if (pageContents.length === 0) throw new Error('No content extracted from pages');

        combinedMarkdown = pageContents.join('\n\n---\n\n');
        break;
      }

      // If still crawling, use partial results if available after 20 attempts
      if (attempts >= 20 && statusData.data && statusData.data.length > 0) {
        const pages = statusData.data;
        title = pages[0]?.metadata?.title || url;
        const pageContents = pages
          .filter((p: { markdown?: string }) => p.markdown && p.markdown.trim())
          .map((p: { markdown: string; metadata?: { sourceURL?: string; title?: string } }) => {
            const pageTitle = p.metadata?.title || p.metadata?.sourceURL || '';
            const pageUrl = p.metadata?.sourceURL || '';
            return `## ${pageTitle}\n*Source: ${pageUrl}*\n\n${p.markdown}`;
          });
        if (pageContents.length > 0) {
          combinedMarkdown = pageContents.join('\n\n---\n\n');
          break;
        }
      }
    }

    if (!combinedMarkdown) throw new Error('Timed out waiting for crawl to complete');

    const wordCount = combinedMarkdown.trim().split(/\s+/).length;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await supabase.from('content_sources').update({
      title: title.slice(0, 200),
      raw_text: combinedMarkdown,
      word_count: wordCount,
      status: 'draft',
    }).eq('id', contentId);

    return new Response(JSON.stringify({ success: true, title, wordCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('scrape-website error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
