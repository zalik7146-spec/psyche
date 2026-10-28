# Psyche — Дневник Разума

PWA для штудирования книг: библиотека и читалка, заметки с цитатами и связями, ежедневный дневник, карточки для повторения, статистика и социальная лента с сообщениями.

**Стек:** React 19 · TypeScript · Vite 7 · Tailwind CSS 4 · Tiptap 3 · Supabase · d3 · jsPDF.

## Запуск

```bash
npm install
npm run dev
```

Приложение откроется на http://localhost:5173. Сборка для продакшена: `npm run build`, результат в `dist/`.

## Структура

```
src/
  App.tsx            корневой компонент и навигация
  components/        экраны: читалка, заметки, лента, сообщения, статистика…
  store.ts           локальные данные (localStorage)
  cloudStore.ts      синхронизация заметок и книг с Supabase
  socialStore.ts     лента, подписки, уведомления, сообщения
  supabase.ts        клиент Supabase и типы таблиц
  bookFiles.ts       свои книги: разбор TXT, FB2, EPUB и хранение текста на устройстве
  stoicLibrary.ts    Стоическая библиотека: тексты Project Gutenberg
public/              иконки, manifest.json, service worker (sw.js)
api/                 серверная функция Vercel: тексты книг с Project Gutenberg
netlify/functions/   то же для Netlify
supabase/            SQL: полная настройка базы и миграции
```

## База данных (Supabase)

- **Новая база:** откройте Supabase → SQL Editor и выполните [`supabase/setup.sql`](supabase/setup.sql). Скрипт можно запускать повторно.
- **Существующая база:** выполните по порядку файлы из [`supabase/migrations/`](supabase/migrations), которые ещё не применялись.

Адрес проекта и публичный `anon`-ключ лежат в `src/supabase.ts`. Этот ключ можно держать в клиенте: доступ к данным ограничивает RLS. Ключ `service_role` в код не добавляйте.

## Деплой

Работает и на Vercel, и на Netlify: настройки в `vercel.json` и `netlify.toml`. Тексты книг Project Gutenberg загружаются через собственный маршрут `/api/gutenberg/<id>`, потому что сам сайт Gutenberg не отдаёт их браузеру с другого домена.
