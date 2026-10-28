import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { Mail, Settings, ChevronRight, Trash2, X } from 'lucide-react';
import type { User, SocialPost, SocialProfile, Book, Note } from '../types';
import { getMyProfile, upsertProfile, getUserPosts, deletePost } from '../socialStore';

const vibe = (ms = 8) => navigator.vibrate?.(ms);

const label: CSSProperties = { fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' };
const typed: CSSProperties = {
  fontFamily: 'var(--font-typed)', color: 'var(--text-primary)', textShadow: '0 0 0.7px var(--ink-bleed)',
  margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
};
const iconBtn: CSSProperties = {
  width: 44, height: 44, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)',
};
const ghostBtn: CSSProperties = {
  height: 36, border: '1px solid var(--border)', background: 'var(--bg-card)', cursor: 'pointer',
  fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
};
const field: CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: 'none', border: 'none', borderBottom: '1px solid var(--border-mid)',
  padding: '8px 0', fontSize: 15, color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font-ui)',
};

const plain = (html: string) => html.replace(/<[^>]+>/g, '');

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function Avatar({ profile, size = 76 }: { profile?: SocialProfile | null; size?: number }) {
  const av = profile?.avatar;
  const name = profile?.displayName || '?';
  const initial = name[0]?.toUpperCase() || '?';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
      border: '1px solid var(--text-primary)', background: 'var(--bg-card)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, color: 'var(--text-primary)', fontFamily: 'var(--font-serif)',
    }}>
      {av
        ? av.startsWith('data:')
          ? <img src={av} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: size * 0.5 }}>{av}</span>
        : initial}
    </div>
  );
}

// Инструменты и разделы, которые живут в профиле
const TOOLS: { id: string; label: string; desc: string }[] = [
  { id: 'achievements', label: 'Достижения', desc: 'Уровни и знаки' },
  { id: 'challenges', label: 'Вызовы', desc: 'Серии и цели' },
  { id: 'wrapped', label: 'Итоги года', desc: 'Год в цифрах' },
  { id: 'anki', label: 'Карточки Anki', desc: 'Повторение' },
  { id: 'graph', label: 'Граф связей', desc: 'Карта книг и идей' },
  { id: 'share', label: 'Конспекты', desc: 'PDF и публикация' },
  { id: 'settings', label: 'Настройки', desc: 'Тема, аккаунт, корзина' },
];

