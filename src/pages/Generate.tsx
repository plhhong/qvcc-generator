import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Sparkles, Copy, Check, Linkedin, Twitter,
  BookOpen, Video, Mail, ChevronDown, ChevronUp, Wand2,
  Tag, Quote, Lightbulb, Users, Mic2, ChevronRight, Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContentSource, ContentSignal, BrandVoiceProfile, GeneratedPost } from '@/integrations/supabase/helpers';
import { EditSourceDialog } from '@/components/EditSourceDialog';

const PLATFORMS = [
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'text-platform-linkedin', bg: 'bg-platform-linkedin/10', border: 'border-platform-linkedin/30' },
  { id: 'twitter', label: 'X Thread', icon: Twitter, color: 'text-platform-twitter', bg: 'bg-platform-twitter/10', border: 'border-platform-twitter/30' },
  { id: 'blog', label: 'Blog Post', icon: BookOpen, color: 'text-platform-blog', bg: 'bg-platform-blog/10', border: 'border-platform-blog/30' },
  { id: 'reels', label: 'Reels Script', icon: Video, color: 'text-platform-reels', bg: 'bg-platform-reels/10', border: 'border-platform-reels/30' },
  { id: 'newsletter', label: 'Newsletter', icon: Mail, color: 'text-platform-newsletter', bg: 'bg-platform-newsletter/10', border: 'border-platform-newsletter/30' },
] as const;

const TONES = ['Professional', 'Conversational', 'Bold', 'Educational'];

