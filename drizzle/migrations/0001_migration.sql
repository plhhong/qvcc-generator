WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY updated_at DESC NULLS LAST, created_at DESC) rn
  FROM public.brand_voice_profiles WHERE is_default
)
UPDATE public.brand_voice_profiles b SET is_default = false FROM ranked r WHERE b.id = r.id AND r.rn > 1;
CREATE UNIQUE INDEX IF NOT EXISTS brand_voice_one_default_per_user ON public.brand_voice_profiles (user_id) WHERE is_default;