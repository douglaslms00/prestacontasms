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
      advance_topups: {
        Row: {
          advance_id: string
          amount: number
          created_at: string
          created_by: string | null
          id: string
          issued_at: string
          note: string | null
        }
        Insert: {
          advance_id: string
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          issued_at?: string
          note?: string | null
        }
        Update: {
          advance_id?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          issued_at?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advance_topups_advance_id_fkey"
            columns: ["advance_id"]
            isOneToOne: false
            referencedRelation: "advances"
            referencedColumns: ["id"]
          },
        ]
      }
      advances: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          decision: string | null
          description: string | null
          employee_id: string
          id: string
          issued_at: string
          obra_id: string | null
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["advance_status"]
          submitted_at: string | null
          title: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          decision?: string | null
          description?: string | null
          employee_id: string
          id?: string
          issued_at?: string
          obra_id?: string | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["advance_status"]
          submitted_at?: string | null
          title: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          decision?: string | null
          description?: string | null
          employee_id?: string
          id?: string
          issued_at?: string
          obra_id?: string | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["advance_status"]
          submitted_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "advances_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      cargo_permissions: {
        Row: {
          cargo_id: string
          created_at: string
          id: string
          permission: Database["public"]["Enums"]["app_permission"]
        }
        Insert: {
          cargo_id: string
          created_at?: string
          id?: string
          permission: Database["public"]["Enums"]["app_permission"]
        }
        Update: {
          cargo_id?: string
          created_at?: string
          id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
        }
        Relationships: [
          {
            foreignKeyName: "cargo_permissions_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
        ]
      }
      cargos: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          advance_id: string
          amount: number
          category: string
          created_at: string
          description: string
          id: string
          receipt_path: string | null
          spent_at: string
          user_id: string | null
        }
        Insert: {
          advance_id: string
          amount: number
          category?: string
          created_at?: string
          description: string
          id?: string
          receipt_path?: string | null
          spent_at?: string
          user_id?: string | null
        }
        Update: {
          advance_id?: string
          amount?: number
          category?: string
          created_at?: string
          description?: string
          id?: string
          receipt_path?: string | null
          spent_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_advance_id_fkey"
            columns: ["advance_id"]
            isOneToOne: false
            referencedRelation: "advances"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          advance_id: string | null
          body: string
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          advance_id?: string | null
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          advance_id?: string | null
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_advance_id_fkey"
            columns: ["advance_id"]
            isOneToOne: false
            referencedRelation: "advances"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_sync_logs: {
        Row: {
          advance_id: string
          created_at: string
          created_by: string | null
          id: string
          message: string | null
          obra_id: string | null
          success: boolean
        }
        Insert: {
          advance_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string | null
          obra_id?: string | null
          success?: boolean
        }
        Update: {
          advance_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string | null
          obra_id?: string | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "obra_sync_logs_advance_id_fkey"
            columns: ["advance_id"]
            isOneToOne: false
            referencedRelation: "advances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_sync_logs_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          cliente: string | null
          codigo: string
          created_at: string
          external_id: string
          id: string
          nome: string
          status: string
          updated_at: string
        }
        Insert: {
          cliente?: string | null
          codigo?: string
          created_at?: string
          external_id: string
          id?: string
          nome: string
          status?: string
          updated_at?: string
        }
        Update: {
          cliente?: string | null
          codigo?: string
          created_at?: string
          external_id?: string
          id?: string
          nome?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      user_cargos: {
        Row: {
          cargo_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          cargo_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          cargo_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_cargos_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_permission: {
        Args: {
          _permission: Database["public"]["Enums"]["app_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      notify_users_with_permission: {
        Args: {
          _advance_id: string
          _body: string
          _exclude: string
          _link: string
          _permission: Database["public"]["Enums"]["app_permission"]
          _title: string
          _type: string
        }
        Returns: undefined
      }
    }
    Enums: {
      advance_status: "aberto" | "em_analise" | "fechado"
      app_permission:
        | "criar_adiantamento"
        | "adicionar_verba"
        | "aprovar_prestacao"
        | "ver_todos"
        | "lancar_despesa"
        | "gerenciar_acessos"
        | "integrar_obras"
      app_role: "admin" | "funcionario"
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
      advance_status: ["aberto", "em_analise", "fechado"],
      app_permission: [
        "criar_adiantamento",
        "adicionar_verba",
        "aprovar_prestacao",
        "ver_todos",
        "lancar_despesa",
        "gerenciar_acessos",
        "integrar_obras",
      ],
      app_role: ["admin", "funcionario"],
    },
  },
} as const
