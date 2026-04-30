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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      inbound_leads: {
        Row: {
          contact: string | null
          email: string | null
          id: string
          instagram: string | null
          location: string | null
          name: string
          portfolio: string | null
          services: string | null
          status: string
          submitted_at: string
        }
        Insert: {
          contact?: string | null
          email?: string | null
          id?: string
          instagram?: string | null
          location?: string | null
          name: string
          portfolio?: string | null
          services?: string | null
          status?: string
          submitted_at?: string
        }
        Update: {
          contact?: string | null
          email?: string | null
          id?: string
          instagram?: string | null
          location?: string | null
          name?: string
          portfolio?: string | null
          services?: string | null
          status?: string
          submitted_at?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          category: string
          commission_model: string | null
          contact_number: string | null
          date_added: string
          deliverables: string | null
          distance_from_delhi: string | null
          email: string | null
          google_rating: number | null
          hotel_category: string | null
          id: string
          instagram_handle: string | null
          location: string | null
          number_of_rooms: number | null
          portfolio_link: string | null
          price_range_high: number | null
          price_range_low: number | null
          quote_breakdown: string | null
          remarks: string | null
          source: string | null
          subcategory: string | null
          tags: string[] | null
          team_size: string | null
          updated_at: string
          vendor_name: string
          website: string | null
        }
        Insert: {
          category: string
          commission_model?: string | null
          contact_number?: string | null
          date_added?: string
          deliverables?: string | null
          distance_from_delhi?: string | null
          email?: string | null
          google_rating?: number | null
          hotel_category?: string | null
          id?: string
          instagram_handle?: string | null
          location?: string | null
          number_of_rooms?: number | null
          portfolio_link?: string | null
          price_range_high?: number | null
          price_range_low?: number | null
          quote_breakdown?: string | null
          remarks?: string | null
          source?: string | null
          subcategory?: string | null
          tags?: string[] | null
          team_size?: string | null
          updated_at?: string
          vendor_name: string
          website?: string | null
        }
        Update: {
          category?: string
          commission_model?: string | null
          contact_number?: string | null
          date_added?: string
          deliverables?: string | null
          distance_from_delhi?: string | null
          email?: string | null
          google_rating?: number | null
          hotel_category?: string | null
          id?: string
          instagram_handle?: string | null
          location?: string | null
          number_of_rooms?: number | null
          portfolio_link?: string | null
          price_range_high?: number | null
          price_range_low?: number | null
          quote_breakdown?: string | null
          remarks?: string | null
          source?: string | null
          subcategory?: string | null
          tags?: string[] | null
          team_size?: string | null
          updated_at?: string
          vendor_name?: string
          website?: string | null
        }
        Relationships: []
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
