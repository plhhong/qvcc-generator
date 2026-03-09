import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import {
  Plus, FileText, Cpu, Layers, TrendingUp, Clock, ArrowRight, Youtube,
  Globe, Upload, Sparkles, Linkedin, Twitter, BookOpen, Video, Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContentSource, GeneratedPost } from '@/integrations/supabase/types';

const platformConfig = {
  linkedin: { icon: Linkedin, color: 'text-platform-linkedin', bg: 'bg-platform-linkedin/10', label: 'LinkedIn' },
  twitter: { icon: Twitter, color: 'text-platform-twitter', bg: 'bg-platform-twitter/10', label: 'X / Twitter' },
  blog: { icon: BookOpen, color: 'text-platform-blog', bg: 'bg-platform-blog/10', label: 'Blog' },
  reels: { icon: Video, color: 'text-platform-reels', bg: 'bg-platform-reels/10', label: 'Reels' },
  newsletter: { icon: Mail, color: 'text-platform-newsletter', bg: 'bg-platform-newsletter/10', label: 'Newsletter' },
};

const sourceTypeConfig = {
  manual: { icon: FileText, label: 'Manual', color: 'text-info' },
  youtube: { icon: Youtube, label: 'YouTube', color: 'text-destructive' },
  website: { icon: Globe, label: 'Website', color: 'text-success' },
  document: { icon: Upload, label: 'Document', color: 'text-warning' },
};

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  draft: { label: 'Draft', color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  analyzing: { label: 'Analyzing', color: 'text-info', dot: 'bg-info' },
  analyzed: { label: 'Analyzed', color: 'text-success', dot: 'bg-success' },
  generating: { label: 'Generating', color: 'text-warning', dot: 'bg-warning' },
  generated: { label: 'Generated', color: 'text-primary', dot: 'bg-primary' },
};

export default function Dashboard() {
  const { user } = useAuth();
  const [sources, setSources] = useState<ContentSource[]>([]);
  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [sourcesRes, postsRes] = await Promise.all([
        supabase.from('content_sources').select('*').order('created_at', { ascending: false }).limit(6),
        supabase.from('generated_posts').select('*').order('created_at', { ascending: false }).limit(5),
      ]);
      if (sourcesRes.data) setSources(sourcesRes.data);
      if (postsRes.data) setPosts(postsRes.data);
      setLoading(false);
    };
    fetchData();
  }, []);

  const totalSources = sources.length;
  const totalPosts = posts.length;
  const platforms = new Set(posts.map((p) => p.platform)).size;

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(' ')[0]}` : ''} 👋
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Here's what's happening in your content workspace.</p>
          </div>
          <Button asChild className="bg-gradient-primary hover:opacity-90 transition-opacity glow-primary w-fit">
            <Link to="/new">
              <Plus className="mr-2 h-4 w-4" />
              New Content
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: 'Content Sources', value: totalSources, icon: FileText, color: 'text-info', bg: 'bg-info/10' },
            { label: 'Posts Generated', value: totalPosts, icon: Cpu, color: 'text-primary', bg: 'bg-primary/10' },
            { label: 'Platforms Used', value: platforms, icon: Layers, color: 'text-secondary', bg: 'bg-secondary/10' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
              <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', bg)}>
                <Icon className={cn('h-5 w-5', color)} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{loading ? '—' : value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Recent Projects */}
          <div className="lg:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Recent Projects</h2>
              <Link to="/library" className="text-xs text-primary hover:underline flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : sources.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <p className="font-medium text-foreground">No content yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Import your first piece of content to get started</p>
                <Button asChild className="mt-4 bg-gradient-primary hover:opacity-90">
                  <Link to="/new"><Plus className="mr-2 h-4 w-4" />Start now</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {sources.map((source) => {
                  const type = sourceTypeConfig[source.source_type];
                  const status = statusConfig[source.status];
                  const Icon = type.icon;
                  return (
                    <Link
                      key={source.id}
                      to={source.status === 'analyzed' || source.status === 'generating' || source.status === 'generated'
                        ? `/generate/${source.id}`
                        : `/analyze/${source.id}`}
                      className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:bg-surface-3 transition-all group"
                    >
                      <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg bg-surface-3 shrink-0')}>
                        <Icon className={cn('h-4 w-4', type.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{source.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{type.label}</span>
                          {source.word_count && (
                            <span className="text-xs text-muted-foreground">· {source.word_count.toLocaleString()} words</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn('flex items-center gap-1.5 text-xs font-medium', status.color)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
                          {status.label}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick actions */}
            <div>
              <h2 className="mb-3 text-base font-semibold text-foreground">Quick Import</h2>
              <div className="space-y-2">
                {[
                  { icon: FileText, label: 'Paste text', desc: 'Manual input', tab: 'manual' },
                  { icon: Youtube, label: 'YouTube URL', desc: 'Auto transcript', tab: 'youtube' },
                  { icon: Globe, label: 'Website URL', desc: 'Smart scrape', tab: 'website' },
                  { icon: Upload, label: 'Upload doc', desc: 'PDF, DOCX, TXT', tab: 'document' },
                ].map(({ icon: Icon, label, desc, tab }) => (
                  <Link
                    key={tab}
                    to={`/new?tab=${tab}`}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:border-primary/40 hover:bg-surface-3 transition-all"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-3 shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Recent posts */}
            {posts.length > 0 && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-foreground">Recent Posts</h2>
                </div>
                <div className="space-y-2">
                  {posts.map((post) => {
                    const config = platformConfig[post.platform];
                    const Icon = config.icon;
                    return (
                      <Link
                        key={post.id}
                        to={`/editor/${post.id}`}
                        className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 hover:border-primary/40 hover:bg-surface-3 transition-all"
                      >
                        <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg shrink-0 mt-0.5', config.bg)}>
                          <Icon className={cn('h-3.5 w-3.5', config.color)} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground mb-0.5">{config.label}</p>
                          <p className="text-sm text-foreground line-clamp-2">{post.generated_text.slice(0, 80)}…</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
