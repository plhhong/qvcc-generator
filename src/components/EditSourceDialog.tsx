import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, RefreshCw } from 'lucide-react';
import type { ContentSource } from '@/integrations/supabase/helpers';

interface EditSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: ContentSource;
  onReprocessed: (updated: ContentSource) => void;
}

export function EditSourceDialog({ open, onOpenChange, source, onReprocessed }: EditSourceDialogProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState(source.title);
  const [sourceUrl, setSourceUrl] = useState(source.source_url || '');
  const [rawText, setRawText] = useState(source.raw_text || '');
  const [saving, setSaving] = useState(false);

  const isUrlBased = source.source_type === 'website' || source.source_type === 'youtube';

  const handleSaveAndReprocess = async () => {
    setSaving(true);
    try {
      if (isUrlBased) {
        // Update the URL in the DB first
        await supabase.from('content_sources').update({
          title,
          source_url: sourceUrl,
          status: 'draft',
          raw_text: null,
        }).eq('id', source.id);

        toast({ title: 'Re-processing...', description: 'Fetching updated content from the source.' });

        // Re-run the appropriate edge function
        const fnName = source.source_type === 'website' ? 'scrape-website' : 'youtube-transcript';
        const body = source.source_type === 'website'
          ? { url: sourceUrl, contentId: source.id }
          : { url: sourceUrl, contentId: source.id };

        const { data, error } = await supabase.functions.invoke(fnName, { body });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);

        // Fetch the refreshed source
        const { data: updated } = await supabase.from('content_sources').select('*').eq('id', source.id).single();
        if (updated) {
          onReprocessed(updated);
          toast({ title: 'Source updated!', description: 'Content has been re-fetched and is ready to re-analyze.' });
        }
      } else {
        // Manual / document: just update the text directly
        const wordCount = rawText.trim() ? rawText.trim().split(/\s+/).length : 0;
        const { data: updated, error } = await supabase
          .from('content_sources')
          .update({ title, raw_text: rawText, word_count: wordCount, status: 'draft' })
          .eq('id', source.id)
          .select()
          .single();
        if (error) throw error;
        if (updated) {
          onReprocessed(updated);
          toast({ title: 'Source updated!', description: 'Content saved. You can now re-analyze.' });
        }
      }

      onOpenChange(false);
    } catch (err: unknown) {
      toast({
        title: 'Update failed',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Edit Source</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-surface-3 border-border"
            />
          </div>

          {isUrlBased ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {source.source_type === 'website' ? 'Website URL' : 'YouTube URL'}
              </Label>
              <Input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="bg-surface-3 border-border font-mono text-sm"
                placeholder={source.source_type === 'website' ? 'https://example.com' : 'https://youtube.com/watch?v=...'}
              />
              <p className="text-xs text-muted-foreground">
                Saving will re-{source.source_type === 'website' ? 'crawl the website' : 'fetch the transcript'} and reset the analysis.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Content</Label>
                <span className="text-xs text-muted-foreground">
                  {rawText.trim() ? rawText.trim().split(/\s+/).length.toLocaleString() : 0} words
                </span>
              </div>
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="bg-surface-3 border-border font-mono text-sm resize-none min-h-[240px]"
                placeholder="Paste your content here..."
              />
              <p className="text-xs text-muted-foreground">
                Saving will update the content and reset the analysis so you can re-analyze.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="border-border">
            Cancel
          </Button>
          <Button
            onClick={handleSaveAndReprocess}
            disabled={saving || (!isUrlBased && !rawText.trim()) || (isUrlBased && !sourceUrl.trim())}
            className="bg-gradient-primary hover:opacity-90 glow-primary"
          >
            {saving ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isUrlBased ? 'Re-fetching...' : 'Saving...'}</>
            ) : (
              <><RefreshCw className="mr-2 h-4 w-4" />{isUrlBased ? 'Save & Re-fetch' : 'Save & Re-analyze'}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
