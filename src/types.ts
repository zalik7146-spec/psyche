export type Theme = 'dark' | 'light' | 'sepia';

export type BookStatus = 'reading' | 'finished' | 'want' | 'paused' | 'abandoned';

export interface Book {
  id: string;
  title: string;
  author: string;
  genre?: string;
  description?: string;
  status: BookStatus;
  color: string;
  coverEmoji: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  rating?: number;
  totalPages?: number;
  currentPage?: number;
  tags?: string[];
}

export type NoteType = 'note' | 'quote' | 'insight' | 'question' | 'summary' | 'idea' | 'task';

export interface Note {
  id: string;
  bookId?: string;
  type: NoteType;
  title: string;
  content: string;
  quote?: string;
  quoteColor?: string;
  tags: string[];
  color?: string;
  isPinned: boolean;
  isFavorite: boolean;
  page?: number;
  chapter?: string;
  createdAt: string;
  updatedAt: string;
  wordCount?: number;
  linkedNoteIds?: string[];   // Связи между записями
  templateId?: string;        // Если создана из шаблона
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface DeletedNote extends Note {
  deletedAt: string;
}

// ── Flashcard ──────────────────────────────────────────────────────────────
export interface Flashcard {
  id: string;
  noteId: string;        // Исходная заметка
  front: string;         // Вопрос / понятие
  back: string;          // Ответ / определение
  tags: string[];
  createdAt: string;
  nextReview: string;    // ISO date для следующего повторения
  interval: number;      // Дней до следующего повторения
  easeFactor: number;    // SM-2 ease factor
  repetitions: number;   // Сколько раз повторяли
  lastRating?: 1 | 2 | 3 | 4; // Оценка последнего ответа
}

// ── Daily Note ────────────────────────────────────────────────────────────
export interface DailyNote {
  id: string;
  date: string;          // YYYY-MM-DD
  content: string;       // HTML-контент
  mood?: 1 | 2 | 3 | 4 | 5;
  energy?: 1 | 2 | 3 | 4 | 5;
  linkedNoteIds: string[];
  createdAt: string;
  updatedAt: string;
}

// ── Template ───────────────────────────────────────────────────────────────
export interface Template {
  id: string;
  name: string;
  icon: string;
  type: NoteType;
  titlePlaceholder: string;
  contentHtml: string;
  tags: string[];
  isBuiltin: boolean;
}

export interface AppState {
  books: Book[];
  notes: Note[];
  tags: Tag[];
  deletedNotes: DeletedNote[];
  flashcards: Flashcard[];
  dailyNotes: DailyNote[];
  templates: Template[];
  theme: Theme;
  fontSize: 'sm' | 'md' | 'lg';
  lineHeight: 'tight' | 'normal' | 'relaxed';
}

export type TabId = 'notes' | 'library' | 'new' | 'template' | 'daily' | 'cards' | 'stats' | 'settings';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  isLoggedIn: boolean;
}
