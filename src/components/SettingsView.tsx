import { useState } from 'react';
import {
  Sun, Moon, BookMarked, LogOut, Trash2, Cloud, RefreshCw,
  CheckCircle, AlertCircle, RotateCcw, X, ChevronRight,
  BookOpen, FileText, Star, MessageSquareQuote, Lightbulb,
} from 'lucide-react';
import { Theme, User, AppState, DeletedNote } from '../types';
import { supabase } from '../supabase';
import { syncLocalToCloud } from '../cloudStore';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Props {
  user: User;
  state: AppState;
  onTheme: (t: Theme) => void;
  onLogout: () => void;
  onClearData: () => void;
  onRestoreNote: (noteId: string) => void;
  onPermanentDelete: (noteId: string) => void;
  onEmptyTrash: () => void;
}

const THEMES: { id: Theme; label: string; icon: React.ReactNode; bg: string; text: string }[] = [
  { id: 'dark',  label: 'Тёмная',  icon: <Moon size={16} />,       bg: '#0e0c09', text: '#d4b896' },
  { id: 'light', label: 'Светлая', icon: <Sun size={16} />,        bg: '#f5ede0', text: '#221406' },
  { id: 'sepia', label: 'Сепия',   icon: <BookMarked size={16} />, bg: '#1a1508', text: '#dcc8a0' },
];

const vibe = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };

