import { supabase } from './supabase';
import { Book, Note, Tag, AppState } from './types';

// ── helpers ───────────────────────────────────────────────────────────────────

function bookToDb(b: Book, userId: string) {
  return {
    id: b.id, user_id: userId, title: b.title, author: b.author,
    genre: b.genre, description: b.description, status: b.status,
    color: b.color, cover_emoji: b.coverEmoji, rating: b.rating,
    total_pages: b.totalPages, current_page: b.currentPage,
    tags: b.tags, started_at: b.startedAt, finished_at: b.finishedAt,
    created_at: b.createdAt,
  };
}

function dbToBook(r: Record<string, unknown>): Book {
  return {
    id: r.id as string, title: r.title as string, author: r.author as string,
    genre: r.genre as string | undefined, description: r.description as string | undefined,
    status: r.status as Book['status'], color: r.color as string,
    coverEmoji: r.cover_emoji as string, rating: r.rating as number | undefined,
    totalPages: r.total_pages as number | undefined, currentPage: r.current_page as number | undefined,
    tags: r.tags as string[] | undefined,
    startedAt: r.started_at as string | undefined, finishedAt: r.finished_at as string | undefined,
    createdAt: r.created_at as string,
  };
}

function noteToDb(n: Note, userId: string) {
  return {
    id: n.id, user_id: userId, book_id: n.bookId, type: n.type,
    title: n.title, content: n.content, quote: n.quote, quote_color: n.quoteColor,
    tags: n.tags, color: n.color, is_pinned: n.isPinned, is_favorite: n.isFavorite,
    page: n.page, chapter: n.chapter, word_count: n.wordCount,
    linked_note_ids: n.linkedNoteIds, template_id: n.templateId,
    created_at: n.createdAt, updated_at: n.updatedAt,
  };
}

function dbToNote(r: Record<string, unknown>): Note {
  return {
    id: r.id as string, bookId: r.book_id as string | undefined,
    type: r.type as Note['type'], title: r.title as string, content: r.content as string,
    quote: r.quote as string | undefined, quoteColor: r.quote_color as string | undefined,
    tags: (r.tags as string[]) || [], color: r.color as string | undefined,
    isPinned: Boolean(r.is_pinned), isFavorite: Boolean(r.is_favorite),
    page: r.page as number | undefined, chapter: r.chapter as string | undefined,
    wordCount: r.word_count as number | undefined,
    linkedNoteIds: r.linked_note_ids as string[] | undefined,
    templateId: r.template_id as string | undefined,
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  };
}

// ── load ──────────────────────────────────────────────────────────────────────

export async function loadCloudState(userId: string): Promise<Partial<AppState> | null> {
  try {
    const [booksRes, notesRes, tagsRes] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('books') as any).select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('notes') as any).select('*').eq('user_id', userId).order('updated_at', { ascending: false }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('tags') as any).select('*').eq('user_id', userId),
    ]);

    if (booksRes.error || notesRes.error || tagsRes.error) return null;

    return {
      books: (booksRes.data || []).map(dbToBook),
      notes: (notesRes.data || []).map(dbToNote),
      tags: (tagsRes.data || []).map((r: Record<string, unknown>) => ({
        id: r.id, name: r.name, color: r.color,
      })) as Tag[],
    };
  } catch (e) {
    console.warn('loadCloudState failed:', e);
    return null;
  }
}

// ── save individual ───────────────────────────────────────────────────────────

export async function cloudSaveBook(book: Book, userId: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('books') as any).upsert(bookToDb(book, userId), { onConflict: 'id' });
  } catch (e) { console.warn('cloudSaveBook failed:', e); }
}

export async function cloudDeleteBook(bookId: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('books') as any).delete().eq('id', bookId);
  } catch (e) { console.warn('cloudDeleteBook failed:', e); }
}

export async function cloudSaveNote(note: Note, userId: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('notes') as any).upsert(noteToDb(note, userId), { onConflict: 'id' });
  } catch (e) { console.warn('cloudSaveNote failed:', e); }
}

export async function cloudDeleteNote(noteId: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('notes') as any).delete().eq('id', noteId);
  } catch (e) { console.warn('cloudDeleteNote failed:', e); }
}

export async function cloudSaveTag(tag: Tag, userId: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('tags') as any).upsert(
      { id: tag.id, user_id: userId, name: tag.name, color: tag.color },
      { onConflict: 'id' }
    );
  } catch (e) { console.warn('cloudSaveTag failed:', e); }
}

// ── bulk sync ─────────────────────────────────────────────────────────────────

export async function syncLocalToCloud(state: AppState, userId: string) {
  try {
    await Promise.all([
      ...state.books.map(b => cloudSaveBook(b, userId)),
      ...state.notes.map(n => cloudSaveNote(n, userId)),
      ...state.tags.map(t => cloudSaveTag(t, userId)),
    ]);
  } catch (e) { console.warn('syncLocalToCloud failed:', e); }
}
