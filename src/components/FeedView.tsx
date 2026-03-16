import { useState, useEffect, useCallback, useRef } from 'react';
import { Heart, MessageCircle, Bookmark, Share2, Search, Users, Send, X, Plus, BookOpen, Sparkles, Quote, Lightbulb, FileText, MoreHorizontal, Trash2, Edit3, Check } from 'lucide-react';
import type { SocialPost, SocialComment, SocialProfile, User, Book, PostType } from '../types';
import { getFeed, toggleLike, toggleSave, getComments, addComment, toggleCommentLike, searchProfiles, createPost, toggleFollow, getUserPosts, isFollowing, getMyProfile, upsertProfile, deletePost, updatePost } from '../socialStore';
import { supabase } from '../supabase';
import StoriesRow from './StoriesView';

const vibe = (ms = 8) => navigator.vibrate?.(ms);

const TYPE_CONFIG: Record<PostType, { icon: React.ReactNode; label: string; color: string }> = {
  note:        { icon: <FileText size={12}/>,   label: 'Заметка',   color: '#b07d4a' },
  quote:       { icon: <Quote size={12}/>,       label: 'Цитата',    color: '#8a6a9a' },
  insight:     { icon: <Lightbulb size={12}/>,   label: 'Инсайт',    color: '#5a8a6a' },
  summary:     { icon: <BookOpen size={12}/>,    label: 'Конспект',  color: '#4a7a9a' },
  flashcard:   { icon: <Sparkles size={12}/>,    label: 'Карточка',  color: '#9a6a4a' },
  book_review: { icon: <BookOpen size={12}/>,    label: 'Рецензия',  color: '#7a5a8a' },
};

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

// ── Avatar ──────────────────────────────────────────────────────────────────
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
      {av ? av.startsWith('data:')
        ? <img src={av} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontSize: size * 0.5 }}>{av}</span>
        : initial}
    </div>
  );
}

// ── ReactionBtn ─────────────────────────────────────────────────────────────
const REACTIONS = ['❤️','🔥','💡','🙏','😮'];
function ReactionBtn({ post, onLike }: { post: SocialPost; onLike: (p: SocialPost) => void }) {
  const [showPicker, setShowPicker] = useState(false);
  const [myReaction, setMyReaction] = useState(post.isLiked ? '❤️' : '');

  const handleReact = (emoji: string) => {
    vibe(10);
    setShowPicker(false);
    if (myReaction === emoji) {
      setMyReaction('');
      onLike({ ...post, isLiked: false });
    } else {
      setMyReaction(emoji);
      onLike({ ...post, isLiked: true });
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {showPicker && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, marginBottom: 6,
          background: 'var(--bg-raised)', border: '1px solid var(--border)',
          borderRadius: 24, padding: '6px 8px', display: 'flex', gap: 4,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          animation: 'scaleIn 0.15s cubic-bezier(0.22,1,0.36,1)',
          zIndex: 50,
        }}>
          {REACTIONS.map(r => (
            <button key={r} onClick={() => handleReact(r)} style={{
              background: myReaction === r ? 'var(--accent-muted)' : 'none',
              border: 'none', cursor: 'pointer', fontSize: 20, padding: '4px 6px',
              borderRadius: 12, transition: 'all 0.15s',
            }}>{r}</button>
          ))}
        </div>
      )}
      <button
        onClick={() => { vibe(6); setShowPicker(v => !v); }}
        onBlur={() => setTimeout(() => setShowPicker(false), 200)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px',
          color: myReaction ? 'var(--accent)' : 'var(--text-muted)',
          borderRadius: 10, transition: 'all 0.15s', fontSize: 14,
        }}
      >
        <span style={{ fontSize: 18 }}>{myReaction || '🤍'}</span>
        <span style={{ fontSize: 13, fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>
          {post.likesCount || 0}
        </span>
      </button>
    </div>
  );
}

// ── ActionBtn ───────────────────────────────────────────────────────────────
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

