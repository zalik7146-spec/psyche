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
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface AppState {
  books: Book[];
  notes: Note[];
  tags: Tag[];
  theme: Theme;
  fontSize: 'sm' | 'md' | 'lg';
  lineHeight: 'tight' | 'normal' | 'relaxed';
}

export type TabId = 'notes' | 'library' | 'new' | 'stats' | 'settings';

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
