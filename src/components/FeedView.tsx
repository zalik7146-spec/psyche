import { useState, useEffect, useCallback, useRef } from 'react';
import { Heart, MessageCircle, Bookmark, Share2, Search, Users, Compass, Send, X, Plus, BookOpen, Sparkles, Quote, Lightbulb, FileText } from 'lucide-react';
import type { SocialPost, SocialComment, SocialProfile, User, Book, PostType } from '../types';
import { getFeed, getFollowingFeed, toggleLike, toggleSave, getComments, addComment, toggleCommentLike, searchProfiles, createPost, toggleFollow, getUserPosts, isFollowing, getMyProfile, upsertProfile } from '../socialStore';
import { supabase } from '../supabase';

const vibe = (ms = 8) => navigator.vibrate?.(ms);

const TYPE_CONFIG: Record<PostType, { icon: React.ReactNode; label: string; color: string }> = {
  note:       { icon: <FileText size={12}/>,   label: 'Заметка',   color: '#b07d4a' },
  quote:      { icon: <Quote size={12}/>,       label: 'Цитата',    color: '#8a6a9a' },
  insight:    { icon: <Lightbulb size={12}/>,   label: 'Инсайт',    color: '#5a8a6a' },
  summary:    { icon: <BookOpen size={12}/>,    label: 'Конспект',  color: '#4a7a9a' },
  flashcard:  { icon: <Sparkles size={12}/>,    label: 'Карточка',  color: '#9a6a4a' },
  book_review:{ icon: <BookOpen size={12}/>,    label: 'Рецензия',  color: '#7a5a8a' },
};

// ── Avatar ─────────────────────────────────────────────────────────────────
function Avatar({ profile, size = 36 }: { profile?: SocialProfile | null; size?: number }) {
  const av = profile?.avatar;
  const name = profile?.displayName || profile?.username || '?';
  const initial = name[0]?.toUpperCase() || '?';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: av && av.startsWith('data:') ? 'none' : 'linear-gradient(135deg, #d4a060, #8a5220)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 700, color: '#fff', flexShrink: 0,
      overflow: 'hidden', border: '2px solid var(--border)',
    }}>
      {av
        ? av.startsWith('data:')
          ? <img src={av} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
          : <span style={{ fontSize: size * 0.5 }}>{av}</span>
        : initial
      }
    </div>
  );
}

