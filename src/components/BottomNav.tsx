import { BookOpen, FileText, BarChart2, Settings, Plus } from 'lucide-react';
import { TabId } from '../types';

interface Props {
  active: TabId;
  onChange: (tab: TabId) => void;
}

const vibe = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };

export default function BottomNav({ active, onChange }: Props) {
  const left:  { id: TabId; icon: React.ReactNode; label: string }[] = [
    { id: 'notes',   icon: <FileText  size={21} />, label: 'Записи'    },
    { id: 'library', icon: <BookOpen  size={21} />, label: 'Библиотека' },
  ];
  const right: { id: TabId; icon: React.ReactNode; label: string }[] = [
    { id: 'stats',    icon: <BarChart2 size={21} />, label: 'Прогресс' },
    { id: 'settings', icon: <Settings  size={21} />, label: 'Настройки' },
  ];

  return (
    <nav
      style={{
        flexShrink: 0,
        background: 'var(--nav-bg)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom, 6px)',
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* Sync shimmer line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'var(--border)' }} />

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 68px 1fr 1fr',
        height: 58,
        alignItems: 'stretch',
        position: 'relative',
      }}>
        {/* LEFT tabs */}
        {left.map(tab => (
          <button
            key={tab.id}
            onClick={() => { vibe(6); onChange(tab.id); }}
            style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 3,
              background: 'none', border: 'none', cursor: 'pointer',
              color: active === tab.id ? 'var(--accent)' : 'var(--text-muted)',
              transition: 'color 0.18s, transform 0.12s',
              WebkitTapHighlightColor: 'transparent',
              padding: '0 4px',
            }}
            onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.86)')}
            onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {tab.icon}
            <span style={{
              fontSize: 10, fontWeight: active === tab.id ? 700 : 400,
              fontFamily: 'Inter, sans-serif', lineHeight: 1,
              letterSpacing: active === tab.id ? '0.02em' : 0,
            }}>{tab.label}</span>
            {active === tab.id && (
              <span style={{
                position: 'absolute', bottom: 6, width: 18, height: 3,
                borderRadius: 99, background: 'var(--accent)',
                animation: 'fadeIn 0.18s ease-out',
              }} />
            )}
          </button>
        ))}

        {/* FAB — строго центральная колонка */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          <button
            onClick={() => { vibe(12); onChange('new'); }}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) translateY(-8px)',
              width: 54, height: 54,
              borderRadius: 18,
              background: 'linear-gradient(145deg, #d4914a 0%, #9a5220 100%)',
              border: '2.5px solid var(--bg-base)',
              boxShadow: '0 6px 24px rgba(196,129,60,0.5), 0 2px 8px rgba(0,0,0,0.5)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff',
              transition: 'transform 0.14s cubic-bezier(0.34,1.4,0.64,1), box-shadow 0.14s',
              WebkitTapHighlightColor: 'transparent',
              zIndex: 20,
            }}
            onPointerDown={e => {
              e.currentTarget.style.transform = 'translate(-50%, -50%) translateY(-8px) scale(0.88)';
              e.currentTarget.style.boxShadow = '0 2px 10px rgba(196,129,60,0.35)';
            }}
            onPointerUp={e => {
              e.currentTarget.style.transform = 'translate(-50%, -50%) translateY(-8px) scale(1)';
              e.currentTarget.style.boxShadow = '0 6px 24px rgba(196,129,60,0.5), 0 2px 8px rgba(0,0,0,0.5)';
            }}
            onPointerLeave={e => {
              e.currentTarget.style.transform = 'translate(-50%, -50%) translateY(-8px) scale(1)';
              e.currentTarget.style.boxShadow = '0 6px 24px rgba(196,129,60,0.5), 0 2px 8px rgba(0,0,0,0.5)';
            }}
          >
            <Plus size={26} strokeWidth={2.2} />
          </button>
        </div>

        {/* RIGHT tabs */}
        {right.map(tab => (
          <button
            key={tab.id}
            onClick={() => { vibe(6); onChange(tab.id); }}
            style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 3,
              background: 'none', border: 'none', cursor: 'pointer',
              color: active === tab.id ? 'var(--accent)' : 'var(--text-muted)',
              transition: 'color 0.18s, transform 0.12s',
              WebkitTapHighlightColor: 'transparent',
              padding: '0 4px',
              position: 'relative',
            }}
            onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.86)')}
            onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {tab.icon}
            <span style={{
              fontSize: 10, fontWeight: active === tab.id ? 700 : 400,
              fontFamily: 'Inter, sans-serif', lineHeight: 1,
              letterSpacing: active === tab.id ? '0.02em' : 0,
            }}>{tab.label}</span>
            {active === tab.id && (
              <span style={{
                position: 'absolute', bottom: 6, width: 18, height: 3,
                borderRadius: 99, background: 'var(--accent)',
                animation: 'fadeIn 0.18s ease-out',
              }} />
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
