-- ════════════════════════════════════════════════════════════════
-- PSYCHE APP — Полная настройка базы данных
-- Проект: rputpotpsxivoulxbxoi
--
-- КАК ВЫПОЛНИТЬ:
-- 1. Открой https://supabase.com → войди в аккаунт
-- 2. Выбери проект rputpotpsxivoulxbxoi
-- 3. В левом меню нажми "SQL Editor"
-- 4. Нажми "+ New query"
-- 5. Скопируй ВЕСЬ этот файл (supabase/setup.sql) и вставь в редактор
-- 6. Нажми кнопку "Run" (или Ctrl+Enter)
-- 7. Внизу увидишь "Success" — готово!
-- ════════════════════════════════════════════════════════════════

-- ── ЧАСТЬ 1: Основные таблицы ───────────────────────────────────

-- Книги
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

-- Записи / Заметки
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

-- Теги
create table if not exists public.tags (
  id         text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  color      text not null default '#b07d4a',
  created_at text not null default (now()::text)
);

-- Журнал дня
create table if not exists public.daily_notes (
  id              text primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  date            text not null,
  content         text not null default '',
  mood            integer,
  linked_note_ids text[],
  created_at      text not null default (now()::text),
  updated_at      text not null default (now()::text)
);

-- Карточки Anki / Flashcards
create table if not exists public.flashcards (
  id           text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  note_id      text,
  book_id      text,
  front        text not null default '',
  back         text not null default '',
  tags         text[],
  difficulty   integer default 0,
  next_review  text,
  review_count integer default 0,
  created_at   text not null default (now()::text)
);

-- ── ЧАСТЬ 2: Row Level Security (защита данных) ─────────────────

alter table public.books        enable row level security;
alter table public.notes        enable row level security;
alter table public.tags         enable row level security;
alter table public.daily_notes  enable row level security;
alter table public.flashcards   enable row level security;

-- Удаляем старые политики (на случай повторного запуска)
drop policy if exists "books_user"        on public.books;
drop policy if exists "notes_user"        on public.notes;
drop policy if exists "tags_user"         on public.tags;
drop policy if exists "daily_notes_user"  on public.daily_notes;
drop policy if exists "flashcards_user"   on public.flashcards;

-- Создаём политики — каждый видит только свои данные
create policy "books_user" on public.books
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "notes_user" on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "tags_user" on public.tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "daily_notes_user" on public.daily_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "flashcards_user" on public.flashcards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── ЧАСТЬ 3: Индексы для быстрого поиска ───────────────────────

create index if not exists books_user_idx       on public.books(user_id);
create index if not exists notes_user_idx       on public.notes(user_id);
create index if not exists notes_book_idx       on public.notes(book_id);
create index if not exists tags_user_idx        on public.tags(user_id);
create index if not exists daily_notes_usr_idx  on public.daily_notes(user_id);
create index if not exists daily_notes_date_idx on public.daily_notes(date);
create index if not exists flashcards_user_idx  on public.flashcards(user_id);

-- ── ЧАСТЬ 4: Социальный слой ────────────────────────────────────

