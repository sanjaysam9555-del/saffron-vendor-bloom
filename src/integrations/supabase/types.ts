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
      categories: {
        Row: {
          created_at: string
          id: string
          is_base: boolean
          is_deleted: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_base?: boolean
          is_deleted?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_base?: boolean
          is_deleted?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_vendor_status: {
        Row: {
          created_at: string
          id: string
          status: Database["public"]["Enums"]["client_vendor_status_enum"]
          updated_at: string
          user_id: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status: Database["public"]["Enums"]["client_vendor_status_enum"]
          updated_at?: string
          user_id: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["client_vendor_status_enum"]
          updated_at?: string
          user_id?: string
          vendor_id?: string
        }
        Relationships: []
      }
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
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_clients: {
        Row: {
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_clients_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_vendor_quote_files: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          quote_id: string
          size_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          quote_id: string
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          quote_id?: string
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_vendor_quote_files_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "project_vendor_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      project_vendor_quotes: {
        Row: {
          category: string | null
          closed_amount: number | null
          created_at: string
          created_by: string | null
          currency: string
          id: string
          is_final: boolean
          notes: string | null
          project_id: string
          quote_amount: number | null
          quote_text: string | null
          status: Database["public"]["Enums"]["quote_status"]
          updated_at: string
          vendor_id: string
        }
        Insert: {
          category?: string | null
          closed_amount?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          is_final?: boolean
          notes?: string | null
          project_id: string
          quote_amount?: number | null
          quote_text?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
          vendor_id: string
        }
        Update: {
          category?: string | null
          closed_amount?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          is_final?: boolean
          notes?: string | null
          project_id?: string
          quote_amount?: number | null
          quote_text?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_vendor_quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_vendor_quotes_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      project_vendors: {
        Row: {
          created_at: string
          id: string
          project_id: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_vendors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_vendors_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          bride_name: string
          created_at: string
          created_by: string | null
          groom_name: string
          id: string
          notes: string | null
          updated_at: string
          wedding_date: string
        }
        Insert: {
          bride_name: string
          created_at?: string
          created_by?: string | null
          groom_name: string
          id?: string
          notes?: string | null
          updated_at?: string
          wedding_date: string
        }
        Update: {
          bride_name?: string
          created_at?: string
          created_by?: string | null
          groom_name?: string
          id?: string
          notes?: string | null
          updated_at?: string
          wedding_date?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_attachments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
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
          price_text: string | null
          quote_breakdown: string | null
          remarks: string | null
          saffron_rating: number | null
          source: string | null
          subcategory: string | null
          submitted_via_form: boolean
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
          price_text?: string | null
          quote_breakdown?: string | null
          remarks?: string | null
          saffron_rating?: number | null
          source?: string | null
          subcategory?: string | null
          submitted_via_form?: boolean
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
          price_text?: string | null
          quote_breakdown?: string | null
          remarks?: string | null
          saffron_rating?: number | null
          source?: string | null
          subcategory?: string | null
          submitted_via_form?: boolean
          team_size?: string | null
          updated_at?: string
          vendor_name?: string
          website?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      vendor_booked_summary: {
        Row: {
          last_booked_at: string | null
          last_closed_amount: number | null
          last_project_id: string | null
          times_booked: number | null
          vendor_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_vendor_quotes_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      client_can_view_vendor: {
        Args: { _user_id: string; _vendor_id: string }
        Returns: boolean
      }
      has_project_access: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "employee" | "client"
      client_vendor_status_enum:
        | "like"
        | "shortlisted"
        | "finalised"
        | "rejected"
        | "thinking"
      quote_status: "received" | "revised" | "closed" | "withdrawn"
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
    Enums: {
      app_role: ["admin", "employee", "client"],
      client_vendor_status_enum: [
        "like",
        "shortlisted",
        "finalised",
        "rejected",
        "thinking",
      ],
      quote_status: ["received", "revised", "closed", "withdrawn"],
    },
  },
} as const
