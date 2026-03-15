import { useState, useRef } from 'react';
import { Star, Pin, Search, SlidersHorizontal, X, Trash2, RotateCcw } from 'lucide-react';
import { Note, Book, Tag, NoteType } from '../types';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Props {
  notes: Note[];
  books: Book[];
  tags: Tag[];
  onOpen: (note: Note) => void;
  onNew: () => void;
  onDelete: (noteId: string) => void;
}

const TYPE_META: Record<NoteType, { icon: string; color: string; label: string }> = {
  note:     { icon: '📝', color: 'var(--text-secondary)', label: 'Заметка' },
  quote:    { icon: '❝',  color: '#c4813c',               label: 'Цитата' },
  insight:  { icon: '💡', color: '#6a9e8a',               label: 'Инсайт' },
  question: { icon: '🔍', color: '#8a7a9a',               label: 'Вопрос' },
  summary:  { icon: '📋', color: '#7a8a6a',               label: 'Резюме' },
  idea:     { icon: '🌱', color: '#9a8a4a',               label: 'Идея' },
  task:     { icon: '✓',  color: '#6a7a9a',               label: 'Задача' },
};

type SortKey = 'updated' | 'created' | 'alpha';

const vibe = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };

// Swipeable card with delete action
function SwipeCard({ note, onOpen, onDelete, idx }: {
  note: Note; onOpen: () => void; onDelete: () => void; idx: number;
  books: Book[]; tags: Tag[];
}) {
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const startX = useRef(0);
  const isDragging = useRef(false);

  const THRESHOLD = 90;

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    isDragging.current = true;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const dx = e.touches[0].clientX - startX.current;
    if (dx < -5) setSwiping(true);
    if (dx < 0) setSwipeX(Math.max(dx, -140));
  };
  const onTouchEnd = () => {
    isDragging.current = false;
    if (swipeX < -THRESHOLD) {
      setSwipeX(-120);
    } else {
      setSwipeX(0);
      setSwiping(false);
    }
  };

  const handleDelete = () => {
    vibe(20);
    setDeleted(true);
    setTimeout(() => onDelete(), 320);
  };

  if (deleted) return (
    <div style={{
      height: 0, overflow: 'hidden',
      animation: 'swipe-delete 0.32s cubic-bezier(0.22,1,0.36,1) both',
    }} />
  );

  return (
    <div style={{ position: 'relative', marginBottom: 9, overflow: 'hidden', borderRadius: 16 }}>
      {/* Delete bg */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        width: 120, background: 'rgba(180,50,50,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 16, gap: 6,
        opacity: swiping ? 1 : 0,
        transition: 'opacity 0.15s',
      }}>
        <Trash2 size={20} color="#fff" />
        <span style={{ color: '#fff', fontSize: 13, fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>Удалить</span>
      </div>

      {/* Card */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isDragging.current ? 'none' : 'transform 0.28s cubic-bezier(0.22,1,0.36,1)',
          position: 'relative', zIndex: 1,
        }}
      >
        <NoteCard note={note} onOpen={onOpen} onDelete={handleDelete} idx={idx} showDelete={swipeX < -THRESHOLD} />
      </div>
    </div>
  );
}

