import { useState, useEffect, useCallback, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Bookmark, Share2, Search, Send, X, MoreHorizontal, Trash2, Edit3, Bell, Mail, PenLine, ChevronLeft } from 'lucide-react';
import type { SocialPost, SocialComment, SocialProfile, User, Book, PostType } from '../types';
import { getFeed, toggleLike, toggleSave, getComments, addComment, toggleCommentLike, searchProfiles, createPost, toggleFollow, getUserPosts, isFollowing, getMyProfile, upsertProfile, deletePost, updatePost } from '../socialStore';
import { supabase } from '../supabase';
import StoriesRow from './StoriesView';

const vibe = (ms = 8) => navigator.vibrate?.(ms);

const TYPE_LABEL: Record<PostType, string> = {
  note:        'Мысль',
  quote:       'Цитата',
  insight:     'Инсайт',
  summary:     'Конспект',
  flashcard:   'Карточка',
  book_review: 'Рецензия',
};

// ── Общие стили бумаги и чернил ──────────────────────────────────────────────
const label: CSSProperties = { fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' };
const typed: CSSProperties = {
  fontFamily: 'var(--font-typed)', color: 'var(--text-primary)', textShadow: '0 0 0.7px var(--ink-bleed)',
  fontSize: 16, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
};
const iconBtn: CSSProperties = {
  width: 44, height: 44, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', position: 'relative',
};
const sheet: CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)' };
const inkButton = (enabled = true): CSSProperties => ({
  height: 36, padding: '0 14px', border: 'none', cursor: enabled ? 'pointer' : 'not-allowed',
  background: enabled ? 'var(--accent)' : 'var(--bg-active)', color: enabled ? 'var(--on-accent)' : 'var(--text-muted)',
  fontSize: 14, fontWeight: 500, fontFamily: 'var(--font-ui)',
  transition: 'background var(--dur-quick) var(--ease-calm)',
});
const screen: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--bg-base)',
  display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top)',
};
const screenHead: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  minHeight: 52, padding: '0 10px', flexShrink: 0,
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} мин`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} д`;
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' });
}

const plainText = (html: string) => html.replace(/<[^>]+>/g, '');

// Честные правки: ~~текст~~ в листе показывается зачёркнутым
const STRIKE = /~~([\s\S]+?)~~/g;
const stripStrikes = (s: string) => s.replace(STRIKE, '').replace(/[ \t]{2,}/g, ' ');

function TypedText({ text, style }: { text: string; style?: CSSProperties }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(STRIKE)) {
    if (m.index! > last) parts.push(text.slice(last, m.index));
    parts.push(
      <s key={m.index} style={{ color: 'var(--text-muted)', textDecorationThickness: 1.5, textDecorationColor: 'var(--text-primary)' }}>{m[1]}</s>,
    );
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <p style={{ ...typed, ...style }}>{parts}</p>;
}

// ── Avatar ──────────────────────────────────────────────────────────────────
function Avatar({ profile, size = 32 }: { profile?: SocialProfile | null; size?: number }) {
  const av = profile?.avatar;
  const name = profile?.displayName || profile?.username || '?';
  const initial = name[0]?.toUpperCase() || '?';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
      border: '1px solid var(--text-primary)', background: 'var(--bg-card)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, color: 'var(--text-primary)', fontFamily: 'var(--font-serif)',
    }}>
      {av ? av.startsWith('data:')
        ? <img src={av} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontSize: size * 0.5 }}>{av}</span>
        : initial}
    </div>
  );
}

// ── Оттиск: чернильная печать вместо лайка ───────────────────────────────────
function StampIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path fillRule="evenodd" d="M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 7.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9" />
    </svg>
  );
}

function StampButton({ stamped, count, onToggle, small }: { stamped: boolean; count: number; onToggle: () => void; small?: boolean }) {
  const [pressKey, setPressKey] = useState(0);
  return (
    <button
      aria-pressed={stamped}
      onClick={() => { vibe(stamped ? 6 : 14); if (!stamped) setPressKey(k => k + 1); onToggle(); }}
      style={{
        height: small ? 32 : 44, padding: '0 8px', background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 8, fontSize: small ? 12 : 13,
        color: stamped ? 'var(--text-primary)' : 'var(--text-muted)', fontFamily: 'var(--font-ui)',
      }}
    >
      <span key={pressKey} className={pressKey ? 'stamp-press' : undefined} style={{ display: 'flex' }}>
        <StampIcon filled={stamped} />
      </span>
      Оттиск · {count}
    </button>
  );
}

