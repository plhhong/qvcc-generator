import { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText, Youtube, Globe, Upload, ArrowRight, Loader2, X, File,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function NewContent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultTab = searchParams.get('tab') || 'manual';

  // Manual
  const [manualTitle, setManualTitle] = useState('');
  const [manualText, setManualText] = useState('');

  // YouTube
  const [ytUrl, setYtUrl] = useState('');

  // Website
  const [webUrl, setWebUrl] = useState('');

  // Document
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);

  const wordCount = manualText.trim() ? manualText.trim().split(/\s+/).length : 0;

  const createSource = async (data: {
    title: string;
    source_type: 'manual' | 'youtube' | 'website' | 'document';
    source_url?: string;
    raw_text?: string;
    file_path?: string;
    word_count?: number;
  }) => {
    if (!user) return;
    const { data: source, error } = await supabase
      .from('content_sources')
      .insert({ ...data, user_id: user.id })
      .select()
      .single();
    if (error) throw error;
    return source;
  };

  const handleManualSubmit = async () => {
    if (!manualText.trim()) {
      toast({ title: 'Content required', description: 'Please paste or write some content.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const source = await createSource({
        title: manualTitle || manualText.split('\n')[0].slice(0, 80) || 'Untitled',
        source_type: 'manual',
        raw_text: manualText,
        word_count: wordCount,
      });
      toast({ title: 'Content imported!', description: 'Analyzing your content...' });
      navigate(`/analyze/${source!.id}`);
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleYoutubeSubmit = async () => {
    if (!ytUrl.trim() || !ytUrl.includes('youtube.com') && !ytUrl.includes('youtu.be')) {
      toast({ title: 'Invalid URL', description: 'Please enter a valid YouTube URL.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      // Create source first, then fetch transcript via edge function
      const source = await createSource({
        title: 'YouTube Import',
        source_type: 'youtube',
        source_url: ytUrl,
      });

      // Fetch transcript
      const { data, error } = await supabase.functions.invoke('youtube-transcript', {
        body: { url: ytUrl, contentId: source!.id },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast({ title: 'Transcript fetched!', description: 'Analyzing your content...' });
      navigate(`/analyze/${source!.id}`);
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to fetch transcript', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleWebsiteSubmit = async () => {
    if (!webUrl.trim()) {
      toast({ title: 'URL required', description: 'Please enter a website URL.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    let source: Awaited<ReturnType<typeof createSource>> | undefined;
    try {
      source = await createSource({
        title: 'Website Import',
        source_type: 'website',
        source_url: webUrl,
      });

      const { data, error } = await supabase.functions.invoke('scrape-website', {
        body: { url: webUrl, contentId: source!.id },
      });
      if (error) throw new Error(error.message || 'Scrape failed');
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Page scraped!', description: 'Analyzing your content...' });
      navigate(`/analyze/${source!.id}`);
    } catch (err: unknown) {
      // Clean up the orphaned source record if scrape failed
      if (source?.id) {
        await supabase.from('content_sources').delete().eq('id', source.id);
      }
      toast({ title: 'Failed to scrape website', description: err instanceof Error ? err.message : 'Please try another URL', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentSubmit = async () => {
    if (!file) {
      toast({ title: 'File required', description: 'Please select a document to upload.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      // Upload to Supabase Storage
      const filePath = `${user!.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
      if (uploadError) throw uploadError;

      const source = await createSource({
        title: file.name.replace(/\.[^/.]+$/, ''),
        source_type: 'document',
        file_path: filePath,
      });

      // Parse document via edge function
      const { data, error } = await supabase.functions.invoke('parse-document', {
        body: { filePath, contentId: source!.id, fileName: file.name },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast({ title: 'Document parsed!', description: 'Analyzing your content...' });
      navigate(`/analyze/${source!.id}`);
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to process document', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Import Content</h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose how to bring in your source material.</p>
        </div>

        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 h-auto p-1 bg-surface-3 rounded-xl">
            {[
              { value: 'manual', icon: FileText, label: 'Manual' },
              { value: 'youtube', icon: Youtube, label: 'YouTube' },
              { value: 'website', icon: Globe, label: 'Website' },
              { value: 'document', icon: Upload, label: 'Document' },
            ].map(({ value, icon: Icon, label }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex flex-col items-center gap-1.5 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg text-muted-foreground"
              >
                <Icon className="h-4 w-4" />
                <span className="text-xs font-medium">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Manual */}
          <TabsContent value="manual" className="mt-0">
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Title (optional)</Label>
                <Input
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="e.g. My podcast episode on AI in startups"
                  className="bg-surface-3 border-border"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Content *</Label>
                  <span className="text-xs text-muted-foreground">{wordCount.toLocaleString()} words</span>
                </div>
                <Textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="Paste your article, essay, transcript, or any long-form content here..."
                  className="bg-surface-3 border-border min-h-[280px] font-mono text-sm resize-none"
                />
              </div>
              <Button
                onClick={handleManualSubmit}
                disabled={loading || !manualText.trim()}
                className="w-full bg-gradient-primary hover:opacity-90 transition-opacity glow-primary"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Analyze Content <ArrowRight className="ml-2 h-4 w-4" /></>)}
              </Button>
            </div>
          </TabsContent>

          {/* YouTube */}
          <TabsContent value="youtube" className="mt-0">
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 mb-2">
                <Youtube className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Import from YouTube</h3>
                <p className="mt-1 text-sm text-muted-foreground">We'll extract the full transcript automatically from the video.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">YouTube URL *</Label>
                <Input
                  value={ytUrl}
                  onChange={(e) => setYtUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="bg-surface-3 border-border font-mono text-sm"
                />
              </div>
              <Button
                onClick={handleYoutubeSubmit}
                disabled={loading || !ytUrl.trim()}
                className="w-full bg-gradient-primary hover:opacity-90 transition-opacity glow-primary"
              >
                {loading ? (<><Loader2 className="h-4 w-4 animate-spin mr-2" />Fetching transcript...</>) : (<>Fetch Transcript <ArrowRight className="ml-2 h-4 w-4" /></>)}
              </Button>
            </div>
          </TabsContent>

          {/* Website */}
          <TabsContent value="website" className="mt-0">
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10 mb-2">
                <Globe className="h-6 w-6 text-success" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Scrape from Website</h3>
                <p className="mt-1 text-sm text-muted-foreground">We'll extract the main article content from any webpage via Firecrawl.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Website URL *</Label>
                <Input
                  value={webUrl}
                  onChange={(e) => setWebUrl(e.target.value)}
                  placeholder="https://example.com/blog/article"
                  className="bg-surface-3 border-border font-mono text-sm"
                />
              </div>
              <Button
                onClick={handleWebsiteSubmit}
                disabled={loading || !webUrl.trim()}
                className="w-full bg-gradient-primary hover:opacity-90 transition-opacity glow-primary"
              >
                {loading ? (<><Loader2 className="h-4 w-4 animate-spin mr-2" />Scraping page...</>) : (<>Scrape Content <ArrowRight className="ml-2 h-4 w-4" /></>)}
              </Button>
            </div>
          </TabsContent>

          {/* Document */}
          <TabsContent value="document" className="mt-0">
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10 mb-2">
                <Upload className="h-6 w-6 text-warning" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Upload Document</h3>
                <p className="mt-1 text-sm text-muted-foreground">Supports PDF, DOCX, TXT, and Markdown files.</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />

              {!file ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'w-full rounded-xl border-2 border-dashed border-border p-8 text-center transition-all hover:border-primary/60 hover:bg-surface-3'
                  )}
                >
                  <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Click to upload or drag and drop</p>
                  <p className="mt-1 text-xs text-muted-foreground">PDF, DOCX, TXT, MD — up to 20MB</p>
                </button>
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-3 p-4">
                  <File className="h-8 w-8 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button onClick={() => setFile(null)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                  <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                </div>
              )}

              <Button
                onClick={handleDocumentSubmit}
                disabled={loading || !file}
                className="w-full bg-gradient-primary hover:opacity-90 transition-opacity glow-primary"
              >
                {loading ? (<><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing...</>) : (<>Process Document <ArrowRight className="ml-2 h-4 w-4" /></>)}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