export default function GeneratePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [source, setSource] = useState<ContentSource | null>(null);
  const [signals, setSignals] = useState<ContentSignal | null>(null);
  const [brandVoices, setBrandVoices] = useState<BrandVoiceProfile[]>([]);

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['linkedin', 'twitter']);
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedTone, setSelectedTone] = useState('Professional');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [generatedPosts, setGeneratedPosts] = useState<Record<string, { text: string; saved?: GeneratedPost }>>({});
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  const [signalsExpanded, setSignalsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      const [sourceRes, signalRes, voicesRes, postsRes] = await Promise.all([
        supabase.from('content_sources').select('*').eq('id', id).single(),
        supabase.from('content_signals').select('*').eq('content_id', id).maybeSingle(),
        supabase.from('brand_voice_profiles').select('*').eq('is_active', true).order('is_default', { ascending: false }),
        supabase.from('generated_posts').select('*').eq('content_id', id).order('created_at', { ascending: false }),
      ]);
      if (sourceRes.data) setSource(sourceRes.data);
      if (signalRes.data) setSignals(signalRes.data);
      if (voicesRes.data) {
        setBrandVoices(voicesRes.data);
        const def = voicesRes.data.find((v) => v.is_default);
        if (def) setSelectedVoiceId(def.id);
      }
      if (postsRes.data) {
        const existing: Record<string, { text: string; saved?: GeneratedPost }> = {};
        postsRes.data.forEach((post) => {
          if (!existing[post.platform]) {
            existing[post.platform] = { text: post.generated_text, saved: post };
          }
        });
        setGeneratedPosts(existing);
      }
      setLoading(false);
    };
    fetchData();
  }, [id]);

  const togglePlatform = (p: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const handleGenerate = async () => {
    if (!source || !signals || selectedPlatforms.length === 0) return;
    setGenerating(true);
    const voice = brandVoices.find((v) => v.id === selectedVoiceId);

    try {
      await supabase.from('content_sources').update({ status: 'generating' }).eq('id', source.id);

      const { data, error } = await supabase.functions.invoke('generate-posts', {
        body: {
          contentId: source.id,
          signals: {
            themes: signals.themes,
            key_quotes: signals.key_quotes,
            key_insights: signals.key_insights,
            audience_type: signals.audience_type,
            tone: signals.tone,
            summary: signals.summary,
          },
          platforms: selectedPlatforms,
          customPrompt,
          tone: selectedTone,
          brandVoice: voice ? {
            tone: voice.tone,
            audience: voice.audience,
            style_notes: voice.style_notes,
            vocabulary: voice.vocabulary,
          } : null,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Save generated posts & update state
      const newPosts: Record<string, { text: string; saved?: GeneratedPost }> = { ...generatedPosts };
      for (const platform of selectedPlatforms) {
        const text = data.posts[platform];
        if (!text) continue;
        const { data: saved, error: saveErr } = await supabase
          .from('generated_posts')
          .insert({
            content_id: source.id,
            user_id: user!.id,
            platform: platform as GeneratedPost['platform'],
            generated_text: text,
            prompt_used: customPrompt || null,
            tone: selectedTone,
            brand_voice_id: selectedVoiceId,
            character_count: text.length,
            word_count: text.trim().split(/\s+/).length,
          })
          .select()
          .single();
        if (!saveErr && saved) {
          newPosts[platform] = { text, saved };
        }
      }
      setGeneratedPosts(newPosts);
      await supabase.from('content_sources').update({ status: 'generated' }).eq('id', source.id);
      toast({ title: 'Content generated!', description: `${selectedPlatforms.length} platform posts created.` });
    } catch (err: unknown) {
      toast({ title: 'Generation failed', description: err instanceof Error ? err.message : 'Please try again', variant: 'destructive' });
      await supabase.from('content_sources').update({ status: 'analyzed' }).eq('id', source.id);
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async (platform: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedPlatform(platform);
    setTimeout(() => setCopiedPlatform(null), 2000);
    toast({ title: 'Copied!', description: 'Post copied to clipboard.' });
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
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Generate Content</h1>
            <p className="mt-1 text-sm text-muted-foreground truncate max-w-lg">{source?.title}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            {source && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
                className="border-border text-xs gap-1.5"
              >
                <Pencil className="h-3 w-3" /> Edit Source
              </Button>
            )}
            {signals && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/analyze/${id}`)}
                className="border-border text-xs gap-1.5"
              >
                View Analysis <ChevronRight className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {source && (
          <EditSourceDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            source={source}
            onReprocessed={(updated) => {
              setSource(updated);
              setSignals(null);
              navigate(`/analyze/${id}`);
            }}
          />
        )}

        {/* Analysis signals summary */}
        {signals && (
          <div className="mb-6 rounded-xl border border-border bg-card overflow-hidden">
            <button
              onClick={() => setSignalsExpanded(!signalsExpanded)}
              className="flex w-full items-center justify-between px-5 py-3 hover:bg-surface-3 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Content Analysis</span>
                {signals.tone && (
                  <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                    {signals.tone}
                  </Badge>
                )}
              </div>
              {signalsExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {signalsExpanded && (
              <div className="px-5 pb-5 border-t border-border space-y-4 pt-4">
                {signals.summary && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{signals.summary}</p>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {signals.audience_type && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Users className="h-3.5 w-3.5 text-info" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Audience</span>
                      </div>
                      <p className="text-sm text-foreground">{signals.audience_type}</p>
                    </div>
                  )}
                  {signals.themes && signals.themes.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Tag className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Themes</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {signals.themes.map((t, i) => (
                          <Badge key={i} variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {signals.key_insights && signals.key_insights.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Lightbulb className="h-3.5 w-3.5 text-success" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Key Insights</span>
                    </div>
                    <ul className="space-y-1.5">
                      {signals.key_insights.map((insight, i) => (
                        <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success/15 text-xs font-bold text-success mt-0.5">
                            {i + 1}
                          </span>
                          {insight}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {signals.key_quotes && signals.key_quotes.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Quote className="h-3.5 w-3.5 text-secondary" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Key Quotes</span>
                    </div>
                    <div className="space-y-2">
                      {signals.key_quotes.map((q, i) => (
                        <p key={i} className="text-sm text-foreground italic border-l-2 border-secondary pl-3">"{q}"</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!signalsExpanded && (
              <div className="px-5 pb-3 flex flex-wrap gap-1.5">
                {signals.themes?.slice(0, 4).map((t, i) => (
                  <Badge key={i} variant="secondary" className="text-xs bg-surface-3 text-muted-foreground border-border">
                    {t}
                  </Badge>
                ))}
                {signals.audience_type && (
                  <Badge variant="secondary" className="text-xs bg-info/10 text-info border-info/20 gap-1">
                    <Users className="h-3 w-3" />{signals.audience_type.split(',')[0].trim()}
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Left: Config panel */}
          <div className="lg:col-span-2 space-y-4">
            {/* Platform selector */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Select Platforms</h3>
              <div className="space-y-2">
                {PLATFORMS.map(({ id: pid, label, icon: Icon, color, bg, border }) => {
                  const selected = selectedPlatforms.includes(pid);
                  return (
                    <button
                      key={pid}
                      onClick={() => togglePlatform(pid)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all',
                        selected ? `${bg} ${border} border` : 'border-border hover:bg-surface-3'
                      )}
                    >
                      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shrink-0', selected ? bg : 'bg-surface-3')}>
                        <Icon className={cn('h-4 w-4', selected ? color : 'text-muted-foreground')} />
                      </div>
                      <span className={cn('text-sm font-medium', selected ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
                      {selected && <Check className="ml-auto h-4 w-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tone */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Tone</h3>
              <div className="grid grid-cols-2 gap-2">
                {TONES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedTone(t)}
                    className={cn(
                      'rounded-lg px-3 py-2 text-sm font-medium transition-all',
                      selectedTone === t
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-surface-3 text-muted-foreground hover:bg-surface-4'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Brand voice */}
            {brandVoices.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Brand Voice</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedVoiceId(null)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all',
                      !selectedVoiceId ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-surface-3'
                    )}
                  >
                    Default
                  </button>
                  {brandVoices.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVoiceId(v.id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all',
                        selectedVoiceId === v.id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-surface-3'
                      )}
                    >
                      {v.name}
                      {v.is_default && <Badge variant="secondary" className="ml-auto text-xs py-0">Default</Badge>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom prompt */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Custom Instruction</h3>
              <Textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g. Make this controversial... Use storytelling... Focus on the ROI angle..."
                className="bg-surface-3 border-border text-sm resize-none min-h-[80px]"
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generating || selectedPlatforms.length === 0}
              className="w-full bg-gradient-primary hover:opacity-90 transition-opacity glow-primary py-5 text-base font-semibold"
            >
              {generating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
              ) : (
                <><Sparkles className="mr-2 h-5 w-5" />Generate {selectedPlatforms.length} Post{selectedPlatforms.length !== 1 ? 's' : ''}</>
              )}
            </Button>
          </div>

          {/* Right: Generated posts */}
          <div className="lg:col-span-3 space-y-4">
            {PLATFORMS.map(({ id: pid, label, icon: Icon, color, bg, border }) => {
              const post = generatedPosts[pid];
              const isExpanded = expandedPlatform === pid;
              if (!post && !selectedPlatforms.includes(pid)) return null;

              return (
                <div
                  key={pid}
                  className={cn(
                    'rounded-xl border bg-card transition-all',
                    post ? `${border} border` : 'border-border opacity-50'
                  )}
                >
                  <div className="flex items-center gap-3 p-4">
                    <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shrink-0', bg)}>
                      <Icon className={cn('h-4 w-4', color)} />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-foreground">{label}</span>
                      {post && (
                        <span className="ml-2 text-xs text-muted-foreground">{post.text.length} chars</span>
                      )}
                    </div>
                    {post && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(pid, post.text)}
                          className="h-8 px-2 text-muted-foreground hover:text-foreground"
                        >
                          {copiedPlatform === pid ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                        {post.saved && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/editor/${post.saved!.id}`)}
                            className="h-8 px-2 text-muted-foreground hover:text-foreground"
                          >
                            <Wand2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedPlatform(isExpanded ? null : pid)}
                          className="h-8 px-2 text-muted-foreground hover:text-foreground"
                        >
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    )}
                    {!post && selectedPlatforms.includes(pid) && (
                      <span className="text-xs text-muted-foreground">Pending generation</span>
                    )}
                  </div>

                  {post && (
                    <div className={cn('overflow-hidden transition-all', isExpanded ? 'max-h-none' : 'max-h-24')}>
                      <div className="px-4 pb-4">
                        <div className="relative">
                          <p className={cn(
                            'text-sm text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed',
                            !isExpanded && 'line-clamp-4'
                          )}>
                            {post.text}
                          </p>
                          {!isExpanded && (
                            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent" />
                          )}
                        </div>
                        {!isExpanded && (
                          <button
                            onClick={() => setExpandedPlatform(pid)}
                            className="mt-2 text-xs text-primary hover:underline"
                          >
                            Show full post
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {generating && selectedPlatforms.includes(pid) && !post && (
                    <div className="px-4 pb-4">
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="h-3 rounded-full bg-surface-4"
                            style={{
                              width: `${80 - i * 10}%`,
                              backgroundImage: 'linear-gradient(90deg, transparent 0%, hsl(var(--surface-3)) 50%, transparent 100%)',
                              backgroundSize: '200% 100%',
                              animation: `shimmer 1.5s ease-in-out infinite ${i * 0.2}s`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {Object.keys(generatedPosts).length === 0 && !generating && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                <Sparkles className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="font-medium text-foreground">No posts generated yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Select platforms and click Generate</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
