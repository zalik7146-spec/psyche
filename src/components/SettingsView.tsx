import { useState } from 'react';
import { Sun, Moon, BookMarked, LogOut, Trash2, ChevronRight, Cloud, RefreshCw, CheckCircle } from 'lucide-react';
import { Theme, User, AppState } from '../types';
import { supabase } from '../supabase';
import { syncLocalToCloud } from '../cloudStore';

interface Props {
  user: User;
  state: AppState;
  onTheme: (t: Theme) => void;
  onLogout: () => void;
  onClearData: () => void;
}

const THEMES: { id: Theme; label: string; icon: React.ReactNode; bg: string; text: string }[] = [
  { id: 'dark',  label: 'Тёмная',  icon: <Moon size={16} />,       bg: '#0e0c09', text: '#d4b896' },
  { id: 'light', label: 'Светлая', icon: <Sun size={16} />,        bg: '#f5ede0', text: '#221406' },
  { id: 'sepia', label: 'Сепия',   icon: <BookMarked size={16} />, bg: '#1a1508', text: '#dcc8a0' },
];

export default function SettingsView({ user, state, onTheme, onLogout, onClearData }: Props) {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');

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
    if (error) {
      alert('Ошибка: ' + error.message);
    } else {
      alert('Письмо со сменой пароля отправлено на ' + user.email);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="scroll-area" style={{ padding: '0 0 80px' }}>

        {/* Header */}
        <div style={{
          padding: 'calc(env(safe-area-inset-top,0px) + 18px) 16px 18px',
          borderBottom: '1px solid var(--border)',
        }}>
          <h1 className="font-serif" style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px' }}>
            Профиль
          </h1>

          {/* User card */}
          <div style={{
            padding: '16px', borderRadius: '18px',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: '14px',
          }}>
            <div style={{
              width: 54, height: 54, borderRadius: '16px',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-soft))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', fontWeight: 700, color: '#0e0c09',
              fontFamily: 'Lora, serif', flexShrink: 0,
            }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>
                {user.name}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', fontFamily: 'Inter, sans-serif' }}>
                {user.email}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'Inter, sans-serif' }}>
                С нами с {new Date(user.createdAt).toLocaleDateString('ru', { month: 'long', year: 'numeric' })}
              </div>
            </div>
            {/* Cloud badge */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
            }}>
              <Cloud size={16} style={{ color: '#6ab47a' }} />
              <span style={{ fontSize: '9px', color: '#6ab47a', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
                ОБЛАКО
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ padding: '0 16px' }}>
          <div className="section-header">Статистика</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              { label: 'Записей',   value: stats.notes,     emoji: '📝' },
              { label: 'Книг',      value: stats.books,     emoji: '📚' },
              { label: 'Прочитано', value: stats.finished,  emoji: '✅' },
              { label: 'Читаю',     value: stats.reading,   emoji: '📖' },
              { label: 'Избранное', value: stats.favorites, emoji: '⭐' },
              { label: 'Слов',      value: stats.words,     emoji: '✍️' },
              { label: 'Цитат',     value: stats.quotes,    emoji: '❝' },
              { label: 'Инсайтов',  value: stats.insights,  emoji: '💡' },
            ].map(s => (
              <div key={s.label} style={{
                padding: '14px', borderRadius: '16px',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', gap: '4px',
              }}>
                <span style={{ fontSize: '18px' }}>{s.emoji}</span>
                <span style={{ fontSize: '22px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'Lora, serif' }}>
                  {s.value}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Theme */}
        <div style={{ padding: '0 16px' }}>
          <div className="section-header">Тема оформления</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => onTheme(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '14px 16px', borderRadius: '16px',
                  background: state.theme === t.id ? 'var(--bg-active)' : 'var(--bg-card)',
                  border: `1px solid ${state.theme === t.id ? 'var(--accent-dim)' : 'var(--border)'}`,
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: '12px',
                  background: t.bg, border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ color: t.text }}>{t.icon}</span>
                </div>
                <span style={{
                  flex: 1, fontSize: '14px', fontWeight: 500,
                  color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif',
                }}>
                  {t.label}
                </span>
                {state.theme === t.id && (
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', color: '#0e0c09', fontWeight: 700,
                  }}>
                    ✓
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Cloud Storage — ACTIVE */}
        <div style={{ padding: '0 16px' }}>
          <div className="section-header">Облачное хранилище</div>
          <div style={{
            borderRadius: '18px',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            overflow: 'hidden',
          }}>
            {/* Cloud header */}
            <div style={{
              padding: '14px 16px',
              background: 'linear-gradient(135deg, rgba(100,180,120,0.08), rgba(100,180,120,0.04))',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '10px',
                background: 'rgba(100,180,120,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Cloud size={18} style={{ color: '#6ab47a' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}>
                  Supabase Cloud
                </div>
                <div style={{ fontSize: '11px', color: '#6ab47a', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
                  ● Подключено · Активно
                </div>
              </div>
              <div style={{
                fontSize: '10px', fontFamily: 'Inter, sans-serif',
                padding: '3px 10px', borderRadius: '99px',
                background: 'rgba(100,180,120,0.2)', color: '#6ab47a', fontWeight: 700,
              }}>
                АКТИВНО
              </div>
            </div>

            {/* Cloud info */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>
                Все записи и книги синхронизируются в реальном времени. Данные доступны на любом устройстве. Автосохранение при каждом изменении.
              </div>
              <div style={{
                marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px',
              }}>
                {['🔒 Шифрование', '☁️ Бэкапы', '🔄 Авто-синхронизация', '📱 Все устройства'].map(tag => (
                  <span key={tag} style={{
                    fontSize: '11px', padding: '3px 8px', borderRadius: '99px',
                    background: 'var(--bg-active)', color: 'var(--text-secondary)',
                    fontFamily: 'Inter, sans-serif',
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Sync button */}
            <button
              onClick={handleManualSync}
              disabled={syncStatus === 'syncing'}
              style={{
                width: '100%', padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'none', border: 'none', cursor: syncStatus === 'syncing' ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-active)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              {syncStatus === 'done' ? (
                <CheckCircle size={16} style={{ color: '#6ab47a' }} />
              ) : (
                <RefreshCw size={16} style={{
                  color: syncStatus === 'syncing' ? 'var(--text-muted)' : 'var(--accent)',
                  animation: syncStatus === 'syncing' ? 'spin 1s linear infinite' : 'none',
                }} />
              )}
              <span style={{
                fontSize: '13px', fontWeight: 500, fontFamily: 'Inter, sans-serif',
                color: syncStatus === 'done' ? '#6ab47a'
                     : syncStatus === 'error' ? 'var(--red)'
                     : 'var(--text-primary)',
              }}>
                {syncStatus === 'idle'    && 'Синхронизировать вручную'}
                {syncStatus === 'syncing' && 'Синхронизация...'}
                {syncStatus === 'done'    && 'Синхронизировано!'}
                {syncStatus === 'error'   && 'Ошибка синхронизации'}
              </span>
              <ChevronRight size={16} style={{ color: 'var(--text-muted)', marginLeft: 'auto' }} />
            </button>
          </div>
        </div>

        {/* Account actions */}
        <div style={{ padding: '0 16px' }}>
          <div className="section-header">Аккаунт</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <ActionBtn
              icon="🔑"
              label="Сменить пароль"
              color="var(--text-secondary)"
              onClick={handleChangePassword}
            />
            <ActionBtn
              icon={<LogOut size={17} />}
              label="Выйти из аккаунта"
              color="var(--text-secondary)"
              onClick={onLogout}
            />
            <ActionBtn
              icon={<Trash2 size={17} />}
              label="Удалить все данные"
              color="var(--red)"
              danger
              onClick={onClearData}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '24px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', margin: 0 }}>
            Psyche — Дневник Разума · v2.0
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', margin: '4px 0 0' }}>
            ☁️ Powered by Supabase · Создан для тех, кто думает глубоко
          </p>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, color, danger, onClick }: {
  icon: React.ReactNode; label: string; color: string;
  danger?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="card-hover"
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '14px 16px', borderRadius: '16px', width: '100%',
        background: danger ? 'rgba(196,72,72,0.06)' : 'var(--bg-card)',
        border: `1px solid ${danger ? 'rgba(196,72,72,0.2)' : 'var(--border)'}`,
        cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span style={{ color, fontSize: typeof icon === 'string' ? '18px' : undefined }}>{icon}</span>
      <span style={{ fontSize: '14px', color, fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
        {label}
      </span>
      <ChevronRight size={16} style={{ color: 'var(--text-muted)', marginLeft: 'auto' }} />
    </button>
  );
}
