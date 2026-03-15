-- ══════════════════════════════════════════════════════════════
-- SOCIAL LAYER — выполни в Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

-- 1. Профили
create table if not exists public.social_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  display_name text,
  avatar text,
  bio text,
  is_public boolean default true,
  followers_count int default 0,
  following_count int default 0,
  posts_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.social_profiles enable row level security;
create policy "Public profiles are viewable by everyone" on public.social_profiles for select using (true);
create policy "Users can insert own profile" on public.social_profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.social_profiles for update using (auth.uid() = id);

-- 2. Посты
create table if not exists public.social_posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null default 'note',
  title text not null,
  content text default '',
  book_title text,
  book_author text,
  book_emoji text,
  tags text[] default '{}',
  is_public boolean default true,
  likes_count int default 0,
  comments_count int default 0,
  views_count int default 0,
  created_at timestamptz default now()
);
alter table public.social_posts enable row level security;
create policy "Public posts viewable by everyone" on public.social_posts for select using (is_public = true or auth.uid() = user_id);
create policy "Users can insert own posts" on public.social_posts for insert with check (auth.uid() = user_id);
create policy "Users can delete own posts" on public.social_posts for delete using (auth.uid() = user_id);

-- 3. Лайки постов
create table if not exists public.social_likes (
  post_id uuid references public.social_posts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);
alter table public.social_likes enable row level security;
create policy "Likes viewable by everyone" on public.social_likes for select using (true);
create policy "Users can manage own likes" on public.social_likes for all using (auth.uid() = user_id);

-- 4. Комментарии
create table if not exists public.social_comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.social_posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  likes_count int default 0,
  created_at timestamptz default now()
);
alter table public.social_comments enable row level security;
create policy "Comments viewable by everyone" on public.social_comments for select using (true);
create policy "Users can insert own comments" on public.social_comments for insert with check (auth.uid() = user_id);
create policy "Users can delete own comments" on public.social_comments for delete using (auth.uid() = user_id);

-- 5. Лайки комментариев
create table if not exists public.social_comment_likes (
  comment_id uuid references public.social_comments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  primary key (comment_id, user_id)
);
alter table public.social_comment_likes enable row level security;
create policy "Comment likes viewable by everyone" on public.social_comment_likes for select using (true);
create policy "Users can manage own comment likes" on public.social_comment_likes for all using (auth.uid() = user_id);

-- 6. Подписки
create table if not exists public.social_follows (
  follower_id uuid references auth.users(id) on delete cascade,
  following_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id)
);
alter table public.social_follows enable row level security;
create policy "Follows viewable by everyone" on public.social_follows for select using (true);
create policy "Users can manage own follows" on public.social_follows for all using (auth.uid() = follower_id);

-- 7. Сохранённые посты
create table if not exists public.social_saves (
  post_id uuid references public.social_posts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);
alter table public.social_saves enable row level security;
create policy "Users can manage own saves" on public.social_saves for all using (auth.uid() = user_id);

-- 8. Уведомления
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  from_user_id uuid references auth.users(id) on delete cascade,
  type text not null, -- 'like', 'comment', 'follow', 'daily_review'
  post_id uuid references public.social_posts(id) on delete cascade,
  comment_id uuid references public.social_comments(id) on delete cascade,
  message text,
  is_read boolean default false,
  created_at timestamptz default now()
);
alter table public.notifications enable row level security;
create policy "Users can view own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "Users can update own notifications" on public.notifications for update using (auth.uid() = user_id);

-- 9. Функции для обновления счётчиков
create or replace function update_likes_count() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update social_posts set likes_count = likes_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update social_posts set likes_count = greatest(0, likes_count - 1) where id = old.post_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

create or replace trigger on_like_change
  after insert or delete on social_likes
  for each row execute function update_likes_count();

create or replace function update_comments_count() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update social_posts set comments_count = comments_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update social_posts set comments_count = greatest(0, comments_count - 1) where id = old.post_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

create or replace trigger on_comment_change
  after insert or delete on social_comments
  for each row execute function update_comments_count();

create or replace function update_followers_count() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update social_profiles set followers_count = followers_count + 1 where id = new.following_id;
    update social_profiles set following_count = following_count + 1 where id = new.follower_id;
  elsif tg_op = 'DELETE' then
    update social_profiles set followers_count = greatest(0, followers_count - 1) where id = old.following_id;
    update social_profiles set following_count = greatest(0, following_count - 1) where id = old.follower_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

create or replace trigger on_follow_change
  after insert or delete on social_follows
  for each row execute function update_followers_count();

-- 10. Realtime включить для нужных таблиц
alter publication supabase_realtime add table social_posts;
alter publication supabase_realtime add table social_likes;
alter publication supabase_realtime add table social_comments;
alter publication supabase_realtime add table notifications;
