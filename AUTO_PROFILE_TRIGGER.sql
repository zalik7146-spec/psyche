-- ════════════════════════════════════════════════════════════════
-- Автоматическое создание профиля при регистрации
-- Выполни это в Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

-- Функция создания профиля
create or replace function public.handle_new_user()
returns trigger as $$
declare
  base_username text;
  final_username text;
  counter int := 0;
begin
  -- Берём часть email до @ как базовый username
  base_username := lower(split_part(new.email, '@', 1));
  -- Убираем спецсимволы
  base_username := regexp_replace(base_username, '[^a-z0-9_]', '', 'g');
  -- Минимум 3 символа
  if length(base_username) < 3 then
    base_username := 'reader' || base_username;
  end if;
  -- Максимум 20 символов
  base_username := left(base_username, 20);
  
  final_username := base_username;
  
  -- Если username занят — добавляем цифры
  while exists (select 1 from public.social_profiles where username = final_username) loop
    counter := counter + 1;
    final_username := base_username || counter::text;
  end loop;

  -- Создаём профиль
  insert into public.social_profiles (
    id,
    username,
    display_name,
    avatar,
    bio,
    is_public,
    followers_count,
    following_count,
    posts_count,
    created_at,
    updated_at
  ) values (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data->>'display_name', final_username),
    new.raw_user_meta_data->>'avatar',
    null,
    true,
    0,
    0,
    0,
    now(),
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

-- Удаляем старый триггер если есть
drop trigger if exists on_auth_user_created on auth.users;

-- Создаём триггер
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Создаём профили для СУЩЕСТВУЮЩИХ пользователей ──────────────
-- Для всех у кого ещё нет профиля
insert into public.social_profiles (
  id, username, display_name, is_public,
  followers_count, following_count, posts_count,
  created_at, updated_at
)
select
  u.id,
  lower(regexp_replace(split_part(u.email, '@', 1), '[^a-z0-9_]', '', 'g')) || 
    row_number() over (
      partition by lower(regexp_replace(split_part(u.email, '@', 1), '[^a-z0-9_]', '', 'g'))
      order by u.created_at
    ) - 1 as username,
  split_part(u.email, '@', 1) as display_name,
  true,
  0, 0, 0,
  now(), now()
from auth.users u
where not exists (
  select 1 from public.social_profiles p where p.id = u.id
)
on conflict (id) do nothing;

-- Проверка — покажет все созданные профили
select id, username, display_name from public.social_profiles;
