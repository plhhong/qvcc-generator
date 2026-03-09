
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ─── content_sources ────────────────────────────────────────────
CREATE TABLE public.content_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  source_type TEXT NOT NULL CHECK (source_type IN ('manual', 'youtube', 'website', 'document')),
  source_url TEXT,
  raw_text TEXT,
  file_path TEXT,
  word_count INTEGER,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'analyzing', 'analyzed', 'generating', 'generated')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.content_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own content sources" ON public.content_sources FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own content sources" ON public.content_sources FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own content sources" ON public.content_sources FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own content sources" ON public.content_sources FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_content_sources_updated_at BEFORE UPDATE ON public.content_sources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── content_signals ────────────────────────────────────────────
CREATE TABLE public.content_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id UUID NOT NULL REFERENCES public.content_sources(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  themes TEXT[] DEFAULT '{}',
  key_quotes TEXT[] DEFAULT '{}',
  key_insights TEXT[] DEFAULT '{}',
  audience_type TEXT,
  tone TEXT,
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.content_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own content signals" ON public.content_signals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own content signals" ON public.content_signals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own content signals" ON public.content_signals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own content signals" ON public.content_signals FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_content_signals_updated_at BEFORE UPDATE ON public.content_signals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── brand_voice_profiles ───────────────────────────────────────
CREATE TABLE public.brand_voice_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'professional',
  audience TEXT,
  style_notes TEXT,
  vocabulary TEXT[] DEFAULT '{}',
  content_goals TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.brand_voice_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own brand voice profiles" ON public.brand_voice_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own brand voice profiles" ON public.brand_voice_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own brand voice profiles" ON public.brand_voice_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own brand voice profiles" ON public.brand_voice_profiles FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_brand_voice_profiles_updated_at BEFORE UPDATE ON public.brand_voice_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── generated_posts ────────────────────────────────────────────
CREATE TABLE public.generated_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id UUID NOT NULL REFERENCES public.content_sources(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'twitter', 'blog', 'reels', 'newsletter')),
  prompt_used TEXT,
  brand_voice_id UUID REFERENCES public.brand_voice_profiles(id) ON DELETE SET NULL,
  generated_text TEXT NOT NULL,
  tone TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  character_count INTEGER,
  word_count INTEGER,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.generated_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own generated posts" ON public.generated_posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own generated posts" ON public.generated_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own generated posts" ON public.generated_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own generated posts" ON public.generated_posts FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_generated_posts_updated_at BEFORE UPDATE ON public.generated_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── post_variants ──────────────────────────────────────────────
CREATE TABLE public.post_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.generated_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  variant_label TEXT NOT NULL CHECK (variant_label IN ('A', 'B', 'C')),
  generated_text TEXT NOT NULL,
  tone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.post_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own post variants" ON public.post_variants FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own post variants" ON public.post_variants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own post variants" ON public.post_variants FOR DELETE USING (auth.uid() = user_id);

-- ─── storage bucket for documents ───────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);
CREATE POLICY "Users can upload their own documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view their own documents" ON storage.objects FOR SELECT USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own documents" ON storage.objects FOR DELETE USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
