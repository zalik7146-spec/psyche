-- Обновление для уже развёрнутой базы: запустите один раз в Supabase → SQL Editor.
-- Для новой базы достаточно supabase/setup.sql, там всё это уже есть.

-- ── 1. Уведомления: только от своего имени ─────────────────────
-- Старая политика разрешала любому пользователю создавать уведомления кому угодно.

drop policy if exists "System can insert notifications"           on public.notifications;
drop policy if exists "Users can send notifications as themselves" on public.notifications;

create policy "Users can send notifications as themselves"
  on public.notifications for insert
  with check (auth.uid() = from_user_id and from_user_id <> user_id);

-- ── 2. Личные сообщения ────────────────────────────────────────
-- Таблицу использует чат, но ни один SQL-файл её не создавал.
-- Если она уже создана вручную, дополняем недостающие колонки и заменяем политики.

create table if not exists public.messages (
  id           uuid default gen_random_uuid() primary key,
  from_user_id uuid references auth.users(id) on delete cascade not null,
  to_user_id   uuid references auth.users(id) on delete cascade not null,
  content      text not null,
  is_read      boolean default false not null,
  edited       boolean default false not null,
  created_at   timestamptz default now() not null
);

alter table public.messages add column if not exists is_read boolean default false not null;
alter table public.messages add column if not exists edited  boolean default false not null;
update public.messages set is_read = false where is_read is null;
alter table public.messages alter column is_read set not null;

create index if not exists messages_from_to_idx on public.messages(from_user_id, to_user_id, created_at);
create index if not exists messages_to_unread_idx on public.messages(to_user_id) where not is_read;

alter table public.messages enable row level security;

do $$
declare
  p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'messages' loop
    execute format('drop policy %I on public.messages', p.policyname);
  end loop;
end $$;

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

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
