import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Edit2, Trash2, Check, X, Star, Mic2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BrandVoiceProfile } from '@/integrations/supabase/helpers';

const TONES = ['professional', 'conversational', 'bold', 'educational', 'casual', 'inspirational'];

export default function BrandVoicePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [profiles, setProfiles] = useState<BrandVoiceProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BrandVoiceProfile | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [tone, setTone] = useState('professional');
  const [audience, setAudience] = useState('');
  const [styleNotes, setStyleNotes] = useState('');
  const [vocabInput, setVocabInput] = useState('');
  const [vocabulary, setVocabulary] = useState<string[]>([]);
  const [contentGoals, setContentGoals] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    const { data } = await supabase.from('brand_voice_profiles').select('*').order('is_default', { ascending: false });
    if (data) setProfiles(data);
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setName('');
    setTone('professional');
    setAudience('');
    setStyleNotes('');
    setVocabInput('');
    setVocabulary([]);
    setContentGoals('');
    setDialogOpen(true);
  };

  const openEdit = (profile: BrandVoiceProfile) => {
    setEditing(profile);
    setName(profile.name);
    setTone(profile.tone);
    setAudience(profile.audience || '');
    setStyleNotes(profile.style_notes || '');
    setVocabulary(profile.vocabulary || []);
    setContentGoals(profile.content_goals || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = { name, tone, audience, style_notes: styleNotes, vocabulary, content_goals: contentGoals, user_id: user!.id };
      if (editing) {
        await supabase.from('brand_voice_profiles').update(payload).eq('id', editing.id);
      } else {
        await supabase.from('brand_voice_profiles').insert(payload);
      }
      toast({ title: editing ? 'Profile updated!' : 'Profile created!' });
      setDialogOpen(false);
      fetchProfiles();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteProfile = async (id: string) => {
    await supabase.from('brand_voice_profiles').delete().eq('id', id);
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    toast({ title: 'Profile deleted' });
  };

  const setDefault = async (id: string) => {
    await supabase.from('brand_voice_profiles').update({ is_default: false }).neq('id', 'none');
    await supabase.from('brand_voice_profiles').update({ is_default: true }).eq('id', id);
    fetchProfiles();
  };

  const addVocab = () => {
    if (vocabInput.trim()) {
      setVocabulary([...vocabulary, vocabInput.trim()]);
      setVocabInput('');
    }
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Brand Voice</h1>
            <p className="mt-1 text-sm text-muted-foreground">Define your writing style and voice profiles.</p>
          </div>
          <Button onClick={openCreate} className="bg-gradient-primary hover:opacity-90 glow-primary">
            <Plus className="mr-2 h-4 w-4" /> New Profile
          </Button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10">
              <Mic2 className="h-6 w-6 text-secondary" />
            </div>
            <p className="font-medium text-foreground">No voice profiles yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Create a profile to give your content a consistent voice</p>
            <Button onClick={openCreate} className="mt-4 bg-gradient-primary hover:opacity-90">
              <Plus className="mr-2 h-4 w-4" /> Create Profile
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {profiles.map((profile) => (
              <div key={profile.id} className={cn(
                'rounded-xl border bg-card p-5 space-y-3 relative transition-all',
                profile.is_default ? 'border-primary/40' : 'border-border hover:border-primary/20'
              )}>
                {profile.is_default && (
                  <div className="absolute top-3 right-3">
                    <Badge className="bg-primary/15 text-primary border-primary/30 text-xs">Default</Badge>
                  </div>
                )}
                <div className="flex items-start gap-3 pr-16">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/10 shrink-0">
                    <Mic2 className="h-4 w-4 text-secondary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{profile.name}</h3>
                    <Badge variant="secondary" className="mt-1 text-xs capitalize">{profile.tone}</Badge>
                  </div>
                </div>

                {profile.audience && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Audience</p>
                    <p className="text-sm text-foreground">{profile.audience}</p>
                  </div>
                )}
                {profile.style_notes && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Style</p>
                    <p className="text-sm text-foreground line-clamp-2">{profile.style_notes}</p>
                  </div>
                )}
                {profile.vocabulary && profile.vocabulary.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {profile.vocabulary.slice(0, 5).map((v, i) => (
                      <Badge key={i} variant="secondary" className="text-xs py-0">{v}</Badge>
                    ))}
                    {profile.vocabulary.length > 5 && (
                      <Badge variant="secondary" className="text-xs py-0">+{profile.vocabulary.length - 5}</Badge>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1 border-t border-border">
                  {!profile.is_default && (
                    <Button variant="ghost" size="sm" onClick={() => setDefault(profile.id)} className="h-7 text-xs text-muted-foreground hover:text-foreground">
                      <Star className="mr-1 h-3 w-3" /> Set default
                    </Button>
                  )}
                  <div className="ml-auto flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEdit(profile)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteProfile(profile.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg bg-card border-border">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Profile' : 'Create Brand Voice Profile'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Profile Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Personal Brand" className="bg-surface-3 border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tone</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger className="bg-surface-3 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {TONES.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Target Audience</Label>
                <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. Startup founders, SaaS marketers" className="bg-surface-3 border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Writing Style Notes</Label>
                <Textarea value={styleNotes} onChange={(e) => setStyleNotes(e.target.value)} placeholder="e.g. Short paragraphs, punchy insights, no jargon..." className="bg-surface-3 border-border resize-none min-h-[80px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Key Vocabulary</Label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {vocabulary.map((v, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 pr-1">
                      {v}
                      <button onClick={() => setVocabulary(vocabulary.filter((_, j) => j !== i))}><X className="h-2.5 w-2.5" /></button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={vocabInput} onChange={(e) => setVocabInput(e.target.value)} placeholder="Add keyword..." className="bg-surface-3 border-border text-sm" onKeyDown={(e) => e.key === 'Enter' && addVocab()} />
                  <Button size="sm" variant="outline" onClick={addVocab} className="border-border"><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Content Goals</Label>
                <Input value={contentGoals} onChange={(e) => setContentGoals(e.target.value)} placeholder="e.g. Build thought leadership, drive newsletter signups" className="bg-surface-3 border-border" />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1 border-border">Cancel</Button>
                <Button onClick={handleSave} disabled={saving} className="flex-1 bg-gradient-primary hover:opacity-90">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Check className="mr-2 h-4 w-4" />{editing ? 'Update' : 'Create'}</>)}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
