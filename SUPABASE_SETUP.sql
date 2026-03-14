-- ══════════════════════════════════════════════════════════════════
--  PSYCHE — Дневник Разума
--  Выполни этот SQL в Supabase SQL Editor:
--  https://rputpotpsxivoulxbxoi.supabase.co
--  Dashboard → SQL Editor → New query → вставь → Run
-- ══════════════════════════════════════════════════════════════════

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Books table
CREATE TABLE IF NOT EXISTS books (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        REFERENCES auth.users NOT NULL,
  title        text        NOT NULL DEFAULT '',
  author       text        NOT NULL DEFAULT '',
  genre        text,
  description  text,
  status       text        DEFAULT 'want',
  color        text        DEFAULT '#3d2a1a',
  cover_emoji  text        DEFAULT '📚',
  rating       int,
  total_pages  int,
  current_page int,
  tags         text[]      DEFAULT '{}',
  started_at   timestamptz,
  finished_at  timestamptz,
  created_at   timestamptz DEFAULT now()
);

-- 3. Notes table
CREATE TABLE IF NOT EXISTS notes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        REFERENCES auth.users NOT NULL,
  book_id      uuid        REFERENCES books(id) ON DELETE SET NULL,
  type         text        DEFAULT 'note',
  title        text        NOT NULL DEFAULT '',
  content      text        DEFAULT '',
  quote        text,
  quote_color  text        DEFAULT '#c4813c',
  tags         text[]      DEFAULT '{}',
  color        text,
  is_pinned    bool        DEFAULT false,
  is_favorite  bool        DEFAULT false,
  page         int,
  chapter      text,
  word_count   int         DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- 4. Tags table
CREATE TABLE IF NOT EXISTS tags (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES auth.users NOT NULL,
  name       text        NOT NULL,
  color      text        DEFAULT '#b07d4a',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

-- 5. Row Level Security (каждый видит только своё)
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags  ENABLE ROW LEVEL SECURITY;

-- 6. Policies
DROP POLICY IF EXISTS "Users manage own books" ON books;
DROP POLICY IF EXISTS "Users manage own notes" ON notes;
DROP POLICY IF EXISTS "Users manage own tags"  ON tags;

CREATE POLICY "Users manage own books" ON books
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own notes" ON notes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own tags" ON tags
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7. Auto-update updated_at for notes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notes_updated_at ON notes;
CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════════════
--  Готово! Supabase настроен для Psyche.
-- ══════════════════════════════════════════════════════════════════