function NoteCard({ note, onOpen, onDelete, idx, showDelete }: {
  note: Note; onOpen: () => void; onDelete: () => void;
  idx: number; showDelete: boolean;
}) {
  const meta     = TYPE_META[note.type];
  const plain    = note.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const preview  = plain.length > 130 ? plain.slice(0, 130) + '…' : plain;

  return (
    <button
      className="card-hover"
      onClick={() => { vibe(8); if (!showDelete) onOpen(); }}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '14px 15px', borderRadius: '16px',
        background: 'var(--bg-card)',
        border: 'var(--card-border)',
        cursor: 'pointer',
        animation: 'card-enter 0.35s cubic-bezier(0.22,1,0.36,1) both',
        animationDelay: `${Math.min(idx * 0.045, 0.35)}s`,
        position: 'relative',
      }}
    >
      {/* Delete button (visible when swiped) */}
      {showDelete && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(180,50,50,0.9)', border: 'none', borderRadius: 10,
            color: '#fff', cursor: 'pointer', padding: '6px 12px',
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600,
            zIndex: 2,
          }}
        >
          <Trash2 size={14} /> Удалить
        </button>
      )}

      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', marginBottom: '7px' }}>
        <span style={{ fontSize: '17px', flexShrink: 0, lineHeight: 1, marginTop: 1 }}>{meta.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="note-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {note.title || 'Без заголовка'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0, alignItems: 'center', marginTop: 2 }}>
          {note.isFavorite && <Star size={13} color="#d4914a" fill="#d4914a" />}
          {note.isPinned   && <Pin  size={13} color="var(--accent)" fill="var(--accent)" />}
        </div>
      </div>

      {/* Quote */}
      {note.quote && (
        <div style={{
          borderLeft: `3px solid ${note.quoteColor || '#d4914a'}`,
          padding: '5px 11px', marginBottom: '7px',
          background: 'var(--bg-raised)', borderRadius: '0 8px 8px 0',
        }}>
          <p style={{
            margin: 0, fontSize: '12px', color: 'var(--text-secondary)',
            fontStyle: 'italic', fontFamily: 'Lora, serif', lineHeight: 1.55,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>«{note.quote}»</p>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <p className="note-preview" style={{ margin: '0 0 9px' }}>{preview}</p>
      )}

      {/* Bottom */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span className="note-meta">
          {format(new Date(note.updatedAt), 'd MMM', { locale: ru })}
        </span>
        {note.wordCount ? <span className="note-meta">· {note.wordCount} сл.</span> : null}
        <span style={{
          fontSize: 11, color: meta.color,
          fontFamily: 'Inter, sans-serif',
          background: meta.color + '18',
          borderRadius: 99, padding: '1px 7px',
        }}>{meta.label}</span>
      </div>
    </button>
  );
}

export default function NotesList({ notes, books, tags, onOpen, onDelete }: Props) {
  const [search, setSearch]         = useState('');
  const [filterType, setFilterType] = useState<NoteType | 'all'>('all');
  const [filterBook, setFilterBook] = useState<string>('all');
  const [sortBy, setSortBy]         = useState<SortKey>('updated');
  const [showFilters, setShowFilters] = useState(false);
  const [showFavOnly, setShowFavOnly] = useState(false);

  const bookMap = Object.fromEntries(books.map(b => [b.id, b]));
  const tagMap  = Object.fromEntries(tags.map(t => [t.id, t]));
  void bookMap; void tagMap;

  const filtered = notes
    .filter(n => {
      if (showFavOnly && !n.isFavorite) return false;
      if (filterType !== 'all' && n.type !== filterType) return false;
      if (filterBook !== 'all' && n.bookId !== filterBook) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          (n.quote && n.quote.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      if (sortBy === 'updated') return b.updatedAt.localeCompare(a.updatedAt);
      if (sortBy === 'created') return b.createdAt.localeCompare(a.createdAt);
      return a.title.localeCompare(b.title, 'ru');
    });

  const pinned   = filtered.filter(n => n.isPinned);
  const unpinned = filtered.filter(n => !n.isPinned);
  const today    = unpinned.filter(n => new Date(n.updatedAt).toDateString() === new Date().toDateString());
  const rest     = unpinned.filter(n => new Date(n.updatedAt).toDateString() !== new Date().toDateString());

  const totalFiltered = filtered.length;
  const hasFilters = filterType !== 'all' || filterBook !== 'all' || showFavOnly;

  const renderSwipe = (note: Note, idx: number) => (
    <SwipeCard
      key={note.id}
      note={note}
      idx={idx}
      books={books}
      tags={tags}
      onOpen={() => onOpen(note)}
      onDelete={() => onDelete(note.id)}
    />
  );

  const Section = ({ label, items, offset = 0 }: { label: string; items: Note[]; offset?: number }) => (
    items.length > 0 ? (
      <>
        <div className="section-header">{label}</div>
        {items.map((note, i) => renderSwipe(note, offset + i))}
      </>
    ) : null
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: 'calc(env(safe-area-inset-top,0px) + 12px) 14px 10px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-base)', flexShrink: 0,
        animation: 'fadeIn 0.3s ease-out both',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div>
            <h1 className="font-serif" style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Записи
            </h1>
            <p style={{ margin: '1px 0 0', fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
              {notes.length} {notes.length === 1 ? 'запись' : 'записей'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => { vibe(6); setShowFavOnly(v => !v); }}
              style={{
                width: 36, height: 36, borderRadius: '11px',
                background: showFavOnly ? 'rgba(196,129,60,0.15)' : 'var(--bg-raised)',
                border: `1px solid ${showFavOnly ? '#c4813c' : 'var(--border)'}`,
                color: showFavOnly ? '#c4813c' : 'var(--text-muted)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.18s',
              }}
            >
              <Star size={16} fill={showFavOnly ? '#c4813c' : 'none'} />
            </button>
            <button
              onClick={() => { vibe(6); setShowFilters(v => !v); }}
              style={{
                width: 36, height: 36, borderRadius: '11px',
                background: hasFilters ? 'var(--accent-glow)' : 'var(--bg-raised)',
                border: `1px solid ${hasFilters ? 'var(--accent-dim)' : 'var(--border)'}`,
                color: hasFilters ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.18s',
              }}
            >
              <SlidersHorizontal size={16} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{
            position: 'absolute', left: '12px', top: '50%',
            transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none',
          }} />
          <input
            className="input-base"
            style={{ paddingLeft: '36px', paddingRight: search ? '36px' : '14px', fontSize: '14px' }}
            placeholder="Поиск по записям…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')}
              style={{
                position: 'absolute', right: '10px', top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none',
                color: 'var(--text-muted)', cursor: 'pointer', padding: '2px',
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filters */}
        {showFilters && (
          <div style={{
            marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px',
            animation: 'slideDown 0.22s cubic-bezier(0.22,1,0.36,1) both',
          }}>
            <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '2px' }}>
              {(['all', ...Object.keys(TYPE_META)] as (NoteType | 'all')[]).map(t => (
                <button key={t}
                  onClick={() => { vibe(5); setFilterType(t); }}
                  style={{
                    padding: '4px 10px', borderRadius: '99px', whiteSpace: 'nowrap',
                    background: filterType === t ? 'var(--bg-active)' : 'var(--bg-raised)',
                    border: `1px solid ${filterType === t ? 'var(--border-mid)' : 'var(--border)'}`,
                    color: filterType === t ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor: 'pointer', fontSize: '12px', fontFamily: 'Inter, sans-serif',
                    fontWeight: filterType === t ? 600 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  {t === 'all' ? 'Все' : TYPE_META[t as NoteType].icon + ' ' + TYPE_META[t as NoteType].label}
                </button>
              ))}
            </div>

            {books.length > 0 && (
              <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '2px' }}>
                <button onClick={() => setFilterBook('all')}
                  style={{
                    padding: '4px 10px', borderRadius: '99px', whiteSpace: 'nowrap',
                    background: filterBook === 'all' ? 'var(--bg-active)' : 'var(--bg-raised)',
                    border: `1px solid ${filterBook === 'all' ? 'var(--border-mid)' : 'var(--border)'}`,
                    color: filterBook === 'all' ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor: 'pointer', fontSize: '12px', fontFamily: 'Inter, sans-serif',
                    transition: 'all 0.15s',
                  }}
                >
                  Все книги
                </button>
                {books.map(b => (
                  <button key={b.id} onClick={() => { vibe(5); setFilterBook(b.id); }}
                    style={{
                      padding: '4px 10px', borderRadius: '99px', whiteSpace: 'nowrap',
                      background: filterBook === b.id ? 'var(--bg-active)' : 'var(--bg-raised)',
                      border: `1px solid ${filterBook === b.id ? 'var(--border-mid)' : 'var(--border)'}`,
                      color: filterBook === b.id ? 'var(--text-primary)' : 'var(--text-muted)',
                      cursor: 'pointer', fontSize: '12px', fontFamily: 'Inter, sans-serif',
                      transition: 'all 0.15s',
                    }}
                  >
                    {b.coverEmoji} {b.title}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '5px' }}>
              {([['updated','По изменению'],['created','По дате'],['alpha','А–Я']] as [SortKey,string][]).map(([k,l]) => (
                <button key={k} onClick={() => { vibe(5); setSortBy(k); }}
                  style={{
                    padding: '4px 10px', borderRadius: '99px',
                    background: sortBy === k ? 'var(--bg-active)' : 'var(--bg-raised)',
                    border: `1px solid ${sortBy === k ? 'var(--border-mid)' : 'var(--border)'}`,
                    color: sortBy === k ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor: 'pointer', fontSize: '12px', fontFamily: 'Inter, sans-serif',
                    fontWeight: sortBy === k ? 600 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Hint */}
      {notes.length > 1 && (
        <div style={{
          padding: '5px 14px', fontSize: 11, color: 'var(--text-muted)',
          fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 5,
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-base)',
          flexShrink: 0,
        }}>
          <RotateCcw size={10} />
          Потяните карточку влево, чтобы удалить
        </div>
      )}

      {/* List */}
      <div className="scroll-area" style={{ padding: '8px 14px 80px' }}>
        {totalFiltered === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            animation: 'fadeUp 0.4s ease-out both',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>📝</div>
            <p style={{ color: 'var(--text-muted)', fontFamily: 'Lora, serif', fontSize: '15px' }}>
              {search ? 'Ничего не найдено' : 'Нет записей'}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'Inter, sans-serif', marginTop: '6px' }}>
              {search ? 'Попробуйте другой запрос' : 'Нажмите + чтобы создать первую'}
            </p>
          </div>
        ) : (
          <>
            <Section label="📌 Закреплённые" items={pinned} offset={0} />
            <Section label="Сегодня" items={today} offset={pinned.length} />
            <Section label="Ранее" items={rest} offset={pinned.length + today.length} />
          </>
        )}
      </div>
    </div>
  );
}
