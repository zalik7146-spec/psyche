import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rputpotpsxivoulxbxoi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ISw8oG_EAgTTcBOe00Lxmw_6VxKKKS0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Автоматически обнаруживает токены в URL хэше (#access_token=...)
    // что критично для подтверждения email
    detectSessionInUrl: true,
    // Сохраняет сессию в localStorage — не нужно входить повторно
    persistSession: true,
    // Автоматически обновляет токен
    autoRefreshToken: true,
    // Ключ для localStorage
    storageKey: 'psyche_auth',
    flowType: 'implicit', // для email confirmation ссылок с #access_token
  },
});

// ─── Database types ──────────────────────────────────────────────────────────
export interface DbBook {
  id: string;
  user_id: string;
  title: string;
  author: string;
  genre?: string;
  description?: string;
  status: string;
  color: string;
  cover_emoji: string;
  rating?: number;
  total_pages?: number;
  current_page?: number;
  tags?: string[];
  started_at?: string;
  finished_at?: string;
  created_at: string;
}

export interface DbNote {
  id: string;
  user_id: string;
  book_id?: string;
  type: string;
  title: string;
  content: string;
  quote?: string;
  quote_color?: string;
  tags?: string[];
  color?: string;
  is_pinned: boolean;
  is_favorite: boolean;
  page?: number;
  chapter?: string;
  word_count?: number;
  created_at: string;
  updated_at: string;
}

export interface DbTag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

// ─── SQL для создания таблиц (выполнить в Supabase SQL Editor) ───────────────
/*
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Books table
CREATE TABLE IF NOT EXISTS books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  title text NOT NULL DEFAULT '',
  author text NOT NULL DEFAULT '',
  genre text,
  description text,
  status text DEFAULT 'want',
  color text DEFAULT '#3d2a1a',
  cover_emoji text DEFAULT '📚',
  rating int,
  total_pages int,
  current_page int,
  tags text[] DEFAULT '{}',
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Notes table
CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  book_id uuid REFERENCES books(id) ON DELETE SET NULL,
  type text DEFAULT 'note',
  title text NOT NULL DEFAULT '',
  content text DEFAULT '',
  quote text,
  quote_color text DEFAULT '#c4813c',
  tags text[] DEFAULT '{}',
  color text,
  is_pinned bool DEFAULT false,
  is_favorite bool DEFAULT false,
  page int,
  chapter text,
  word_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#b07d4a',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Row Level Security
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own books" ON books FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own notes" ON notes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own tags"  ON tags  FOR ALL USING (auth.uid() = user_id);
*/
