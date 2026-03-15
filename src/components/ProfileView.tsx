import { useState, useEffect } from 'react';
import {
  Edit2, Check, X, BookOpen, FileText, Sparkles, Globe, Lock,
  Trash2, Settings, ChevronRight
} from 'lucide-react';
import type { User, SocialPost, SocialProfile, Book } from '../types';
import { getMyProfile, upsertProfile, getUserPosts, deletePost } from '../socialStore';

const vibe = (ms = 8) => navigator.vibrate?.(ms);

function Avatar({ profile, size = 64 }: { profile?: SocialProfile | null; size?: number }) {
  const av = profile?.avatar;
  const name = profile?.displayName || '?';
  const initial = name[0]?.toUpperCase() || '?';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: av && av.startsWith('data:') ? 'none' : 'linear-gradient(135deg, #d4a060, #8a5220)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 700, color: '#fff',
      overflow: 'hidden', border: '3px solid var(--accent)',
      flexShrink: 0,
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

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)}м назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}ч назад`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}д назад`;
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'long' });
}

// Инструменты — карточки-плитки
const TOOLS = [
  {
    id: 'anki',
    icon: '🃏',
    label: 'Anki',
    desc: 'Повторение карточек',
    bg: 'linear-gradient(135deg, rgba(212,145,74,0.18), rgba(180,100,40,0.08))',
    border: 'rgba(212,145,74,0.3)',
  },
  {
    id: 'achievements',
    icon: '🏆',
    label: 'Достижения',
    desc: 'Бейджи и прогресс',
    bg: 'linear-gradient(135deg, rgba(180,150,80,0.18), rgba(140,100,40,0.08))',
    border: 'rgba(180,150,80,0.3)',
  },
  {
    id: 'graph',
    icon: '🔗',
    label: 'Граф связей',
    desc: 'Карта книг и идей',
    bg: 'linear-gradient(135deg, rgba(106,158,138,0.18), rgba(60,120,100,0.08))',
    border: 'rgba(106,158,138,0.3)',
  },
  {
    id: 'share',
    icon: '📄',
    label: 'Конспекты',
    desc: 'Экспорт PDF и публикация',
    bg: 'linear-gradient(135deg, rgba(138,106,158,0.18), rgba(100,60,120,0.08))',
    border: 'rgba(138,106,158,0.3)',
  },
];

