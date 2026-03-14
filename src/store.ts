import { Book, Note, Tag, AppState, User, AuthState } from './types';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'psyche_v2';
const AUTH_KEY    = 'psyche_auth_v2';
const USERS_KEY   = 'psyche_users_v2';

// ─── Local Auth ────────────────────────────────────────────────────────
export function loadUsers(): (User & { _pw: string })[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveUsers(users: (User & { _pw: string })[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function loadAuth(): AuthState {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : { user: null, isLoggedIn: false };
  } catch { return { user: null, isLoggedIn: false }; }
}

export function saveAuth(auth: AuthState) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

export function registerUser(
  email: string, name: string, password: string
): { ok: boolean; error?: string; user?: User } {
  const users = loadUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return { ok: false, error: 'Пользователь с таким email уже существует' };
  }
  const user: User = {
    id: uuidv4(),
    email: email.toLowerCase().trim(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
  };
  saveUsers([...users, { ...user, _pw: btoa(unescape(encodeURIComponent(password))) }]);
  return { ok: true, user };
}

export function loginUser(
  email: string, password: string
): { ok: boolean; error?: string; user?: User } {
  const users = loadUsers();
  const found = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
  if (!found) return { ok: false, error: 'Пользователь не найден' };
  const encoded = btoa(unescape(encodeURIComponent(password)));
  if (found._pw !== encoded) return { ok: false, error: 'Неверный пароль' };
  const { _pw, ...user } = found;
  void _pw;
  return { ok: true, user: user as User };
}

// ─── Sample Data ─────────────────────────────────────────────────────
const sampleTags: Tag[] = [
  { id: 't1', name: 'психология', color: '#b07d4a' },
  { id: 't2', name: 'терапия', color: '#8a5a3a' },
  { id: 't3', name: 'ключевая идея', color: '#7a6a4a' },
  { id: 't4', name: 'практика', color: '#5a8a6a' },
  { id: 't5', name: 'цитата', color: '#4a6a8a' },
  { id: 't6', name: 'вопрос', color: '#7a4a4a' },
  { id: 't7', name: 'инсайт', color: '#8a7a3a' },
];

const sampleBooks: Book[] = [
  {
    id: 'b1', title: 'Человек в поисках смысла', author: 'Виктор Франкл',
    genre: 'Психология', status: 'finished', color: '#3d2a1a',
    coverEmoji: '🧠', createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    finishedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    rating: 5, totalPages: 224, currentPage: 224,
    description: 'Классический труд о поиске смысла в жизни.',
    tags: ['t1', 't3'],
  },
  {
    id: 'b2', title: 'Тело помнит всё', author: 'Бессел ван дер Колк',
    genre: 'Психотерапия', status: 'reading', color: '#2a1e10',
    coverEmoji: '💆', createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    rating: 4, totalPages: 464, currentPage: 180,
    description: 'О влиянии травмы на тело и психику.',
    tags: ['t1', 't2'],
  },
  {
    id: 'b3', title: 'Мышление быстрое и медленное', author: 'Даниэль Канеман',
    genre: 'Когнитивная психология', status: 'want', color: '#1a2a1a',
    coverEmoji: '⚡', createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    totalPages: 499,
    tags: ['t3'],
  },
];

const sampleNotes: Note[] = [
  {
    id: 'n1', bookId: 'b1', type: 'insight',
    title: 'Смысл как опора в страдании',
    content: '<p>Франкл утверждает: человек способен вынести почти любое «как», если знает «зачем». Это резонирует с практикой — клиенты, нашедшие смысл в боли, восстанавливаются быстрее.</p>',
    quote: 'Тот, кто знает, зачем жить, может вынести почти любое как.',
    quoteColor: '#c4813c', tags: ['t1', 't3', 't7'],
    isPinned: true, isFavorite: true, page: 84, chapter: 'Часть I',
    wordCount: 38, createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
  {
    id: 'n2', bookId: 'b2', type: 'note',
    title: 'Соматические маркеры травмы',
    content: '<p>Тело фиксирует травму через мышечные зажимы, паттерны дыхания, рефлексы замирания. Важно работать не только с нарративом, но и с телесными сигналами.</p>',
    tags: ['t2', 't4'], isPinned: false, isFavorite: false,
    page: 67, wordCount: 29,
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
];

const defaultState: AppState = {
  books: sampleBooks,
  notes: sampleNotes,
  tags: sampleTags,
  theme: 'dark',
  fontSize: 'md',
  lineHeight: 'normal',
};

export function loadState(userId: string): AppState {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    if (!raw) return { ...defaultState };
    const parsed = JSON.parse(raw);
    return {
      ...defaultState,
      ...parsed,
    };
  } catch { return { ...defaultState }; }
}

export function saveState(state: AppState, userId: string) {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(state));
  } catch {}
}

// ─── Creators ────────────────────────────────────────────────────────
export function createBook(data: Partial<Book>): Book {
  return {
    id: uuidv4(),
    title: data.title || 'Без названия',
    author: data.author || '',
    genre: data.genre,
    description: data.description,
    status: data.status || 'want',
    color: data.color || '#3d2a1a',
    coverEmoji: data.coverEmoji || '📚',
    createdAt: new Date().toISOString(),
    startedAt: data.startedAt,
    finishedAt: data.finishedAt,
    rating: data.rating,
    totalPages: data.totalPages,
    currentPage: data.currentPage,
    tags: data.tags || [],
  };
}

export function createNote(data: Partial<Note>): Note {
  return {
    id: uuidv4(),
    bookId: data.bookId,
    type: data.type || 'note',
    title: data.title || '',
    content: data.content || '',
    quote: data.quote,
    quoteColor: data.quoteColor || '#c4813c',
    tags: data.tags || [],
    color: data.color,
    isPinned: data.isPinned || false,
    isFavorite: data.isFavorite || false,
    page: data.page,
    chapter: data.chapter,
    wordCount: data.wordCount || 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createTag(name: string, color: string): Tag {
  return { id: uuidv4(), name, color };
}
