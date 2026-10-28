import { useState, useEffect } from 'react';
import { BookOpen, Plus, UserCircle, Landmark, NotebookPen, X } from 'lucide-react';
import { TabId } from '../types';

interface Props {
  active: TabId;
  onChange: (tab: TabId) => void;
  unreadNotifs?: number;
  onNotifications?: () => void;
  onComposePost?: () => void;
}

const vibe = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };

// Какой пункт панели подсвечивать для каждого экрана
const SECTION: Partial<Record<TabId, TabId>> = {
  feed: 'feed',
  library: 'library',
  notes: 'notes', daily: 'notes', cards: 'notes', graph: 'notes', stats: 'notes',
  profile: 'profile', achievements: 'profile', anki: 'profile', share: 'profile', settings: 'profile',
};

export default function BottomNav({ active, onChange, unreadNotifs = 0, onNotifications, onComposePost }: Props) {
  const [showNewMenu, setShowNewMenu] = useState(false);

  useEffect(() => {
    if (!showNewMenu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowNewMenu(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showNewMenu]);

  const tabs = [
    { id: 'feed'    as TabId, icon: <Landmark size={23} strokeWidth={1.5} />,    label: 'Агора'   },
    { id: 'library' as TabId, icon: <BookOpen size={23} strokeWidth={1.5} />,    label: 'Книги'   },
    null,
    { id: 'notes'   as TabId, icon: <NotebookPen size={23} strokeWidth={1.5} />, label: 'Дневник' },
    { id: 'profile' as TabId, icon: <UserCircle size={23} strokeWidth={1.5} />,  label: 'Профиль' },
  ];

  const current = SECTION[active];
  const NAV_H = 58;

  const pick = (tab: TabId) => { vibe(10); setShowNewMenu(false); onChange(tab); };

  return (
    <>
      <nav aria-label="Разделы" style={{
        flexShrink: 0, width: '100%',
        background: 'var(--nav-bg)',
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        position: 'relative', zIndex: 50,
        height: `calc(${NAV_H}px + env(safe-area-inset-bottom, 0px))`,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {tabs.map(tab => {
          if (tab === null) {
            return (
              <div key="new" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <button
                  className="fab-btn"
                  aria-label="Новый лист"
                  aria-expanded={showNewMenu}
                  onClick={() => { vibe(14); setShowNewMenu(v => !v); }}
                  style={{
                    width: 44, height: 44,
                    background: 'var(--accent)', color: 'var(--on-accent)',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'transform var(--dur-quick) var(--ease-calm)',
                    transform: showNewMenu ? 'rotate(45deg)' : 'none',
                  }}
                >
                  <Plus size={22} strokeWidth={1.75} />
                </button>
              </div>
            );
          }

          const isActive = current === tab.id;
          return (
            <button
              key={tab.id}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => { vibe(6); onChange(tab.id); }}
              style={{
                flex: 1, height: NAV_H,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'none', border: 'none', cursor: 'pointer',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                transition: 'color var(--dur-quick) var(--ease-calm)',
                position: 'relative',
              }}
            >
              <span style={{ position: 'relative', display: 'flex' }}>
                {tab.icon}
                {tab.id === 'feed' && unreadNotifs > 0 && (
                  <span aria-hidden="true" style={{
                    position: 'absolute', top: -1, right: -3,
                    width: 7, height: 7, borderRadius: '50%',
                    background: 'var(--accent)', border: '1.5px solid var(--nav-bg)',
                  }} />
                )}
              </span>
              {isActive && (
                <span aria-hidden="true" style={{
                  position: 'absolute', top: -1, left: '50%', marginLeft: -12,
                  width: 24, height: 1, background: 'var(--text-primary)',
                }} />
              )}
            </button>
          );
        })}
      </nav>

      {showNewMenu && (
        <>
          <div
            onClick={() => setShowNewMenu(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--overlay)', animation: 'fadeIn var(--dur-quick) var(--ease-calm)' }}
          />
          <div
            role="dialog"
            aria-label="Новый лист"
            className="new-menu-sheet view-feed"
            style={{
              position: 'fixed',
              bottom: `calc(${NAV_H}px + env(safe-area-inset-bottom,0px) + 10px)`,
              left: 0, right: 0, margin: '0 auto',
              width: 'min(calc(100vw - 24px), 406px)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 100,
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 6px 6px 18px', borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Новый лист</span>
              <button
                aria-label="Закрыть"
                onClick={() => setShowNewMenu(false)}
                style={{ width: 44, height: 44, background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)' }}
              ><X size={18} strokeWidth={1.5} /></button>
            </div>

            <MenuOption title="Мысль в Агору" desc="Лист, который увидят читатели" onClick={() => {
              vibe(10); setShowNewMenu(false);
              if (onComposePost) onComposePost(); else onChange('feed');
            }} />
            <MenuOption title="Запись" desc="Чистый лист для себя" onClick={() => pick('new')} />
            <MenuOption title="Из шаблона" desc="Готовая структура для разбора книги" onClick={() => pick('template')} />
            <MenuOption title="Запись дня" desc="Утреннее намерение, вечерние итоги" onClick={() => pick('daily')} />
            <MenuOption title="Карточка памяти" desc="Для повторения" onClick={() => pick('cards')} />
            <MenuOption
              title={`Отклики${unreadNotifs > 0 ? ` · ${unreadNotifs}` : ''}`}
              desc="Оттиски, пометки на полях, новые читатели"
              onClick={() => { vibe(10); setShowNewMenu(false); onNotifications?.(); }}
              last
            />
          </div>
        </>
      )}
    </>
  );
}

function MenuOption({ title, desc, onClick, last }: {
  title: string; desc: string; onClick: () => void; last?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', gap: 3,
        padding: '13px 18px', width: '100%', textAlign: 'left',
        background: 'none', border: 'none', cursor: 'pointer',
        borderBottom: last ? 'none' : '1px solid var(--border)',
        transition: 'background var(--dur-quick) var(--ease-calm)',
      }}
      onPointerDown={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
      onPointerUp={e => (e.currentTarget.style.background = 'none')}
      onPointerLeave={e => (e.currentTarget.style.background = 'none')}
    >
      <span style={{ fontSize: 15, color: 'var(--text-primary)' }}>{title}</span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{desc}</span>
    </button>
  );
}
