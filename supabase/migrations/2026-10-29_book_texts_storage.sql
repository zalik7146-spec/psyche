-- Тексты загруженных книг в Supabase Storage, чтобы книга была на всех устройствах.
-- Приватное хранилище: файл лежит по пути <id пользователя>/<id книги>.txt.gz,
-- и каждый видит и меняет только свою папку.

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