export default function ProfileView({
  user, books, notes: _notes = [], onNavigate, onOpenWrapped, onOpenChallenges, onOpenMessages, onOpenFollowers,
}: {
  user: User;
  books: Book[];
  notes?: Note[];
  onNavigate?: (tab: string) => void;
  onOpenWrapped?: () => void;
  onOpenChallenges?: () => void;
  onOpenMessages?: () => void;
  onOpenFollowers?: (tab: 'followers' | 'following') => void;
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
  const [activeTab, setActiveTab] = useState<'posts' | 'tools' | 'stats'>('posts');
  const [openPost, setOpenPost] = useState<SocialPost | null>(null);

  // Аватар хранится локально
  const avatarKey = `psyche_avatar_${user.id}`;
  const avatarVal = localStorage.getItem(avatarKey) || '';

  useEffect(() => {
    Promise.all([
      getMyProfile(user.id),
      getUserPosts(user.id, user.id),
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
    const updated = await upsertProfile(user.id, {
      username: editUsername.trim().toLowerCase().replace(/\s+/g, '_'),
      displayName: editName.trim(),
      bio: editBio.trim(),
      isPublic: editPublic,
      avatar: avatarVal,
    });
    if (updated) setProfile(updated);
    setSaving(false);
    setEditing(false);
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Удалить этот лист?')) return;
    vibe(10);
    await deletePost(postId, user.id);
    setPosts(prev => prev.filter(p => p.id !== postId));
    setOpenPost(null);
  };

  const handleShare = async () => {
    vibe(6);
    const text = `@${profile?.username || editUsername} в Psyche`;
    try { await navigator.share({ title: 'Psyche', text, url: window.location.origin }); }
    catch { try { await navigator.clipboard.writeText(`${text} — ${window.location.origin}`); } catch { /* ignore */ } }
  };

  const openTool = (id: string) => {
    vibe(8);
    if (id === 'wrapped') onOpenWrapped?.();
    else if (id === 'challenges') onOpenChallenges?.();
    else onNavigate?.(id);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--bg-base)' }}>
        <div style={{ width: 24, height: 24, border: '1px solid var(--border)', borderTopColor: 'var(--text-primary)', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
      </div>
    );
  }

  const me: SocialProfile = profile || {
    id: user.id, username: editUsername, displayName: editName,
    avatar: avatarVal, isPublic: true,
    followersCount: 0, followingCount: 0, postsCount: 0,
    createdAt: user.createdAt, bio: '',
  };
  const finished = books.filter(b => b.status === 'finished').length;
  const reading = books.filter(b => b.status === 'reading').length;
  const totalStamps = posts.reduce((sum, p) => sum + (p.likesCount || 0), 0);
  const totalMargins = posts.reduce((sum, p) => sum + (p.commentsCount || 0), 0);

  const counters: { v: number; l: string; onClick?: () => void }[] = [
    { v: posts.length, l: 'листов', onClick: () => setActiveTab('posts') },
    { v: me.followersCount || 0, l: 'читателей', onClick: () => onOpenFollowers?.('followers') },
    { v: me.followingCount || 0, l: 'читает', onClick: () => onOpenFollowers?.('following') },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-base)' }}>
      <header style={{ paddingTop: 'env(safe-area-inset-top)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, padding: '0 8px 0 20px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
            {me.username || 'профиль'}
            {!me.isPublic && <span style={{ ...label, letterSpacing: '0.08em' }}>· закрытый</span>}
          </span>
          <span style={{ display: 'flex' }}>
            <button aria-label="Письма" onClick={() => { vibe(6); onOpenMessages?.(); }} style={iconBtn}><Mail size={21} strokeWidth={1.5} /></button>
            <button aria-label="Настройки" onClick={() => { vibe(6); onNavigate?.('settings'); }} style={iconBtn}><Settings size={21} strokeWidth={1.5} /></button>
          </span>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Шапка профиля */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '4px 24px 0' }}>
          <Avatar profile={me} size={76} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', flex: 1 }}>
            {counters.map(c => (
              <button key={c.l} onClick={() => { vibe(6); c.onClick?.(); }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--text-primary)' }}>{c.v}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.l}</span>
              </button>
            ))}
          </div>
        </div>

        {!editing ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '14px 24px 0' }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{me.displayName || me.username}</span>
              {me.bio && <p style={{ ...typed, fontSize: 14, lineHeight: 1.5 }}>{me.bio}</p>}
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {finished} {plural(finished, 'книга прочитана', 'книги прочитаны', 'книг прочитано')} · читаю {reading}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, padding: '14px 24px 0' }}>
              <button onClick={() => { vibe(6); setEditing(true); }} style={ghostBtn}>Править профиль</button>
              <button onClick={handleShare} style={ghostBtn}>Поделиться</button>
            </div>
          </>
        ) : (
          <div className="view-enter" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '18px 24px 0' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={label}>Имя</span>
              <input value={editName} onChange={e => setEditName(e.target.value)} style={field} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={label}>Имя пользователя</span>
              <input value={editUsername} onChange={e => setEditUsername(e.target.value)} style={field} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={label}>О себе</span>
              <textarea value={editBio} onChange={e => setEditBio(e.target.value)} rows={3}
                style={{ ...field, ...typed, fontSize: 15, resize: 'none', lineHeight: 1.5 }} />
            </label>
            <button role="switch" aria-checked={editPublic} onClick={() => { vibe(6); setEditPublic(p => !p); }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>Открытый профиль</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{editPublic ? 'Листы видны в Агоре' : 'Листы видите только вы'}</span>
              </span>
              <span style={{ width: 40, height: 22, flexShrink: 0, boxSizing: 'border-box', border: '1px solid var(--accent)', padding: 2, display: 'flex', background: editPublic ? 'var(--accent)' : 'none', transition: 'background var(--dur-quick) var(--ease-calm)' }}>
                <span style={{ width: 16, height: 16, background: editPublic ? 'var(--on-accent)' : 'var(--accent)', transform: `translateX(${editPublic ? 16 : 0}px)`, transition: 'transform var(--dur-quick) var(--ease-calm)' }} />
              </span>
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              <button onClick={() => setEditing(false)} style={ghostBtn}>Отмена</button>
              <button onClick={handleSave} disabled={saving || !editName.trim() || !editUsername.trim()}
                style={{ ...ghostBtn, background: 'var(--accent)', color: 'var(--on-accent)', border: '1px solid var(--accent)' }}>
                {saving ? 'Сохраняю…' : 'Сохранить'}
              </button>
            </div>
          </div>
        )}

        {/* Вкладки */}
        <div role="tablist" aria-label="Профиль" style={{ display: 'flex', marginTop: 18, borderBottom: '1px solid var(--border)' }}>
          {([['posts', 'Листы'], ['tools', 'Инструменты'], ['stats', 'Статистика']] as const).map(([id, name]) => (
            <button key={id} role="tab" aria-selected={activeTab === id} onClick={() => { vibe(6); setActiveTab(id); }}
              style={{
                flex: 1, height: 44, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, marginBottom: -1, fontFamily: 'var(--font-ui)',
                borderBottom: activeTab === id ? '1px solid var(--text-primary)' : '1px solid transparent',
                color: activeTab === id ? 'var(--text-primary)' : 'var(--text-muted)',
                transition: 'color var(--dur-quick) var(--ease-calm), border-color var(--dur-quick) var(--ease-calm)',
              }}>{name}</button>
          ))}
        </div>

        <div key={activeTab} className="view-enter">
          {activeTab === 'posts' && (
            posts.length === 0 ? (
              <div style={{ padding: '36px 24px', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--text-primary)' }}>Листов пока нет</span>
                <p style={{ ...typed, fontSize: 14, color: 'var(--text-muted)' }}>Напишите первый — он появится здесь и в Агоре.</p>
                <button onClick={() => { vibe(6); onNavigate?.('feed'); }} style={{ ...ghostBtn, padding: '0 16px', background: 'var(--accent)', color: 'var(--on-accent)', border: '1px solid var(--accent)' }}>В Агору</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 2, padding: 2 }}>
                {posts.map(p => (
                  <button key={p.id} onClick={() => { vibe(6); setOpenPost(p); }} aria-label={`Лист: ${p.title || plain(p.content).slice(0, 30)}`}
                    style={{ aspectRatio: '3 / 4', background: 'var(--bg-card)', padding: 10, overflow: 'hidden', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'flex-start' }}>
                    <span style={{ ...typed, fontSize: 9.5, lineHeight: 1.45 }}>{plain(p.content).replace(/~~([\s\S]+?)~~/g, '$1').slice(0, 170)}</span>
                  </button>
                ))}
              </div>
            )
          )}

          {activeTab === 'tools' && (
            <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 24px 24px' }}>
              {TOOLS.map(t => (
                <button key={t.id} onClick={() => openTool(t.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                  <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 15, color: 'var(--text-primary)' }}>{t.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.desc}</span>
                  </span>
                  <ChevronRight size={16} strokeWidth={1.5} color="var(--text-muted)" />
                </button>
              ))}
            </div>
          )}

          {activeTab === 'stats' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22, padding: '18px 24px 24px' }}>
              {([
                ['Библиотека', [[books.length, 'книг'], [reading, 'читаю'], [finished, 'прочитано']]],
                ['Агора', [[posts.length, 'листов'], [totalStamps, 'оттисков'], [totalMargins, 'на полях']]],
              ] as [string, [number, string][]][]).map(([title, items]) => (
                <section key={title} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={label}>{title}</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                    {items.map(([v, l]) => (
                      <span key={l} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '14px 0' }}>
                        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--text-primary)' }}>{v}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l}</span>
                      </span>
                    ))}
                  </div>
                </section>
              ))}
              <button onClick={() => { vibe(6); onNavigate?.('stats'); }}
                style={{ ...ghostBtn, height: 44 }}>Подробная статистика</button>
            </div>
          )}
        </div>
      </div>

      {/* Свой лист крупно */}
      {openPost && (
        <div onClick={() => setOpenPost(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--overlay)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'fadeIn var(--dur-quick) var(--ease-calm)' }}>
          <div role="dialog" aria-label="Лист" className="view-feed" onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 430, maxHeight: '80vh', overflowY: 'auto', background: 'var(--bg-card)', borderTop: '1px solid var(--border)', padding: '6px 20px calc(20px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={label}>{new Date(openPost.createdAt).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              <button aria-label="Закрыть" onClick={() => setOpenPost(null)} style={{ ...iconBtn, marginRight: -12 }}><X size={18} strokeWidth={1.5} /></button>
            </div>
            {openPost.title && <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--text-primary)' }}>{openPost.title}</span>}
            <p style={{ ...typed, fontSize: 16, lineHeight: 1.6 }}>{plain(openPost.content).replace(/~~([\s\S]+?)~~/g, '$1')}</p>
            {openPost.bookTitle && <span style={label}>{openPost.bookTitle}{openPost.bookAuthor ? ` · ${openPost.bookAuthor}` : ''}</span>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderTop: '1px dashed var(--border)', paddingTop: 10, fontSize: 13, color: 'var(--text-muted)' }}>
              <span>Оттиск · {openPost.likesCount || 0}</span>
              <span>На полях · {openPost.commentsCount || 0}</span>
              <button onClick={() => handleDeletePost(openPost.id)}
                style={{ marginLeft: 'auto', height: 36, display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 13 }}>
                <Trash2 size={15} strokeWidth={1.5} /> Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
