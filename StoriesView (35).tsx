import { useState, useEffect, useRef } from 'react';
import { X, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import type { SocialProfile } from '../types';

const vibe = (ms = 8) => navigator.vibrate?.(ms);

interface Story {
  id: string;
  userId: string;
  profile?: SocialProfile;
  emoji: string;
  text: string;
  bg: string;
  createdAt: string;
}

const BG_COLORS = [
  'linear-gradient(135deg, #2d1f0e, #4a3520)',
  'linear-gradient(135deg, #0e1f2d, #1a3548)',
  'linear-gradient(135deg, #1f0e2d, #3a1f4a)',
  'linear-gradient(135deg, #0e2d1a, #1a4a2a)',
  'linear-gradient(135deg, #2d1a0e, #4a2d1a)',
  'linear-gradient(135deg, #1a1a2d, #2d2d4a)',
];

const EMOJIS = ['💭', '✨', '📖', '🧠', '💡', '🌙', '⭐', '🔥', '🌊', '🎯', '🪶', '🌿'];

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

// ── Story Viewer ──────────────────────────────────────────────────────────
function StoryViewer({ stories, startIndex, userId, onClose, onDelete }: {
  stories: Story[];
  startIndex: number;
  userId: string;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const [current, setCurrent] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const DURATION = 5000;

  const story = stories[current];

  useEffect(() => {
    setProgress(0);
    if (timerRef.current) clearInterval(timerRef.current);
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min((elapsed / DURATION) * 100, 100);
      setProgress(p);
      if (p >= 100) {
        if (current < stories.length - 1) {
          setCurrent(c => c + 1);
        } else {
          onClose();
        }
      }
    }, 50);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [current]); // eslint-disable-line

  const goNext = () => { vibe(6); if (current < stories.length - 1) setCurrent(c => c + 1); else onClose(); };
  const goPrev = () => { vibe(6); if (current > 0) setCurrent(c => c - 1); };

  if (!story) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#000',
    }}>
      <div style={{
        width: '100%', maxWidth: 430, height: '100%',
        background: story.bg, display: 'flex', flexDirection: 'column',
        position: 'relative',
      }}>
        {/* Progress bars */}
        <div style={{
          display: 'flex', gap: 4, padding: '48px 16px 12px',
          paddingTop: `calc(48px + env(safe-area-inset-top))`,
        }}>
          {stories.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: 'rgba(255,255,255,0.3)', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 2,
                background: '#fff',
                width: i < current ? '100%' : i === current ? `${progress}%` : '0%',
                transition: i === current ? 'none' : 'none',
              }} />
            </div>
          ))}
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 16px',
        }}>
          <Avatar profile={story.profile} size={36} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
              {story.profile?.displayName || story.profile?.username || 'Читатель'}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
              {formatTime(story.createdAt)}
            </div>
          </div>
          {story.userId === userId && (
            <button onClick={() => { vibe(8); onDelete(story.id); onClose(); }}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '6px 10px', color: '#fff', cursor: 'pointer', fontSize: 12 }}>
              Удалить
            </button>
          )}
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}>
            <X size={22} />
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 32,
        }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>{story.emoji}</div>
          <p style={{
            fontSize: 22, color: '#fff', fontFamily: 'Lora, serif',
            textAlign: 'center', lineHeight: 1.5, fontWeight: 500,
          }}>{story.text}</p>
        </div>

        {/* Tap zones */}
        <button onClick={goPrev} style={{
          position: 'absolute', left: 0, top: '15%', bottom: '15%', width: '35%',
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', paddingLeft: 12,
        }}>
          {current > 0 && <ChevronLeft size={28} color="rgba(255,255,255,0.5)" />}
        </button>
        <button onClick={goNext} style={{
          position: 'absolute', right: 0, top: '15%', bottom: '15%', width: '35%',
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 12,
        }}>
          {current < stories.length - 1 && <ChevronRight size={28} color="rgba(255,255,255,0.5)" />}
        </button>
      </div>
    </div>
  );
}

