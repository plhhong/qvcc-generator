export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      brand_voice_profiles: {
        Row: {
          audience: string | null
          content_goals: string | null
          created_at: string
          id: string
          is_default: boolean
          name: string
          style_notes: string | null
          tone: string
          updated_at: string
          user_id: string
          vocabulary: string[] | null
        }
        Insert: {
          audience?: string | null
          content_goals?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          style_notes?: string | null
          tone?: string
          updated_at?: string
          user_id: string
          vocabulary?: string[] | null
        }
        Update: {
          audience?: string | null
          content_goals?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          style_notes?: string | null
          tone?: string
          updated_at?: string
          user_id?: string
          vocabulary?: string[] | null
        }
        Relationships: []
      }
      content_signals: {
        Row: {
          audience_type: string | null
          content_id: string
          created_at: string
          id: string
          key_insights: string[] | null
          key_quotes: string[] | null
          summary: string | null
          themes: string[] | null
          tone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          audience_type?: string | null
          content_id: string
          created_at?: string
          id?: string
          key_insights?: string[] | null
          key_quotes?: string[] | null
          summary?: string | null
          themes?: string[] | null
          tone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          audience_type?: string | null
          content_id?: string
          created_at?: string
          id?: string
          key_insights?: string[] | null
          key_quotes?: string[] | null
          summary?: string | null
          themes?: string[] | null
          tone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_signals_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: true
            referencedRelation: "content_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      content_sources: {
        Row: {
          created_at: string
          file_path: string | null
          id: string
          raw_text: string | null
          source_type: string
          source_url: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          word_count: number | null
        }
        Insert: {
          created_at?: string
          file_path?: string | null
          id?: string
          raw_text?: string | null
          source_type: string
          source_url?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id: string
          word_count?: number | null
        }
        Update: {
          created_at?: string
          file_path?: string | null
          id?: string
          raw_text?: string | null
          source_type?: string
          source_url?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          word_count?: number | null
        }
        Relationships: []
      }
      generated_posts: {
        Row: {
          brand_voice_id: string | null
          character_count: number | null
          content_id: string
          created_at: string
          generated_text: string
          id: string
          is_favorite: boolean
          platform: string
          prompt_used: string | null
          tags: string[] | null
          tone: string | null
          updated_at: string
          user_id: string
          version: number
          word_count: number | null
        }
        Insert: {
          brand_voice_id?: string | null
          character_count?: number | null
          content_id: string
          created_at?: string
          generated_text: string
          id?: string
          is_favorite?: boolean
          platform: string
          prompt_used?: string | null
          tags?: string[] | null
          tone?: string | null
          updated_at?: string
          user_id: string
          version?: number
          word_count?: number | null
        }
        Update: {
          brand_voice_id?: string | null
          character_count?: number | null
          content_id?: string
          created_at?: string
          generated_text?: string
          id?: string
          is_favorite?: boolean
          platform?: string
          prompt_used?: string | null
          tags?: string[] | null
          tone?: string | null
          updated_at?: string
          user_id?: string
          version?: number
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_posts_brand_voice_id_fkey"
            columns: ["brand_voice_id"]
            isOneToOne: false
            referencedRelation: "brand_voice_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_posts_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      post_variants: {
        Row: {
          created_at: string
          generated_text: string
          id: string
          post_id: string
          tone: string | null
          user_id: string
          variant_label: string
        }
        Insert: {
          created_at?: string
          generated_text: string
          id?: string
          post_id: string
          tone?: string | null
          user_id: string
          variant_label: string
        }
        Update: {
          created_at?: string
          generated_text?: string
          id?: string
          post_id?: string
          tone?: string | null
          user_id?: string
          variant_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_variants_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "generated_posts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
