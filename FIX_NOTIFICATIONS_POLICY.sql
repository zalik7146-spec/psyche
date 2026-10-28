-- Исправление для уже развёрнутой базы: запустите один раз в Supabase → SQL Editor.
-- Старая политика разрешала любому пользователю создавать уведомления кому угодно.

drop policy if exists "System can insert notifications"           on public.notifications;
drop policy if exists "Users can send notifications as themselves" on public.notifications;

create policy "Users can send notifications as themselves"
  on public.notifications for insert
  with check (auth.uid() = from_user_id and from_user_id <> user_id);