// ── PostCard ───────────────────────────────────────────────────────────────
function PostCard({
  post, userId: _userId, onLike, onSave, onComment, onProfile
}: {
  post: SocialPost;
  userId: string;
  onLike: (p: SocialPost) => void;
  onSave: (p: SocialPost) => void;
  onComment: (p: SocialPost) => void;
  onProfile: (p: SocialProfile) => void;
}) {
  const typeConf = TYPE_CONFIG[post.type] || TYPE_CONFIG.note;
  const plain = post.content.replace(/<[^>]+>/g, '').slice(0, 280);

  const handleShare = async () => {
    vibe(6);
    try {
      await navigator.share({ title: post.title, text: plain, url: window.location.href });
    } catch {
      await navigator.clipboard.writeText(plain).catch(() => {});
    }
  };

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 16,
      border: '1px solid var(--border)',
      overflow: 'hidden', marginBottom: 12,
      animation: 'fadeSlideUp 0.4s ease both',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => { vibe(); post.profile && onProfile(post.profile); }}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
          <Avatar profile={post.profile} size={40}/>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <button onClick={() => { vibe(); post.profile && onProfile(post.profile); }}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}>
              {post.profile?.displayName || post.profile?.username || 'Читатель'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
              @{post.profile?.username || 'user'} · {formatTime(post.createdAt)}
            </div>
          </button>
        </div>
        {/* Type badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: `${typeConf.color}22`, borderRadius: 20, padding: '3px 10px',
          border: `1px solid ${typeConf.color}44`,
        }}>
          <span style={{ color: typeConf.color }}>{typeConf.icon}</span>
          <span style={{ fontSize: 11, color: typeConf.color, fontWeight: 600 }}>{typeConf.label}</span>
        </div>
      </div>

      {/* Book ref */}
      {post.bookTitle && (
        <div style={{
          margin: '0 16px 10px',
          background: 'var(--bg-raised)', borderRadius: 10, padding: '8px 12px',
          display: 'flex', alignItems: 'center', gap: 8,
          border: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 20 }}>{post.bookEmoji || '📖'}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>
              {post.bookTitle}
            </div>
            {post.bookAuthor && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{post.bookAuthor}</div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ padding: '0 16px 12px' }}>
        {post.title && (
          <div style={{
            fontSize: 16, fontWeight: 700, color: 'var(--text-primary)',
            fontFamily: 'Lora, serif', marginBottom: 8, lineHeight: 1.3,
          }}>{post.title}</div>
        )}
        <div style={{
          fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7,
          fontFamily: 'Inter, sans-serif',
          display: '-webkit-box', WebkitLineClamp: 6,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{plain}</div>
      </div>

      {/* Tags */}
      {post.tags.length > 0 && (
        <div style={{ padding: '0 16px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {post.tags.slice(0, 4).map(t => (
            <span key={t} style={{
              fontSize: 11, color: 'var(--accent)', background: 'var(--accent-muted)',
              borderRadius: 20, padding: '2px 8px', fontFamily: 'Inter, sans-serif',
            }}>#{t}</span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{
        padding: '10px 16px 14px', display: 'flex', alignItems: 'center', gap: 4,
        borderTop: '1px solid var(--border)',
      }}>
        <ActionBtn icon={<Heart size={18} fill={post.isLiked ? 'var(--accent)' : 'none'}/>}
          label={post.likesCount || 0} active={!!post.isLiked}
          color={post.isLiked ? 'var(--accent)' : 'var(--text-muted)'}
          onClick={() => { vibe(10); onLike(post); }}/>
        <ActionBtn icon={<MessageCircle size={18}/>} label={post.commentsCount || 0}
          color='var(--text-muted)' onClick={() => { vibe(); onComment(post); }}/>
        <ActionBtn icon={<Bookmark size={18} fill={post.isSaved ? 'var(--accent)' : 'none'}/>}
          label='' active={!!post.isSaved}
          color={post.isSaved ? 'var(--accent)' : 'var(--text-muted)'}
          onClick={() => { vibe(); onSave(post); }}/>
        <div style={{ flex: 1 }}/>
        <ActionBtn icon={<Share2 size={18}/>} label='' color='var(--text-muted)'
          onClick={handleShare}/>
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, active, color, onClick }: {
  icon: React.ReactNode; label: string | number; active?: boolean;
  color: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px',
      color, borderRadius: 10, transition: 'all 0.15s',
    }}
      onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.92)')}
      onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {icon}
      {label !== '' && <span style={{ fontSize: 13, fontWeight: active ? 700 : 400 }}>{label}</span>}
    </button>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)}м`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}ч`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}д`;
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' });
}

// ── CommentsSheet ──────────────────────────────────────────────────────────
function CommentsSheet({ post, userId, onClose }: {
  post: SocialPost; userId: string; onClose: () => void;
}) {
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getComments(post.id, userId).then(setComments);
    setTimeout(() => inputRef.current?.focus(), 300);
  }, [post.id, userId]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true); vibe(8);
    try {
      // Проверяем профиль перед комментарием
      const existingProfile = await getMyProfile(userId);
      if (!existingProfile) {
        const { data: userData } = await supabase.auth.getUser();
        const email = userData?.user?.email || '';
        const baseUsername = email.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase() || 'reader';
        await upsertProfile({
          id: userId,
          username: baseUsername + Math.floor(Math.random() * 9999),
          displayName: baseUsername,
          isPublic: true,
        });
      }
      const comment = await addComment(post.id, userId, text.trim());
      if (comment) {
        setComments(prev => [...prev, comment]);
        setText('');
      }
    } catch (e) {
      console.error('handleSend error:', e);
    }
    setSending(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }}/>
      <div style={{
        position: 'relative', background: 'var(--bg-card)',
        borderRadius: '20px 20px 0 0', maxHeight: '75vh',
        display: 'flex', flexDirection: 'column',
        border: '1px solid var(--border)', borderBottom: 'none',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2 }}/>
        </div>
        {/* Header */}
        <div style={{
          padding: '8px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontFamily: 'Lora, serif', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            Комментарии
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={20}/>
          </button>
        </div>
        {/* Comments list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {comments.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 14 }}>
              Будьте первым — напишите комментарий
            </div>
          )}
          {comments.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 10 }}>
              <Avatar profile={c.profile} size={32}/>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {c.profile?.displayName || c.profile?.username || 'Читатель'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatTime(c.createdAt)}</span>
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{c.content}</div>
                <button onClick={() => { vibe(6); toggleCommentLike(c.id, userId, !!c.isLiked); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', marginTop: 6,
                    display: 'flex', alignItems: 'center', gap: 4,
                    color: c.isLiked ? 'var(--accent)' : 'var(--text-muted)', fontSize: 12,
                  }}>
                  <Heart size={13} fill={c.isLiked ? 'var(--accent)' : 'none'}/> {c.likesCount || 0}
                </button>
              </div>
            </div>
          ))}
        </div>
        {/* Input */}
        <div style={{
          padding: '12px 16px', borderTop: '1px solid var(--border)',
          display: 'flex', gap: 10, alignItems: 'center',
          paddingBottom: `calc(12px + env(safe-area-inset-bottom))`,
        }}>
          <input ref={inputRef} value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder='Написать комментарий...'
            style={{
              flex: 1, background: 'var(--bg-raised)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '10px 14px', fontSize: 14,
              color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', outline: 'none',
            }}/>
          <button onClick={handleSend} disabled={!text.trim() || sending}
            style={{
              width: 40, height: 40, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: text.trim() ? 'linear-gradient(135deg, #d4a060, #8a5220)' : 'var(--bg-raised)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: text.trim() ? '#fff' : 'var(--text-muted)', transition: 'all 0.2s',
            }}>
            <Send size={16}/>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CreatePostSheet ────────────────────────────────────────────────────────
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
  const [selectedBookId, setSelectedBookId] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState('');
  const [publishing, setPublishing] = useState(false);

  const selectedBook = books.find(b => b.id === selectedBookId);
  const selectedNote = notes.find(n => n.id === selectedNoteId);

  useEffect(() => {
    if (selectedNote) {
      setTitle(selectedNote.title);
      setContent(selectedNote.content.replace(/<[^>]+>/g, ''));
      setSelectedTags(selectedNote.tags);
      if (selectedNote.bookId) setSelectedBookId(selectedNote.bookId);
      setType(selectedNote.type as PostType);
    }
  }, [selectedNoteId]); // eslint-disable-line

  const handlePublish = async () => {
    if (!content.trim()) return;
    setPublishing(true); vibe(10);
    try {
      // Проверяем и создаём профиль если его нет
      const existingProfile = await getMyProfile(userId);
      if (!existingProfile) {
        const { data: userData } = await supabase.auth.getUser();
        const email = userData?.user?.email || '';
        const baseUsername = email.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase() || 'reader';
        await upsertProfile({
          id: userId,
          username: baseUsername + Math.floor(Math.random() * 9999),
          displayName: baseUsername,
          isPublic: true,
        });
      }
      const post = await createPost({
        userId, type,
        title: title || content.replace(/<[^>]+>/g, '').slice(0, 60),
        content,
        bookTitle: selectedBook?.title,
        bookAuthor: selectedBook?.author,
        bookEmoji: selectedBook?.coverEmoji,
        tags: selectedTags,
      });
      if (post) {
        onCreated(post);
        onClose();
      } else {
        console.error('createPost returned null');
        alert('Ошибка публикации. Проверьте подключение.');
      }
    } catch (e) {
      console.error('handlePublish error:', e);
      alert('Ошибка: ' + (e instanceof Error ? e.message : String(e)));
    }
    setPublishing(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }}/>
      <div style={{
        position: 'relative', background: 'var(--bg-card)',
        borderRadius: '20px 20px 0 0', maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        border: '1px solid var(--border)', borderBottom: 'none',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2 }}/>
        </div>
        <div style={{ padding: '8px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontFamily: 'Lora, serif', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Новая публикация</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20}/></button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {/* Import from notes */}
          {notes.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>ИМПОРТ ИЗ ЗАПИСЕЙ</label>
              <select value={selectedNoteId} onChange={e => setSelectedNoteId(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 12,
                  background: 'var(--bg-raised)', border: '1px solid var(--border)',
                  color: selectedNoteId ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none',
                }}>
                <option value=''>Выбрать запись...</option>
                {notes.slice(0, 30).map(n => (
                  <option key={n.id} value={n.id}>{n.title || n.content.replace(/<[^>]+>/g,'').slice(0,40)}</option>
                ))}
              </select>
            </div>
          )}

          {/* Type */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>ТИП</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(Object.keys(TYPE_CONFIG) as PostType[]).map(t => {
                const cfg = TYPE_CONFIG[t];
                return (
                  <button key={t} onClick={() => { vibe(6); setType(t); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
                      background: type === t ? `${cfg.color}33` : 'var(--bg-raised)',
                      border: `1px solid ${type === t ? cfg.color : 'var(--border)'}`,
                      color: type === t ? cfg.color : 'var(--text-muted)', fontSize: 12,
                      fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
                    }}>
                    {cfg.icon} {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Book */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>КНИГА (опционально)</label>
            <select value={selectedBookId} onChange={e => setSelectedBookId(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 12,
                background: 'var(--bg-raised)', border: '1px solid var(--border)',
                color: selectedBookId ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none',
              }}>
              <option value=''>Без книги</option>
              {books.map(b => <option key={b.id} value={b.id}>{b.coverEmoji} {b.title}</option>)}
            </select>
          </div>

          {/* Title */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>ЗАГОЛОВОК</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder='Заголовок публикации...'
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 12, boxSizing: 'border-box',
                background: 'var(--bg-raised)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: 15, fontFamily: 'Lora, serif', outline: 'none',
              }}/>
          </div>

          {/* Content */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>ТЕКСТ *</label>
            <textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder='Поделитесь мыслями, инсайтом или цитатой...'
              rows={6}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 12, boxSizing: 'border-box',
                background: 'var(--bg-raised)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: 14, fontFamily: 'Inter, sans-serif',
                outline: 'none', resize: 'none', lineHeight: 1.7,
              }}/>
          </div>

          {/* Tags */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>ТЕГИ</label>
            <input
              placeholder='психология, книги, инсайт...'
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  const val = (e.currentTarget.value || '').trim().replace(',', '');
                  if (val && !selectedTags.includes(val)) setSelectedTags(prev => [...prev, val]);
                  e.currentTarget.value = '';
                }
              }}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 12, boxSizing: 'border-box',
                background: 'var(--bg-raised)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none',
              }}/>
            {selectedTags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {selectedTags.map(t => (
                  <button key={t} onClick={() => setSelectedTags(prev => prev.filter(x => x !== t))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px',
                      borderRadius: 20, background: 'var(--accent-muted)', border: '1px solid var(--accent)',
                      color: 'var(--accent)', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                    }}>
                    #{t} <X size={10}/>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Publish btn */}
        <div style={{
          padding: '12px 16px', borderTop: '1px solid var(--border)',
          paddingBottom: `calc(16px + env(safe-area-inset-bottom))`,
        }}>
          <button onClick={handlePublish} disabled={!content.trim() || publishing}
            style={{
              width: '100%', padding: '14px', borderRadius: 14, border: 'none', cursor: 'pointer',
              background: content.trim() ? 'linear-gradient(135deg, #d4a060, #8a5220)' : 'var(--bg-raised)',
              color: content.trim() ? '#fff' : 'var(--text-muted)',
              fontSize: 15, fontWeight: 700, fontFamily: 'Inter, sans-serif',
              transition: 'all 0.2s',
            }}>
            {publishing ? 'Публикация...' : '✦ Опубликовать'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ProfileSheet ───────────────────────────────────────────────────────────
function ProfileSheet({ profile, currentUserId, onClose }: {
  profile: SocialProfile; currentUserId: string; onClose: () => void;
}) {
  const [following, setFollowing] = useState(false);
  const [posts, setPosts] = useState<SocialPost[]>([]);

  useEffect(() => {
    isFollowing(currentUserId, profile.id).then(setFollowing);
    getUserPosts(profile.id, currentUserId).then(setPosts);
  }, [profile.id]); // eslint-disable-line

  const handleFollow = () => {
    vibe(10);
    toggleFollow(currentUserId, profile.id, following);
    setFollowing(f => !f);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }}/>
      <div style={{
        position: 'relative', background: 'var(--bg-card)', borderRadius: '20px 20px 0 0',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        border: '1px solid var(--border)', borderBottom: 'none',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2 }}/>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Avatar profile={profile} size={56}/>
            {profile.id !== currentUserId && (
              <button onClick={handleFollow} style={{
                padding: '8px 20px', borderRadius: 20, border: 'none', cursor: 'pointer',
                background: following ? 'var(--bg-raised)' : 'linear-gradient(135deg, #d4a060, #8a5220)',
                color: following ? 'var(--text-primary)' : '#fff',
                fontSize: 13, fontWeight: 700, fontFamily: 'Inter, sans-serif',
                outline: following ? '1px solid var(--border)' : 'none',
              }}>
                {following ? 'Читаю' : '+ Читать'}
              </button>
            )}
          </div>
          <div style={{ fontFamily: 'Lora, serif', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
            {profile.displayName}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>@{profile.username}</div>
          {profile.bio && (
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
              {profile.bio}
            </div>
          )}
          <div style={{ display: 'flex', gap: 24, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
            {[
              { v: profile.followersCount || 0, l: 'читателей' },
              { v: profile.followingCount || 0, l: 'читает' },
              { v: posts.length, l: 'публикаций' },
            ].map(s => (
              <div key={s.l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>{s.v}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {posts.slice(0, 5).map(p => (
              <div key={p.id} style={{
                padding: '10px 12px', borderRadius: 12,
                background: 'var(--bg-raised)', border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, fontFamily: 'Lora, serif' }}>
                  {p.title || p.content.replace(/<[^>]+>/g,'').slice(0,50)}
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>♥ {p.likesCount}</span>
                  <span>💬 {p.commentsCount}</span>
                  <span>{formatTime(p.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SearchPeople ───────────────────────────────────────────────────────────
function SearchPeople({ currentUserId, onProfile }: { currentUserId: string; onProfile: (p: SocialProfile) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SocialProfile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      const r = await searchProfiles(query);
      setResults(r.filter(p => p.id !== currentUserId));
      setLoading(false);
    }, 400);
    return () => clearTimeout(t);
  }, [query, currentUserId]);

  return (
    <div style={{ padding: '0 16px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--bg-raised)', borderRadius: 14, padding: '10px 14px',
        border: '1px solid var(--border)', marginBottom: 16,
      }}>
        <Search size={16} color='var(--text-muted)'/>
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder='Найти читателей...'
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            fontSize: 15, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif',
          }}/>
      </div>
      {loading && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 16 }}>Поиск...</div>}
      {results.map(p => (
        <button key={p.id} onClick={() => { vibe(); onProfile(p); }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: '1px solid var(--border)',
          }}>
          <Avatar profile={p} size={44}/>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}>
              {p.displayName}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{p.username} · {p.followersCount || 0} читателей</div>
          </div>
        </button>
      ))}
      {!loading && query && results.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 24 }}>Никого не найдено</div>
      )}
      {!query && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 15, color: 'var(--text-muted)', fontFamily: 'Lora, serif' }}>Найдите читателей</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Поищите по имени или username</div>
        </div>
      )}
    </div>
  );
}

// ── Main FeedView ──────────────────────────────────────────────────────────
export default function FeedView({
  user, notes, books,
}: {
  user: User;
  notes: import('../types').Note[];
  books: Book[];
}) {
  const [feedTab, setFeedTab] = useState<'explore' | 'following' | 'search'>('explore');
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentPost, setCommentPost] = useState<SocialPost | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<SocialProfile | null>(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    const data = feedTab === 'following'
      ? await getFollowingFeed(user.id)
      : await getFeed(user.id);
    setPosts(data);
    setLoading(false);
  }, [feedTab, user.id]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const handleLike = async (post: SocialPost) => {
    await toggleLike(post.id, user.id, !!post.isLiked);
    setPosts(prev => prev.map(p => p.id === post.id
      ? { ...p, isLiked: !p.isLiked, likesCount: p.likesCount + (p.isLiked ? -1 : 1) }
      : p
    ));
  };

  const handleSave = async (post: SocialPost) => {
    await toggleSave(post.id, user.id, !!post.isSaved);
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, isSaved: !p.isSaved } : p));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px 0',
        paddingTop: `calc(16px + env(safe-area-inset-top))`,
        background: 'var(--bg-base)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: 'Lora, serif', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
              Сообщество
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Читатели и их мысли</div>
          </div>
          <button onClick={() => { vibe(10); setShowCreate(true); }}
            style={{
              width: 42, height: 42, borderRadius: 14, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #d4a060, #8a5220)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
            }}>
            <Plus size={20}/>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-raised)', borderRadius: 14, padding: 4, marginBottom: 16 }}>
          {([
            { id: 'explore', label: 'Обзор', icon: <Compass size={14}/> },
            { id: 'following', label: 'Читаю', icon: <Users size={14}/> },
            { id: 'search', label: 'Поиск', icon: <Search size={14}/> },
          ] as const).map(t => (
            <button key={t.id} onClick={() => { vibe(6); setFeedTab(t.id); }}
              style={{
                flex: 1, padding: '8px 4px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: feedTab === t.id ? 'var(--bg-card)' : 'transparent',
                color: feedTab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: 12, fontWeight: feedTab === t.id ? 700 : 400,
                fontFamily: 'Inter, sans-serif', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: 5,
                boxShadow: feedTab === t.id ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
                transition: 'all 0.15s',
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 100px' }}>
        {feedTab === 'search' ? (
          <SearchPeople currentUserId={user.id} onProfile={setSelectedProfile}/>
        ) : loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 12 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{
                height: 200, borderRadius: 16, background: 'var(--bg-card)',
                border: '1px solid var(--border)', animation: 'pulse 1.5s ease infinite',
                opacity: 0.6,
              }}/>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
            <div style={{ fontFamily: 'Lora, serif', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              {feedTab === 'following' ? 'Пока тихо' : 'Будьте первым'}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {feedTab === 'following'
                ? 'Найдите читателей через поиск и подпишитесь на них'
                : 'Поделитесь своими мыслями и вдохновите других читателей'}
            </div>
            <button onClick={() => { vibe(10); setShowCreate(true); }}
              style={{
                marginTop: 20, padding: '12px 28px', borderRadius: 14, border: 'none',
                background: 'linear-gradient(135deg, #d4a060, #8a5220)', color: '#fff',
                fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>
              Опубликовать
            </button>
          </div>
        ) : (
          <div style={{ paddingTop: 12 }}>
            {posts.map(post => (
              <PostCard key={post.id} post={post} userId={user.id}
                onLike={handleLike} onSave={handleSave}
                onComment={setCommentPost} onProfile={setSelectedProfile}/>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {commentPost && <CommentsSheet post={commentPost} userId={user.id} onClose={() => setCommentPost(null)}/>}
      {showCreate && (
        <CreatePostSheet userId={user.id} notes={notes} books={books}
          onClose={() => setShowCreate(false)}
          onCreated={post => setPosts(prev => [post, ...prev])}/>
      )}
      {selectedProfile && (
        <ProfileSheet profile={selectedProfile} currentUserId={user.id} onClose={() => setSelectedProfile(null)}/>
      )}
    </div>
  );
}
