import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Sparkles, ArrowRight, X, Plus, Quote, Lightbulb, Tag, Users, Mic2,
  RefreshCw, Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContentSource, ContentSignal } from '@/integrations/supabase/helpers';
import { EditSourceDialog } from '@/components/EditSourceDialog';

export default function AnalyzePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [source, setSource] = useState<ContentSource | null>(null);
  const [signals, setSignals] = useState<ContentSignal | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Editable signals
  const [themes, setThemes] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<string[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [audienceType, setAudienceType] = useState('');
  const [tone, setTone] = useState('');
  const [summary, setSummary] = useState('');
  const [newTheme, setNewTheme] = useState('');
  const [newQuote, setNewQuote] = useState('');
  const [newInsight, setNewInsight] = useState('');

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      const [sourceRes, signalRes] = await Promise.all([
        supabase.from('content_sources').select('*').eq('id', id).single(),
        supabase.from('content_signals').select('*').eq('content_id', id).maybeSingle(),
      ]);
      if (sourceRes.data) setSource(sourceRes.data);
      if (signalRes.data) {
        setSignals(signalRes.data);
        setThemes(signalRes.data.themes || []);
        setQuotes(signalRes.data.key_quotes || []);
        setInsights(signalRes.data.key_insights || []);
        setAudienceType(signalRes.data.audience_type || '');
        setTone(signalRes.data.tone || '');
        setSummary(signalRes.data.summary || '');
      }
      setLoading(false);

      // Auto-analyze if not yet done
      if (sourceRes.data && sourceRes.data.status !== 'analyzed' && sourceRes.data.status !== 'generated') {
        runAnalysis(sourceRes.data);
      }
    };
    fetchData();
  }, [id]);

  const runAnalysis = async (src?: ContentSource) => {
    const s = src || source;
    if (!s || !user) return;

    if (!s.raw_text) {
      toast({
        title: 'No content to analyze',
        description: 'This source has no extracted text. Please go back and re-import it.',
        variant: 'destructive',
      });
      return;
    }

    setAnalyzing(true);
    try {
      await supabase.from('content_sources').update({ status: 'analyzing' }).eq('id', s.id);

      const { data, error } = await supabase.functions.invoke('analyze-content', {
        body: { contentId: s.id, text: s.raw_text },
      });
      if (error) throw new Error(error.message || 'Edge function error');;
      if (data.error) throw new Error(data.error);

      const result = data.signals;
      setThemes(result.themes || []);
      setQuotes(result.key_quotes || []);
      setInsights(result.key_insights || []);
      setAudienceType(result.audience_type || '');
      setTone(result.tone || '');
      setSummary(result.summary || '');

      // Save signals
      const { data: savedSignal, error: signalError } = await supabase
        .from('content_signals')
        .upsert({
          content_id: s.id,
          user_id: user.id,
          themes: result.themes || [],
          key_quotes: result.key_quotes || [],
          key_insights: result.key_insights || [],
          audience_type: result.audience_type,
          tone: result.tone,
          summary: result.summary,
        }, { onConflict: 'content_id' })
        .select()
        .single();

      if (signalError) throw signalError;
      setSignals(savedSignal);

      await supabase.from('content_sources').update({ status: 'analyzed' }).eq('id', s.id);
      setSource((prev) => prev ? { ...prev, status: 'analyzed' } : prev);
      toast({ title: 'Analysis complete!', description: 'Your content signals are ready.' });
    } catch (err: unknown) {
      toast({ title: 'Analysis failed', description: err instanceof Error ? err.message : 'Please try again', variant: 'destructive' });
      await supabase.from('content_sources').update({ status: 'draft' }).eq('id', s.id);
    } finally {
      setAnalyzing(false);
    }
  };

  const saveAndProceed = async () => {
    if (!signals || !user) return;
    await supabase.from('content_signals').update({
      themes, key_quotes: quotes, key_insights: insights, audience_type: audienceType, tone, summary,
    }).eq('id', signals.id);
    navigate(`/generate/${id}`);
  };

  const removeItem = (arr: string[], setArr: (v: string[]) => void, idx: number) => {
    setArr(arr.filter((_, i) => i !== idx));
  };

  const addItem = (arr: string[], setArr: (v: string[]) => void, value: string, setValue: (v: string) => void) => {
    if (value.trim()) {
      setArr([...arr, value.trim()]);
      setValue('');
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Content Analysis</h1>
            <p className="mt-1 text-sm text-muted-foreground truncate max-w-md">{source?.title}</p>
          </div>
          {!analyzing && signals && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => runAnalysis()} className="border-border">
                <RefreshCw className="mr-2 h-4 w-4" /> Re-analyze
              </Button>
              <Button onClick={saveAndProceed} className="bg-gradient-primary hover:opacity-90 glow-primary">
                Generate Content <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {analyzing ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="relative flex h-16 w-16 items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles className="h-7 w-7 text-primary animate-pulse" />
                </div>
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">Analyzing your content...</p>
                <p className="mt-1 text-sm text-muted-foreground">Extracting themes, quotes, and key insights</p>
              </div>
              <div className="flex items-center gap-6 mt-2 text-xs text-muted-foreground">
                {['Extracting signals', 'Identifying themes', 'Finding insights'].map((step, i) => (
                  <span key={step} className={cn('flex items-center gap-1.5', i === 0 && 'text-primary')}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', i === 0 ? 'bg-primary animate-pulse' : 'bg-muted-foreground')} />
                    {step}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : !signals ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <Button onClick={() => runAnalysis()} className="bg-gradient-primary hover:opacity-90 glow-primary">
              <Sparkles className="mr-2 h-4 w-4" /> Start Analysis
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Summary */}
            {summary && (
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
                  <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-3 w-3 text-primary" />
                  </div>
                  AI Summary
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
              </div>
            )}

            {/* Meta row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-info" />
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Audience</h3>
                </div>
                <Input
                  value={audienceType}
                  onChange={(e) => setAudienceType(e.target.value)}
                  className="bg-surface-3 border-border text-sm"
                  placeholder="e.g. Startup founders"
                />
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Mic2 className="h-4 w-4 text-secondary" />
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tone</h3>
                </div>
                <Input
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="bg-surface-3 border-border text-sm"
                  placeholder="e.g. Professional, conversational"
                />
              </div>
            </div>

            {/* Themes */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
                <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center">
                  <Tag className="h-3 w-3 text-primary" />
                </div>
                Themes
              </h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {themes.map((theme, i) => (
                  <Badge key={i} variant="secondary" className="bg-primary/10 text-primary border-primary/20 gap-1.5 pr-1">
                    {theme}
                    <button onClick={() => removeItem(themes, setThemes, i)} className="hover:text-destructive transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newTheme}
                  onChange={(e) => setNewTheme(e.target.value)}
                  placeholder="Add a theme..."
                  className="bg-surface-3 border-border text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && addItem(themes, setThemes, newTheme, setNewTheme)}
                />
                <Button size="sm" variant="outline" onClick={() => addItem(themes, setThemes, newTheme, setNewTheme)} className="border-border">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Key Quotes */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
                <div className="h-5 w-5 rounded bg-secondary/10 flex items-center justify-center">
                  <Quote className="h-3 w-3 text-secondary" />
                </div>
                Key Quotes
              </h3>
              <div className="space-y-2 mb-3">
                {quotes.map((quote, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg bg-surface-3 p-3 border-l-2 border-secondary">
                    <p className="flex-1 text-sm text-foreground italic">"{quote}"</p>
                    <button onClick={() => removeItem(quotes, setQuotes, i)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-0.5">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newQuote}
                  onChange={(e) => setNewQuote(e.target.value)}
                  placeholder="Add a key quote..."
                  className="bg-surface-3 border-border text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && addItem(quotes, setQuotes, newQuote, setNewQuote)}
                />
                <Button size="sm" variant="outline" onClick={() => addItem(quotes, setQuotes, newQuote, setNewQuote)} className="border-border">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Key Insights */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
                <div className="h-5 w-5 rounded bg-success/10 flex items-center justify-center">
                  <Lightbulb className="h-3 w-3 text-success" />
                </div>
                Key Insights
              </h3>
              <ul className="space-y-2 mb-3">
                {insights.map((insight, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-lg bg-surface-3 p-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-xs font-bold text-success mt-0.5">
                      {i + 1}
                    </span>
                    <p className="flex-1 text-sm text-foreground">{insight}</p>
                    <button onClick={() => removeItem(insights, setInsights, i)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-0.5">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Input
                  value={newInsight}
                  onChange={(e) => setNewInsight(e.target.value)}
                  placeholder="Add a key insight..."
                  className="bg-surface-3 border-border text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && addItem(insights, setInsights, newInsight, setNewInsight)}
                />
                <Button size="sm" variant="outline" onClick={() => addItem(insights, setInsights, newInsight, setNewInsight)} className="border-border">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={saveAndProceed} className="bg-gradient-primary hover:opacity-90 glow-primary px-8">
                Generate Platform Content <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
