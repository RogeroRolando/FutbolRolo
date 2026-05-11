export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          role: 'admin' | 'viewer'
          created_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          role?: 'admin' | 'viewer'
          created_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          role?: 'admin' | 'viewer'
          created_at?: string
        }
      }
      players: {
        Row: {
          id: string
          full_name: string
          birth_date: string | null
          phone: string | null
          primary_position: string
          foot: 'derecha' | 'izquierda' | 'ambas' | null
          strengths: string | null
          weaknesses: string | null
          fitness_status: 'ok' | 'molestias' | 'lesionado'
          rating: number | null
          rating_updated_at: string | null
          shirt_number: number | null
          archived: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          full_name: string
          birth_date?: string | null
          phone?: string | null
          primary_position?: string
          foot?: 'derecha' | 'izquierda' | 'ambas' | null
          strengths?: string | null
          weaknesses?: string | null
          fitness_status?: 'ok' | 'molestias' | 'lesionado'
          rating?: number | null
          rating_updated_at?: string | null
          shirt_number?: number | null
          archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['players']['Insert']>
      }
      events: {
        Row: {
          id: string
          kind: 'entrenamiento' | 'partido'
          starts_at: string
          title: string | null
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          kind: 'entrenamiento' | 'partido'
          starts_at: string
          title?: string | null
          description?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['events']['Insert']>
      }
      attendance: {
        Row: {
          event_id: string
          player_id: string
          status: 'presente' | 'ausente' | 'justificado' | 'lesion'
        }
        Insert: {
          event_id: string
          player_id: string
          status: 'presente' | 'ausente' | 'justificado' | 'lesion'
        }
        Update: Partial<Database['public']['Tables']['attendance']['Insert']>
      }
      call_ups: {
        Row: {
          event_id: string
          player_id: string
        }
        Insert: {
          event_id: string
          player_id: string
        }
        Update: Partial<Database['public']['Tables']['call_ups']['Insert']>
      }
      tactical_boards: {
        Row: {
          id: string
          name: string
          event_id: string | null
          schema_version: number
          konva_json: Json
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          event_id?: string | null
          schema_version?: number
          konva_json?: Json
          updated_at?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['tactical_boards']['Insert']>
      }
    }
  }
}

export type PlayerRow = Database['public']['Tables']['players']['Row']
export type EventRow = Database['public']['Tables']['events']['Row']
export type TacticalBoardRow = Database['public']['Tables']['tactical_boards']['Row']
