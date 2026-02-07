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
      email_sessions: {
        Row: {
          conversation_id: string | null
          conversation_type: string | null
          created_at: string | null
          customer_email: string
          customer_first_name: string
          customer_last_name: string
          escalation_reason: string | null
          escalation_summary: Json | null
          id: string
          is_escalated: boolean | null
          raw_conversation: string | null
          shopify_customer_id: string
          subject: string | null
          updated_at: string | null
          workflow_category: string | null
        }
        Insert: {
          conversation_id?: string | null
          conversation_type?: string | null
          created_at?: string | null
          customer_email: string
          customer_first_name: string
          customer_last_name: string
          escalation_reason?: string | null
          escalation_summary?: Json | null
          id?: string
          is_escalated?: boolean | null
          raw_conversation?: string | null
          shopify_customer_id: string
          subject?: string | null
          updated_at?: string | null
          workflow_category?: string | null
        }
        Update: {
          conversation_id?: string | null
          conversation_type?: string | null
          created_at?: string | null
          customer_email?: string
          customer_first_name?: string
          customer_last_name?: string
          escalation_reason?: string | null
          escalation_summary?: Json | null
          id?: string
          is_escalated?: boolean | null
          raw_conversation?: string | null
          shopify_customer_id?: string
          subject?: string | null
          updated_at?: string | null
          workflow_category?: string | null
        }
        Relationships: []
      }
      imported_tickets: {
        Row: {
          conversation_id: string
          conversation_type: string | null
          created_at: string | null
          customer_id: string
          id: string
          imported_at: string | null
          original_created_at: string | null
          raw_conversation: string
          subject: string | null
        }
        Insert: {
          conversation_id: string
          conversation_type?: string | null
          created_at?: string | null
          customer_id: string
          id?: string
          imported_at?: string | null
          original_created_at?: string | null
          raw_conversation: string
          subject?: string | null
        }
        Update: {
          conversation_id?: string
          conversation_type?: string | null
          created_at?: string | null
          customer_id?: string
          id?: string
          imported_at?: string | null
          original_created_at?: string | null
          raw_conversation?: string
          subject?: string | null
        }
        Relationships: []
      }
      session_actions: {
        Row: {
          action_details: Json
          action_type: string
          created_at: string | null
          id: string
          performed_by: string
          session_id: string
        }
        Insert: {
          action_details: Json
          action_type: string
          created_at?: string | null
          id?: string
          performed_by: string
          session_id: string
        }
        Update: {
          action_details?: Json
          action_type?: string
          created_at?: string | null
          id?: string
          performed_by?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_actions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "email_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_context: {
        Row: {
          conversation_state: Json | null
          customer_sentiment: string | null
          id: string
          order_data: Json | null
          promises_made: Json | null
          session_id: string
          subscription_data: Json | null
          updated_at: string | null
        }
        Insert: {
          conversation_state?: Json | null
          customer_sentiment?: string | null
          id?: string
          order_data?: Json | null
          promises_made?: Json | null
          session_id: string
          subscription_data?: Json | null
          updated_at?: string | null
        }
        Update: {
          conversation_state?: Json | null
          customer_sentiment?: string | null
          id?: string
          order_data?: Json | null
          promises_made?: Json | null
          session_id?: string
          subscription_data?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_context_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "email_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_messages: {
        Row: {
          agent_name: string | null
          content: string
          created_at: string | null
          id: string
          role: string
          session_id: string
        }
        Insert: {
          agent_name?: string | null
          content: string
          created_at?: string | null
          id?: string
          role: string
          session_id: string
        }
        Update: {
          agent_name?: string | null
          content?: string
          created_at?: string | null
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "email_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_calls: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          message_id: string | null
          session_id: string
          success: boolean | null
          tool_input: Json
          tool_name: string
          tool_output: Json | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          session_id: string
          success?: boolean | null
          tool_input: Json
          tool_name: string
          tool_output?: Json | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          session_id?: string
          success?: boolean | null
          tool_input?: Json
          tool_name?: string
          tool_output?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "tool_calls_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "session_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_calls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "email_sessions"
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