// ── Create Story Sheet ────────────────────────────────────────────────────
function CreateStorySheet({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (story: Omit<Story, 'id' | 'userId' | 'profile' | 'createdAt'>) => void;
}) {
  const [text, setText] = useState('');
  const [emoji, setEmoji] = useState('💭');
  const [bg, setBg] = useState(BG_COLORS[0]);

  const handleCreate = () => {
    if (!text.trim()) return;
    vibe(12);
    onCreate({ text: text.trim(), emoji, bg });
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1500, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
      <div style={{
        position: 'relative', background: 'var(--bg-card)',
        borderRadius: '20px 20px 0 0', maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        border: '1px solid var(--border)', borderBottom: 'none',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2 }} />
        </div>
        <div style={{ padding: '8px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontFamily: 'Lora, serif', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Новая история</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Preview */}
          <div style={{
            borderRadius: 16, padding: '32px 20px', background: bg,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            minHeight: 140,
          }}>
            <span style={{ fontSize: 40 }}>{emoji}</span>
            <p style={{
              fontSize: 16, color: '#fff', fontFamily: 'Lora, serif',
              textAlign: 'center', lineHeight: 1.5, margin: 0,
              opacity: text ? 1 : 0.4,
            }}>{text || 'Ваша мысль...'}</p>
          </div>

          {/* Text input */}
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Напишите мысль, цитату или инсайт..."
            maxLength={200}
            rows={3}
            style={{
              width: '100%', background: 'var(--bg-raised)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '12px 14px', fontSize: 15,
              color: 'var(--text-primary)', fontFamily: 'Lora, serif',
              outline: 'none', resize: 'none', boxSizing: 'border-box',
              lineHeight: 1.6,
            }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', marginTop: -8 }}>{text.length}/200</div>

          {/* Emoji picker */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>ЭМОДЗИ</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {EMOJIS.map(e => (
                <button key={e} onClick={() => { vibe(6); setEmoji(e); }}
                  style={{
                    width: 40, height: 40, borderRadius: 10, fontSize: 20,
                    border: emoji === e ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: emoji === e ? 'var(--accent-muted)' : 'var(--bg-raised)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}>{e}</button>
              ))}
            </div>
          </div>

          {/* Background picker */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>ФОН</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {BG_COLORS.map(c => (
                <button key={c} onClick={() => { vibe(6); setBg(c); }}
                  style={{
                    flex: 1, height: 32, borderRadius: 8, background: c,
                    border: bg === c ? '2px solid var(--accent)' : '1px solid var(--border)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }} />
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: '12px 16px' }}>
          <button onClick={handleCreate} disabled={!text.trim()}
            style={{
              width: '100%', padding: '14px', borderRadius: 14,
              background: text.trim() ? 'linear-gradient(135deg, #d4a060, #8a5220)' : 'var(--bg-raised)',
              border: 'none', color: text.trim() ? '#fff' : 'var(--text-muted)',
              fontSize: 15, fontWeight: 600, cursor: text.trim() ? 'pointer' : 'not-allowed',
              fontFamily: 'Inter, sans-serif',
            }}>
            Опубликовать историю
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)}м`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}ч`;
  return `${Math.floor(diff / 86400)}д`;
}

// ── Main StoriesRow ───────────────────────────────────────────────────────
export default function StoriesRow({ userId, profile }: {
  userId: string;
  profile?: SocialProfile | null;
}) {
  const [stories, setStories] = useState<Story[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('psyche_stories');
      if (saved) setStories(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const saveStories = (s: Story[]) => {
    setStories(s);
    localStorage.setItem('psyche_stories', JSON.stringify(s));
  };

  const handleCreate = (data: Omit<Story, 'id' | 'userId' | 'profile' | 'createdAt'>) => {
    const newStory: Story = {
      id: Date.now().toString(),
      userId,
      profile: profile || undefined,
      createdAt: new Date().toISOString(),
      ...data,
    };
    saveStories([newStory, ...stories]);
  };

  const handleDelete = (id: string) => {
    saveStories(stories.filter(s => s.id !== id));
  };

  // Group by user (my stories first)
  const myStories = stories.filter(s => s.userId === userId);
  const otherStories = stories.filter(s => s.userId !== userId);
  const grouped = [...(myStories.length ? [{ userId, stories: myStories, profile }] : [])];

  return (
    <>
      <div style={{
        display: 'flex', gap: 12, padding: '0 16px 16px',
        overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        {/* Add story button */}
        <button onClick={() => { vibe(8); setShowCreate(true); }}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
          }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: 'var(--bg-raised)', border: '2px dashed var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            <Avatar profile={profile} size={56} />
            <div style={{
              position: 'absolute', bottom: -2, right: -2,
              width: 22, height: 22, borderRadius: '50%',
              background: 'linear-gradient(135deg, #d4a060, #8a5220)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid var(--bg-card)',
            }}>
              <Plus size={12} color="#fff" strokeWidth={3} />
            </div>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>Моя история</span>
        </button>

        {/* My stories */}
        {myStories.length > 0 && (
          <button onClick={() => { vibe(8); setViewerIndex(0); }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
            }}>
            <div style={{
              width: 60, height: 60, borderRadius: '50%',
              background: myStories[0].bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid var(--accent)',
              fontSize: 28,
            }}>
              {myStories[0].emoji}
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}>Ваши</span>
          </button>
        )}

        {/* Other stories */}
        {otherStories.map((s, i) => (
          <button key={s.id} onClick={() => { vibe(8); setViewerIndex(myStories.length + i); }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
            }}>
            <div style={{
              width: 60, height: 60, borderRadius: '50%',
              background: s.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid var(--accent)',
              fontSize: 28,
            }}>
              {s.emoji}
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
              {s.profile?.username || 'reader'}
            </span>
          </button>
        ))}

        {grouped.length === 0 && otherStories.length === 0 && myStories.length === 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', padding: '8px 0',
            color: 'var(--text-muted)', fontSize: 13, fontFamily: 'Inter, sans-serif',
          }}>
            Истории появятся здесь
          </div>
        )}
      </div>

      {viewerIndex !== null && (
        <StoryViewer
          stories={stories}
          startIndex={viewerIndex}
          userId={userId}
          onClose={() => setViewerIndex(null)}
          onDelete={handleDelete}
        />
      )}

      {showCreate && (
        <CreateStorySheet
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
    </>
  );
}
