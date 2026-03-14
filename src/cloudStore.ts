import { supabase, DbBook, DbNote, DbTag } from './supabase';
import { Book, Note, Tag, AppState } from './types';

// ─── Mappers: DB → App ───────────────────────────────────────────────────────
function dbToBook(d: DbBook): Book {
  return {
    id:          d.id,
    title:       d.title,
    author:      d.author,
    genre:       d.genre,
    description: d.description,
    status:      d.status as Book['status'],
    color:       d.color,
    coverEmoji:  d.cover_emoji,
    rating:      d.rating,
    totalPages:  d.total_pages,
    currentPage: d.current_page,
    tags:        d.tags || [],
    startedAt:   d.started_at,
    finishedAt:  d.finished_at,
    createdAt:   d.created_at,
  };
}

function dbToNote(d: DbNote): Note {
  return {
    id:         d.id,
    bookId:     d.book_id,
    type:       d.type as Note['type'],
    title:      d.title,
    content:    d.content,
    quote:      d.quote,
    quoteColor: d.quote_color,
    tags:       d.tags || [],
    color:      d.color,
    isPinned:   d.is_pinned,
    isFavorite: d.is_favorite,
    page:       d.page,
    chapter:    d.chapter,
    wordCount:  d.word_count,
    createdAt:  d.created_at,
    updatedAt:  d.updated_at,
  };
}

function dbToTag(d: DbTag): Tag {
  return { id: d.id, name: d.name, color: d.color };
}

// ─── Mappers: App → DB ───────────────────────────────────────────────────────
function bookToDb(b: Book, userId: string): Omit<DbBook, 'created_at'> & { created_at?: string } {
  return {
    id:          b.id,
    user_id:     userId,
    title:       b.title,
    author:      b.author,
    genre:       b.genre,
    description: b.description,
    status:      b.status,
    color:       b.color,
    cover_emoji: b.coverEmoji,
    rating:      b.rating,
    total_pages: b.totalPages,
    current_page:b.currentPage,
    tags:        b.tags || [],
    started_at:  b.startedAt,
    finished_at: b.finishedAt,
    created_at:  b.createdAt,
  };
}

function noteToDb(n: Note, userId: string): Omit<DbNote, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string } {
  return {
    id:          n.id,
    user_id:     userId,
    book_id:     n.bookId || undefined,
    type:        n.type,
    title:       n.title,
    content:     n.content,
    quote:       n.quote,
    quote_color: n.quoteColor,
    tags:        n.tags || [],
    color:       n.color,
    is_pinned:   n.isPinned,
    is_favorite: n.isFavorite,
    page:        n.page,
    chapter:     n.chapter,
    word_count:  n.wordCount,
    created_at:  n.createdAt,
    updated_at:  n.updatedAt,
  };
}

// ─── Load all data ────────────────────────────────────────────────────────────
export async function loadCloudState(userId: string): Promise<Partial<AppState> | null> {
  try {
    const [booksRes, notesRes, tagsRes] = await Promise.all([
      supabase.from('books').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('notes').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('tags').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    ]);

    if (booksRes.error) throw booksRes.error;
    if (notesRes.error) throw notesRes.error;
    if (tagsRes.error)  throw tagsRes.error;

    return {
      books: (booksRes.data as DbBook[]).map(dbToBook),
      notes: (notesRes.data as DbNote[]).map(dbToNote),
      tags:  (tagsRes.data  as DbTag[]).map(dbToTag),
    };
  } catch (e) {
    console.error('Cloud load error:', e);
    return null;
  }
}

// ─── Books CRUD ───────────────────────────────────────────────────────────────
export async function cloudSaveBook(book: Book, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('books')
      .upsert(bookToDb(book, userId), { onConflict: 'id' });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Save book error:', e);
    return false;
  }
}

export async function cloudDeleteBook(bookId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('books').delete().eq('id', bookId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Delete book error:', e);
    return false;
  }
}

// ─── Notes CRUD ───────────────────────────────────────────────────────────────
export async function cloudSaveNote(note: Note, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notes')
      .upsert(noteToDb(note, userId), { onConflict: 'id' });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Save note error:', e);
    return false;
  }
}

export async function cloudDeleteNote(noteId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('notes').delete().eq('id', noteId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Delete note error:', e);
    return false;
  }
}

// ─── Tags CRUD ────────────────────────────────────────────────────────────────
export async function cloudSaveTag(tag: Tag, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('tags')
      .upsert({ id: tag.id, user_id: userId, name: tag.name, color: tag.color }, { onConflict: 'id' });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Save tag error:', e);
    return false;
  }
}

// ─── Sync all local → cloud ───────────────────────────────────────────────────
export async function syncLocalToCloud(state: AppState, userId: string): Promise<void> {
  const bookPromises = state.books.map(b => cloudSaveBook(b, userId));
  const notePromises = state.notes.map(n => cloudSaveNote(n, userId));
  const tagPromises  = state.tags.map(t => cloudSaveTag(t, userId));
  await Promise.all([...bookPromises, ...notePromises, ...tagPromises]);
}
