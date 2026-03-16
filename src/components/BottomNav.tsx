import { useState, useEffect, useRef } from 'react';
import { BookOpen, FileText, Plus, Users, UserCircle, X, Sparkles, PenLine, Brain, Bell } from 'lucide-react';
import { TabId } from '../types';

interface Props {
  active: TabId;
  onChange: (tab: TabId) => void;
  unreadNotifs?: number;
  onNotifications?: () => void;
}

const vibe = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };

export default function BottomNav({ active, onChange, unreadNotifs = 0, onNotifications }: Props) {
  const [showNewMenu, setShowNewMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showNewMenu) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.new-menu-sheet') && !target.closest('.fab-btn')) {
        setShowNewMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [showNewMenu]);

  const tabs = [
    { id: 'notes'   as TabId, icon: <FileText size={22} />,   label: 'Записи'  },
    { id: 'library' as TabId, icon: <BookOpen size={22} />,   label: 'Книги'   },
    null,
    { id: 'feed'    as TabId, icon: <Users size={22} />,      label: 'Люди'    },
    { id: 'profile' as TabId, icon: <UserCircle size={22} />, label: 'Профиль' },
  ];

  const NAV_H = 60;

  return (
    <>
      <nav style={{
        flexShrink: 0, width: '100%',
        background: 'var(--nav-bg)',
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        position: 'relative', zIndex: 50,
        height: NAV_H,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {tabs.map((tab, _i) => {
          if (tab === null) {
            return (
              <div key="fab" style={{
                flex: 1, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                position: 'relative', height: '100%',
              }}>
                <button
                  className="fab-btn"
                  onClick={() => { vibe(14); setShowNewMenu(v => !v); }}
                  style={{
                    width: 50, height: 50, borderRadius: 15,
                    background: showNewMenu
                      ? 'linear-gradient(145deg,#7a4518,#4a2808)'
                      : 'linear-gradient(145deg,#d4914a,#8a5220)',
                    border: '2px solid var(--nav-bg)',
                    boxShadow: showNewMenu
                      ? '0 2px 10px rgba(180,110,40,0.3)'
                      : '0 3px 16px rgba(180,110,40,0.5),0 1px 6px rgba(0,0,0,0.4)',
                    cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: '#fff',
                    WebkitTapHighlightColor: 'transparent',
                    transition: 'background 0.2s, box-shadow 0.2s',
                    animation: 'fab-pop 0.45s cubic-bezier(0.34,1.4,0.64,1) both',
                    flexShrink: 0,
                  }}
                  onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.88)'; }}
                  onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                  onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <div style={{
                    transform: showNewMenu ? 'rotate(45deg)' : 'rotate(0deg)',
                    transition: 'transform 0.25s cubic-bezier(0.34,1.4,0.64,1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Plus size={24} strokeWidth={2.5} />
                  </div>
                </button>
              </div>
            );
          }

          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { vibe(6); onChange(tab.id); }}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 4, background: 'none', border: 'none', cursor: 'pointer',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                transition: 'color 0.18s',
                WebkitTapHighlightColor: 'transparent',
                padding: '6px 4px', position: 'relative', height: NAV_H,
              }}
              onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.85)'; }}
              onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <div style={{ position: 'relative' }}>
                {tab.icon}
                {tab.id === 'profile' && unreadNotifs > 0 && (
                  <span style={{
                    position: 'absolute', top: -4, right: -4,
                    width: 14, height: 14, borderRadius: '50%',
                    background: '#e74c3c', border: '2px solid var(--nav-bg)',
                    fontSize: 8, fontWeight: 700, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'Inter,sans-serif',
                  }}>
                    {unreadNotifs > 9 ? '9+' : unreadNotifs}
                  </span>
                )}
              </div>
              <span style={{
                fontSize: 10, fontWeight: isActive ? 700 : 400,
                fontFamily: 'Inter,sans-serif', lineHeight: 1,
                letterSpacing: isActive ? '0.02em' : 0,
              }}>{tab.label}</span>
              {isActive && (
                <span style={{
                  position: 'absolute', bottom: 6,
                  width: 18, height: 3, borderRadius: 99,
                  background: 'var(--accent)',
                  animation: 'tab-indicator 0.22s cubic-bezier(0.22,1,0.36,1) both',
                }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* FAB Menu */}
      {showNewMenu && (
        <>
          <div
            onClick={() => setShowNewMenu(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 90,
              background: 'rgba(0,0,0,0.5)',
              animation: 'fadeIn 0.18s ease',
            }}
          />
          <div
            ref={menuRef}
            className="new-menu-sheet"
            style={{
              position: 'fixed',
              bottom: `calc(${NAV_H}px + env(safe-area-inset-bottom,0px) + 10px)`,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 'min(calc(100vw - 32px), 398px)',
              background: 'var(--bg-card)',
              borderRadius: 20,
              border: '1px solid var(--border-mid)',
              boxShadow: '0 -4px 40px rgba(0,0,0,0.55)',
              zIndex: 100, overflow: 'hidden',
              animation: 'menuSlideUp 0.28s cubic-bezier(0.34,1.2,0.64,1)',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '13px 16px 10px',
              borderBottom: '1px solid var(--border)',
            }}>
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: 'var(--text-muted)', fontFamily: 'Inter,sans-serif',
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>Новая запись</span>
              <button
                onClick={() => setShowNewMenu(false)}
                style={{
                  width: 26, height: 26, borderRadius: 8,
                  background: 'var(--bg-raised)', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--text-muted)',
                }}
              ><X size={14} /></button>
            </div>

            <div style={{ padding: '10px 12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <MenuOption
                icon={<PenLine size={20} color="var(--accent)" />}
                iconBg="linear-gradient(135deg,#d4a06030,#8a522020)"
                title="Свободная запись"
                desc="Чистый лист — пиши что думаешь"
                delay={0.05}
                onClick={() => { vibe(10); setShowNewMenu(false); onChange('new'); }}
              />
              <MenuOption
                icon={<Sparkles size={20} color="#6a9e8a" />}
                iconBg="linear-gradient(135deg,#6a9e8a30,#4a7a6a20)"
                title="Из шаблона"
                desc="Готовая структура для разбора книги"
                delay={0.10}
                onClick={() => { vibe(10); setShowNewMenu(false); onChange('template'); }}
              />
              <MenuOption
                icon={<Brain size={20} color="#8a7a9a" />}
                iconBg="linear-gradient(135deg,#8a7a9a30,#6a5a8a20)"
                title="Карточка памяти"
                desc="Создать карточку для повторения"
                delay={0.15}
                onClick={() => { vibe(10); setShowNewMenu(false); onChange('cards'); }}
              />
              <MenuOption
                icon={<Users size={20} color="#6a8a9a" />}
                iconBg="linear-gradient(135deg,#6a8a9a30,#4a6a7a20)"
                title="Поделиться в сообществе"
                desc="Опубликовать мысль или инсайт"
                delay={0.20}
                onClick={() => { vibe(10); setShowNewMenu(false); onChange('feed'); }}
              />
              <MenuOption
                icon={<BookOpen size={20} color="#9a8a6a" />}
                iconBg="linear-gradient(135deg,#9a8a6a30,#7a6a4a20)"
                title="Запись в журнал"
                desc="Дневниковая запись сегодняшнего дня"
                delay={0.25}
                onClick={() => { vibe(10); setShowNewMenu(false); onChange('daily'); }}
              />
              <MenuOption
                icon={<Bell size={20} color="#6a9a8a" />}
                iconBg="linear-gradient(135deg,#6a9a8a30,#4a7a6a20)"
                title={`Уведомления${unreadNotifs > 0 ? ` (${unreadNotifs})` : ''}`}
                desc="Лайки, комментарии, Daily Review"
                delay={0.30}
                onClick={() => { vibe(10); setShowNewMenu(false); onNotifications?.(); }}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}

function MenuOption({ icon, iconBg, title, desc, delay, onClick }: {
  icon: React.ReactNode; iconBg: string; title: string;
  desc: string; delay: number; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '13px 14px', borderRadius: 14,
        background: 'var(--bg-raised)',
        border: '1px solid var(--border)',
        cursor: 'pointer', textAlign: 'left', width: '100%',
        transition: 'background 0.15s',
        animation: `fadeSlideUp 0.25s ease ${delay}s both`,
      }}
      onPointerDown={e => (e.currentTarget.style.background = 'var(--bg-active)')}
      onPointerUp={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
      onPointerLeave={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
    >
      <div style={{
        width: 42, height: 42, borderRadius: 12,
        background: iconBg, border: '1px solid var(--border-mid)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{
          fontSize: 15, fontWeight: 600,
          color: 'var(--text-primary)', fontFamily: 'Inter,sans-serif',
          marginBottom: 2,
        }}>{title}</div>
        <div style={{
          fontSize: 12, color: 'var(--text-muted)',
          fontFamily: 'Inter,sans-serif', lineHeight: 1.4,
        }}>{desc}</div>
      </div>
    </button>
  );
}
