import { useState, useCallback, useEffect, useRef } from 'react';
import { AppState, Note, Book, Tag, User, AuthState, Theme } from './types';
import { loadState, saveState, createBook, createTag } from './store';
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
import { TabId } from './types';

// ── Supabase session → UserType ─────────────────────────────────────────────
function sessionToUser(supaSession: { user: { id: string; email?: string; user_metadata?: Record<string, string>; created_at: string } }): User {
  const u = supaSession.user;
  return {
    id:        u.id,
    email:     u.email || '',
    name:      u.user_metadata?.name || u.email?.split('@')[0] || 'Пользователь',
    createdAt: u.created_at,
  };
}

export default function App() {
  const [auth, setAuth]       = useState<AuthState>({ user: null, isLoggedIn: false });
  const [appReady, setAppReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const syncedRef = useRef(false);
  const tabOrder: TabId[] = ['notes', 'library', 'stats', 'settings'];
  const [tabDir, setTabDir] = useState<'left' | 'right'>('left');
  const [tabKey, setTabKey] = useState(0);

  // ── Check existing Supabase session on mount ──────────────────────────────
  useEffect(() => {
    // First: handle email confirmation tokens in URL hash/query
    // Supabase puts tokens in hash: #access_token=...&type=signup
    const hash = window.location.hash;
    const search = window.location.search;
    const hasTokenInHash = hash.includes('access_token') || hash.includes('type=signup') || hash.includes('type=recovery');
    const hasTokenInQuery = search.includes('access_token') || search.includes('type=signup') || search.includes('code=');

    if (hasTokenInHash || hasTokenInQuery) {
      // Let Supabase process the token — it will fire onAuthStateChange
      // Clean URL immediately so it looks clean
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Check existing session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        const user = sessionToUser(data.session);
        setAuth({ user, isLoggedIn: true });
      }
      setAppReady(true);
    });

    // Listen for ALL auth state changes — including email confirmation redirects
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth event]', event, session?.user?.email);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session?.user) {
          const user = sessionToUser(session);
          setAuth({ user, isLoggedIn: true });
          setAppReady(true);
        }
      } else if (event === 'SIGNED_OUT') {
        setAuth({ user: null, isLoggedIn: false });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── App State ─────────────────────────────────────────────────────────────
  const [state, setState] = useState<AppState>(() => loadState('guest'));

  // Load cloud data when user logs in
  useEffect(() => {
    if (!auth.user || syncedRef.current) return;
    const userId = auth.user.id;

    // Load local state first (instant)
    const localState = loadState(userId);
    setState(localState);

    // Then load from cloud and merge
    setSyncing(true);
    loadCloudState(userId).then(cloudData => {
      if (cloudData) {
        // If cloud has data — use cloud; otherwise sync local to cloud
        const hasCloudData =
          (cloudData.books?.length || 0) > 0 ||
          (cloudData.notes?.length || 0) > 0;

        if (hasCloudData) {
          setState(prev => ({
            ...prev,
            books: cloudData.books || prev.books,
            notes: cloudData.notes || prev.notes,
            tags:  cloudData.tags  || prev.tags,
          }));
        } else {
          // First login — push local/sample data to cloud
          syncLocalToCloud(localState, userId);
        }
        syncedRef.current = true;
      }
      setSyncing(false);
    });
  }, [auth.user?.id]); // eslint-disable-line

  // Auto-save to localStorage on every state change
  useEffect(() => {
    if (auth.user) saveState(state, auth.user.id);
  }, [state, auth.user?.id]); // eslint-disable-line

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  const update = useCallback((fn: (s: AppState) => AppState) => setState(prev => fn(prev)), []);

  // ── UI State ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('notes');
  const [editingNote, setEditingNote] = useState<Note | null | 'new'>(null);
  const [newNoteBookId, setNewNoteBookId] = useState<string | undefined>(undefined);
  const [bookModal, setBookModal] = useState<{ open: boolean; book?: Book }>({ open: false });

  // ── Auth handlers ─────────────────────────────────────────────────────────
  const handleAuth = (user: User) => {
    syncedRef.current = false;
    setAuth({ user, isLoggedIn: true });
  };

  const handleLogout = async () => {
    if (auth.user) saveState(state, auth.user.id);
    await supabase.auth.signOut();
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

  const _handleDeleteNote = (noteId: string) => {
    update(s => ({ ...s, notes: s.notes.filter(n => n.id !== noteId) }));
    cloudDeleteNote(noteId);
  };
  void _handleDeleteNote;

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

  const handleTheme = (theme: Theme) => {
    update(s => ({ ...s, theme }));
  };

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
      handleNewNote();
    } else {
      const cur = tabOrder.indexOf(activeTab);
      const next = tabOrder.indexOf(tab);
      setTabDir(next >= cur ? 'left' : 'right');
      setTabKey(k => k + 1);
      setActiveTab(tab);
    }
  };

  // ── Loading screen ────────────────────────────────────────────────────────
  if (!appReady) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', flexDirection: 'column', gap: '16px',
        background: 'var(--bg-base)',
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: '20px',
          background: 'linear-gradient(135deg, var(--bg-raised), var(--bg-active))',
          border: '1px solid var(--border-mid)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '28px',
        }}>
          🪶
        </div>
        <div className="spinner" />
      </div>
    );
  }

  // ── Auth gate ─────────────────────────────────────────────────────────────
  if (!auth.isLoggedIn) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  // ── Editor overlay ────────────────────────────────────────────────────────
  if (editingNote !== null) {
    const note = editingNote === 'new' ? undefined : editingNote;
    return (
      <NoteEditor
        note={note}
        books={state.books}
        tags={state.tags}
        onSave={handleSaveNote}
        onClose={() => setEditingNote(null)}
        onAddTag={handleAddTag}
        defaultBookId={newNoteBookId}
      />
    );
  }

  // ── Main app ──────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>

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
        }}>
          <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
          Синхронизация...
        </div>
      )}

      {/* Content */}
      <div
        key={tabKey}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}
        className={tabDir === 'left' ? 'view-enter' : 'view-enter-back'}
      >
        {activeTab === 'notes' && (
          <NotesList
            notes={state.notes}
            books={state.books}
            tags={state.tags}
            onOpen={note => setEditingNote(note)}
            onNew={() => handleNewNote()}
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

        {activeTab === 'stats' && (
          <StatsView
            notes={state.notes}
            books={state.books}
            tags={state.tags}
            onOpen={note => setEditingNote(note)}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            user={auth.user!}
            state={state}
            onTheme={handleTheme}
            onLogout={handleLogout}
            onClearData={handleClearData}
          />
        )}

        {/* Book modal */}
        {bookModal.open && (
          <BookModal
            book={bookModal.book}
            onSave={handleSaveBook}
            onDelete={handleDeleteBook}
            onClose={() => setBookModal({ open: false })}
          />
        )}
      </div>

      {/* Bottom nav */}
      <BottomNav active={activeTab} onChange={handleTabChange} />
    </div>
  );
}