// ── PostCard ─────────────────────────────────────────────────────────────────
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
  const typeConf = TYPE_CONFIG[post.type] || TYPE_CONFIG.note;
  const plain = post.content.replace(/<[^>]+>/g, '').slice(0, 280);

  const handleShare = async () => {
    vibe(6);
    try {
      await navigator.share({ title: post.title, text: plain, url: window.location.href });
    } catch {
      try { await navigator.clipboard.writeText(plain); } catch { /* ignore */ }
    }
  };

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 16,
      border: '1px solid var(--border)', overflow: 'hidden',
      marginBottom: 12, animation: 'fadeSlideUp 0.4s ease both',
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => { vibe(); post.profile && onProfile(post.profile); }}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
          <Avatar profile={post.profile} size={40} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}>
            {post.profile?.displayName || post.profile?.username || 'Читатель'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
            @{post.profile?.username || 'user'} · {formatTime(post.createdAt)}
          </div>
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

        {/* Menu button */}
        {isOwn && (
          <div style={{ position: 'relative' }}>
            <button onClick={() => { vibe(6); setShowMenu(m => !m); }}
              style={{
                background: 'var(--bg-raised)', border: '1px solid var(--border)',
                borderRadius: 8, width: 32, height: 32, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)',
              }}>
              <MoreHorizontal size={16} />
            </button>
            {showMenu && (
              <>
                <div onClick={() => setShowMenu(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 100 }} />
                <div style={{
                  position: 'absolute', right: 0, top: 36, zIndex: 101,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 12, overflow: 'hidden', minWidth: 160,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                }}>
                  <button onClick={() => { vibe(8); setShowMenu(false); onEdit(post); }}
                    style={{
                      width: '100%', padding: '12px 16px', background: 'none', border: 'none',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                      color: 'var(--text-primary)', fontSize: 14, fontFamily: 'Inter, sans-serif',
                      borderBottom: '1px solid var(--border)',
                    }}>
                    <Edit3 size={15} /> Редактировать
                  </button>
                  <button onClick={() => {
                    vibe(12); setShowMenu(false);
                    if (window.confirm('Удалить этот пост?')) onDelete(post.id);
                  }}
                    style={{
                      width: '100%', padding: '12px 16px', background: 'none', border: 'none',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                      color: '#e74c3c', fontSize: 14, fontFamily: 'Inter, sans-serif',
                    }}>
                    <Trash2 size={15} /> Удалить пост
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Book ref */}
      {post.bookTitle && (
        <div style={{
          margin: '0 16px 10px', background: 'var(--bg-raised)',
          borderRadius: 10, padding: '8px 12px',
          display: 'flex', alignItems: 'center', gap: 8,
          border: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 20 }}>{post.bookEmoji || '📖'}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>{post.bookTitle}</div>
            {post.bookAuthor && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{post.bookAuthor}</div>}
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

      {/* Tags — кликабельные хэштеги */}
      {post.tags.length > 0 && (
        <div style={{ padding: '0 16px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {post.tags.slice(0, 4).map(t => (
            <button key={t} onClick={() => { vibe(6); }} style={{
              fontSize: 11, color: 'var(--accent)', background: 'var(--accent-muted)',
              borderRadius: 20, padding: '3px 10px', fontFamily: 'Inter, sans-serif',
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              fontWeight: 600,
            }}>#{t}</button>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{
        padding: '10px 16px 14px', display: 'flex', alignItems: 'center', gap: 4,
        borderTop: '1px solid var(--border)',
      }}>
        {/* Реакции */}
        <ReactionBtn post={post} onLike={onLike} />
        <ActionBtn icon={<MessageCircle size={18} />} label={post.commentsCount || 0}
          color='var(--text-muted)' onClick={() => { vibe(); onComment(post); }} />
        <ActionBtn
          icon={<Bookmark size={18} fill={post.isSaved ? 'var(--accent)' : 'none'} />}
          label='' active={!!post.isSaved}
          color={post.isSaved ? 'var(--accent)' : 'var(--text-muted)'}
          onClick={() => { vibe(); onSave(post); }} />
        <div style={{ flex: 1 }} />
        <ActionBtn icon={<Share2 size={18} />} label='' color='var(--text-muted)' onClick={handleShare} />
      </div>
    </div>
  );
}

// ── CommentsSheet ────────────────────────────────────────────────────────────
function CommentsSheet({ post, userId, onClose }: {
  post: SocialPost; userId: string; onClose: () => void;
}) {
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getComments(post.id).then(setComments);
    setTimeout(() => inputRef.current?.focus(), 300);
  }, [post.id, userId]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true); vibe(8);
    try {
      const existingProfile = await getMyProfile(userId);
      if (!existingProfile) {
        const { data: userData } = await supabase.auth.getUser();
        const email = userData?.user?.email || '';
        const baseUsername = email.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase() || 'reader';
        await upsertProfile(userId, { username: baseUsername + Math.floor(Math.random() * 9999), displayName: baseUsername, isPublic: true });
      }
      const comment = await addComment(post.id, userId, text.trim());
      if (comment) { setComments(prev => [...prev, comment]); setText(''); }
    } catch (e) { console.error('Comment error:', e); }
    setSending(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
      <div style={{
        position: 'relative', background: 'var(--bg-card)',
        borderRadius: '20px 20px 0 0', maxHeight: '75vh',
        display: 'flex', flexDirection: 'column',
        border: '1px solid var(--border)', borderBottom: 'none',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2 }} />
        </div>
        <div style={{ padding: '8px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontFamily: 'Lora, serif', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            Комментарии {comments.length > 0 && `(${comments.length})`}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {comments.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 14 }}>
              Будьте первым — напишите комментарий
            </div>
          )}
          {comments.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 10 }}>
              <Avatar profile={c.profile} size={32} />
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
                  <Heart size={13} fill={c.isLiked ? 'var(--accent)' : 'none'} /> {c.likesCount || 0}
                </button>
              </div>
            </div>
          ))}
        </div>
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
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
            }} />
          <button onClick={handleSend} disabled={!text.trim() || sending}
            style={{
              width: 40, height: 40, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: text.trim() ? 'linear-gradient(135deg, #d4a060, #8a5220)' : 'var(--bg-raised)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: text.trim() ? '#fff' : 'var(--text-muted)', transition: 'all 0.2s',
            }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── EditPostSheet ─────────────────────────────────────────────────────────────
function EditPostSheet({ post, onClose, onSaved }: {
  post: SocialPost; onClose: () => void; onSaved: (p: SocialPost) => void;
}) {
  const [content, setContent] = useState(post.content.replace(/<[^>]+>/g, ''));
  const [saving, setSaving] = useState(false);

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
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
      <div style={{
        position: 'relative', background: 'var(--bg-card)',
        borderRadius: '20px 20px 0 0', maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        border: '1px solid var(--border)', borderBottom: 'none',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2 }} />
        </div>
        <div style={{ padding: '8px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontFamily: 'Lora, serif', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Редактировать</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} disabled={saving}
              style={{
                background: 'linear-gradient(135deg, #d4a060, #8a5220)',
                border: 'none', borderRadius: 10, padding: '8px 16px',
                color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
              <Check size={14} /> {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            style={{
              width: '100%', minHeight: 200, background: 'var(--bg-raised)',
              border: '1px solid var(--border)', borderRadius: 12,
              padding: '14px', fontSize: 15, color: 'var(--text-primary)',
              fontFamily: 'Lora, serif', outline: 'none', resize: 'vertical',
              lineHeight: 1.7, boxSizing: 'border-box',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── CreatePostSheet ───────────────────────────────────────────────────────────
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
  const [tagInput, setTagInput] = useState('');

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
      const existingProfile = await getMyProfile(userId);
      if (!existingProfile) {
        const { data: userData } = await supabase.auth.getUser();
        const email = userData?.user?.email || '';
        const baseUsername = email.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase() || 'reader';
        await upsertProfile(userId, { username: baseUsername + Math.floor(Math.random() * 9999), displayName: baseUsername, isPublic: true });
      }
      const post = await createPost(userId, {
        type,
        title: title || content.replace(/<[^>]+>/g, '').slice(0, 60),
        content,
        bookTitle: selectedBook?.title,
        bookAuthor: selectedBook?.author,
        bookEmoji: selectedBook?.coverEmoji,
        tags: selectedTags,
      });
      if (post) { onCreated(post); onClose(); }
      else { alert('Ошибка публикации. Проверьте подключение.'); }
    } catch (e) {
      console.error('Publish error:', e);
      alert('Ошибка: ' + (e instanceof Error ? e.message : String(e)));
    }
    setPublishing(false);
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !selectedTags.includes(t)) { setSelectedTags(prev => [...prev, t]); }
    setTagInput('');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
      <div style={{
        position: 'relative', background: 'var(--bg-card)',
        borderRadius: '20px 20px 0 0', maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        border: '1px solid var(--border)', borderBottom: 'none',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2 }} />
        </div>
        <div style={{ padding: '8px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontFamily: 'Lora, serif', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Новая публикация</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Import from notes */}
          {notes.length > 0 && (
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>ИМПОРТ ИЗ ЗАПИСЕЙ</label>
              <select value={selectedNoteId} onChange={e => setSelectedNoteId(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 12,
                  background: 'var(--bg-raised)', border: '1px solid var(--border)',
                  color: selectedNoteId ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none',
                }}>
                <option value=''>Выбрать запись...</option>
                {notes.map(n => <option key={n.id} value={n.id}>{n.title || 'Без названия'}</option>)}
              </select>
            </div>
          )}

          {/* Type selector */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>ТИП</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(Object.entries(TYPE_CONFIG) as [PostType, typeof TYPE_CONFIG[PostType]][]).map(([t, conf]) => (
                <button key={t} onClick={() => { vibe(6); setType(t); }}
                  style={{
                    padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${type === t ? conf.color : 'var(--border)'}`,
                    background: type === t ? `${conf.color}22` : 'var(--bg-raised)',
                    color: type === t ? conf.color : 'var(--text-muted)',
                    cursor: 'pointer', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                  {conf.icon} {conf.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>ЗАГОЛОВОК</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder='Заголовок публикации...'
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 12, boxSizing: 'border-box',
                background: 'var(--bg-raised)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: 14, fontFamily: 'Lora, serif', outline: 'none',
              }} />
          </div>

          {/* Content */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>СОДЕРЖАНИЕ *</label>
            <textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder='Поделитесь мыслью, инсайтом или цитатой...'
              rows={5}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 12, boxSizing: 'border-box',
                background: 'var(--bg-raised)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: 14, fontFamily: 'Lora, serif',
                outline: 'none', resize: 'vertical', lineHeight: 1.7,
              }} />
          </div>

          {/* Book */}
          {books.length > 0 && (
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>КНИГА</label>
              <select value={selectedBookId} onChange={e => setSelectedBookId(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 12,
                  background: 'var(--bg-raised)', border: '1px solid var(--border)',
                  color: selectedBookId ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none',
                }}>
                <option value=''>Выбрать книгу...</option>
                {books.map(b => <option key={b.id} value={b.id}>{b.coverEmoji} {b.title}</option>)}
              </select>
            </div>
          )}

          {/* Tags */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>ТЕГИ</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTag()}
                placeholder='Добавить тег...'
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 10,
                  background: 'var(--bg-raised)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: 13, outline: 'none',
                }} />
              <button onClick={addTag}
                style={{
                  padding: '8px 14px', borderRadius: 10, border: 'none',
                  background: 'var(--accent-muted)', color: 'var(--accent)',
                  cursor: 'pointer', fontSize: 13,
                }}>+ Добавить</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {selectedTags.map(t => (
                <span key={t} style={{
                  fontSize: 12, color: 'var(--accent)', background: 'var(--accent-muted)',
                  borderRadius: 20, padding: '3px 10px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                }} onClick={() => setSelectedTags(prev => prev.filter(x => x !== t))}>
                  #{t} <X size={10} />
                </span>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', paddingBottom: `calc(12px + env(safe-area-inset-bottom))` }}>
          <button onClick={handlePublish} disabled={!content.trim() || publishing}
            style={{
              width: '100%', padding: '14px', borderRadius: 14,
              background: content.trim() ? 'linear-gradient(135deg, #d4a060, #8a5220)' : 'var(--bg-raised)',
              border: 'none', color: content.trim() ? '#fff' : 'var(--text-muted)',
              fontSize: 15, fontWeight: 600, cursor: content.trim() ? 'pointer' : 'not-allowed',
              fontFamily: 'Inter, sans-serif',
            }}>
            {publishing ? 'Публикация...' : 'Опубликовать'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ProfileSheet ──────────────────────────────────────────────────────────────
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
      <div style={{
        position: 'relative', background: 'var(--bg-card)',
        borderRadius: '20px 20px 0 0', maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        border: '1px solid var(--border)', borderBottom: 'none',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2 }} />
        </div>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar profile={profile} size={56} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>
              {profile.displayName || profile.username}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>@{profile.username}</div>
            {profile.bio && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{profile.bio}</div>}
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                <b style={{ color: 'var(--text-primary)' }}>{profile.followersCount || 0}</b> читателей
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                <b style={{ color: 'var(--text-primary)' }}>{profile.postsCount || 0}</b> публикаций
              </span>
            </div>
          </div>
          {!isOwn && (
            <button onClick={handleFollow}
              style={{
                padding: '8px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600,
                border: following ? '1px solid var(--border)' : 'none',
                background: following ? 'var(--bg-raised)' : 'linear-gradient(135deg, #d4a060, #8a5220)',
                color: following ? 'var(--text-muted)' : '#fff', cursor: 'pointer',
              }}>
              {following ? 'Читаю' : '+ Читать'}
            </button>
          )}
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {posts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 14 }}>
              Нет публикаций
            </div>
          )}
          {posts.map(p => (
            <div key={p.id} style={{
              background: 'var(--bg-raised)', borderRadius: 12, padding: '12px 14px',
              border: '1px solid var(--border)',
            }}>
              {p.title && <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, fontFamily: 'Lora, serif' }}>{p.title}</div>}
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {p.content.replace(/<[^>]+>/g, '').slice(0, 120)}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Heart size={12} /> {p.likesCount || 0}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MessageCircle size={12} /> {p.commentsCount || 0}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── SearchTab ─────────────────────────────────────────────────────────────────
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
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--bg-raised)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '10px 14px',
      }}>
        <Search size={16} color='var(--text-muted)' />
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder='Поиск по имени или @username...'
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontSize: 15, fontFamily: 'Inter, sans-serif',
          }} />
        {query && <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={14} /></button>}
      </div>

      {loading && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, padding: '20px 0' }}>Поиск...</div>}

      {!loading && results.length === 0 && query && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, padding: '20px 0' }}>
          Никого не найдено по «{query}»
        </div>
      )}

      {!query && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Найдите читателей по имени</div>
        </div>
      )}

      {results.map(p => (
        <button key={p.id} onClick={() => setSelectedProfile(p)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
            background: 'var(--bg-raised)', borderRadius: 14, border: '1px solid var(--border)',
            cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.15s',
          }}>
          <Avatar profile={p} size={44} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {p.displayName || p.username}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{p.username}</div>
            {p.bio && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{p.bio.slice(0, 60)}</div>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.followersCount || 0} читателей</div>
        </button>
      ))}

      {selectedProfile && (
        <ProfileSheet profile={selectedProfile} userId={userId} onClose={() => setSelectedProfile(null)} />
      )}
    </div>
  );
}

// ── SavedTab ──────────────────────────────────────────────────────────────────
function SavedTab({ savedPosts, userId, onLike, onComment }: {
  savedPosts: SocialPost[];
  userId: string;
  onLike: (p: SocialPost) => void;
  onComment: (p: SocialPost) => void;
}) {
  const [selectedProfile, setSelectedProfile] = useState<SocialProfile | null>(null);

  if (savedPosts.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔖</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, fontFamily: 'Lora, serif' }}>Нет сохранённых</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Нажмите 🔖 на любом посте чтобы сохранить</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {savedPosts.map(post => (
        <PostCard key={post.id} post={post} userId={userId}
          onLike={onLike} onSave={() => { }} onComment={onComment}
          onProfile={setSelectedProfile}
          onDelete={() => { }} onEdit={() => { }} />
      ))}
      {selectedProfile && <ProfileSheet profile={selectedProfile} userId={userId} onClose={() => setSelectedProfile(null)} />}
    </div>
  );
}

// ── Main FeedView ─────────────────────────────────────────────────────────────
export default function FeedView({ user, notes, books }: {
  user: User;
  notes: import('../types').Note[];
  books: Book[];
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

  const handleEdit = (post: SocialPost) => {
    setEditPost(post);
  };

  const handleEditSaved = (updated: SocialPost) => {
    setPosts(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const savedPosts = posts.filter(p => p.isSaved);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 0',
        paddingTop: `calc(16px + env(safe-area-inset-top))`,
        background: 'var(--bg-base)', borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Lora, serif', margin: 0 }}>
            Сообщество
          </h1>
          <button onClick={() => { vibe(8); setShowCreate(true); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: 'linear-gradient(135deg, #d4a060, #8a5220)',
              border: 'none', borderRadius: 12, color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}>
            <Plus size={15} strokeWidth={2.5} /> Публикация
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: -1 }}>
          {([['feed', '🌍 Лента'], ['search', '🔍 Поиск'], ['saved', '🔖 Сохранённые']] as const).map(([t, label]) => (
            <button key={t} onClick={() => { vibe(6); setTab(t); }}
              style={{
                flex: 1, padding: '10px 6px', background: 'none', border: 'none',
                borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: 12, fontWeight: tab === t ? 700 : 400, cursor: 'pointer',
                fontFamily: 'Inter, sans-serif', transition: 'all 0.2s',
              }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'feed' && (
          <>
            {/* Stories */}
            <div style={{ paddingTop: 16 }}>
              <StoriesRow userId={user.id} profile={myProfile} />
            </div>
            <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 12 }} />

            {/* Posts */}
            <div style={{ padding: '0 16px' }}>
              {loading && posts.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{
                      height: 200, background: 'var(--bg-raised)', borderRadius: 16,
                      border: '1px solid var(--border)', animation: 'pulse 1.5s ease infinite',
                    }} />
                  ))}
                </div>
              )}

              {!loading && posts.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🌱</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, fontFamily: 'Lora, serif' }}>
                    Лента пуста
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
                    Опубликуйте первую запись или найдите читателей
                  </div>
                  <button onClick={() => { vibe(8); setShowCreate(true); }}
                    style={{
                      padding: '12px 24px', borderRadius: 14,
                      background: 'linear-gradient(135deg, #d4a060, #8a5220)',
                      border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    }}>
                    Первая публикация
                  </button>
                </div>
              )}

              {posts.map(post => (
                <PostCard key={post.id} post={post} userId={user.id}
                  onLike={handleLike} onSave={handleSave}
                  onComment={setCommentPost} onProfile={setSelectedProfile}
                  onDelete={handleDelete} onEdit={handleEdit} />
              ))}

              {hasMore && posts.length > 0 && (
                <button onClick={() => loadPosts(false)} disabled={loading}
                  style={{
                    width: '100%', padding: '14px', background: 'var(--bg-raised)',
                    border: '1px solid var(--border)', borderRadius: 14, marginBottom: 16,
                    color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer',
                  }}>
                  {loading ? 'Загрузка...' : 'Загрузить ещё'}
                </button>
              )}
            </div>
          </>
        )}

        {tab === 'search' && <SearchTab userId={user.id} />}
        {tab === 'saved' && (
          <SavedTab savedPosts={savedPosts} userId={user.id}
            onLike={handleLike} onComment={setCommentPost} />
        )}
      </div>

      {/* Sheets */}
      {showCreate && (
        <CreatePostSheet userId={user.id} notes={notes} books={books}
          onClose={() => setShowCreate(false)}
          onCreated={post => { setPosts(prev => [post, ...prev]); }} />
      )}
      {commentPost && (
        <CommentsSheet post={commentPost} userId={user.id}
          onClose={() => {
            setCommentPost(null);
            setPosts(prev => prev.map(p => p.id === commentPost.id
              ? { ...p, commentsCount: (p.commentsCount || 0) }
              : p));
          }} />
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

      {/* FAB for non-feed tabs */}
      {tab !== 'feed' && (
        <button onClick={() => { vibe(10); setTab('feed'); setShowCreate(true); }}
          style={{
            position: 'fixed', bottom: `calc(80px + env(safe-area-inset-bottom))`,
            right: 20, width: 52, height: 52, borderRadius: '50%',
            background: 'linear-gradient(135deg, #d4a060, #8a5220)',
            border: 'none', boxShadow: '0 4px 16px rgba(180,120,60,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 50, color: '#fff',
          }}>
          <Plus size={22} strokeWidth={2.5} />
        </button>
      )}

      {/* Pull to refresh */}
      <div style={{ display: 'none' }}>
        <button onClick={() => loadPosts(true)}>
          <Users size={16} />
        </button>
      </div>
    </div>
  );
}
