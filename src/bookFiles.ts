import { unzipSync, strFromU8 } from 'fflate';

// ── Тексты своих книг: хранятся на устройстве в IndexedDB ────────────────
// localStorage для книг мал (около 5 МБ на всё приложение), поэтому полные
// тексты живут в отдельной базе браузера по id книги.

const DB_NAME = 'psyche_books';
const STORE = 'texts';

export interface StoredBookText {
  text: string;
  fileName: string;
  addedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  }).finally(() => db.close());
}

export const saveBookText = (bookId: string, data: StoredBookText) =>
  withStore<IDBValidKey>('readwrite', s => s.put(data, bookId));

export async function getBookText(bookId: string): Promise<StoredBookText | null> {
  try { return (await withStore<StoredBookText | undefined>('readonly', s => s.get(bookId))) || null; }
  catch { return null; }
}

export const deleteBookText = (bookId: string) =>
  withStore<undefined>('readwrite', s => s.delete(bookId)).catch(() => undefined);

// ── Разбор файлов ─────────────────────────────────────────────────────────

export interface ParsedBook {
  title?: string;
  author?: string;
  text: string;
}

export const BOOK_FILE_ACCEPT = '.txt,.fb2,.epub,text/plain,application/epub+zip';

const clean = (s: string) => s.replace(/\r\n?/g, '\n').replace(/[\t  ]+/g, ' ').replace(/\n[ ]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

// Текст блочных элементов с пустой строкой между абзацами
function blocksToText(root: Element | Document): string {
  const parts: string[] = [];
  const walk = (el: Element) => {
    const tag = el.localName.toLowerCase();
    if (['script', 'style', 'binary', 'head'].includes(tag)) return;
    if (['p', 'v', 'subtitle', 'text-author', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre'].includes(tag)
      && !el.querySelector('p, div')) {
      const t = el.textContent?.trim();
      if (t) parts.push(t);
      return;
    }
    if (tag === 'empty-line') { parts.push(''); return; }
    for (const child of Array.from(el.children)) walk(child);
    // Текст прямо внутри контейнера без абзацев
    if (!el.children.length) {
      const t = el.textContent?.trim();
      if (t) parts.push(t);
    }
  };
  const start = root instanceof Document ? (root.body || root.documentElement) : root;
  if (start) walk(start);
  return clean(parts.join('\n\n'));
}

function parseFb2(xml: string): ParsedBook {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const info = doc.getElementsByTagName('title-info')[0];
  const title = info?.getElementsByTagName('book-title')[0]?.textContent?.trim();
  const a = info?.getElementsByTagName('author')[0];
  const author = a
    ? [a.getElementsByTagName('first-name')[0], a.getElementsByTagName('middle-name')[0], a.getElementsByTagName('last-name')[0]]
      .map(n => n?.textContent?.trim()).filter(Boolean).join(' ')
    : undefined;
  const bodies = Array.from(doc.getElementsByTagName('body')).filter(b => b.getAttribute('name') !== 'notes');
  const text = clean(bodies.map(b => blocksToText(b)).join('\n\n'));
  return { title, author: author || undefined, text };
}

// FB2 часто в windows-1251: кодировку берём из XML-заголовка
function decodeFb2(bytes: Uint8Array): string {
  const head = new TextDecoder('ascii').decode(bytes.slice(0, 200));
  const enc = head.match(/encoding=["']([\w-]+)["']/i)?.[1] || 'utf-8';
  try { return new TextDecoder(enc).decode(bytes); } catch { return new TextDecoder('utf-8').decode(bytes); }
}

function parseEpub(bytes: Uint8Array): ParsedBook {
  const files = unzipSync(bytes);
  const read = (path: string) => (files[path] ? strFromU8(files[path]) : '');
  const container = new DOMParser().parseFromString(read('META-INF/container.xml'), 'application/xml');
  const opfPath = container.getElementsByTagName('rootfile')[0]?.getAttribute('full-path');
  if (!opfPath) throw new Error('EPUB_NO_OPF');
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const opf = new DOMParser().parseFromString(read(opfPath), 'application/xml');
  const title = opf.getElementsByTagName('dc:title')[0]?.textContent?.trim();
  const author = opf.getElementsByTagName('dc:creator')[0]?.textContent?.trim();
  const manifest = new Map<string, string>();
  for (const item of Array.from(opf.getElementsByTagName('item'))) {
    manifest.set(item.getAttribute('id') || '', item.getAttribute('href') || '');
  }
  const chapters: string[] = [];
  for (const ref of Array.from(opf.getElementsByTagName('itemref'))) {
    const href = manifest.get(ref.getAttribute('idref') || '');
    if (!href) continue;
    const path = decodeURIComponent(base + href.split('#')[0]);
    const html = read(path);
    if (!html) continue;
    const doc = new DOMParser().parseFromString(html, 'application/xhtml+xml');
    const usable = doc.getElementsByTagName('parsererror').length ? new DOMParser().parseFromString(html, 'text/html') : doc;
    const text = blocksToText(usable);
    if (text) chapters.push(text);
  }
  return { title, author, text: clean(chapters.join('\n\n')) };
}

export async function parseBookFile(file: File): Promise<ParsedBook> {
  const name = file.name.toLowerCase();
  const bytes = new Uint8Array(await file.arrayBuffer());
  let parsed: ParsedBook;
  if (name.endsWith('.epub')) parsed = parseEpub(bytes);
  else if (name.endsWith('.fb2')) parsed = parseFb2(decodeFb2(bytes));
  else parsed = { text: clean(new TextDecoder('utf-8').decode(bytes).replace(/^﻿/, '')) };
  if (!parsed.title) parsed.title = file.name.replace(/\.(txt|fb2|epub)$/i, '').replace(/[_-]+/g, ' ').trim();
  return parsed;
}
