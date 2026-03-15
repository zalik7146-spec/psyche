import { useState, useCallback, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { AppState, Note, Book, Tag, User, AuthState, Theme, Flashcard, DailyNote, Template } from './types';
import type { DeletedNote } from './types';
import { loadState, saveState, createBook, createTag, createFlashcard, rateFlashcard } from './store';
import { supabase } from './supabase';
import {
  loadCloudState, cloudSaveBook, cloudDeleteBook,
  cloudSaveNote, cloudDeleteNote, cloudSaveTag, syncLocalToCloud,
} from './cloudStore';
import Library from './components/Library';
import NotesList from './components/NotesList';
import NoteEditor from './components/NoteEditor';
import BottomNav from './components/BottomNav';
import BookModal from './components/BookModal';
import StatsView from './components/StatsView';
import SettingsView from './components/SettingsView';
import AuthScreen from './components/AuthScreen';
import FlashcardsView from './components/FlashcardsView';
import DailyNoteView from './components/DailyNoteView';
import TemplatesModal from './components/TemplatesModal';
import GraphView from './components/GraphView';
import GamificationView from './components/GamificationView';
import { TabId } from './types';

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
          background: '#12100d', color: '#eedfc4', padding: 32,
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
            onClick={() => {
              this.setState({ hasError: false, error: '' });
              window.location.reload();
            }}
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

function sessionToUser(supaSession: {
  user: { id: string; email?: string; user_metadata?: Record<string, string>; created_at: string }
}): User {
  const u = supaSession.user;
  return {
    id:        u.id,
    email:     u.email || '',
    name:      u.user_metadata?.name || u.email?.split('@')[0] || 'Пользователь',
    createdAt: u.created_at,
  };
}

function AppInner() {
  const [auth, setAuth]         = useState<AuthState>({ user: null, isLoggedIn: false });
  const [appReady, setAppReady] = useState(false);
  const [syncing, setSyncing]   = useState(false);
  const syncedRef = useRef(false);
  const tabOrder: TabId[] = ['notes', 'library', 'daily', 'cards', 'settings', 'graph', 'achievements'];
  const [tabDir, setTabDir]   = useState<'left' | 'right'>('left');
  const [tabKey, setTabKey]   = useState(0);

  // ── Supabase Auth ─────────────────────────────────────────────────────────
  useEffect(() => {
    const hash   = window.location.hash;
    const search = window.location.search;
    const hasToken = hash.includes('access_token') || search.includes('access_token') || search.includes('code=');
    if (hasToken) window.history.replaceState({}, document.title, window.location.pathname);

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setAuth({ user: sessionToUser(data.session), isLoggedIn: true });
      }
      setAppReady(true);
    }).catch(() => {
      // Supabase недоступен — работаем локально
      setAppReady(true);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange((event: string, session: { user: { id: string; email?: string; user_metadata?: Record<string, string>; created_at: string } } | null) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session?.user) {
        setAuth({ user: sessionToUser(session), isLoggedIn: true });
        setAppReady(true);
      } else if (event === 'SIGNED_OUT') {
        setAuth({ user: null, isLoggedIn: false });
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── App State ─────────────────────────────────────────────────────────────
  const [state, setState] = useState<AppState>(() => loadState('guest'));

  useEffect(() => {
    if (!auth.user || syncedRef.current) return;
    const userId = auth.user.id;
    const localState = loadState(userId);
    setState(localState);
    setSyncing(true);
    loadCloudState(userId).then(cloudData => {
      if (cloudData) {
        const hasCloudData = (cloudData.books?.length || 0) > 0 || (cloudData.notes?.length || 0) > 0;
        if (hasCloudData) {
          setState(prev => ({
            ...prev,
            books: cloudData.books || prev.books,
            notes: cloudData.notes || prev.notes,
            tags:  cloudData.tags  || prev.tags,
          }));
        } else {
          syncLocalToCloud(localState, userId);
        }
        syncedRef.current = true;
      }
      setSyncing(false);
    }).catch(() => setSyncing(false));
  }, [auth.user?.id]); // eslint-disable-line

  useEffect(() => {
    if (auth.user) saveState(state, auth.user.id);
  }, [state, auth.user?.id]); // eslint-disable-line

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  const update = useCallback((fn: (s: AppState) => AppState) => setState(prev => fn(prev)), []);

  // ── UI State ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]         = useState<TabId>('notes');
  const [editingNote, setEditingNote]     = useState<Note | null | 'new'>(null);
  const [newNoteBookId, setNewNoteBookId] = useState<string | undefined>(undefined);
  const [bookModal, setBookModal]         = useState<{ open: boolean; book?: Book }>({ open: false });
  const [showTemplates, setShowTemplates] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<Template | null>(null);

  // ── Auth handlers ─────────────────────────────────────────────────────────
  const handleAuth = (user: User) => {
    syncedRef.current = false;
    setAuth({ user, isLoggedIn: true });
  };
  const handleLogout = async () => {
    if (auth.user) saveState(state, auth.user.id);
    await supabase.auth.signOut().catch(() => {});
    setAuth({ user: null, isLoggedIn: false });
    syncedRef.current = false;
  };

  // ── Book handlers ─────────────────────────────────────────────────────────
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

  const handleNewNote = (bookId?: string) => {
    setNewNoteBookId(bookId);
    setEditingNote('new');
  };

  const handleTheme = (theme: Theme) => { update(s => ({ ...s, theme })); };

  // ── Auto night mode ────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.theme !== 'auto' as Theme) return;
    const applyAuto = () => {
      const h = new Date().getHours();
      const isDark = h < 7 || h >= 21;
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    };
    applyAuto();
    const interval = setInterval(applyAuto, 60_000);
    return () => clearInterval(interval);
  }, [state.theme]);

  const handleClearData = () => {
    if (window.confirm('Удалить все данные? Это действие необратимо.')) {
      const userId = auth.user?.id || 'guest';
      localStorage.removeItem(`psyche_v2_${userId}`);
      setState(loadState(userId));
    }
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
    update(s => {
      const exists = s.dailyNotes.find(d => d.id === dn.id);
      return {
        ...s,
        dailyNotes: exists
          ? s.dailyNotes.map(d => d.id === dn.id ? dn : d)
          : [dn, ...s.dailyNotes],
      };
    });
  };

  // ── Export PDF ────────────────────────────────────────────────────────────
  const handleExportPDF = async (note: Note) => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const book = state.books.find(b => b.id === note.bookId);

      // Strip HTML tags and decode entities for plain text
      const plain = note.content
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      const PAGE_W = 210;
      const MARGIN = 20;
      const TEXT_W = PAGE_W - MARGIN * 2;
      const PAGE_H = 297;
      let y = MARGIN;

      const checkPage = (needed = 10) => {
        if (y + needed > PAGE_H - MARGIN) {
          doc.addPage();
          y = MARGIN;
        }
      };

      // ── Accent bar ──
      doc.setFillColor(180, 130, 60);
      doc.rect(MARGIN, y, 3, 22, 'F');

      // ── Title ──
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(30, 22, 12);
      const titleLines = doc.splitTextToSize(note.title || 'Без названия', TEXT_W - 6);
      doc.text(titleLines, MARGIN + 8, y + 6);
      y += titleLines.length * 8 + 10;

      // ── Meta ──
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(140, 110, 80);
      const metaParts: string[] = [];
      if (book) metaParts.push(`${book.title}  ·  ${book.author}`);
      metaParts.push(new Date(note.createdAt).toLocaleDateString('ru-RU', {
        day: 'numeric', month: 'long', year: 'numeric',
      }));
      if (note.tags?.length) metaParts.push(note.tags.map(t => `#${t}`).join(' '));
      doc.text(metaParts.join('    '), MARGIN, y);
      y += 6;

      // ── Divider ──
      doc.setDrawColor(200, 170, 120);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      y += 8;

      // ── Quote block ──
      if (note.quote) {
        checkPage(20);
        doc.setFillColor(250, 242, 228);
        doc.setDrawColor(212, 145, 74);
        doc.setLineWidth(0.5);
        const qLines = doc.splitTextToSize(`"${note.quote}"`, TEXT_W - 14);
        const qH = qLines.length * 6 + 10;
        doc.rect(MARGIN, y, TEXT_W, qH, 'F');
        doc.line(MARGIN, y, MARGIN, y + qH);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(11);
        doc.setTextColor(160, 110, 50);
        doc.text(qLines, MARGIN + 8, y + 7);
        y += qH + 10;
      }

      // ── Body text ──
      checkPage(20);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(30, 22, 12);

      const paragraphs = plain.split('\n').filter(p => p.trim());
      for (const para of paragraphs) {
        const pLines = doc.splitTextToSize(para.trim(), TEXT_W);
        checkPage(pLines.length * 6 + 4);
        doc.text(pLines, MARGIN, y);
        y += pLines.length * 6 + 4;
      }

      // ── Footer ──
      const totalPages = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(180, 160, 130);
        doc.text('Psyche — Дневник Разума', MARGIN, PAGE_H - 8);
        doc.text(`${p} / ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 8, { align: 'right' });
      }

      const filename = (note.title || 'заметка')
        .replace(/[^а-яёa-z0-9\s_-]/gi, '')
        .trim()
        .replace(/\s+/g, '_')
        .slice(0, 50) || 'note';
      doc.save(`${filename}.pdf`);

      // Toast
      const toast = document.createElement('div');
      toast.textContent = '✓ PDF сохранён';
      Object.assign(toast.style, {
        position: 'fixed', bottom: '100px', left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--bg-raised)', color: 'var(--text-primary)',
        padding: '10px 20px', borderRadius: '12px',
        border: '1px solid var(--border-mid)',
        fontFamily: 'Inter, sans-serif', fontSize: '13px',
        zIndex: '99999',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        animation: 'fadeIn 0.2s ease',
      });
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2500);

    } catch (e) {
      console.error('PDF export error:', e);
    }
  };

  // ── Quick flashcard from note ─────────────────────────────────────────────
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
  const handleTabChange = (tab: TabId) => {
    if (tab === 'new') {
      // Free note — open editor directly
      try { navigator.vibrate?.(10); } catch {}
      setShowTemplates(false);
      setPendingTemplate(null);
      handleNewNote();
    } else if (tab === 'template') {
      // Show templates modal
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

  // ── Loading ───────────────────────────────────────────────────────────────
  if (!appReady) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', flexDirection: 'column', gap: '16px',
        background: 'var(--bg-base)',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '20px',
          background: 'linear-gradient(135deg, var(--bg-raised), var(--bg-active))',
          border: '1px solid var(--border-mid)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '32px',
          animation: 'scaleInBounce 0.5s cubic-bezier(0.34,1.56,0.64,1)',
        }}>🪶</div>
        <div className="spinner" />
      </div>
    );
  }

  if (!auth.isLoggedIn) return <AuthScreen onAuth={handleAuth} />;

  // ── NoteEditor overlay ────────────────────────────────────────────────────
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

  // ── Main App ──────────────────────────────────────────────────────────────
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
          zIndex: 9999,
          display: 'flex', alignItems: 'center', gap: '7px',
          padding: '6px 14px', borderRadius: '99px',
          background: 'var(--bg-raised)', border: '1px solid var(--border-mid)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          fontSize: '12px', color: 'var(--text-muted)',
          fontFamily: 'Inter, sans-serif',
          animation: 'fadeIn 0.3s ease',
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
          />
        )}

        {activeTab === 'achievements' && (
          <GamificationView
            notes={state.notes}
            books={state.books}
            dailyNotes={state.dailyNotes}
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
            onUpdateAvatar={(av) => { void av; }}
            onNavigate={(tab) => handleTabChange(tab as TabId)}
          />
        )}

        {bookModal.open && (
          <BookModal
            book={bookModal.book}
            onSave={handleSaveBook}
            onDelete={handleDeleteBook}
            onClose={() => setBookModal({ open: false })}
          />
        )}
      </div>

      <BottomNav active={activeTab} onChange={handleTabChange} />

      {/* Templates modal */}
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
