import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Search, Linkedin, Twitter, BookOpen, Video, Mail, Trash2, ExternalLink,
  Copy, Check, Library as LibraryIcon, FileText, Youtube, Globe, Upload,
  ChevronDown, ChevronRight, Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GeneratedPost, ContentSource } from '@/integrations/supabase/helpers';
import { format } from 'date-fns';

const platformConfig: Record<string, { icon: React.ComponentType<{ className?: string }>, color: string, bg: string, label: string }> = {
  linkedin: { icon: Linkedin, color: 'text-platform-linkedin', bg: 'bg-platform-linkedin/10', label: 'LinkedIn' },
  twitter: { icon: Twitter, color: 'text-platform-twitter', bg: 'bg-platform-twitter/10', label: 'X Thread' },
  blog: { icon: BookOpen, color: 'text-platform-blog', bg: 'bg-platform-blog/10', label: 'Blog Post' },
  reels: { icon: Video, color: 'text-platform-reels', bg: 'bg-platform-reels/10', label: 'Reels Script' },
  newsletter: { icon: Mail, color: 'text-platform-newsletter', bg: 'bg-platform-newsletter/10', label: 'Newsletter' },
};

const sourceTypeConfig: Record<string, { icon: React.ComponentType<{ className?: string }>, label: string, color: string }> = {
  manual: { icon: FileText, label: 'Manual', color: 'text-info' },
  youtube: { icon: Youtube, label: 'YouTube', color: 'text-destructive' },
  website: { icon: Globe, label: 'Website', color: 'text-success' },
  document: { icon: Upload, label: 'Document', color: 'text-warning' },
};

const PLATFORM_FILTERS = ['all', 'linkedin', 'twitter', 'blog', 'reels', 'newsletter'] as const;

interface ProjectGroup {
  source: ContentSource;
  posts: GeneratedPost[];
}

export default function LibraryPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sources, setSources] = useState<ContentSource[]>([]);
  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<typeof PLATFORM_FILTERS[number]>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [sourcesRes, postsRes] = await Promise.all([
      supabase.from('content_sources').select('*').order('created_at', { ascending: false }),
      supabase.from('generated_posts').select('*').order('created_at', { ascending: false }),
    ]);
    if (sourcesRes.data) setSources(sourcesRes.data);
    if (postsRes.data) setPosts(postsRes.data);
    setLoading(false);
  };

  const deletePost = async (id: string) => {
    await supabase.from('generated_posts').delete().eq('id', id);
    setPosts((prev) => prev.filter((p) => p.id !== id));
    toast({ title: 'Deleted', description: 'Post removed from library.' });
  };

  const copyPost = async (post: GeneratedPost) => {
    await navigator.clipboard.writeText(post.generated_text);
    setCopiedId(post.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'Copied!' });
  };

  const toggleCollapse = (sourceId: string) => {
    setCollapsed((prev) => ({ ...prev, [sourceId]: !prev[sourceId] }));
  };

  // Build grouped structure
  const groups: ProjectGroup[] = sources
    .map((source) => {
      const sourcePosts = posts.filter((p) => {
        const matchContent = p.content_id === source.id;
        const matchPlatform = platformFilter === 'all' || p.platform === platformFilter;
        const matchSearch =
          search === '' ||
          p.generated_text.toLowerCase().includes(search.toLowerCase()) ||
          source.title.toLowerCase().includes(search.toLowerCase());
        return matchContent && matchPlatform && matchSearch;
      });
      return { source, posts: sourcePosts };
    })
    .filter((g) => {
      // If there's a search/filter, only show groups with matching posts or title match
      if (search || platformFilter !== 'all') {
        return (
          g.posts.length > 0 ||
          (search && g.source.title.toLowerCase().includes(search.toLowerCase()))
        );
      }
      return true;
    });

  const totalPosts = posts.length;

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Content Library</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {sources.length} projects · {totalPosts} posts generated
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects or posts..."
              className="pl-10 bg-surface-3 border-border"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-surface-3 rounded-lg p-1">
            <Layers className="h-4 w-4 text-muted-foreground ml-2" />
            {PLATFORM_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setPlatformFilter(f)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-all capitalize',
                  platformFilter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
                <div className="h-5 w-48 rounded bg-muted animate-pulse" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-36 rounded-xl bg-muted animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
            <LibraryIcon className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium text-foreground">No content found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {search || platformFilter !== 'all' ? 'Try adjusting your filters' : 'Generate your first content to see it here'}
            </p>
            {!search && platformFilter === 'all' && (
              <Button asChild className="mt-4 bg-gradient-primary hover:opacity-90">
                <Link to="/new">Start Creating</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map(({ source, posts: groupPosts }) => {
              const typeConfig = sourceTypeConfig[source.source_type] ?? sourceTypeConfig.manual;
              const TypeIcon = typeConfig.icon;
              const isCollapsed = collapsed[source.id];
              const projectLink = source.status === 'analyzed' || source.status === 'generating' || source.status === 'generated'
                ? `/generate/${source.id}`
                : `/analyze/${source.id}`;

              return (
                <div key={source.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  {/* Project header */}
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-surface-3/50">
                    <button
                      onClick={() => toggleCollapse(source.id)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left group"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-card border border-border shrink-0">
                        <TypeIcon className={cn('h-4 w-4', typeConfig.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                          {source.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{typeConfig.label}</span>
                          {source.word_count && (
                            <span className="text-xs text-muted-foreground">· {source.word_count.toLocaleString()} words</span>
                          )}
                          <span className="text-xs text-muted-foreground">· {groupPosts.length} posts</span>
                          <span className="text-xs text-muted-foreground">· {format(new Date(source.created_at), 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </button>
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Link to={projectLink}>
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                        Open Project
                      </Link>
                    </Button>
                  </div>

                  {/* Posts grid */}
                  {!isCollapsed && (
                    <div className="p-4">
                      {groupPosts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <p className="text-sm text-muted-foreground">No posts generated yet for this project.</p>
                          <Button asChild size="sm" variant="outline" className="mt-3">
                            <Link to={projectLink}>Generate Content</Link>
                          </Button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {groupPosts.map((post) => {
                            const config = platformConfig[post.platform] ?? platformConfig.blog;
                            const Icon = config.icon;
                            return (
                              <div
                                key={post.id}
                                className="group rounded-lg border border-border bg-background p-4 hover:border-primary/30 transition-all flex flex-col gap-3"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className={cn('flex h-6 w-6 items-center justify-center rounded-md', config.bg)}>
                                      <Icon className={cn('h-3 w-3', config.color)} />
                                    </div>
                                    <span className="text-xs font-semibold text-foreground">{config.label}</span>
                                  </div>
                                  <span className="text-xs text-muted-foreground">{format(new Date(post.created_at), 'MMM d')}</span>
                                </div>

                                <p className="flex-1 text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                                  {post.generated_text}
                                </p>

                                <div className="flex items-center justify-between border-t border-border pt-2.5">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    {post.tone && <Badge variant="secondary" className="text-xs py-0 px-1.5">{post.tone}</Badge>}
                                    <span>{post.word_count} words</span>
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                      onClick={() => copyPost(post)}
                                    >
                                      {copiedId === post.id ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                      onClick={() => navigate(`/editor/${post.id}`)}
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                      onClick={() => deletePost(post.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
