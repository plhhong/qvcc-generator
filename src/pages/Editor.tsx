import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Copy, Check, Download, ArrowLeft, Wand2, Linkedin, Twitter,
  BookOpen, Video, Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GeneratedPost } from '@/integrations/supabase/helpers';

const REWRITE_ACTIONS = ['Shorten', 'Expand', 'More Persuasive', 'More Professional', 'More Casual'] as const;

const platformConfig = {
  linkedin: { icon: Linkedin, color: 'text-platform-linkedin', bg: 'bg-platform-linkedin/10', label: 'LinkedIn', limit: 3000 },
  twitter: { icon: Twitter, color: 'text-platform-twitter', bg: 'bg-platform-twitter/10', label: 'X Thread', limit: 2800 },
  blog: { icon: BookOpen, color: 'text-platform-blog', bg: 'bg-platform-blog/10', label: 'Blog Post', limit: 99999 },
  reels: { icon: Video, color: 'text-platform-reels', bg: 'bg-platform-reels/10', label: 'Reels Script', limit: 500 },
  newsletter: { icon: Mail, color: 'text-platform-newsletter', bg: 'bg-platform-newsletter/10', label: 'Newsletter', limit: 5000 },
};

export default function EditorPage() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [post, setPost] = useState<GeneratedPost | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rewriting, setRewriting] = useState(false);

  useEffect(() => {
    if (!postId) return;
    supabase.from('generated_posts').select('*').eq('id', postId).single().then(({ data }) => {
      if (data) {
        setPost(data);
        setText(data.generated_text);
      }
      setLoading(false);
    });
  }, [postId]);

  const savePost = async () => {
    if (!post) return;
    setSaving(true);
    const { error } = await supabase.from('generated_posts').update({
      generated_text: text,
      character_count: text.length,
      word_count: text.trim().split(/\s+/).length,
    }).eq('id', post.id);
    if (error) {
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Saved!', description: 'Your edits have been saved.' });
    }
    setSaving(false);
  };

  const copyText = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Copied!', description: 'Post copied to clipboard.' });
  };

  const downloadText = () => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${post?.platform || 'post'}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRewrite = async (action: string) => {
    if (!post) return;
    setRewriting(true);
    try {
      const { data, error } = await supabase.functions.invoke('rewrite-post', {
        body: { text, action, platform: post.platform },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setText(data.rewritten);
      toast({ title: `Rewritten!`, description: `Applied: ${action}` });
    } catch (err: unknown) {
      toast({ title: 'Rewrite failed', description: err instanceof Error ? err.message : 'Please try again', variant: 'destructive' });
    } finally {
      setRewriting(false);
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

  if (!post) {
    return (
      <AppLayout>
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">Post not found.</p>
          <Button variant="outline" onClick={() => navigate('/library')}>Go to Library</Button>
        </div>
      </AppLayout>
    );
  }

  const config = platformConfig[post.platform];
  const Icon = config.icon;
  const charPct = Math.min((text.length / config.limit) * 100, 100);
  const overLimit = text.length > config.limit;

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-border px-6 py-3 bg-card">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', config.bg)}>
              <Icon className={cn('h-3.5 w-3.5', config.color)} />
            </div>
            <span className="text-sm font-semibold text-foreground">{config.label} Editor</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={copyText} className="text-muted-foreground">
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={downloadText} className="text-muted-foreground">
              <Download className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={savePost} disabled={saving} className="bg-gradient-primary hover:opacity-90">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {/* AI Rewrite toolbar */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Wand2 className="h-4 w-4 text-secondary" />
                <h3 className="text-sm font-semibold text-foreground">AI Rewrite</h3>
                {rewriting && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary ml-auto" />}
              </div>
              <div className="flex flex-wrap gap-2">
                {REWRITE_ACTIONS.map((action) => (
                  <button
                    key={action}
                    onClick={() => handleRewrite(action)}
                    disabled={rewriting}
                    className="rounded-lg border border-border bg-surface-3 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground disabled:opacity-50"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>

            {/* Editor */}
            <div className="rounded-xl border border-border bg-card p-4">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-[400px] bg-transparent border-none font-mono text-sm resize-none focus-visible:ring-0 text-foreground leading-relaxed p-0"
                placeholder="Your post content..."
              />
            </div>

            {/* Character count */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{text.trim().split(/\s+/).filter(Boolean).length} words</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-24 rounded-full bg-surface-4">
                    <div
                      className={cn('h-full rounded-full transition-all', overLimit ? 'bg-destructive' : 'bg-primary')}
                      style={{ width: `${charPct}%` }}
                    />
                  </div>
                  <span className={cn(overLimit && 'text-destructive')}>
                    {text.length.toLocaleString()} / {config.limit.toLocaleString()} chars
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
