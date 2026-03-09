import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { filePath, contentId, fileName } = await req.json();
    if (!filePath) throw new Error('filePath is required');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(filePath);

    if (downloadError) throw new Error(`Download error: ${downloadError.message}`);
    if (!fileData) throw new Error('File is empty');

    const ext = (fileName || filePath).split('.').pop()?.toLowerCase();
    let rawText = '';

    if (ext === 'txt' || ext === 'md') {
      rawText = await fileData.text();
    } else if (ext === 'pdf' || ext === 'docx') {
      // Use Firecrawl for complex document parsing if available
      const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
      if (FIRECRAWL_API_KEY) {
        // Upload file to a temporary public URL approach - for PDF/DOCX we'll try text extraction
        // Fall back to reading as text for simple cases
        rawText = await fileData.text();
        // Clean up binary noise if any
        rawText = rawText.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, ' ').replace(/\s{3,}/g, '\n\n').trim();
      } else {
        rawText = await fileData.text();
      }
    } else {
      rawText = await fileData.text();
    }

    if (!rawText || rawText.trim().length < 50) {
      throw new Error('Could not extract readable text from this document. Try converting to TXT or MD format.');
    }

    const wordCount = rawText.trim().split(/\s+/).length;

    await supabase.from('content_sources').update({
      raw_text: rawText.slice(0, 100000), // cap at 100k chars
      word_count: wordCount,
      status: 'draft',
    }).eq('id', contentId);

    return new Response(JSON.stringify({ success: true, wordCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('parse-document error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
