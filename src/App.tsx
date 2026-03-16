import { useState, useCallback, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { AppState, Note, Book, Tag, User, AuthState, Theme, Flashcard, DailyNote, Template } from './types';
import type { DeletedNote } from './types';
import { loadState, saveState, createBook, createTag, createFlashcard, rateFlashcard } from './store';
import { supabase } from './supabase';
import {
  loadCloudState, cloudSaveBook, cloudDeleteBook,
  cloudSaveNote, cloudDeleteNote, cloudSaveTag, syncLocalToCloud,
  cloudSaveDailyNote, loadCloudDailyNotes,
} from './cloudStore';
import { TabId } from './types';
import { getMyProfile } from './socialStore';

import AuthScreen      from './components/AuthScreen';
import NotesList       from './components/NotesList';
import NoteEditor      from './components/NoteEditor';
import BottomNav       from './components/BottomNav';
import Library         from './components/Library';
import BookModal       from './components/BookModal';
import StatsView       from './components/StatsView';
import SettingsView    from './components/SettingsView';
import FlashcardsView  from './components/FlashcardsView';
import DailyNoteView   from './components/DailyNoteView';
import TemplatesModal  from './components/TemplatesModal';
import GraphView       from './components/GraphView';
import GamificationView from './components/GamificationView';
import AnkiView        from './components/AnkiView';
import PublicShareView from './components/PublicShareView';
import FeedView        from './components/FeedView';
import ProfileView     from './components/ProfileView';
import OnboardingView  from './components/OnboardingView';
import NotificationsView from './components/NotificationsView';

import YearWrapped     from './components/YearWrapped';
import ChallengesView  from './components/ChallengesView';
import MessagesView    from './components/MessagesView';
import FollowersView   from './components/FollowersView';

// ── Error Boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%', gap: 20,
          background: '#12100d', color: '#eeddc4', padding: 32,
          fontFamily: 'Inter, sans-serif', textAlign: 'center',
        }}>
          <div style={{ fontSize: 48 }}>🪶</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Lora, serif' }}>
            Что-то пошло не так
          </div>
          <div style={{ fontSize: 13, color: '#8a7258', maxWidth: 300, lineHeight: 1.6 }}>
            {this.state.error}
          </div>
          <button
            onClick={() => { this.setState({ hasError: false, error: '' }); window.location.reload(); }}
            style={{
              padding: '12px 28px', borderRadius: 12,
              background: 'linear-gradient(135deg, #d4a060, #8a5220)',
              border: 'none', color: '#fff', cursor: 'pointer',
              fontSize: 15, fontWeight: 600,
            }}
          >
            Перезагрузить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── sessionToUser ─────────────────────────────────────────────────────────────
function sessionToUser(u: { id: string; email?: string; user_metadata?: Record<string, string>; created_at: string }): User {
  return {
    id:        u.id,
    email:     u.email || '',
    name:      u.user_metadata?.name || u.email?.split('@')[0] || 'Пользователь',
    createdAt: u.created_at,
  };
}

