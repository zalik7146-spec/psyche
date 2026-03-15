import { Template, NoteType } from '../types';
import { X } from 'lucide-react';

interface Props {
  templates: Template[];
  onSelect: (template: Template) => void;
  onClose: () => void;
}

const TYPE_ICONS: Record<NoteType, string> = {
  note:     '📝',
  quote:    '❝',
  insight:  '💡',
  question: '🔍',
  summary:  '📋',
  idea:     '🌱',
  task:     '✓',
};

const TYPE_COLORS: Record<NoteType, string> = {
  note:     'rgba(138,154,122,0.18)',
  quote:    'rgba(212,145,74,0.18)',
  insight:  'rgba(106,158,138,0.18)',
  question: 'rgba(138,122,154,0.18)',
  summary:  'rgba(122,138,106,0.18)',
  idea:     'rgba(154,138,74,0.18)',
  task:     'rgba(106,122,154,0.18)',
};

const TYPE_BORDER: Record<NoteType, string> = {
  note:     'rgba(138,154,122,0.35)',
  quote:    'rgba(212,145,74,0.35)',
  insight:  'rgba(106,158,138,0.35)',
  question: 'rgba(138,122,154,0.35)',
  summary:  'rgba(122,138,106,0.35)',
  idea:     'rgba(154,138,74,0.35)',
  task:     'rgba(106,122,154,0.35)',
};

const vibe = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };

export default function TemplatesModal({ templates, onSelect, onClose }: Props) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'var(--overlay)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        animation: 'fadeIn 0.18s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 430,
          maxHeight: '72vh',
          background: 'var(--bg-card)',
          borderRadius: '22px 22px 0 0',
          border: '1px solid var(--border-mid)',
          borderBottom: 'none',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideUp 0.32s cubic-bezier(0.34,1.2,0.64,1)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10 }}>
          <div style={{
            width: 36, height: 4, borderRadius: 99,
            background: 'var(--border-mid)',
          }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 18px 8px',
        }}>
          <div>
            <div style={{
              fontSize: 16, fontWeight: 700,
              color: 'var(--text-primary)', fontFamily: 'Lora, serif',
            }}>Шаблоны</div>
            <div style={{
              fontSize: 11, color: 'var(--text-muted)',
              fontFamily: 'Inter, sans-serif', marginTop: 1,
            }}>Выберите готовую структуру</div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 10,
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-muted)',
            }}
          ><X size={14} /></button>
        </div>

        {/* List */}
        <div style={{
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '4px 14px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          {templates.map((tpl, i) => (
            <button
              key={tpl.id}
              onClick={() => { vibe(10); onSelect(tpl); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 13px',
                borderRadius: 14,
                background: TYPE_COLORS[tpl.type],
                border: `1px solid ${TYPE_BORDER[tpl.type]}`,
                cursor: 'pointer', textAlign: 'left', width: '100%',
                animation: `fadeSlideUp 0.22s ease ${i * 0.04}s both`,
              }}
              onPointerDown={e => (e.currentTarget.style.opacity = '0.7')}
              onPointerUp={e => (e.currentTarget.style.opacity = '1')}
              onPointerLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              {/* Icon */}
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'var(--bg-card)',
                border: `1px solid ${TYPE_BORDER[tpl.type]}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, flexShrink: 0,
              }}>
                {TYPE_ICONS[tpl.type]}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 600,
                  color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif',
                  marginBottom: 2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{tpl.name}</div>
                {tpl.tags.length > 0 && (
                  <div style={{
                    display: 'flex', gap: 4, flexWrap: 'wrap',
                  }}>
                    {tpl.tags.slice(0, 3).map(tag => (
                      <span key={tag} style={{
                        fontSize: 10, color: 'var(--text-muted)',
                        background: 'var(--bg-raised)',
                        padding: '1px 7px', borderRadius: 99,
                        fontFamily: 'Inter, sans-serif',
                        border: '1px solid var(--border)',
                      }}>#{tag}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Arrow */}
              <div style={{
                color: 'var(--text-muted)', fontSize: 16,
                flexShrink: 0,
              }}>›</div>
            </button>
          ))}

          {/* Free note option at bottom */}
          <div style={{
            marginTop: 4,
            paddingTop: 10,
            borderTop: '1px solid var(--border)',
          }}>
            <button
              onClick={() => { vibe(8); onClose(); }}
              style={{
                width: '100%', padding: '10px 13px',
                borderRadius: 12,
                background: 'transparent',
                border: '1px dashed var(--border-mid)',
                cursor: 'pointer',
                fontSize: 13, color: 'var(--text-muted)',
                fontFamily: 'Inter, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 6,
              }}
              onPointerDown={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
              onPointerUp={e => (e.currentTarget.style.background = 'transparent')}
              onPointerLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              ✏️ Свободная запись без шаблона
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