export default function SettingsView({
  user, state, onTheme, onLogout, onClearData,
  onRestoreNote, onPermanentDelete, onEmptyTrash,
}: Props) {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [showTrash, setShowTrash] = useState(false);

  const deletedNotes: DeletedNote[] = state.deletedNotes || [];

  const stats = {
    books:     state.books.length,
    notes:     state.notes.length,
    finished:  state.books.filter(b => b.status === 'finished').length,
    reading:   state.books.filter(b => b.status === 'reading').length,
    favorites: state.notes.filter(n => n.isFavorite).length,
    words:     state.notes.reduce((acc, n) => acc + (n.wordCount || 0), 0),
    quotes:    state.notes.filter(n => n.type === 'quote').length,
    insights:  state.notes.filter(n => n.type === 'insight').length,
  };

  const handleManualSync = async () => {
    vibe(10);
    setSyncStatus('syncing');
    try {
      await syncLocalToCloud(state, user.id);
      setSyncStatus('done');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch {
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  const handleChangePassword = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: window.location.origin,
    });
    if (error) alert('Ошибка: ' + error.message);
    else alert('Письмо со сменой пароля отправлено на ' + user.email);
  };

  // ── Trash modal ──────────────────────────────────────────────────────
  if (showTrash) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'slideLeft 0.26s cubic-bezier(0.22,1,0.36,1) both' }}>
        {/* Header */}
        <div style={{
          padding: 'calc(env(safe-area-inset-top,0px) + 12px) 16px 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-base)', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <button
            onClick={() => { vibe(6); setShowTrash(false); }}
            style={{
              width: 36, height: 36, borderRadius: 12,
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              color: 'var(--text-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
          <div style={{ flex: 1 }}>
            <h2 className="font-serif" style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
              🗑 Корзина
            </h2>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
              {deletedNotes.length} удалённых записей
            </p>
          </div>
          {deletedNotes.length > 0 && (
            <button
              onClick={() => { vibe(15); if (window.confirm('Очистить корзину? Записи будут удалены навсегда.')) onEmptyTrash(); }}
              style={{
                padding: '6px 12px', borderRadius: 10,
                background: 'rgba(180,50,50,0.15)', border: '1px solid rgba(180,50,50,0.3)',
                color: '#d45858', cursor: 'pointer', fontSize: 12,
                fontFamily: 'Inter, sans-serif', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <Trash2 size={13} />
              Очистить
            </button>
          )}
        </div>

        <div className="scroll-area" style={{ padding: '12px 14px 80px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {deletedNotes.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px 20px',
              animation: 'fadeUp 0.4s ease-out both',
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🗑</div>
              <p style={{ color: 'var(--text-muted)', fontFamily: 'Lora, serif', fontSize: 15 }}>
                Корзина пуста
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'Inter, sans-serif', marginTop: 6 }}>
                Удалённые записи появятся здесь
              </p>
            </div>
          ) : (
            deletedNotes.map((note, i) => (
              <div
                key={note.id}
                style={{
                  background: 'var(--bg-card)', border: 'var(--card-border)',
                  borderRadius: 14, padding: '12px 14px',
                  animation: `card-enter 0.32s cubic-bezier(0.22,1,0.36,1) both`,
                  animationDelay: `${i * 0.04}s`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0, fontSize: 14, fontWeight: 600,
                      color: 'var(--text-primary)', fontFamily: 'Lora, serif',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {note.title || 'Без заголовка'}
                    </p>
                    <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
                      Удалено {format(new Date(note.deletedAt), 'd MMM yyyy', { locale: ru })}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    onClick={() => { vibe(10); onRestoreNote(note.id); }}
                    style={{
                      flex: 1, padding: '8px', borderRadius: 10,
                      background: 'var(--accent-glow)', border: '1px solid var(--accent-dim)',
                      color: 'var(--accent)', cursor: 'pointer', fontSize: 12,
                      fontFamily: 'Inter, sans-serif', fontWeight: 600,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      transition: 'all 0.15s',
                    }}
                  >
                    <RotateCcw size={13} />
                    Восстановить
                  </button>
                  <button
                    onClick={() => { vibe(15); if (window.confirm('Удалить навсегда?')) onPermanentDelete(note.id); }}
                    style={{
                      padding: '8px 14px', borderRadius: 10,
                      background: 'rgba(180,50,50,0.12)', border: '1px solid rgba(180,50,50,0.25)',
                      color: '#d45858', cursor: 'pointer', fontSize: 12,
                      fontFamily: 'Inter, sans-serif', fontWeight: 600,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      transition: 'all 0.15s',
                    }}
                  >
                    <X size={13} />
                    Навсегда
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ── Main settings ────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="scroll-area" style={{ padding: '0 0 80px' }}>

        {/* Profile hero */}
        <div style={{
          padding: 'calc(env(safe-area-inset-top,0px) + 20px) 20px 20px',
          background: 'linear-gradient(180deg, var(--bg-raised) 0%, var(--bg-base) 100%)',
          borderBottom: '1px solid var(--border)',
          animation: 'fadeUp 0.35s ease-out both',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 18,
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-dim) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, flexShrink: 0,
              boxShadow: '0 4px 16px var(--accent-glow)',
            }}>
              🧠
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>
                {user.name}
              </p>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}>
                {user.email}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
                С {format(new Date(user.createdAt), 'd MMMM yyyy', { locale: ru })}
              </p>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ padding: '16px 16px 0', animation: 'fadeUp 0.4s ease-out 0.05s both' }}>
          <p style={{ margin: '0 0 10px', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Ваша статистика
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[
              { icon: <FileText size={14} />, val: stats.notes,     label: 'Записей' },
              { icon: <BookOpen size={14} />, val: stats.books,     label: 'Книг' },
              { icon: <Star size={14} />,     val: stats.favorites, label: 'Избранных' },
              { icon: <MessageSquareQuote size={14} />, val: stats.quotes, label: 'Цитат' },
              { icon: <Lightbulb size={14} />, val: stats.insights, label: 'Инсайтов' },
              { icon: <BookOpen size={14} />, val: stats.reading,   label: 'Читаю' },
              { icon: <CheckCircle size={14} />, val: stats.finished, label: 'Прочитано' },
              { icon: <FileText size={14} />, val: stats.words,     label: 'Слов' },
            ].map((s, i) => (
              <div key={i} style={{
                background: 'var(--bg-card)', border: 'var(--card-border)',
                borderRadius: 12, padding: '10px 8px', textAlign: 'center',
                animation: `card-enter 0.32s cubic-bezier(0.22,1,0.36,1) both`,
                animationDelay: `${0.05 + i * 0.03}s`,
              }}>
                <div style={{ color: 'var(--accent)', marginBottom: 4, display: 'flex', justifyContent: 'center' }}>{s.icon}</div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>
                  {s.val.toLocaleString()}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Theme */}
        <div style={{ padding: '20px 16px 0', animation: 'fadeUp 0.4s ease-out 0.1s both' }}>
          <p style={{ margin: '0 0 10px', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Тема оформления
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => { vibe(8); onTheme(t.id); }}
                style={{
                  padding: '12px 8px', borderRadius: 14, cursor: 'pointer',
                  background: t.bg, border: `2px solid ${state.theme === t.id ? 'var(--accent)' : 'transparent'}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  boxShadow: state.theme === t.id ? '0 0 0 3px var(--accent-glow)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ color: t.text }}>{t.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: t.text, fontFamily: 'Inter, sans-serif' }}>
                  {t.label}
                </span>
                {state.theme === t.id && (
                  <span style={{ fontSize: 10, color: 'var(--accent)' }}>✓ Активна</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Cloud sync */}
        <div style={{ padding: '20px 16px 0', animation: 'fadeUp 0.4s ease-out 0.15s both' }}>
          <p style={{ margin: '0 0 10px', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Облачное хранилище
          </p>
          <div style={{
            background: 'var(--bg-card)', border: 'var(--card-border)',
            borderRadius: 16, overflow: 'hidden',
          }}>
            <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'rgba(100,180,120,0.15)', border: '1px solid rgba(100,180,120,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Cloud size={18} color="var(--green)" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}>
                  Supabase Cloud
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--green)', fontFamily: 'Inter, sans-serif' }}>
                  ● Подключено и активно
                </p>
              </div>
              <button
                onClick={handleManualSync}
                disabled={syncStatus === 'syncing'}
                style={{
                  padding: '7px 12px', borderRadius: 10,
                  background: syncStatus === 'done' ? 'rgba(100,180,120,0.15)' :
                    syncStatus === 'error' ? 'rgba(180,80,80,0.15)' : 'var(--bg-raised)',
                  border: `1px solid ${syncStatus === 'done' ? 'rgba(100,180,120,0.4)' :
                    syncStatus === 'error' ? 'rgba(180,80,80,0.4)' : 'var(--border)'}`,
                  color: syncStatus === 'done' ? 'var(--green)' :
                    syncStatus === 'error' ? 'var(--red)' : 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: 12, fontFamily: 'Inter, sans-serif', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 5,
                  transition: 'all 0.2s',
                }}
              >
                {syncStatus === 'syncing' ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> :
                  syncStatus === 'done'    ? <CheckCircle size={13} /> :
                  syncStatus === 'error'   ? <AlertCircle size={13} /> :
                  <RefreshCw size={13} />}
                {syncStatus === 'syncing' ? 'Синхр...' :
                  syncStatus === 'done'    ? 'Готово' :
                  syncStatus === 'error'   ? 'Ошибка' : 'Синхр.'}
              </button>
            </div>
          </div>
        </div>

        {/* Account actions */}
        <div style={{ padding: '20px 16px 0', animation: 'fadeUp 0.4s ease-out 0.2s both' }}>
          <p style={{ margin: '0 0 10px', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Аккаунт
          </p>
          <div style={{
            background: 'var(--bg-card)', border: 'var(--card-border)',
            borderRadius: 16, overflow: 'hidden',
          }}>
            {[
              {
                icon: <Cloud size={16} />, label: 'Сменить пароль',
                sub: 'Письмо придёт на ' + user.email.slice(0, 18) + '…',
                action: handleChangePassword, color: 'var(--accent)',
              },
            ].map((item, i) => (
              <button
                key={i}
                onClick={() => { vibe(8); item.action(); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px', background: 'none', border: 'none',
                  borderBottom: '1px solid var(--border)', cursor: 'pointer',
                  textAlign: 'left', transition: 'background 0.15s',
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: item.color + '18', border: `1px solid ${item.color}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  color: item.color,
                }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
                    {item.label}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
                    {item.sub}
                  </p>
                </div>
                <ChevronRight size={16} color="var(--text-muted)" />
              </button>
            ))}

            {/* Trash */}
            <button
              onClick={() => { vibe(8); setShowTrash(true); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px', background: 'none', border: 'none',
                borderBottom: '1px solid var(--border)', cursor: 'pointer',
                textAlign: 'left', transition: 'background 0.15s',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(180,100,50,0.12)', border: '1px solid rgba(180,100,50,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                color: '#d4914a',
              }}>
                <Trash2 size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
                  Корзина
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
                  {deletedNotes.length > 0 ? `${deletedNotes.length} удалённых записей` : 'Пусто'}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {deletedNotes.length > 0 && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--accent)',
                    background: 'var(--accent-glow)', borderRadius: 99,
                    padding: '1px 7px',
                  }}>{deletedNotes.length}</span>
                )}
                <ChevronRight size={16} color="var(--text-muted)" />
              </div>
            </button>

            {/* Logout */}
            <button
              onClick={() => { vibe(12); onLogout(); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px', background: 'none', border: 'none',
                cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(180,50,50,0.12)', border: '1px solid rgba(180,50,50,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                color: '#d45858',
              }}>
                <LogOut size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 14, color: '#d45858', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
                  Выйти
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
                  {user.email}
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Danger zone */}
        <div style={{ padding: '20px 16px 0', animation: 'fadeUp 0.4s ease-out 0.25s both' }}>
          <p style={{ margin: '0 0 10px', fontSize: 11, color: 'var(--red)', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>
            Опасная зона
          </p>
          <button
            onClick={() => { vibe(15); onClearData(); }}
            style={{
              width: '100%', padding: '13px 16px', borderRadius: 14,
              background: 'rgba(180,50,50,0.08)', border: '1px solid rgba(180,50,50,0.2)',
              color: 'var(--red)', cursor: 'pointer', fontSize: 14,
              fontFamily: 'Inter, sans-serif', fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all 0.15s',
            }}
          >
            <Trash2 size={15} />
            Сбросить все данные
          </button>
          <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
            Это действие нельзя отменить
          </p>
        </div>

        {/* Version */}
        <div style={{ padding: '24px 0 12px', textAlign: 'center', animation: 'fadeIn 0.6s ease-out 0.3s both' }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Lora, serif', fontStyle: 'italic' }}>
            Psyche · Дневник Разума
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', opacity: 0.5 }}>
            v2.5 · Supabase Cloud
          </p>
        </div>
      </div>
    </div>
  );
}
