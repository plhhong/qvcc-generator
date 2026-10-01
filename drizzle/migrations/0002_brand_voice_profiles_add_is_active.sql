ALTER TABLE public.brand_voice_profiles ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.brand_voice_profiles.is_active IS 'Disabled profiles are excluded from default selection and post generation';