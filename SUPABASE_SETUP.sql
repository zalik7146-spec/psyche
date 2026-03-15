-- ════════════════════════════════════════════════════
-- PSYCHE APP — Supabase Setup SQL
-- Выполни этот файл в Supabase SQL Editor
-- Project: rputpotpsxivoulxbxoi
-- ════════════════════════════════════════════════════

-- 1. BOOKS
create table if not exists public.books (
  id           text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null default '',
  author       text not null default '',
  genre        text,
  description  text,
  status       text not null default 'want',
  color        text not null default '#b07d4a',
  cover_emoji  text not null default '📚',
  rating       integer,
  total_pages  integer,
  current_page integer,
  tags         text[],
  started_at   text,
  finished_at  text,
  created_at   text not null default (now()::text)
);

-- 2. NOTES
create table if not exists public.notes (
  id              text primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  book_id         text,
  type            text not null default 'note',
  title           text not null default '',
  content         text not null default '',
  quote           text,
  quote_color     text,
  tags            text[],
  color           text,
  is_pinned       boolean not null default false,
  is_favorite     boolean not null default false,
  page            integer,
  chapter         text,
  word_count      integer,
  linked_note_ids text[],
  template_id     text,
  created_at      text not null default (now()::text),
  updated_at      text not null default (now()::text)
);

-- 3. TAGS
create table if not exists public.tags (
  id         text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  color      text not null default '#b07d4a',
  created_at text not null default (now()::text)
);

-- ── Row Level Security ──────────────────────────────

alter table public.books enable row level security;
alter table public.notes enable row level security;
alter table public.tags  enable row level security;

-- Удаляем старые политики если есть
drop policy if exists "books_user" on public.books;
drop policy if exists "notes_user" on public.notes;
drop policy if exists "tags_user"  on public.tags;

-- Создаём новые политики
create policy "books_user" on public.books
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "notes_user" on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "tags_user" on public.tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Индексы для производительности ─────────────────

create index if not exists books_user_idx on public.books(user_id);
create index if not exists notes_user_idx on public.notes(user_id);
create index if not exists notes_book_idx on public.notes(book_id);
create index if not exists tags_user_idx  on public.tags(user_id);

-- ════════════════════════════════════════════════════
-- ГОТОВО! Таблицы созданы, RLS настроен.
-- ════════════════════════════════════════════════════
