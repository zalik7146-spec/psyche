-- Замечания Supabase Security Advisor:
-- 1. У функций не задан search_path: подменив его, можно подсунуть функции чужие таблицы.
-- 2. Триггерные функции с security definer можно вызвать напрямую через /rest/v1/rpc/.
-- Права на выполнение не нужны для срабатывания триггера, поэтому их можно отозвать.

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