-- Публичные профили пользователей
create table if not exists public.social_profiles (
  id               uuid references auth.users(id) on delete cascade primary key,
  username         text unique not null,
  display_name     text,
  avatar           text,
  bio              text,
  interests        text[],
  is_public        boolean default true,
  followers_count  int default 0,
  following_count  int default 0,
  posts_count      int default 0,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- Посты / Публикации
create table if not exists public.social_posts (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade not null,
  type           text not null default 'note',
  title          text not null,
  content        text default '',
  book_title     text,
  book_author    text,
  book_emoji     text,
  tags           text[] default '{}',
  is_public      boolean default true,
  likes_count    int default 0,
  comments_count int default 0,
  views_count    int default 0,
  created_at     timestamptz default now()
);

-- Лайки постов
create table if not exists public.social_likes (
  post_id    uuid references public.social_posts(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

-- Комментарии
create table if not exists public.social_comments (
  id          uuid default gen_random_uuid() primary key,
  post_id     uuid references public.social_posts(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete cascade not null,
  content     text not null,
  likes_count int default 0,
  created_at  timestamptz default now()
);

-- Лайки комментариев
create table if not exists public.social_comment_likes (
  comment_id uuid references public.social_comments(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,
  primary key (comment_id, user_id)
);

-- Подписки
create table if not exists public.social_follows (
  follower_id  uuid references auth.users(id) on delete cascade,
  following_id uuid references auth.users(id) on delete cascade,
  created_at   timestamptz default now(),
  primary key (follower_id, following_id)
);

-- Сохранённые посты
create table if not exists public.social_saves (
  post_id    uuid references public.social_posts(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

-- Уведомления
create table if not exists public.notifications (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users(id) on delete cascade not null,
  from_user_id uuid references auth.users(id) on delete cascade,
  type         text not null,
  post_id      uuid references public.social_posts(id) on delete cascade,
  comment_id   uuid references public.social_comments(id) on delete cascade,
  message      text,
  is_read      boolean default false,
  created_at   timestamptz default now()
);

-- ── RLS для социальных таблиц ────────────────────────────────────

alter table public.social_profiles      enable row level security;
alter table public.social_posts         enable row level security;
alter table public.social_likes         enable row level security;
alter table public.social_comments      enable row level security;
alter table public.social_comment_likes enable row level security;
alter table public.social_follows       enable row level security;
alter table public.social_saves         enable row level security;
alter table public.notifications        enable row level security;

-- Удаляем старые политики
drop policy if exists "Public profiles are viewable by everyone"  on public.social_profiles;
drop policy if exists "Users can insert own profile"              on public.social_profiles;
drop policy if exists "Users can update own profile"              on public.social_profiles;
drop policy if exists "Public posts viewable by everyone"         on public.social_posts;
drop policy if exists "Users can insert own posts"                on public.social_posts;
drop policy if exists "Users can delete own posts"                on public.social_posts;
drop policy if exists "Likes viewable by everyone"                on public.social_likes;
drop policy if exists "Users can manage own likes"                on public.social_likes;
drop policy if exists "Comments viewable by everyone"             on public.social_comments;
drop policy if exists "Users can insert own comments"             on public.social_comments;
drop policy if exists "Users can delete own comments"             on public.social_comments;
drop policy if exists "Comment likes viewable by everyone"        on public.social_comment_likes;
drop policy if exists "Users can manage own comment likes"        on public.social_comment_likes;
drop policy if exists "Follows viewable by everyone"              on public.social_follows;
drop policy if exists "Users can manage own follows"              on public.social_follows;
drop policy if exists "Users can manage own saves"                on public.social_saves;
drop policy if exists "Users can view saves"                      on public.social_saves;
drop policy if exists "Users can update own posts"                on public.social_posts;
drop policy if exists "Users can view own notifications"          on public.notifications;
drop policy if exists "Users can update own notifications"        on public.notifications;
drop policy if exists "System can insert notifications"           on public.notifications;
drop policy if exists "Users can send notifications as themselves" on public.notifications;

-- Создаём политики для социальных таблиц
create policy "Public profiles are viewable by everyone"
  on public.social_profiles for select using (true);
create policy "Users can insert own profile"
  on public.social_profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile"
  on public.social_profiles for update using (auth.uid() = id);

create policy "Public posts viewable by everyone"
  on public.social_posts for select using (is_public = true or auth.uid() = user_id);
create policy "Users can insert own posts"
  on public.social_posts for insert with check (auth.uid() = user_id);
create policy "Users can delete own posts"
  on public.social_posts for delete using (auth.uid() = user_id);
create policy "Users can update own posts"
  on public.social_posts for update using (auth.uid() = user_id);

create policy "Likes viewable by everyone"
  on public.social_likes for select using (true);
create policy "Users can manage own likes"
  on public.social_likes for all using (auth.uid() = user_id);

create policy "Comments viewable by everyone"
  on public.social_comments for select using (true);
create policy "Users can insert own comments"
  on public.social_comments for insert with check (auth.uid() = user_id);
create policy "Users can delete own comments"
  on public.social_comments for delete using (auth.uid() = user_id);

create policy "Comment likes viewable by everyone"
  on public.social_comment_likes for select using (true);
create policy "Users can manage own comment likes"
  on public.social_comment_likes for all using (auth.uid() = user_id);

create policy "Follows viewable by everyone"
  on public.social_follows for select using (true);
create policy "Users can manage own follows"
  on public.social_follows for all using (auth.uid() = follower_id);

create policy "Users can manage own saves"
  on public.social_saves for all using (auth.uid() = user_id);
create policy "Users can view saves"
  on public.social_saves for select using (auth.uid() = user_id);

create policy "Users can view own notifications"
  on public.notifications for select using (auth.uid() = user_id);
create policy "Users can update own notifications"
  on public.notifications for update using (auth.uid() = user_id);
-- Только от своего имени: иначе любой мог бы слать уведомления любому пользователю.
-- Триггеры с security definer обходят RLS и по-прежнему могут создавать уведомления.
create policy "Users can send notifications as themselves"
  on public.notifications for insert
  with check (auth.uid() = from_user_id and from_user_id <> user_id);

-- ── Индексы для социальных таблиц ───────────────────────────────

create index if not exists social_posts_user_idx     on public.social_posts(user_id);
create index if not exists social_posts_created_idx  on public.social_posts(created_at desc);
create index if not exists social_likes_post_idx     on public.social_likes(post_id);
create index if not exists social_comments_post_idx  on public.social_comments(post_id);
create index if not exists social_follows_flwr_idx   on public.social_follows(follower_id);
create index if not exists social_follows_flwg_idx   on public.social_follows(following_id);
create index if not exists notifications_user_idx    on public.notifications(user_id);
create index if not exists notifications_read_idx    on public.notifications(user_id, is_read);

-- ── ЧАСТЬ 5: Триггеры для автоматических счётчиков ──────────────

-- Счётчик лайков постов
create or replace function update_post_likes_count()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update public.social_posts
      set likes_count = likes_count + 1
      where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.social_posts
      set likes_count = greatest(0, likes_count - 1)
      where id = old.post_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

drop trigger if exists on_like_change on public.social_likes;
create trigger on_like_change
  after insert or delete on public.social_likes
  for each row execute function update_post_likes_count();

-- Счётчик комментариев
create or replace function update_post_comments_count()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update public.social_posts
      set comments_count = comments_count + 1
      where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.social_posts
      set comments_count = greatest(0, comments_count - 1)
      where id = old.post_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

drop trigger if exists on_comment_change on public.social_comments;
create trigger on_comment_change
  after insert or delete on public.social_comments
  for each row execute function update_post_comments_count();

-- Счётчик подписчиков
create or replace function update_follow_counts()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update public.social_profiles
      set followers_count = followers_count + 1
      where id = new.following_id;
    update public.social_profiles
      set following_count = following_count + 1
      where id = new.follower_id;
  elsif tg_op = 'DELETE' then
    update public.social_profiles
      set followers_count = greatest(0, followers_count - 1)
      where id = old.following_id;
    update public.social_profiles
      set following_count = greatest(0, following_count - 1)
      where id = old.follower_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

drop trigger if exists on_follow_change on public.social_follows;
create trigger on_follow_change
  after insert or delete on public.social_follows
  for each row execute function update_follow_counts();

-- Счётчик постов в профиле
create or replace function update_posts_count()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update public.social_profiles
      set posts_count = posts_count + 1
      where id = new.user_id;
  elsif tg_op = 'DELETE' then
    update public.social_profiles
      set posts_count = greatest(0, posts_count - 1)
      where id = old.user_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

drop trigger if exists on_post_change on public.social_posts;
create trigger on_post_change
  after insert or delete on public.social_posts
  for each row execute function update_posts_count();

-- ── ЧАСТЬ 6: Личные сообщения ───────────────────────────────────

create table if not exists public.messages (
  id           uuid default gen_random_uuid() primary key,
  from_user_id uuid references auth.users(id) on delete cascade not null,
  to_user_id   uuid references auth.users(id) on delete cascade not null,
  content      text not null check (length(content) between 1 and 4000),
  is_read      boolean default false not null,
  edited       boolean default false not null,
  created_at   timestamptz default now() not null
);

create index if not exists messages_from_to_idx on public.messages(from_user_id, to_user_id, created_at);
create index if not exists messages_to_unread_idx on public.messages(to_user_id) where not is_read;

alter table public.messages enable row level security;

drop policy if exists "Participants can view messages"    on public.messages;
drop policy if exists "Users can send messages as themselves" on public.messages;
drop policy if exists "Participants can update messages"  on public.messages;
drop policy if exists "Participants can delete messages"  on public.messages;

create policy "Participants can view messages"
  on public.messages for select
  using (auth.uid() in (from_user_id, to_user_id));
create policy "Users can send messages as themselves"
  on public.messages for insert
  with check (auth.uid() = from_user_id and from_user_id <> to_user_id);
create policy "Participants can update messages"
  on public.messages for update
  using (auth.uid() in (from_user_id, to_user_id));
create policy "Participants can delete messages"
  on public.messages for delete
  using (auth.uid() in (from_user_id, to_user_id));

-- Получатель может только отметить сообщение прочитанным, а не переписать его.
create or replace function public.guard_message_update()
returns trigger as $$
begin
  if auth.uid() is distinct from old.from_user_id and (
       new.content      is distinct from old.content
    or new.from_user_id is distinct from old.from_user_id
    or new.to_user_id   is distinct from old.to_user_id
    or new.edited       is distinct from old.edited
  ) then
    raise exception 'Only the sender can edit a message';
  end if;
  if new.content is distinct from old.content then
    new.edited := true;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_message_update on public.messages;
create trigger on_message_update
  before update on public.messages
  for each row execute function public.guard_message_update();

-- ── ЧАСТЬ 7: Профиль при регистрации ────────────────────────────

create or replace function public.handle_new_user()
returns trigger as $$
declare
  base_username  text;
  final_username text;
  counter        int := 0;
begin
  -- Часть email до @, без спецсимволов, от 3 до 20 символов
  base_username := regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9_]', '', 'g');
  if length(base_username) < 3 then
    base_username := 'reader' || base_username;
  end if;
  base_username := left(base_username, 20);

  final_username := base_username;
  while exists (select 1 from public.social_profiles where username = final_username) loop
    counter := counter + 1;
    final_username := base_username || counter::text;
  end loop;

  insert into public.social_profiles (
    id, username, display_name, avatar, bio, is_public,
    followers_count, following_count, posts_count, created_at, updated_at
  ) values (
    new.id, final_username,
    coalesce(new.raw_user_meta_data->>'display_name', final_username),
    new.raw_user_meta_data->>'avatar',
    null, true, 0, 0, 0, now(), now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Профили для пользователей, зарегистрированных до появления триггера
insert into public.social_profiles (
  id, username, display_name, is_public,
  followers_count, following_count, posts_count, created_at, updated_at
)
select
  u.id,
  lower(regexp_replace(split_part(u.email, '@', 1), '[^a-z0-9_]', '', 'g')) ||
    row_number() over (
      partition by lower(regexp_replace(split_part(u.email, '@', 1), '[^a-z0-9_]', '', 'g'))
      order by u.created_at
    ) - 1,
  split_part(u.email, '@', 1),
  true, 0, 0, 0, now(), now()
from auth.users u
where not exists (select 1 from public.social_profiles p where p.id = u.id)
on conflict (id) do nothing;

-- ── ЧАСТЬ 8: Realtime ────────────────────────────────────────────────────

-- Добавляем таблицы в публикацию, только если их там ещё нет (скрипт можно перезапускать)
do $$
declare
  t text;
begin
  foreach t in array array['social_posts', 'social_likes', 'social_comments', 'notifications', 'messages'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════
-- ВСЁ ГОТОВО!
-- Таблицы созданы, RLS настроен, триггеры активны, Realtime включён.
-- Скрипт можно запускать повторно.
-- ════════════════════════════════════════════════════════════════

-- ── Защита функций (Supabase Security Advisor) ──────────────────
-- Фиксируем search_path и запрещаем вызывать триггерные функции через /rest/v1/rpc/.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.prorettype = 'trigger'::regtype as is_trigger
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
  loop
    execute format('alter function %s set search_path = public, pg_temp', f.sig);
    if f.is_trigger then
      execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    end if;
  end loop;
end $$;

-- ── Тексты загруженных книг (Supabase Storage) ─────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-texts', 'book-texts', false, 20971520, array['application/gzip'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Read own book texts"   on storage.objects;
drop policy if exists "Upload own book texts" on storage.objects;
drop policy if exists "Update own book texts" on storage.objects;
drop policy if exists "Delete own book texts" on storage.objects;

create policy "Read own book texts" on storage.objects for select to authenticated
  using (bucket_id = 'book-texts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Upload own book texts" on storage.objects for insert to authenticated
  with check (bucket_id = 'book-texts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Update own book texts" on storage.objects for update to authenticated
  using (bucket_id = 'book-texts' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'book-texts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Delete own book texts" on storage.objects for delete to authenticated
  using (bucket_id = 'book-texts' and (storage.foldername(name))[1] = auth.uid()::text);
