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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      cloud_saves: {
        Row: {
          data: Json
          saved_at: number
          updated_at: string
          user_id: string
        }
        Insert: {
          data?: Json
          saved_at?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          data?: Json
          saved_at?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      combat_ai_status: {
        Row: {
          id: string
          paused: boolean
          reason: string
          status: number
          updated_at: string
        }
        Insert: {
          id: string
          paused?: boolean
          reason?: string
          status?: number
          updated_at?: string
        }
        Update: {
          id?: string
          paused?: boolean
          reason?: string
          status?: number
          updated_at?: string
        }
        Relationships: []
      }
      comment_reports: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          reason: string
          reporter_id: string
          status: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          reason?: string
          reporter_id: string
          status?: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_name: string
          body: string
          created_at: string
          id: string
          target: string
          user_id: string
        }
        Insert: {
          author_name: string
          body: string
          created_at?: string
          id?: string
          target: string
          user_id: string
        }
        Update: {
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          target?: string
          user_id?: string
        }
        Relationships: []
      }
      live_runs: {
        Row: {
          armor: string
          class_name: string
          difficulty: string
          floor: number
          kills: number
          level: number
          log: Json
          melee: string
          player_name: string
          ranged: string
          region: string
          run_key: string
          score: number
          seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          armor?: string
          class_name?: string
          difficulty?: string
          floor?: number
          kills?: number
          level?: number
          log?: Json
          melee?: string
          player_name: string
          ranged?: string
          region?: string
          run_key: string
          score?: number
          seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          armor?: string
          class_name?: string
          difficulty?: string
          floor?: number
          kills?: number
          level?: number
          log?: Json
          melee?: string
          player_name?: string
          ranged?: string
          region?: string
          run_key?: string
          score?: number
          seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mp_matches: {
        Row: {
          created_at: string
          difficulty: string
          ended_at: string
          floors: number
          id: string
          mode: string
          outcome: string
          players: number
          room_code: string
          started_at: string | null
        }
        Insert: {
          created_at?: string
          difficulty?: string
          ended_at?: string
          floors?: number
          id: string
          mode: string
          outcome: string
          players?: number
          room_code: string
          started_at?: string | null
        }
        Update: {
          created_at?: string
          difficulty?: string
          ended_at?: string
          floors?: number
          id?: string
          mode?: string
          outcome?: string
          players?: number
          room_code?: string
          started_at?: string | null
        }
        Relationships: []
      }
      mp_profiles: {
        Row: {
          best_score: number
          betrayals: number
          defeats: number
          gold: number
          healing: number
          kills: number
          matches: number
          name: string
          podiums: number
          pvp_kills: number
          revives: number
          total_score: number
          updated_at: string
          user_id: string
          victories: number
          wins: number
        }
        Insert: {
          best_score?: number
          betrayals?: number
          defeats?: number
          gold?: number
          healing?: number
          kills?: number
          matches?: number
          name?: string
          podiums?: number
          pvp_kills?: number
          revives?: number
          total_score?: number
          updated_at?: string
          user_id: string
          victories?: number
          wins?: number
        }
        Update: {
          best_score?: number
          betrayals?: number
          defeats?: number
          gold?: number
          healing?: number
          kills?: number
          matches?: number
          name?: string
          podiums?: number
          pvp_kills?: number
          revives?: number
          total_score?: number
          updated_at?: string
          user_id?: string
          victories?: number
          wins?: number
        }
        Relationships: []
      }
      mp_results: {
        Row: {
          class_id: string
          created_at: string
          gold: number
          id: string
          match_id: string
          name: string
          outcome: string
          place: number
          role: string
          role2: string
          score: number
          stats: Json
          title: string
          title_meaning: string
          user_id: string | null
        }
        Insert: {
          class_id?: string
          created_at?: string
          gold?: number
          id?: string
          match_id: string
          name: string
          outcome?: string
          place: number
          role?: string
          role2?: string
          score?: number
          stats?: Json
          title?: string
          title_meaning?: string
          user_id?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          gold?: number
          id?: string
          match_id?: string
          name?: string
          outcome?: string
          place?: number
          role?: string
          role2?: string
          score?: number
          stats?: Json
          title?: string
          title_meaning?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mp_results_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "mp_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      mp_vault: {
        Row: {
          claimed_at: string | null
          claimed_match: string | null
          created_at: string
          id: string
          item: Json
          match_id: string | null
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_match?: string | null
          created_at?: string
          id?: string
          item: Json
          match_id?: string | null
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          claimed_match?: string | null
          created_at?: string
          id?: string
          item?: Json
          match_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mp_vault_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "mp_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          discord: string
          discord_hidden: boolean
          display_name: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          discord?: string
          discord_hidden?: boolean
          display_name?: string
          id: string
          title?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          discord?: string
          discord_hidden?: boolean
          display_name?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      runs: {
        Row: {
          armor: string
          cause: string
          class_name: string
          created_at: string
          difficulty: string
          floor: number
          id: string
          kills: number
          level: number
          melee: string
          outcome: string
          player_name: string
          ranged: string
          run_key: string
          score: number
          seconds: number
          subclass: string
          title: string
          user_id: string
        }
        Insert: {
          armor?: string
          cause?: string
          class_name: string
          created_at?: string
          difficulty?: string
          floor: number
          id?: string
          kills?: number
          level: number
          melee?: string
          outcome: string
          player_name: string
          ranged?: string
          run_key: string
          score: number
          seconds?: number
          subclass?: string
          title?: string
          user_id: string
        }
        Update: {
          armor?: string
          cause?: string
          class_name?: string
          created_at?: string
          difficulty?: string
          floor?: number
          id?: string
          kills?: number
          level?: number
          melee?: string
          outcome?: string
          player_name?: string
          ranged?: string
          run_key?: string
          score?: number
          seconds?: number
          subclass?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weapon_finds: {
        Row: {
          acc: number
          affixes: string[]
          crit: number
          dmg_mult: number
          first_finder: string
          first_found_at: string
          last_found_at: string
          name: string
          ranged: boolean
          rarity: number
          times_found: number
          weapon_type: string
        }
        Insert: {
          acc?: number
          affixes?: string[]
          crit?: number
          dmg_mult?: number
          first_finder?: string
          first_found_at?: string
          last_found_at?: string
          name: string
          ranged?: boolean
          rarity?: number
          times_found?: number
          weapon_type: string
        }
        Update: {
          acc?: number
          affixes?: string[]
          crit?: number
          dmg_mult?: number
          first_finder?: string
          first_found_at?: string
          last_found_at?: string
          name?: string
          ranged?: boolean
          rarity?: number
          times_found?: number
          weapon_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      floor_averages: {
        Args: never
        Returns: {
          avg_kills: number
          avg_score: number
          avg_seconds: number
          deaths: number
          floor: number
          players: number
          runs: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mp_claim_vault: {
        Args: { _id: string; _match: string; _user: string }
        Returns: Json
      }
      mp_record_match: { Args: { payload: Json }; Returns: boolean }
      my_discord: {
        Args: never
        Returns: {
          discord: string
          discord_hidden: boolean
        }[]
      }
      public_discords: {
        Args: { _ids: string[] }
        Returns: {
          discord: string
          id: string
        }[]
      }
      record_weapon_find: {
        Args: {
          _acc: number
          _affixes: string[]
          _crit: number
          _dmg: number
          _finder: string
          _name: string
          _ranged: boolean
          _rarity: number
          _type: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
