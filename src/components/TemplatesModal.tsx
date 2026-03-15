import { Template, NoteType } from '../types';
import { X, Sparkles, ChevronRight } from 'lucide-react';

interface Props {
  templates: Template[];
  onSelect: (template: Template) => void;
  onClose: () => void;
}

const TYPE_LABELS: Record<NoteType, string> = {
  note:     'Заметка',
  quote:    'Цитата',
  insight:  'Инсайт',
  question: 'Вопрос',
  summary:  'Конспект',
  idea:     'Идея',
  task:     'Задача',
};

const TYPE_COLORS: Record<NoteType, string> = {
  note:     '#8a9a7a',
  quote:    '#d4914a',
  insight:  '#6a9e8a',
  question: '#8a7a9a',
  summary:  '#7a8a6a',
  idea:     '#9a8a4a',
  task:     '#6a7a9a',
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
          maxHeight: '75vh',
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
        {/* Drag handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 99,
          background: 'var(--border-mid)',
          margin: '10px auto 0',
          flexShrink: 0,
        }} />

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={16} color="var(--accent)" />
            <span style={{
              fontSize: 15, fontWeight: 700,
              fontFamily: 'Lora,serif',
              color: 'var(--text-primary)',
            }}>Выберите шаблон</span>
          </div>
          <button
            onClick={() => { onClose(); vibe(); }}
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'var(--bg-raised)',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-muted)',
            }}
          ><X size={14} /></button>
        </div>

        {/* Subtitle */}
        <div style={{
          padding: '8px 16px 4px',
          fontSize: 12,
          color: 'var(--text-muted)',
          fontFamily: 'Inter,sans-serif',
          lineHeight: 1.4,
          flexShrink: 0,
        }}>
          Готовая структура заполнит редактор — отредактируй под себя
        </div>

        {/* Templates list — scrollable */}
        <div style={{
          overflowY: 'auto',
          padding: '6px 12px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          {templates.map((tpl, i) => (
            <button
              key={tpl.id}
              onClick={() => { vibe(10); onSelect(tpl); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '11px 12px',
                borderRadius: 14,
                background: 'var(--bg-raised)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                transition: 'background 0.12s',
                animation: `fadeSlideUp 0.22s ease ${i * 0.04}s both`,
              }}
              onPointerDown={e => (e.currentTarget.style.background = 'var(--bg-active)')}
              onPointerUp={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
              onPointerLeave={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
            >
              {/* Icon */}
              <div style={{
                width: 40, height: 40,
                borderRadius: 12,
                background: `${TYPE_COLORS[tpl.type]}18`,
                border: `1px solid ${TYPE_COLORS[tpl.type]}35`,
                display: 'flex', alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20, flexShrink: 0,
              }}>
                {tpl.icon}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  marginBottom: 2,
                }}>
                  <span style={{
                    fontSize: 14, fontWeight: 600,
                    color: 'var(--text-primary)',
                    fontFamily: 'Inter,sans-serif',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>{tpl.name}</span>
                  <span style={{
                    fontSize: 10, padding: '1px 6px',
                    background: `${TYPE_COLORS[tpl.type]}20`,
                    color: TYPE_COLORS[tpl.type],
                    borderRadius: 99,
                    fontFamily: 'Inter,sans-serif',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}>{TYPE_LABELS[tpl.type]}</span>
                </div>
                {/* Tags */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {tpl.tags.slice(0, 3).map(tag => (
                    <span key={tag} style={{
                      fontSize: 10, padding: '1px 6px',
                      background: 'var(--bg-active)',
                      color: 'var(--text-muted)',
                      borderRadius: 99,
                      fontFamily: 'Inter,sans-serif',
                    }}>#{tag}</span>
                  ))}
                </div>
              </div>

              <ChevronRight size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