// ── Main App ──────────────────────────────────────────────────────────────────
function AppInner() {
  // Начинаем с isLoggedIn: false — сразу показываем AuthScreen
  // После проверки сессии — обновляем если есть сессия
  const [auth, setAuth] = useState<AuthState>({ user: null, isLoggedIn: false });
  const [sessionChecked, setSessionChecked] = useState(false);
  const [syncing, setSyncing]         = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const [showWrapped, setShowWrapped] = useState(false);
  const [showChallenges, setShowChallenges] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [messageRecipientId, setMessageRecipientId] = useState<string | undefined>(undefined);
  const [showFollowers, setShowFollowers] = useState(false);
  const [followersTab, setFollowersTab] = useState<'followers' | 'following'>('followers');
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const syncedRef = useRef(false);
  const tabOrder: TabId[] = ['notes', 'library', 'daily', 'cards', 'settings', 'stats', 'graph', 'achievements', 'anki', 'share', 'feed', 'profile'];
  const [tabDir, setTabDir] = useState<'left' | 'right'>('left');
  const [tabKey, setTabKey] = useState(0);

  // ── Apply theme immediately ───────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('psyche_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    // Hide splash
    const s = document.getElementById('splash');
    if (s) { s.style.opacity = '0'; setTimeout(() => s.remove(), 400); }
  }, []);

  // ── Supabase Auth — проверяем сессию в фоне ───────────────────────────────
  useEffect(() => {
    // Очищаем токены из URL
    const hash = window.location.hash;
    const search = window.location.search;
    if (hash.includes('access_token') || search.includes('access_token') || search.includes('code=')) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Проверяем сессию с таймаутом
    let done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; setSessionChecked(true); }
    }, 3000);

    supabase.auth.getSession().then(({ data }) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (data.session?.user) {
        setAuth({ user: sessionToUser(data.session.user), isLoggedIn: true });
      }
      setSessionChecked(true);
    }).catch(() => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      setSessionChecked(true);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange(
      (event: string, session: { user: { id: string; email?: string; user_metadata?: Record<string, string>; created_at: string } } | null) => {
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
          setAuth({ user: sessionToUser(session.user), isLoggedIn: true });
          setSessionChecked(true);
        } else if (event === 'SIGNED_OUT') {
          setAuth({ user: null, isLoggedIn: false });
        }
      }
    );
    return () => { subscription.unsubscribe(); };
  }, []);

  // ── App State ─────────────────────────────────────────────────────────────
  const [state, setState] = useState<AppState>(() => loadState('guest'));
  const update = useCallback((fn: (s: AppState) => AppState) => setState(prev => fn(prev)), []);

  // Сохраняем тему отдельно для быстрого доступа при старте
  useEffect(() => {
    localStorage.setItem('psyche_theme', state.theme);
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  // ── Auto night mode ────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.theme !== 'auto' as Theme) return;
    const applyAuto = () => {
      const h = new Date().getHours();
      document.documentElement.setAttribute('data-theme', (h < 7 || h >= 21) ? 'dark' : 'light');
    };
    applyAuto();
    const interval = setInterval(applyAuto, 60_000);
    return () => clearInterval(interval);
  }, [state.theme]);

  // ── Cloud sync ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!auth.user || syncedRef.current) return;
    const userId = auth.user.id;
    const localState = loadState(userId);
    setState(localState);
    setSyncing(true);
    Promise.all([
      loadCloudState(userId),
      loadCloudDailyNotes(userId),
    ]).then(([cloudData, cloudDailyNotes]) => {
      if (cloudData) {
        const hasCloud = (cloudData.books?.length || 0) > 0 || (cloudData.notes?.length || 0) > 0;
        if (hasCloud) {
          setState(prev => ({
            ...prev,
            books: cloudData.books || prev.books,
            notes: cloudData.notes || prev.notes,
            tags:  cloudData.tags  || prev.tags,
            dailyNotes: cloudDailyNotes.length > 0 ? cloudDailyNotes : prev.dailyNotes,
          }));
        } else {
          syncLocalToCloud(localState, userId);
        }
        syncedRef.current = true;
      } else if (cloudDailyNotes.length > 0) {
        setState(prev => ({ ...prev, dailyNotes: cloudDailyNotes }));
      }
      setSyncing(false);
    }).catch(() => setSyncing(false));
  }, [auth.user?.id]); // eslint-disable-line

  useEffect(() => {
    if (auth.user) saveState(state, auth.user.id);
  }, [state, auth.user?.id]); // eslint-disable-line

  // ── Auth handlers ─────────────────────────────────────────────────────────
  const handleAuth = (user: User) => {
    syncedRef.current = false;
    supabase.auth.getUser().then(({ data }) => {
      const meta = data?.user?.user_metadata?.avatar;
      if (meta && user.id) {
        const local = localStorage.getItem(`psyche_avatar_${user.id}`);
        if (!local) localStorage.setItem(`psyche_avatar_${user.id}`, meta);
      }
    }).catch(() => {});
    setAuth({ user, isLoggedIn: true });
  };

  const handleLogout = async () => {
    if (auth.user) saveState(state, auth.user.id);
    await supabase.auth.signOut().catch(() => {});
    setAuth({ user: null, isLoggedIn: false });
    syncedRef.current = false;
  };

  // ── Book handlers ─────────────────────────────────────────────────────────
  const [bookModal, setBookModal] = useState<{ open: boolean; book?: Book }>({ open: false });

  const handleSaveBook = (data: Partial<Book>) => {
    const userId = auth.user?.id || 'guest';
    if (bookModal.book) {
      const updated = { ...bookModal.book, ...data };
      update(s => ({ ...s, books: s.books.map(b => b.id === bookModal.book!.id ? updated : b) }));
      cloudSaveBook(updated, userId);
    } else {
      const book = createBook(data);
      update(s => ({ ...s, books: [book, ...s.books] }));
      cloudSaveBook(book, userId);
    }
    setBookModal({ open: false });
  };

  const handleDeleteBook = (bookId: string) => {
    update(s => ({ ...s, books: s.books.filter(b => b.id !== bookId) }));
    cloudDeleteBook(bookId);
    setBookModal({ open: false });
  };

  // ── Note handlers ─────────────────────────────────────────────────────────
  const handleSaveNote = (note: Note) => {
    const userId = auth.user?.id || 'guest';
    update(s => {
      const exists = s.notes.find(n => n.id === note.id);
      return {
        ...s,
        notes: exists
          ? s.notes.map(n => n.id === note.id ? note : n)
          : [note, ...s.notes],
      };
    });
    cloudSaveNote(note, userId);
  };

  const handleDeleteNote = (noteId: string) => {
    const note = state.notes.find(n => n.id === noteId);
    if (!note) return;
    const plainContent = note.content.replace(/<[^>]+>/g, '').trim();
    const isEmpty = !note.title.trim() && !plainContent;
    if (isEmpty) {
      update(s => ({ ...s, notes: s.notes.filter(n => n.id !== noteId) }));
    } else {
      const deleted: DeletedNote = { ...note, deletedAt: new Date().toISOString() };
      update(s => ({
        ...s,
        notes: s.notes.filter(n => n.id !== noteId),
        deletedNotes: [deleted, ...(s.deletedNotes || [])].slice(0, 100),
      }));
    }
    cloudDeleteNote(noteId);
    setEditingNote(null);
  };

  const handleRestoreNote = (noteId: string) => {
    const deleted = (state.deletedNotes || []).find(n => n.id === noteId);
    if (!deleted) return;
    const { deletedAt: _d, ...note } = deleted;
    void _d;
    update(s => ({
      ...s,
      notes: [note as Note, ...s.notes],
      deletedNotes: (s.deletedNotes || []).filter(n => n.id !== noteId),
    }));
  };

  const handlePermanentDelete = (noteId: string) => {
    update(s => ({ ...s, deletedNotes: (s.deletedNotes || []).filter(n => n.id !== noteId) }));
  };

  const handleEmptyTrash = () => { update(s => ({ ...s, deletedNotes: [] })); };

  const handleAddTag = (name: string): Tag => {
    const existing = state.tags.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const colors = ['#b07d4a','#8a5a3a','#7a6a4a','#5a8a6a','#4a6a8a','#7a4a4a','#8a7a3a'];
    const tag = createTag(name, colors[state.tags.length % colors.length]);
    update(s => ({ ...s, tags: [...s.tags, tag] }));
    cloudSaveTag(tag, auth.user?.id || 'guest');
    return tag;
  };

  // ── Flashcard handlers ────────────────────────────────────────────────────
  const handleSaveFlashcard = (card: Flashcard) => {
    update(s => {
      const exists = s.flashcards.find(c => c.id === card.id);
      return {
        ...s,
        flashcards: exists
          ? s.flashcards.map(c => c.id === card.id ? card : c)
          : [card, ...s.flashcards],
      };
    });
  };

  const handleDeleteFlashcard = (id: string) => {
    update(s => ({ ...s, flashcards: s.flashcards.filter(c => c.id !== id) }));
  };

  const handleRateFlashcard = (card: Flashcard) => {
    const updated = rateFlashcard(card, card.lastRating || 3);
    handleSaveFlashcard(updated);
  };

  // ── DailyNote handlers ────────────────────────────────────────────────────
  const handleSaveDailyNote = (dn: DailyNote) => {
    const userId = auth.user?.id || 'guest';
    update(s => {
      const exists = s.dailyNotes.find(d => d.id === dn.id);
      return {
        ...s,
        dailyNotes: exists
          ? s.dailyNotes.map(d => d.id === dn.id ? dn : d)
          : [dn, ...s.dailyNotes],
      };
    });
    cloudSaveDailyNote(dn, userId);
  };

  // ── Export PDF (single note) ──────────────────────────────────────────────
  const handleExportPDF = async (note: Note) => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const book = state.books.find(b => b.id === note.bookId);
      const plain = note.content
        .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n').replace(/<\/li>/gi, '\n')
        .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n').trim();
      const PAGE_W = 210, MARGIN = 20, TEXT_W = PAGE_W - MARGIN * 2, PAGE_H = 297;
      let y = MARGIN;
      const checkPage = (n = 10) => { if (y + n > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN; } };
      doc.setFillColor(180, 130, 60); doc.rect(MARGIN, y, 3, 22, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(30, 22, 12);
      const tLines = doc.splitTextToSize(note.title || 'Без названия', TEXT_W - 6);
      doc.text(tLines, MARGIN + 8, y + 6); y += tLines.length * 8 + 10;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(140, 110, 80);
      const meta: string[] = [];
      if (book) meta.push(`${book.title} · ${book.author}`);
      meta.push(new Date(note.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }));
      if (note.tags?.length) meta.push(note.tags.map(t => `#${t}`).join(' '));
      doc.text(meta.join('    '), MARGIN, y); y += 6;
      doc.setDrawColor(200, 170, 120); doc.setLineWidth(0.3); doc.line(MARGIN, y, PAGE_W - MARGIN, y); y += 8;
      if (note.quote) {
        checkPage(20);
        const qLines = doc.splitTextToSize(`"${note.quote}"`, TEXT_W - 14);
        const qH = qLines.length * 6 + 10;
        doc.setFillColor(250, 242, 228); doc.rect(MARGIN, y, TEXT_W, qH, 'F');
        doc.setFont('helvetica', 'italic'); doc.setFontSize(11); doc.setTextColor(160, 110, 50);
        doc.text(qLines, MARGIN + 8, y + 7); y += qH + 10;
      }
      checkPage(20);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(30, 22, 12);
      plain.split('\n').filter(p => p.trim()).forEach(para => {
        const pLines = doc.splitTextToSize(para, TEXT_W);
        checkPage(pLines.length * 6 + 4);
        doc.text(pLines, MARGIN, y); y += pLines.length * 6 + 4;
      });
      const total = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
      for (let p = 1; p <= total; p++) {
        doc.setPage(p); doc.setFontSize(8); doc.setTextColor(180, 160, 130);
        doc.text('Psyche', MARGIN, PAGE_H - 8);
        doc.text(`${p} / ${total}`, PAGE_W - MARGIN, PAGE_H - 8, { align: 'right' });
      }
      const fn = (note.title || 'note').replace(/[^а-яёa-z0-9\s_-]/gi, '').trim().replace(/\s+/g, '_').slice(0, 50) || 'note';
      doc.save(`${fn}.pdf`);
      showToast('✓ PDF сохранён');
    } catch (e) { console.error('PDF error:', e); }
  };

  // ── Export entire book as PDF ─────────────────────────────────────────────
  const handleExportBookPDF = async (bookId: string) => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const book = state.books.find(b => b.id === bookId);
      if (!book) return;
      const bookNotes = state.notes.filter(n => n.bookId === bookId);
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const PAGE_W = 210, MARGIN = 20, TEXT_W = PAGE_W - MARGIN * 2, PAGE_H = 297;
      let y = MARGIN;
      const checkPage = (n = 10) => { if (y + n > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN; } };
      doc.setFillColor(30, 22, 12); doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
      doc.setFillColor(180, 130, 60); doc.rect(0, 0, 4, PAGE_H, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(28); doc.setTextColor(238, 223, 196);
      const tLines = doc.splitTextToSize(book.title, TEXT_W - 10);
      doc.text(tLines, MARGIN + 8, 60);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(14); doc.setTextColor(180, 150, 100);
      doc.text(book.author, MARGIN + 8, 60 + tLines.length * 12 + 8);
      doc.setFontSize(11); doc.setTextColor(120, 100, 70);
      doc.text(`${bookNotes.length} записей · Конспект`, MARGIN + 8, PAGE_H - 30);
      doc.text('Psyche', MARGIN + 8, PAGE_H - 22);
      bookNotes.forEach((note, idx) => {
        doc.addPage(); y = MARGIN;
        doc.setFillColor(180, 130, 60); doc.rect(MARGIN, y, 3, 18, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(30, 22, 12);
        const nT = doc.splitTextToSize(note.title || 'Без названия', TEXT_W - 6);
        doc.text(nT, MARGIN + 8, y + 6); y += nT.length * 7 + 10;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(140, 110, 80);
        const meta = [note.type, new Date(note.createdAt).toLocaleDateString('ru-RU'), ...(note.tags?.map(t => `#${t}`) || [])].join(' · ');
        doc.text(meta, MARGIN, y); y += 6;
        doc.setDrawColor(200, 170, 120); doc.line(MARGIN, y, PAGE_W - MARGIN, y); y += 6;
        if (note.quote) {
          checkPage(16);
          const qL = doc.splitTextToSize(`"${note.quote}"`, TEXT_W - 14);
          const qH = qL.length * 6 + 8;
          doc.setFillColor(250, 242, 228); doc.rect(MARGIN, y, TEXT_W, qH, 'F');
          doc.setFont('helvetica', 'italic'); doc.setFontSize(10); doc.setTextColor(160, 110, 50);
          doc.text(qL, MARGIN + 6, y + 6); y += qH + 8;
        }
        const plain = note.content.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
        doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(30, 22, 12);
        plain.split('\n').filter(p => p.trim()).forEach(para => {
          const pL = doc.splitTextToSize(para, TEXT_W);
          checkPage(pL.length * 6 + 4);
          doc.text(pL, MARGIN, y); y += pL.length * 6 + 4;
        });
        doc.setFontSize(8); doc.setTextColor(180, 160, 130);
        doc.text(`${idx + 2}`, PAGE_W - MARGIN, PAGE_H - 8, { align: 'right' });
      });
      const fn = book.title.replace(/[^а-яёa-z0-9\s_-]/gi, '').trim().replace(/\s+/g, '_').slice(0, 50) || 'book';
      doc.save(`${fn}_конспект.pdf`);
      showToast(`✓ Конспект «${book.title}» сохранён`);
    } catch (e) { console.error('Book PDF error:', e); }
  };

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showToast = (text: string, duration = 2500) => {
    const t = document.createElement('div');
    t.textContent = text;
    Object.assign(t.style, {
      position: 'fixed', bottom: '100px', left: '50%', transform: 'translateX(-50%)',
      background: '#262219', color: '#eeddc4',
      padding: '10px 20px', borderRadius: '12px', border: '1px solid #38332c',
      fontFamily: 'Inter, sans-serif', fontSize: '13px', zIndex: '99999',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      whiteSpace: 'nowrap',
    });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), duration);
  };

  // ── Create flashcard from note ────────────────────────────────────────────
  const handleCreateFlashcardFromNote = (note: Note) => {
    const plain = note.content.replace(/<[^>]+>/g, '').trim();
    const card = createFlashcard({
      noteId: note.id,
      front: note.title || 'Вопрос?',
      back: note.quote || plain.slice(0, 200) || '...',
      tags: note.tags,
    });
    handleSaveFlashcard(card);
    try { navigator.vibrate?.([10, 30, 10]); } catch {}
  };

  // ── Tab navigation ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]         = useState<TabId>('notes');
  const [editingNote, setEditingNote]     = useState<Note | null | 'new'>(null);
  const [newNoteBookId, setNewNoteBookId] = useState<string | undefined>(undefined);
  const [showTemplates, setShowTemplates] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<Template | null>(null);

  const handleNewNote = (bookId?: string) => {
    setNewNoteBookId(bookId);
    setEditingNote('new');
  };

  const handleTheme = (theme: Theme) => { update(s => ({ ...s, theme })); };

  const handleClearData = () => {
    if (window.confirm('Удалить все данные? Это действие необратимо.')) {
      const userId = auth.user?.id || 'guest';
      localStorage.removeItem(`psyche_v2_${userId}`);
      setState(loadState(userId));
    }
  };

  const handleTabChange = (tab: TabId) => {
    if (tab === 'new') {
      try { navigator.vibrate?.(10); } catch {}
      setShowTemplates(false);
      setPendingTemplate(null);
      handleNewNote();
    } else if (tab === 'template') {
      try { navigator.vibrate?.(10); } catch {}
      setShowTemplates(true);
    } else {
      const cur  = tabOrder.indexOf(activeTab);
      const next = tabOrder.indexOf(tab);
      setTabDir(next >= cur ? 'left' : 'right');
      setTabKey(k => k + 1);
      setActiveTab(tab);
    }
  };

  // ── Onboarding check ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!auth.user) return;
    const key = `psyche_onboarded_${auth.user.id}`;
    if (localStorage.getItem(key)) return;
    getMyProfile(auth.user.id).then(profile => {
      if (!profile?.username) setShowOnboarding(true);
    }).catch(() => {});
  }, [auth.user?.id]); // eslint-disable-line

  // ── Daily Review ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!auth.user || state.notes.length === 0) return;
    const key = `psyche_daily_review_${auth.user.id}_${new Date().toDateString()}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    const old = state.notes.filter(n => {
      const d = new Date(n.createdAt);
      return Date.now() - d.getTime() > 7 * 24 * 60 * 60 * 1000;
    });
    if (old.length === 0) return;
    const pick = old[Math.floor(Math.random() * old.length)];
    setTimeout(() => {
      const t = document.createElement('div');
      t.innerHTML = `<div style="font-weight:600;margin-bottom:4px">📚 Из прошлого</div><div style="font-size:12px;opacity:0.8">${pick.title || '...'}...</div>`;
      Object.assign(t.style, {
        position: 'fixed', bottom: '100px', left: '50%', transform: 'translateX(-50%)',
        background: '#262219', color: '#eeddc4',
        padding: '12px 20px', borderRadius: '14px', border: '1px solid #38332c',
        fontFamily: 'Inter, sans-serif', fontSize: '13px',
        zIndex: '99999', maxWidth: '320px', width: '90%',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)', cursor: 'pointer', lineHeight: '1.5',
      });
      t.onclick = () => { t.remove(); setShowNotifications(true); };
      document.body.appendChild(t);
      setTimeout(() => { try { t.remove(); } catch {} }, 6000);
      setUnreadNotifs(n => n + 1);
    }, 3000);
  }, [auth.user?.id, state.notes.length]); // eslint-disable-line

  // ── Show auth screen while session check or not logged in ─────────────────
  // Показываем AuthScreen сразу — не ждём проверки сессии
  // Если сессия найдена — автоматически переходим в приложение
  if (!auth.isLoggedIn) {
    // sessionChecked нужен только для предотвращения мигания
    void sessionChecked;
    return <AuthScreen onAuth={handleAuth} />;
  }

  if (showOnboarding && auth.user) return (
    <OnboardingView
      user={auth.user}
      onComplete={(username) => {
        localStorage.setItem(`psyche_onboarded_${auth.user!.id}`, '1');
        if (username) localStorage.setItem(`psyche_username_${auth.user!.id}`, username);
        setShowOnboarding(false);
      }}
    />
  );

  if (editingNote !== null) {
    const note = editingNote === 'new' ? undefined : editingNote;
    return (
      <NoteEditor
        note={note}
        books={state.books}
        tags={state.tags}
        allNotes={state.notes}
        templates={state.templates}
        onSave={handleSaveNote}
        onClose={() => setEditingNote(null)}
        onDelete={handleDeleteNote}
        onAddTag={handleAddTag}
        onExportPDF={handleExportPDF}
        onCreateFlashcard={handleCreateFlashcardFromNote}
        defaultBookId={newNoteBookId}
        pendingTemplate={pendingTemplate}
        onTemplateClear={() => setPendingTemplate(null)}
      />
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', overflow: 'hidden', position: 'relative',
    }}>
      {/* Sync indicator */}
      {syncing && (
        <div style={{
          position: 'fixed', top: 'calc(env(safe-area-inset-top,0px) + 8px)',
          left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, display: 'flex', alignItems: 'center', gap: 7,
          padding: '6px 14px', borderRadius: 99,
          background: '#262219', border: '1px solid #38332c',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          fontSize: 12, color: '#a09070', fontFamily: 'Inter, sans-serif',
        }}>
          <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
          Синхронизация...
        </div>
      )}

      {/* Content */}
      <div
        key={tabKey}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}
        className={tabDir === 'left' ? 'view-enter' : 'view-enter-back'}
      >
        {activeTab === 'notes' && (
          <NotesList
            notes={state.notes}
            books={state.books}
            tags={state.tags}
            onOpen={note => setEditingNote(note)}
            onNew={() => handleNewNote()}
            onDelete={handleDeleteNote}
          />
        )}

        {activeTab === 'library' && (
          <Library
            books={state.books}
            notes={state.notes}
            onAddBook={() => setBookModal({ open: true })}
            onEditBook={book => setBookModal({ open: true, book })}
            onNewNoteForBook={bookId => handleNewNote(bookId)}
          />
        )}

        {activeTab === 'daily' && (
          <DailyNoteView
            dailyNotes={state.dailyNotes}
            notes={state.notes}
            onSave={handleSaveDailyNote}
            onOpenNote={note => setEditingNote(note)}
          />
        )}

        {activeTab === 'cards' && (
          <FlashcardsView
            flashcards={state.flashcards}
            notes={state.notes}
            onSave={handleSaveFlashcard}
            onDelete={handleDeleteFlashcard}
            onRate={handleRateFlashcard}
          />
        )}

        {activeTab === 'stats' && (
          <StatsView
            notes={state.notes}
            books={state.books}
            tags={state.tags}
            onOpen={note => setEditingNote(note)}
          />
        )}

        {activeTab === 'graph' && (
          <GraphView
            notes={state.notes}
            books={state.books}
            onOpenNote={note => setEditingNote(note)}
            onBack={() => handleTabChange('profile')}
          />
        )}

        {activeTab === 'achievements' && (
          <GamificationView
            notes={state.notes}
            books={state.books}
            dailyNotes={state.dailyNotes}
            onBack={() => handleTabChange('profile')}
          />
        )}

        {activeTab === 'anki' && (
          <AnkiView
            flashcards={state.flashcards}
            notes={state.notes}
            onSave={handleSaveFlashcard}
            onDelete={handleDeleteFlashcard}
            onBack={() => handleTabChange('profile')}
          />
        )}

        {activeTab === 'share' && (
          <PublicShareView
            notes={state.notes}
            books={state.books}
            onBack={() => handleTabChange('profile')}
            onExportBookPDF={handleExportBookPDF}
          />
        )}

        {activeTab === 'feed' && auth.user && (
          <FeedView
            user={auth.user}
            notes={state.notes}
            books={state.books}
          />
        )}

        {activeTab === 'profile' && auth.user && (
          <ProfileView
            user={auth.user}
            books={state.books}
            notes={state.notes}
            onNavigate={(tab) => handleTabChange(tab as TabId)}
            onOpenWrapped={() => setShowWrapped(true)}
            onOpenChallenges={() => setShowChallenges(true)}
            onOpenMessages={() => setShowMessages(true)}
            onOpenFollowers={(tab) => { setFollowersTab(tab); setShowFollowers(true); }}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            user={auth.user!}
            state={state}
            onTheme={handleTheme}
            onLogout={handleLogout}
            onClearData={handleClearData}
            onRestoreNote={handleRestoreNote}
            onPermanentDelete={handlePermanentDelete}
            onEmptyTrash={handleEmptyTrash}
            onUpdateAvatar={(av) => {
              if (auth.user?.id) {
                localStorage.setItem(`psyche_avatar_${auth.user.id}`, av);
                supabase.auth.updateUser({ data: { avatar: av } }).catch(() => {});
              }
            }}
            onNavigate={(tab) => handleTabChange(tab as TabId)}
            onBack={() => handleTabChange('profile')}
          />
        )}
      </div>

      <BottomNav
        active={activeTab}
        onChange={handleTabChange}
        unreadNotifs={unreadNotifs}
        onNotifications={() => { setUnreadNotifs(0); setShowNotifications(true); }}
      />

      {/* Modals */}
      {bookModal.open && (
        <BookModal
          book={bookModal.book}
          onSave={handleSaveBook}
          onDelete={handleDeleteBook}
          onClose={() => setBookModal({ open: false })}
        />
      )}

      {showNotifications && auth.user && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'var(--bg-base)' }}>
          <NotificationsView
            user={auth.user}
            onBack={() => setShowNotifications(false)}
          />
        </div>
      )}



      {showTemplates && (
        <TemplatesModal
          templates={state.templates}
          onSelect={tpl => {
            setPendingTemplate(tpl);
            setShowTemplates(false);
            handleNewNote();
          }}
          onClose={() => {
            setShowTemplates(false);
            handleNewNote();
          }}
        />
      )}

      {showWrapped && (
        <YearWrapped
          notes={state.notes}
          books={state.books}
          onClose={() => setShowWrapped(false)}
        />
      )}

      {showChallenges && (
        <ChallengesView
          notes={state.notes}
          books={state.books}
          onClose={() => setShowChallenges(false)}
        />
      )}

      {showMessages && auth.user && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
          <MessagesView
            userId={auth.user.id}
            initialRecipientId={messageRecipientId}
            onBack={() => { setShowMessages(false); setMessageRecipientId(undefined); }}
          />
        </div>
      )}

      {showFollowers && auth.user && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
          <FollowersView
            userId={auth.user.id}
            initialTab={followersTab}
            onBack={() => setShowFollowers(false)}
            onOpenMessages={(recipientId) => {
              setShowFollowers(false);
              setMessageRecipientId(recipientId);
              setShowMessages(true);
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
