import { useState } from 'react';
import { Note } from '../types';
import { Link2, X, Search, Plus, BookOpen } from 'lucide-react';

interface Props {
  currentNoteId: string;
  linkedNoteIds: string[];
  allNotes: Note[];
  onLink: (noteId: string) => void;
  onUnlink: (noteId: string) => void;
}

export default function LinkedNotesPanel({ currentNoteId, linkedNoteIds, allNotes, onLink, onUnlink }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const vibe = (ms = 6) => { try { navigator.vibrate?.(ms); } catch {} };

  const linkedNotes   = allNotes.filter(n => linkedNoteIds.includes(n.id));
  const availableNotes = allNotes.filter(n =>
    n.id !== currentNoteId &&
    !linkedNoteIds.includes(n.id) &&
    (search === '' ||
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.replace(/<[^>]+>/g, '').toLowerCase().includes(search.toLowerCase()))
  );

  const NOTE_ICONS: Record<string, string> = {
    note: '📝', quote: '❝', insight: '💡', question: '🔍', summary: '📋', idea: '🌱', task: '✓',
  };

  return (
    <div style={{ borderTop: '1px solid var(--border)', marginTop: 0 }}>
      {/* Header toggle */}
      <button
        onClick={() => { vibe(); setOpen(!open); }}
        style={{
          width: '100%', padding: '10px 16px',
          background: 'transparent', border: 'none',
          display: 'flex', alignItems: 'center', gap: 8,
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <Link2 size={13} color="var(--accent)" />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif',
          fontWeight: 600, flex: 1 }}>
          Связанные записи {linkedNotes.length > 0 && `(${linkedNotes.length})`}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif',
          transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s ease' }}>▾</span>
      </button>

      {open && (
        <div style={{ padding: '0 16px 12px', animation: 'fadeSlideUp 0.25s ease' }}>

          {/* Linked notes list */}
          {linkedNotes.length > 0 && (
            <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {linkedNotes.map(note => (
                <div key={note.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', borderRadius: 10,
                  background: 'var(--bg-raised)', border: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: 14 }}>{NOTE_ICONS[note.type] || '📝'}</span>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif',
                      fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {note.title || 'Без названия'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
                      {note.type} · {new Date(note.createdAt).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                  <button onClick={() => { vibe(8); onUnlink(note.id); }} style={{
                    width: 24, height: 24, borderRadius: 8,
                    background: 'rgba(224,112,112,0.12)', border: '1px solid rgba(224,112,112,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#e07070', cursor: 'pointer', flexShrink: 0,
                  }}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Search to add */}
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%',
              transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Найти запись для связи..."
              style={{ width: '100%', padding: '9px 10px 9px 30px', borderRadius: 10,
                background: 'var(--bg-raised)', border: '1px solid var(--border)',
                outline: 'none', color: 'var(--text-primary)', fontSize: 13,
                fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' }}
            />
          </div>

          {/* Available notes */}
          {availableNotes.length > 0 ? (
            <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {availableNotes.slice(0, 8).map(note => (
                <button key={note.id} onClick={() => { vibe(8); onLink(note.id); }}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 10,
                    background: 'var(--bg-active)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontSize: 13 }}>{NOTE_ICONS[note.type] || '📝'}</span>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif',
                      fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {note.title || 'Без названия'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
                      {note.type}
                    </div>
                  </div>
                  <Plus size={12} color="var(--accent)" />
                </button>
              ))}
              {availableNotes.length > 8 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center',
                  padding: '4px', fontFamily: 'Inter, sans-serif' }}>
                  + ещё {availableNotes.length - 8} записей — уточните поиск
                </div>
              )}
            </div>
          ) : search ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center',
              padding: '12px', fontFamily: 'Inter, sans-serif' }}>
              Ничего не найдено
            </div>
          ) : allNotes.length <= 1 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center',
              padding: '12px', fontFamily: 'Inter, sans-serif' }}>
              <BookOpen size={14} style={{ marginBottom: 4 }} /> Создайте больше записей для связей
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center',
              padding: '12px', fontFamily: 'Inter, sans-serif' }}>
              Все записи уже связаны
            </div>
          )}
        </div>
      )}
    </div>
  );
}
