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
  SlidersHorizontal, Copy, Check, Library as LibraryIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GeneratedPost } from '@/integrations/supabase/helpers';
import { format } from 'date-fns';

const platformConfig = {
  linkedin: { icon: Linkedin, color: 'text-platform-linkedin', bg: 'bg-platform-linkedin/10', label: 'LinkedIn' },
  twitter: { icon: Twitter, color: 'text-platform-twitter', bg: 'bg-platform-twitter/10', label: 'X Thread' },
  blog: { icon: BookOpen, color: 'text-platform-blog', bg: 'bg-platform-blog/10', label: 'Blog Post' },
  reels: { icon: Video, color: 'text-platform-reels', bg: 'bg-platform-reels/10', label: 'Reels Script' },
  newsletter: { icon: Mail, color: 'text-platform-newsletter', bg: 'bg-platform-newsletter/10', label: 'Newsletter' },
};

const PLATFORM_FILTERS = ['all', 'linkedin', 'twitter', 'blog', 'reels', 'newsletter'] as const;

export default function LibraryPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<typeof PLATFORM_FILTERS[number]>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    const { data } = await supabase.from('generated_posts').select('*').order('created_at', { ascending: false });
    if (data) setPosts(data);
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

  const filtered = posts.filter((p) => {
    const matchPlatform = platformFilter === 'all' || p.platform === platformFilter;
    const matchSearch = search === '' || p.generated_text.toLowerCase().includes(search.toLowerCase());
    return matchPlatform && matchSearch;
  });

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Content Library</h1>
            <p className="mt-1 text-sm text-muted-foreground">{posts.length} posts generated</p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search posts..."
              className="pl-10 bg-surface-3 border-border"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-surface-3 rounded-lg p-1">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground ml-2" />
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
            <LibraryIcon className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium text-foreground">No posts found</p>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((post) => {
              const config = platformConfig[post.platform];
              const Icon = config.icon;
              return (
                <div
                  key={post.id}
                  className="group rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-all flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', config.bg)}>
                        <Icon className={cn('h-3.5 w-3.5', config.color)} />
                      </div>
                      <span className="text-xs font-semibold text-foreground">{config.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{format(new Date(post.created_at), 'MMM d')}</span>
                  </div>

                  <p className="flex-1 text-sm text-muted-foreground line-clamp-4 leading-relaxed">
                    {post.generated_text}
                  </p>

                  <div className="flex items-center justify-between border-t border-border pt-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {post.tone && <Badge variant="secondary" className="text-xs py-0 px-1.5">{post.tone}</Badge>}
                      <span>{post.word_count} words</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => copyPost(post)}
                      >
                        {copiedId === post.id ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => navigate(`/editor/${post.id}`)}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deletePost(post.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