// ── Лист в ленте ─────────────────────────────────────────────────────────────
function PostCard({ post, userId, onLike, onSave, onComment, onProfile, onDelete, onEdit }: {
  post: SocialPost; userId: string;
  onLike: (p: SocialPost) => void;
  onSave: (p: SocialPost) => void;
  onComment: (p: SocialPost) => void;
  onProfile: (p: SocialProfile) => void;
  onDelete: (id: string) => void;
  onEdit: (p: SocialPost) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const isOwn = post.userId === userId;
  const text = plainText(post.content);
  const showTitle = post.title && !stripStrikes(text).startsWith(post.title.slice(0, 40));

  const handleShare = async () => {
    vibe(6);
    const shareText = stripStrikes(text);
    try {
      await navigator.share({ title: post.title, text: shareText, url: window.location.href });
    } catch {
      try { await navigator.clipboard.writeText(shareText); } catch { /* ignore */ }
    }
  };

  return (
    <article className="view-enter" style={{ ...sheet, padding: '16px 18px 0', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => { vibe(); post.profile && onProfile(post.profile); }}
          aria-label="Открыть профиль"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, textAlign: 'left' }}>
          <Avatar profile={post.profile} size={32} />
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
              {post.profile?.displayName || post.profile?.username || 'Читатель'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {TYPE_LABEL[post.type] || 'Мысль'} · {formatTime(post.createdAt)}
            </span>
          </span>
        </button>

        {isOwn && (
          <div style={{ position: 'relative' }}>
            <button aria-label="Действия с листом" onClick={() => { vibe(6); setShowMenu(m => !m); }} style={{ ...iconBtn, color: 'var(--text-muted)', marginRight: -12 }}>
              <MoreHorizontal size={18} strokeWidth={1.5} />
            </button>
            {showMenu && (
              <>
                <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 100 }} />
                <div className="fade-in" style={{ ...sheet, position: 'absolute', right: 0, top: 40, zIndex: 101, minWidth: 180, boxShadow: 'var(--shadow-lg)' }}>
                  <button onClick={() => { vibe(8); setShowMenu(false); onEdit(post); }} style={menuItem}>
                    <Edit3 size={15} strokeWidth={1.5} /> Править
                  </button>
                  <button onClick={() => {
                    vibe(12); setShowMenu(false);
                    if (window.confirm('Удалить этот лист?')) onDelete(post.id);
                  }} style={{ ...menuItem, color: 'var(--red)', borderBottom: 'none' }}>
                    <Trash2 size={15} strokeWidth={1.5} /> Удалить
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {showTitle && (
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, lineHeight: 1.3, color: 'var(--text-primary)' }}>{post.title}</div>
      )}

      <button onClick={() => { vibe(); onComment(post); }} aria-label="Открыть обсуждение"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
        {post.type === 'quote' ? (
          <blockquote style={{ margin: 0, paddingLeft: 14, borderLeft: '1px solid var(--text-primary)', fontFamily: 'var(--font-serif)', fontSize: 18, lineHeight: 1.45, color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 8, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {stripStrikes(text)}
          </blockquote>
        ) : (
          <TypedText text={text.length > 600 ? text.slice(0, 600) + '…' : text} />
        )}
      </button>

      {(post.bookTitle || post.tags.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', alignItems: 'baseline' }}>
          {post.bookTitle && (
            <span style={{ ...label, letterSpacing: '0.08em' }}>
              {post.bookTitle}{post.bookAuthor ? ` · ${post.bookAuthor}` : ''}
            </span>
          )}
          {post.tags.slice(0, 4).map(t => (
            <span key={t} style={{ fontSize: 12, color: 'var(--text-muted)' }}>#{t}</span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', borderTop: '1px dashed var(--border)', margin: '0 -10px' }}>
        <StampButton stamped={!!post.isLiked} count={post.likesCount || 0} onToggle={() => onLike(post)} />
        <button onClick={() => { vibe(); onComment(post); }}
          style={{ height: 44, padding: '0 8px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
          <MarginsIcon /> На полях · {post.commentsCount || 0}
        </button>
        <div style={{ flex: 1 }} />
        <button aria-label={post.isSaved ? 'Убрать из сохранённого' : 'Сохранить'} aria-pressed={!!post.isSaved}
          onClick={() => { vibe(); onSave(post); }} style={{ ...iconBtn, color: post.isSaved ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          <Bookmark size={19} strokeWidth={1.5} fill={post.isSaved ? 'currentColor' : 'none'} />
        </button>
        <button aria-label="Поделиться" onClick={handleShare} style={{ ...iconBtn, color: 'var(--text-muted)' }}>
          <Share2 size={18} strokeWidth={1.5} />
        </button>
      </div>
    </article>
  );
}

const menuItem: CSSProperties = {
  width: '100%', minHeight: 44, padding: '0 16px', background: 'none', border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)', fontSize: 14,
  fontFamily: 'var(--font-ui)', borderBottom: '1px solid var(--border)',
};

function MarginsIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M4 4v16M8 8h12M8 12h12M8 16h7" />
    </svg>
  );
}

async function ensureProfile(userId: string) {
  const existingProfile = await getMyProfile(userId);
  if (existingProfile) return;
  const { data: userData } = await supabase.auth.getUser();
  const email = userData?.user?.email || '';
  const baseUsername = email.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase() || 'reader';
  await upsertProfile(userId, { username: baseUsername + Math.floor(Math.random() * 9999), displayName: baseUsername, isPublic: true });
}

// ── Обсуждение на полях ──────────────────────────────────────────────────────
function MarginsView({ post, userId, onClose, onCommented }: {
  post: SocialPost; userId: string; onClose: () => void; onCommented: () => void;
}) {
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const body = plainText(post.content);

  useEffect(() => {
    getComments(post.id).then(setComments);
  }, [post.id, userId]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true); vibe(8);
    try {
      await ensureProfile(userId);
      const comment = await addComment(post.id, userId, text.trim());
      if (comment) { setComments(prev => [...prev, comment]); setText(''); onCommented(); }
    } catch (e) { console.error('Comment error:', e); }
    setSending(false);
  };

  const handleCommentStamp = (c: SocialComment) => {
    toggleCommentLike(c.id, userId, !!c.isLiked);
    setComments(prev => prev.map(x => x.id === c.id
      ? { ...x, isLiked: !x.isLiked, likesCount: Math.max(0, (x.likesCount || 0) + (x.isLiked ? -1 : 1)) }
      : x));
  };

  return (
    <div role="dialog" aria-label="Обсуждение" className="view-push" style={screen}>
      <div style={screenHead}>
        <button aria-label="Назад" onClick={onClose} style={iconBtn}><ChevronLeft size={22} strokeWidth={1.5} /></button>
        <span style={label}>Обсуждение</span>
        <span style={{ width: 44 }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 24px' }}>
        <article style={{ ...sheet, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar profile={post.profile} size={32} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>{post.profile?.displayName || post.profile?.username || 'Читатель'}</span>
          </div>
          {post.type === 'quote'
            ? <blockquote style={{ margin: 0, paddingLeft: 14, borderLeft: '1px solid var(--text-primary)', fontFamily: 'var(--font-serif)', fontSize: 18, lineHeight: 1.45 }}>{stripStrikes(body)}</blockquote>
            : <TypedText text={body} />}
          {post.bookTitle && <span style={label}>{post.bookTitle}{post.bookAuthor ? ` · ${post.bookAuthor}` : ''}</span>}
        </article>

        <div style={{ padding: '22px 12px 0', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <span style={label}>На полях · {comments.length}</span>
          {comments.length === 0 && (
            <p style={{ margin: 0, fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 17, color: 'var(--text-muted)' }}>
              Поля пока чистые. Оставьте первую пометку.
            </p>
          )}
          {comments.map(c => (
            <div key={c.id} className="view-enter" style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 14, borderLeft: `1px solid ${c.userId === post.userId ? 'var(--border-mid)' : 'var(--text-primary)'}` }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {c.profile?.displayName || c.profile?.username || 'Читатель'} · {formatTime(c.createdAt)}
              </span>
              <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 17, lineHeight: 1.45, color: 'var(--text-primary)' }}>{c.content}</span>
              <div style={{ marginLeft: -8 }}>
                <StampButton small stamped={!!c.isLiked} count={c.likesCount || 0} onToggle={() => handleCommentStamp(c)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '8px 12px', paddingBottom: 'calc(8px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--border)' }}>
        <div style={{ ...sheet, display: 'flex', alignItems: 'center', height: 52, padding: '0 4px 0 16px' }}>
          <input ref={inputRef} value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            aria-label="Заметка на полях"
            placeholder="Заметка на полях…"
            style={{ ...typed, fontSize: 15, flex: 1, background: 'none', border: 'none', outline: 'none', minWidth: 0 }} />
          <button aria-label="Отправить" onClick={handleSend} disabled={!text.trim() || sending}
            style={{ ...iconBtn, color: text.trim() ? 'var(--text-primary)' : 'var(--text-muted)', cursor: text.trim() ? 'pointer' : 'default' }}>
            <Send size={18} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Правка листа ─────────────────────────────────────────────────────────────
function EditPostSheet({ post, onClose, onSaved }: {
  post: SocialPost; onClose: () => void; onSaved: (p: SocialPost) => void;
}) {
  const [content, setContent] = useState(plainText(post.content));
  const [saving, setSaving] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const handleSave = async () => {
    if (!content.trim() || saving) return;
    setSaving(true); vibe(10);
    try {
      const updated = await updatePost(post.id, { content: content.trim() });
      if (updated) { onSaved({ ...post, content: content.trim() }); onClose(); }
    } catch (e) { console.error('Edit error:', e); }
    setSaving(false);
  };

  return (
    <div role="dialog" aria-label="Правка листа" className="view-feed" style={screen}>
      <div style={screenHead}>
        <button onClick={onClose} style={{ ...iconBtn, width: 'auto', padding: '0 8px', fontSize: 15, color: 'var(--text-muted)' }}>Отмена</button>
        <span style={label}>Правка</span>
        <button onClick={handleSave} disabled={saving || !content.trim()} style={inkButton(!!content.trim() && !saving)}>
          {saving ? 'Сохраняю…' : 'Сохранить'}
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <PaperArea areaRef={areaRef} value={content} onChange={setContent} />
        <StrikeButton areaRef={areaRef} value={content} onChange={setContent} />
      </div>
    </div>
  );
}

// Разлинованный лист для набора
function PaperArea({ areaRef, value, onChange, placeholder }: {
  areaRef: React.RefObject<HTMLTextAreaElement | null>; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <textarea
      ref={areaRef}
      value={value}
      onChange={e => onChange(e.target.value)}
      aria-label="Текст листа"
      placeholder={placeholder}
      style={{
        ...typed, fontSize: 17, lineHeight: '30px', width: '100%', minHeight: 300, flex: 1,
        ...sheet, padding: '14px 20px', outline: 'none', resize: 'none', boxSizing: 'border-box',
        backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 29px, var(--border) 29px, var(--border) 30px)',
        backgroundPosition: '0 14px', backgroundAttachment: 'local',
      }}
    />
  );
}

// Зачёркивает выделенный фрагмент: ~~так~~
function StrikeButton({ areaRef, value, onChange }: {
  areaRef: React.RefObject<HTMLTextAreaElement | null>; value: string; onChange: (v: string) => void;
}) {
  const strike = () => {
    const el = areaRef.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    if (a === b) return;
    vibe(10);
    onChange(value.slice(0, a) + '~~' + value.slice(a, b) + '~~' + value.slice(b));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(b + 4, b + 4); });
  };
  return (
    <button onClick={strike} onMouseDown={e => e.preventDefault()}
      style={{ alignSelf: 'flex-start', height: 36, padding: '0 12px', background: 'none', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
      <s>Зачеркнуть</s> выделенное
    </button>
  );
}

// ── Новый лист ───────────────────────────────────────────────────────────────
function CreatePostSheet({ userId, notes, books, onClose, onCreated }: {
  userId: string;
  notes: import('../types').Note[];
  books: Book[];
  onClose: () => void;
  onCreated: (post: SocialPost) => void;
}) {
  const [type, setType] = useState<PostType>('note');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [honest, setHonest] = useState(true);
  const [selectedBookId, setSelectedBookId] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const selectedBook = books.find(b => b.id === selectedBookId);
  const selectedNote = notes.find(n => n.id === selectedNoteId);

  useEffect(() => {
    if (selectedNote) {
      setTitle(selectedNote.title);
      setContent(plainText(selectedNote.content));
      setSelectedTags(selectedNote.tags);
      if (selectedNote.bookId) setSelectedBookId(selectedNote.bookId);
      setType(selectedNote.type as PostType);
    }
  }, [selectedNoteId]); // eslint-disable-line

  const handlePublish = async () => {
    if (!content.trim()) return;
    setPublishing(true); vibe(10);
    try {
      await ensureProfile(userId);
      const finalContent = (honest ? content : stripStrikes(content)).trim();
      const post = await createPost(userId, {
        type,
        title: title || stripStrikes(content).slice(0, 60),
        content: finalContent,
        bookTitle: selectedBook?.title,
        bookAuthor: selectedBook?.author,
        bookEmoji: selectedBook?.coverEmoji,
        tags: selectedTags,
      });
      if (post) { onCreated(post); onClose(); }
      else { alert('Не удалось опубликовать. Проверьте подключение.'); }
    } catch (e) {
      console.error('Publish error:', e);
      alert('Ошибка: ' + (e instanceof Error ? e.message : String(e)));
    }
    setPublishing(false);
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/^#/, '');
    if (t && !selectedTags.includes(t)) setSelectedTags(prev => [...prev, t]);
    setTagInput('');
  };

  const canPublish = !!content.trim() && !publishing;
  const optionRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, borderBottom: '1px solid var(--border)' };
  const selectStyle: CSSProperties = { background: 'none', border: 'none', outline: 'none', fontSize: 14, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', maxWidth: '60%', textAlign: 'right' };

  return (
    <div role="dialog" aria-label="Новый лист" className="view-feed" style={screen}>
      <div style={screenHead}>
        <button onClick={onClose} style={{ ...iconBtn, width: 'auto', padding: '0 8px', fontSize: 15, color: 'var(--text-muted)' }}>Отмена</button>
        <span style={label}>Новый лист</span>
        <button onClick={handlePublish} disabled={!canPublish} style={inkButton(canPublish)}>
          {publishing ? 'Публикую…' : 'Опубликовать'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: 8, padding: '8px 16px 14px', overflowX: 'auto', flexShrink: 0 }}>
          {(Object.keys(TYPE_LABEL) as PostType[]).filter(t => t !== 'flashcard').map(t => {
            const on = type === t;
            return (
              <button key={t} aria-pressed={on} onClick={() => { vibe(6); setType(t); }}
                style={{
                  height: 34, padding: '0 14px', flexShrink: 0, cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-ui)',
                  border: on ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: on ? 'var(--accent)' : 'none', color: on ? 'var(--on-accent)' : 'var(--text-primary)',
                  transition: 'background var(--dur-quick) var(--ease-calm), color var(--dur-quick) var(--ease-calm)',
                }}>{TYPE_LABEL[t]}</button>
            );
          })}
        </div>

        <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Заголовок, если нужен"
            aria-label="Заголовок"
            style={{ ...sheet, borderBottom: 'none', padding: '14px 20px 6px', fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--text-primary)', outline: 'none', marginBottom: -10 }} />
          <PaperArea areaRef={areaRef} value={content} onChange={setContent} placeholder="Что в вашей власти сегодня?" />
          <StrikeButton areaRef={areaRef} value={content} onChange={setContent} />
        </div>

        <div style={{ padding: '8px 24px 24px', display: 'flex', flexDirection: 'column' }}>
          <button role="switch" aria-checked={honest} onClick={() => { vibe(6); setHonest(h => !h); }}
            style={{ ...optionRow, minHeight: 60, background: 'none', borderLeft: 'none', borderRight: 'none', borderTop: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>Честные правки</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{honest ? 'Зачёркнутое останется видно читателям' : 'Зачёркнутое уберём перед публикацией'}</span>
            </span>
            <span style={{ width: 40, height: 22, flexShrink: 0, boxSizing: 'border-box', border: '1px solid var(--accent)', padding: 2, display: 'flex', background: honest ? 'var(--accent)' : 'none', transition: 'background var(--dur-quick) var(--ease-calm)' }}>
              <span style={{ width: 16, height: 16, background: honest ? 'var(--on-accent)' : 'var(--accent)', transform: `translateX(${honest ? 16 : 0}px)`, transition: 'transform var(--dur-quick) var(--ease-calm)' }} />
            </span>
          </button>

          {books.length > 0 && (
            <label style={optionRow}>
              <span style={{ flex: 1, fontSize: 14 }}>Книга</span>
              <select value={selectedBookId} onChange={e => setSelectedBookId(e.target.value)} style={selectStyle}>
                <option value="">Без книги</option>
                {books.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
              </select>
            </label>
          )}

          {notes.length > 0 && (
            <label style={optionRow}>
              <span style={{ flex: 1, fontSize: 14 }}>Из моих записей</span>
              <select value={selectedNoteId} onChange={e => setSelectedNoteId(e.target.value)} style={selectStyle}>
                <option value="">Не брать</option>
                {notes.map(n => <option key={n.id} value={n.id}>{n.title || 'Без названия'}</option>)}
              </select>
            </label>
          )}

          <div style={{ ...optionRow, flexWrap: 'wrap', padding: '10px 0' }}>
            <span style={{ fontSize: 14 }}>Темы</span>
            {selectedTags.map(t => (
              <button key={t} onClick={() => setSelectedTags(prev => prev.filter(x => x !== t))} aria-label={`Убрать тему ${t}`}
                style={{ height: 28, padding: '0 8px', background: 'none', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                #{t} <X size={11} />
              </button>
            ))}
            <input value={tagInput} onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTag()} onBlur={addTag}
              aria-label="Добавить тему" placeholder="+ тема"
              style={{ flex: 1, minWidth: 80, background: 'none', border: 'none', outline: 'none', fontSize: 14, color: 'var(--text-primary)', textAlign: 'right' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Профиль читателя ─────────────────────────────────────────────────────────
function ProfileSheet({ profile, userId, onClose }: {
  profile: SocialProfile; userId: string; onClose: () => void;
}) {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [following, setFollowing] = useState(false);
  const isOwn = profile.id === userId;

  useEffect(() => {
    getUserPosts(profile.id, userId).then(setPosts);
    if (!isOwn) isFollowing(userId, profile.id).then(setFollowing);
  }, [profile.id, userId, isOwn]);

  const handleFollow = async () => {
    vibe(10);
    await toggleFollow(userId, profile.id, following);
    setFollowing(f => !f);
  };

  return (
    <div role="dialog" aria-label="Профиль" className="view-push" style={screen}>
      <div style={screenHead}>
        <button aria-label="Назад" onClick={onClose} style={iconBtn}><ChevronLeft size={22} strokeWidth={1.5} /></button>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{profile.username}</span>
        <span style={{ width: 44 }} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '4px 24px 0' }}>
          <Avatar profile={profile} size={76} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', flex: 1 }}>
            {[[profile.postsCount || posts.length, 'листов'], [profile.followersCount || 0, 'читателей'], [profile.followingCount || 0, 'читает']].map(([v, l]) => (
              <span key={l as string} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22 }}>{v}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l}</span>
              </span>
            ))}
          </div>
        </div>
        <div style={{ padding: '14px 24px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{profile.displayName || profile.username}</span>
          {profile.bio && <TypedText text={profile.bio} style={{ fontSize: 14, lineHeight: 1.5 }} />}
        </div>
        {!isOwn && (
          <div style={{ padding: '14px 24px 0' }}>
            <button onClick={handleFollow}
              style={{
                width: '100%', height: 38, cursor: 'pointer', fontSize: 14, fontWeight: 500, fontFamily: 'var(--font-ui)',
                border: '1px solid var(--accent)', background: following ? 'none' : 'var(--accent)',
                color: following ? 'var(--text-primary)' : 'var(--on-accent)',
                transition: 'background var(--dur-quick) var(--ease-calm), color var(--dur-quick) var(--ease-calm)',
              }}>
              {following ? 'Вы читаете' : 'Читать'}
            </button>
          </div>
        )}
        <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 2, padding: 2 }}>
          {posts.map(p => (
            <div key={p.id} style={{ aspectRatio: '3 / 4', background: 'var(--bg-card)', padding: 10, overflow: 'hidden' }}>
              <TypedText text={plainText(p.content).slice(0, 160)} style={{ fontSize: 9.5, lineHeight: 1.45 }} />
            </div>
          ))}
        </div>
        {posts.length === 0 && (
          <p style={{ textAlign: 'center', padding: '40px 24px', margin: 0, fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--text-muted)' }}>
            Листов пока нет
          </p>
        )}
      </div>
    </div>
  );
}

// ── Поиск людей ──────────────────────────────────────────────────────────────
function SearchTab({ userId }: { userId: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SocialProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<SocialProfile | null>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      const r = await searchProfiles(query, userId);
      setResults(r);
      setLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [query, userId]);

  return (
    <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, height: 48, borderBottom: '1px solid var(--text-primary)' }}>
        <Search size={17} strokeWidth={1.5} color="var(--text-muted)" />
        <input value={query} onChange={e => setQuery(e.target.value)}
          aria-label="Поиск читателей"
          placeholder="Имя или @username"
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 15, fontFamily: 'var(--font-ui)' }} />
        {query && <button aria-label="Очистить" onClick={() => setQuery('')} style={{ ...iconBtn, color: 'var(--text-muted)' }}><X size={15} /></button>}
      </label>

      {loading && <p style={{ ...label, padding: '20px 0', margin: 0 }}>Ищу…</p>}

      {!loading && results.length === 0 && query && (
        <p style={{ margin: 0, padding: '24px 0', fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--text-muted)' }}>
          Никого не нашлось по «{query}»
        </p>
      )}

      {!query && (
        <p style={{ margin: 0, padding: '32px 0', fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 17, color: 'var(--text-muted)' }}>
          Найдите тех, кто читает то же, что и вы.
        </p>
      )}

      {results.map(p => (
        <button key={p.id} onClick={() => setSelectedProfile(p)}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
          <Avatar profile={p} size={44} />
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{p.displayName || p.username}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{p.username}</span>
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.followersCount || 0} читателей</span>
        </button>
      ))}

      {selectedProfile && (
        <ProfileSheet profile={selectedProfile} userId={userId} onClose={() => setSelectedProfile(null)} />
      )}
    </div>
  );
}

// ── Сохранённое ──────────────────────────────────────────────────────────────
function SavedTab({ savedPosts, userId, onLike, onSave, onComment }: {
  savedPosts: SocialPost[];
  userId: string;
  onLike: (p: SocialPost) => void;
  onSave: (p: SocialPost) => void;
  onComment: (p: SocialPost) => void;
}) {
  const [selectedProfile, setSelectedProfile] = useState<SocialProfile | null>(null);

  if (savedPosts.length === 0) {
    return (
      <div style={{ padding: '56px 28px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22 }}>Здесь пусто</span>
        <TypedText text="Сохраняйте листы закладкой — они соберутся здесь." style={{ fontSize: 14, color: 'var(--text-muted)' }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '14px 12px' }}>
      {savedPosts.map(post => (
        <PostCard key={post.id} post={post} userId={userId}
          onLike={onLike} onSave={onSave} onComment={onComment}
          onProfile={setSelectedProfile}
          onDelete={() => { }} onEdit={() => { }} />
      ))}
      {selectedProfile && <ProfileSheet profile={selectedProfile} userId={userId} onClose={() => setSelectedProfile(null)} />}
    </div>
  );
}

// ── Агора ────────────────────────────────────────────────────────────────────
export default function FeedView({ user, notes, books, composeRequest = 0, onOpenNotifications, onOpenMessages }: {
  user: User;
  notes: import('../types').Note[];
  books: Book[];
  composeRequest?: number;
  onOpenNotifications?: () => void;
  onOpenMessages?: () => void;
}) {
  const [tab, setTab] = useState<'feed' | 'search' | 'saved'>('feed');
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [commentPost, setCommentPost] = useState<SocialPost | null>(null);
  const [editPost, setEditPost] = useState<SocialPost | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<SocialProfile | null>(null);
  const [myProfile, setMyProfile] = useState<SocialProfile | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadPosts = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const offset = reset ? 0 : page * 20;
      const newPosts = await getFeed(user.id, offset);
      if (reset) {
        setPosts(newPosts);
        setPage(1);
      } else {
        setPosts(prev => [...prev, ...newPosts]);
        setPage(p => p + 1);
      }
      setHasMore(newPosts.length === 20);
    } catch (e) { console.error('Load feed error:', e); }
    setLoading(false);
  }, [user.id, page]);

  useEffect(() => {
    loadPosts(true);
    getMyProfile(user.id).then(setMyProfile);
  }, [user.id]); // eslint-disable-line

  // «Мысль в Агору» из меню «+» открывает новый лист
  useEffect(() => {
    if (composeRequest > 0) { setTab('feed'); setShowCreate(true); }
  }, [composeRequest]);

  const handleLike = async (post: SocialPost) => {
    const newLiked = await toggleLike(post.id, user.id, !!post.isLiked);
    setPosts(prev => prev.map(p => p.id === post.id
      ? { ...p, isLiked: newLiked, likesCount: newLiked ? (p.likesCount || 0) + 1 : Math.max(0, (p.likesCount || 0) - 1) }
      : p));
  };

  const handleSave = async (post: SocialPost) => {
    const newSaved = await toggleSave(post.id, user.id, !!post.isSaved);
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, isSaved: newSaved } : p));
  };

  const handleDelete = async (postId: string) => {
    vibe(12);
    await deletePost(postId, user.id);
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const handleEditSaved = (updated: SocialPost) => {
    setPosts(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const savedPosts = posts.filter(p => p.isSaved);
  const tabs = [['feed', 'Лента'], ['search', 'Люди'], ['saved', 'Сохранённое']] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-base)' }}>
      <header style={{ paddingTop: 'env(safe-area-inset-top)', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, padding: '0 8px 0 20px' }}>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, fontSize: 28, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
            Агора
          </h1>
          <div style={{ display: 'flex' }}>
            <button aria-label="Новый лист" onClick={() => { vibe(8); setShowCreate(true); }} style={iconBtn}>
              <PenLine size={21} strokeWidth={1.5} />
            </button>
            {onOpenNotifications && (
              <button aria-label="Отклики" onClick={() => { vibe(6); onOpenNotifications(); }} style={iconBtn}>
                <Bell size={21} strokeWidth={1.5} />
              </button>
            )}
            {onOpenMessages && (
              <button aria-label="Письма" onClick={() => { vibe(6); onOpenMessages(); }} style={iconBtn}>
                <Mail size={21} strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>
        <div role="tablist" aria-label="Агора" style={{ display: 'flex', padding: '0 12px', marginBottom: -1 }}>
          {tabs.map(([t, name]) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => { vibe(6); setTab(t); }}
              style={{
                flex: 1, height: 44, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-ui)',
                borderBottom: tab === t ? '1px solid var(--text-primary)' : '1px solid transparent',
                color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
                transition: 'color var(--dur-quick) var(--ease-calm), border-color var(--dur-quick) var(--ease-calm)',
              }}>{name}</button>
          ))}
        </div>
      </header>

      <div key={tab} className="view-enter" style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'feed' && (
          <>
            <div style={{ paddingTop: 14, borderBottom: '1px solid var(--border)' }}>
              <StoriesRow userId={user.id} profile={myProfile} />
            </div>

            <div style={{ padding: '14px 12px 8px' }}>
              {loading && posts.length === 0 && [1, 2, 3].map(i => (
                <div key={i} style={{ ...sheet, height: 180, marginBottom: 14, animation: 'pulse-soft 1.6s ease infinite' }} />
              ))}

              {!loading && posts.length === 0 && (
                <div style={{ padding: '48px 16px', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: 24 }}>Агора пока молчит</span>
                  <TypedText text="Напишите первый лист: мысль, цитату или вопрос." style={{ fontSize: 15, color: 'var(--text-muted)' }} />
                  <button onClick={() => { vibe(8); setShowCreate(true); }} style={{ ...inkButton(), height: 40, marginTop: 8 }}>Новый лист</button>
                </div>
              )}

              {posts.map(post => (
                <PostCard key={post.id} post={post} userId={user.id}
                  onLike={handleLike} onSave={handleSave}
                  onComment={setCommentPost} onProfile={setSelectedProfile}
                  onDelete={handleDelete} onEdit={setEditPost} />
              ))}

              {hasMore && posts.length > 0 && (
                <button onClick={() => loadPosts(false)} disabled={loading}
                  style={{ width: '100%', height: 48, marginBottom: 12, background: 'none', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                  {loading ? 'Загружаю…' : 'Ещё листы'}
                </button>
              )}
            </div>
          </>
        )}

        {tab === 'search' && <SearchTab userId={user.id} />}
        {tab === 'saved' && (
          <SavedTab savedPosts={savedPosts} userId={user.id}
            onLike={handleLike} onSave={handleSave} onComment={setCommentPost} />
        )}
      </div>

      {showCreate && (
        <CreatePostSheet userId={user.id} notes={notes} books={books}
          onClose={() => setShowCreate(false)}
          onCreated={post => { setPosts(prev => [post, ...prev]); }} />
      )}
      {commentPost && (
        <MarginsView post={commentPost} userId={user.id}
          onClose={() => setCommentPost(null)}
          onCommented={() => setPosts(prev => prev.map(p => p.id === commentPost.id
            ? { ...p, commentsCount: (p.commentsCount || 0) + 1 }
            : p))} />
      )}
      {editPost && (
        <EditPostSheet post={editPost}
          onClose={() => setEditPost(null)}
          onSaved={handleEditSaved} />
      )}
      {selectedProfile && (
        <ProfileSheet profile={selectedProfile} userId={user.id}
          onClose={() => setSelectedProfile(null)} />
      )}
    </div>
  );
}
