import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rputpotpsxivoulxbxoi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwdXRwb3Rwc3hpdm91bHhieG9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MDI4MTcsImV4cCI6MjA4OTA3ODgxN30.1DEuS9KmmZqJh2v7cq64mKJ9-yYgazn7sxa-mvqXBgs';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'psyche_supabase_auth',
  },
});

export interface DbBook {
  id: string; user_id: string; title: string; author: string;
  genre?: string; description?: string; status: string;
  color: string; cover_emoji: string; rating?: number;
  total_pages?: number; current_page?: number; tags?: string[];
  started_at?: string; finished_at?: string; created_at: string;
}

export interface DbNote {
  id: string; user_id: string; book_id?: string; type: string;
  title: string; content: string; quote?: string; quote_color?: string;
  tags?: string[]; color?: string; is_pinned: boolean; is_favorite: boolean;
  page?: number; chapter?: string; word_count?: number;
  linked_note_ids?: string[]; template_id?: string;
  created_at: string; updated_at: string;
}

export interface DbTag {
  id: string; user_id: string; name: string; color: string; created_at: string;
}
