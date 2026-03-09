import type { Database } from './types';

export type ContentSource = Database['public']['Tables']['content_sources']['Row'];
export type ContentSignal = Database['public']['Tables']['content_signals']['Row'];
export type BrandVoiceProfile = Database['public']['Tables']['brand_voice_profiles']['Row'];
export type GeneratedPost = Database['public']['Tables']['generated_posts']['Row'];
export type PostVariant = Database['public']['Tables']['post_variants']['Row'];

export type ContentSourceInsert = Database['public']['Tables']['content_sources']['Insert'];
export type ContentSignalInsert = Database['public']['Tables']['content_signals']['Insert'];
export type GeneratedPostInsert = Database['public']['Tables']['generated_posts']['Insert'];
export type BrandVoiceProfileInsert = Database['public']['Tables']['brand_voice_profiles']['Insert'];