export default function ProfileView({
  user, books, onNavigate,
}: {
  user: User;
  books: Book[];
  onNavigate?: (tab: string) => void;
}) {
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPublic, setEditPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'tools' | 'stats'>('tools');

  // Avatar from localStorage
  const avatarKey = `psyche_avatar_${user.id}`;
  const avatarVal = localStorage.getItem(avatarKey) || '';

  useEffect(() => {
    Promise.all([
      getMyProfile(user.id),
      getUserPosts(user.id),
    ]).then(([p, ps]) => {
      if (p) {
        setProfile(p);
        setEditName(p.displayName);
        setEditUsername(p.username);
        setEditBio(p.bio || '');
        setEditPublic(p.isPublic);
      } else {
        const defaultName = user.name || user.email.split('@')[0];
        const defaultUsername = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        setEditName(defaultName);
        setEditUsername(defaultUsername);
        setEditPublic(true);
      }
      setPosts(ps);
      setLoading(false);
    });
  }, [user.id]); // eslint-disable-line

  const handleSave = async () => {
    if (!editUsername.trim() || !editName.trim()) return;
    setSaving(true); vibe(8);
    const updated = await upsertProfile({
      id: user.id,
      username: editUsername.trim().toLowerCase().replace(/\s+/g, '_'),
      displayName: editName.trim(),
      bio: editBio.trim(),
      isPublic: editPublic,
      avatar: avatarVal,
      followersCount: profile?.followersCount || 0,
      followingCount: profile?.followingCount || 0,
      postsCount: posts.length,
      createdAt: profile?.createdAt || new Date().toISOString(),
    });
    if (updated) setProfile(updated);
    setSaving(false);
    setEditing(false);
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Удалить публикацию?')) return;
    vibe(10);
    await deletePost(postId);
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const totalLikes = posts.reduce((sum, p) => sum + p.likesCount, 0);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ fontSize: 32, animation: 'spin 1.5s linear infinite' }}>✦</div>
      </div>
    );
  }

  const profileForAvatar: SocialProfile = profile || {
    id: user.id, username: editUsername, displayName: editName,
    avatar: avatarVal, isPublic: true,
    followersCount: 0, followingCount: 0, postsCount: 0,
    createdAt: user.createdAt, bio: '',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={{
        padding: '16px 20px',
        paddingTop: `calc(16px + env(safe-area-inset-top))`,
        background: 'var(--bg-base)', flexShrink: 0,
        borderBottom: '1px solid var(--border)',
      }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontFamily: 'Lora, serif', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            Профиль
          </div>
          <button
            onClick={() => { vibe(6); onNavigate?.('settings'); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 12,
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              cursor: 'pointer', color: 'var(--text-secondary)',
              fontSize: 13, fontFamily: 'Inter, sans-serif',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <Settings size={15} color='var(--accent)' />
            Настройки
          </button>
        </div>

        {/* Avatar + info */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
          <Avatar profile={profileForAvatar} size={68} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  placeholder='Имя' style={{
                    background: 'var(--bg-raised)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '8px 12px', fontSize: 15, fontWeight: 700,
                    color: 'var(--text-primary)', fontFamily: 'Lora, serif', outline: 'none',
                    width: '100%', boxSizing: 'border-box',
                  }}/>
                <input value={editUsername} onChange={e => setEditUsername(e.target.value)}
                  placeholder='username' style={{
                    background: 'var(--bg-raised)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '8px 12px', fontSize: 13,
                    color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', outline: 'none',
                    width: '100%', boxSizing: 'border-box',
                  }}/>
                <textarea value={editBio} onChange={e => setEditBio(e.target.value)}
                  placeholder='Расскажите о себе...' rows={2} style={{
                    background: 'var(--bg-raised)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '8px 12px', fontSize: 13,
                    color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif',
                    outline: 'none', resize: 'none', lineHeight: 1.5,
                    width: '100%', boxSizing: 'border-box',
                  }}/>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => { setEditPublic(p => !p); vibe(6); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                      borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer',
                      background: editPublic ? 'var(--accent-muted)' : 'var(--bg-raised)',
                      color: editPublic ? 'var(--accent)' : 'var(--text-muted)', fontSize: 12,
                      fontFamily: 'Inter, sans-serif',
                    }}>
                    {editPublic ? <Globe size={12}/> : <Lock size={12}/>}
                    {editPublic ? 'Публичный' : 'Приватный'}
                  </button>
                  <div style={{ flex: 1 }}/>
                  <button onClick={() => setEditing(false)}
                    style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 10px', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <X size={16}/>
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    style={{
                      background: 'linear-gradient(135deg, #d4a060, #8a5220)', border: 'none',
                      borderRadius: 10, padding: '6px 14px', cursor: 'pointer', color: '#fff',
                      fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                    <Check size={14}/> {saving ? '...' : 'Готово'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <div style={{ fontFamily: 'Lora, serif', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {profile?.displayName || editName || user.name}
                  </div>
                  {profile?.isPublic
                    ? <Globe size={12} color='var(--text-muted)'/>
                    : <Lock size={12} color='var(--text-muted)'/>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                  @{profile?.username || editUsername}
                </div>
                {profile?.bio && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>
                    {profile.bio}
                  </div>
                )}
                <button onClick={() => { vibe(6); setEditing(true); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                    borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer',
                    background: 'var(--bg-raised)', color: 'var(--text-secondary)',
                    fontSize: 12, fontFamily: 'Inter, sans-serif',
                  }}>
                  <Edit2 size={12}/> Редактировать
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats row */}
        {!editing && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8, padding: '12px 0 4px',
            borderTop: '1px solid var(--border)',
          }}>
            {[
              { v: posts.length, l: 'постов' },
              { v: profile?.followersCount || 0, l: 'читателей' },
              { v: profile?.followingCount || 0, l: 'читает' },
              { v: totalLikes, l: 'лайков' },
            ].map(s => (
              <div key={s.l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>{s.v}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>{s.l}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        {!editing && (
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-raised)', borderRadius: 12, padding: 3, marginTop: 10 }}>
            {([
              { id: 'tools', label: '🛠 Инструменты' },
              { id: 'posts', label: '📝 Публикации' },
              { id: 'stats', label: '📊 Статистика' },
            ] as const).map(t => (
              <button key={t.id} onClick={() => { vibe(6); setActiveTab(t.id); }}
                style={{
                  flex: 1, padding: '7px 4px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  background: activeTab === t.id ? 'var(--bg-card)' : 'transparent',
                  color: activeTab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: 11, fontWeight: activeTab === t.id ? 700 : 400,
                  fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
                  WebkitTapHighlightColor: 'transparent',
                }}>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 100px' }}>

        {/* ── TOOLS tab ──────────────────────────────────────────────── */}
        {!editing && activeTab === 'tools' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* 2×2 grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {TOOLS.map((tool, i) => (
                <button
                  key={tool.id}
                  onClick={() => { vibe(8); onNavigate?.(tool.id); }}
                  style={{
                    padding: '18px 14px', borderRadius: 18,
                    background: tool.bg, border: `1px solid ${tool.border}`,
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                    display: 'flex', flexDirection: 'column', gap: 8,
                    animation: `fadeSlideUp 0.3s ease ${i * 0.06}s both`,
                    WebkitTapHighlightColor: 'transparent',
                  }}
                  onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.96)'; }}
                  onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                  onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <div style={{ fontSize: 30 }}>{tool.icon}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}>
                      {tool.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', marginTop: 2, lineHeight: 1.4 }}>
                      {tool.desc}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Library quick link */}
            <button
              onClick={() => { vibe(6); onNavigate?.('library'); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px', borderRadius: 16, cursor: 'pointer', width: '100%',
                background: 'rgba(212,145,74,0.06)', border: '1px solid rgba(212,145,74,0.2)',
                animation: 'fadeSlideUp 0.3s ease 0.24s both',
                WebkitTapHighlightColor: 'transparent',
              }}
              onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.98)'; }}
              onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <div style={{
                width: 42, height: 42, borderRadius: 13,
                background: 'var(--bg-raised)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <BookOpen size={20} color='var(--accent)'/>
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}>
                  Библиотека
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', marginTop: 1 }}>
                  {books.length} книг в коллекции
                </div>
              </div>
              <ChevronRight size={16} color='var(--text-muted)'/>
            </button>

            {/* Сообщество */}
            <button
              onClick={() => { vibe(6); onNavigate?.('feed'); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px', borderRadius: 16, cursor: 'pointer', width: '100%',
                background: 'rgba(106,158,138,0.06)', border: '1px solid rgba(106,158,138,0.2)',
                animation: 'fadeSlideUp 0.3s ease 0.3s both',
                WebkitTapHighlightColor: 'transparent',
              }}
              onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.98)'; }}
              onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <div style={{
                width: 42, height: 42, borderRadius: 13,
                background: 'var(--bg-raised)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <span style={{ fontSize: 20 }}>🌐</span>
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}>
                  Сообщество
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', marginTop: 1 }}>
                  Читатели и психологи
                </div>
              </div>
              <ChevronRight size={16} color='var(--text-muted)'/>
            </button>

            {/* Prompt to setup public profile */}
            {!profile && (
              <div style={{
                background: 'var(--accent-muted)', borderRadius: 16, padding: '16px',
                border: '1px solid var(--accent)', textAlign: 'center',
                animation: 'fadeSlideUp 0.3s ease 0.36s both',
              }}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>✦</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', fontFamily: 'Lora, serif', marginBottom: 6 }}>
                  Настройте публичный профиль
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
                  Выберите username и начните делиться инсайтами с сообществом
                </div>
                <button onClick={() => { vibe(8); setEditing(true); }}
                  style={{
                    padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg, #d4a060, #8a5220)', color: '#fff',
                    fontSize: 13, fontWeight: 700,
                  }}>
                  Настроить
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── POSTS tab ──────────────────────────────────────────────── */}
        {!editing && activeTab === 'posts' && (
          posts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', animation: 'fadeSlideUp 0.4s ease both' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✦</div>
              <div style={{ fontFamily: 'Lora, serif', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                Нет публикаций
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Поделитесь мыслью или инсайтом в разделе «Сообщество»
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {posts.map((post, i) => (
                <div key={post.id} style={{
                  background: 'var(--bg-card)', borderRadius: 14,
                  border: '1px solid var(--border)', overflow: 'hidden',
                  animation: `fadeSlideUp 0.3s ease ${i * 0.05}s both`,
                }}>
                  <div style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                      <div style={{ fontFamily: 'Lora, serif', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>
                        {post.title || post.content.replace(/<[^>]+>/g,'').slice(0, 60)}
                      </div>
                      <button onClick={() => handleDeletePost(post.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, flexShrink: 0 }}>
                        <Trash2 size={14}/>
                      </button>
                    </div>
                    {post.bookTitle && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <span style={{ fontSize: 14 }}>{post.bookEmoji || '📖'}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{post.bookTitle}</span>
                      </div>
                    )}
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6,
                      display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {post.content.replace(/<[^>]+>/g,'').slice(0, 150)}
                    </div>
                  </div>
                  <div style={{
                    padding: '8px 14px 10px', borderTop: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: 16,
                  }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      ♥ {post.likesCount}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      💬 {post.commentsCount}
                    </span>
                    <div style={{ flex: 1 }}/>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatTime(post.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* ── STATS tab ──────────────────────────────────────────────── */}
        {!editing && activeTab === 'stats' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeSlideUp 0.4s ease both' }}>
            {/* Library stats */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '16px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5, marginBottom: 14, fontFamily: 'Inter, sans-serif' }}>БИБЛИОТЕКА</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { icon: <BookOpen size={18}/>, v: books.length, l: 'книг' },
                  { icon: <FileText size={18}/>, v: books.filter(b => b.status === 'reading').length, l: 'читаю' },
                  { icon: <Sparkles size={18}/>, v: books.filter(b => b.status === 'finished').length, l: 'прочитано' },
                ].map(s => (
                  <div key={s.l} style={{
                    background: 'var(--bg-raised)', borderRadius: 12, padding: '12px 8px',
                    textAlign: 'center', border: '1px solid var(--border)',
                  }}>
                    <div style={{ color: 'var(--accent)', marginBottom: 6 }}>{s.icon}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>{s.v}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Social stats */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '16px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5, marginBottom: 14, fontFamily: 'Inter, sans-serif' }}>АКТИВНОСТЬ</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { l: 'Публикации', v: posts.length, max: Math.max(posts.length, 1) },
                  { l: 'Лайки получено', v: totalLikes, max: Math.max(totalLikes, 1) },
                  { l: 'Читателей', v: profile?.followersCount || 0, max: Math.max(profile?.followersCount || 0, 1) },
                ].map(s => (
                  <div key={s.l}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}>{s.l}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}>{s.v}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg-raised)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        background: 'linear-gradient(90deg, #d4a060, #8a5220)',
                        width: `${Math.min((s.v / s.max) * 100, 100)}%`,
                        transition: 'width 0.6s ease',
                      }}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


