import { useState } from 'react';
import { Star, Pin, Search, SlidersHorizontal, X } from 'lucide-react';
import { Note, Book, Tag, NoteType } from '../types';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Props {
  notes: Note[];
  books: Book[];
  tags: Tag[];
  onOpen: (note: Note) => void;
  onNew: () => void;
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

export default function NotesList({ notes, books, tags, onOpen }: Props) {
  const [search, setSearch]       = useState('');
  const [filterType, setFilterType] = useState<NoteType | 'all'>('all');
  const [filterBook, setFilterBook] = useState<string>('all');
  const [sortBy, setSortBy]       = useState<SortKey>('updated');
  const [showFilters, setShowFilters] = useState(false);
  const [showFavOnly, setShowFavOnly] = useState(false);

  const bookMap = Object.fromEntries(books.map(b => [b.id, b]));
  const tagMap  = Object.fromEntries(tags.map(t => [t.id, t]));

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

  const renderNote = (note: Note, idx = 0) => {
    const meta     = TYPE_META[note.type];
    const book     = note.bookId ? bookMap[note.bookId] : undefined;
    const noteTags = note.tags.map(tid => tagMap[tid]).filter(Boolean);
    const plain    = note.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const preview  = plain.length > 130 ? plain.slice(0, 130) + '…' : plain;

    return (
      <button
        key={note.id}
        className="card-hover"
        onClick={() => { vibe(8); onOpen(note); }}
        style={{
          display: 'block', width: '100%', textAlign: 'left',
          padding: '14px 15px', borderRadius: '16px',
          background: 'var(--bg-card)',
          border: 'var(--card-border)',
          marginBottom: '9px',
          cursor: 'pointer',
          animation: 'card-enter 0.32s cubic-bezier(0.22,1,0.36,1) both',
          animationDelay: `${Math.min(idx * 0.04, 0.3)}s`,
        }}
      >
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', marginBottom: '7px' }}>
          <span style={{ fontSize: '17px', flexShrink: 0, lineHeight: 1, marginTop: 1 }}>{meta.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="note-title" style={{
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {note.title || 'Без заголовка'}
            </div>
            {book && (
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', marginTop: 2 }}>
                {book.coverEmoji} {book.title}
              </div>
            )}
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
            background: 'var(--bg-raised)',
            borderRadius: '0 8px 8px 0',
          }}>
            <p style={{
              margin: 0, fontSize: '12px', color: 'var(--text-secondary)',
              fontStyle: 'italic', fontFamily: 'Lora, serif', lineHeight: 1.55,
              overflow: 'hidden', textOverflow: 'ellipsis',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              «{note.quote}»
            </p>
          </div>
        )}

        {/* Preview */}
        {preview && (
          <p className="note-preview" style={{ margin: '0 0 9px' }}>
            {preview}
          </p>
        )}

        {/* Bottom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span className="note-meta">
            {format(new Date(note.updatedAt), 'd MMM', { locale: ru })}
          </span>
          {note.wordCount ? (
            <span className="note-meta">· {note.wordCount} сл.</span>
          ) : null}
          {noteTags.slice(0, 3).map(tag => (
            <span key={tag.id} className="tag-pill" style={{ color: tag.color, borderColor: tag.color + '55' }}>
              #{tag.name}
            </span>
          ))}
        </div>
      </button>
    );
  };

  const Section = ({ label, items, offset = 0 }: { label: string; items: Note[]; offset?: number }) => (
    items.length > 0 ? (
      <>
        <div className="section-header">{label}</div>
        {items.map((note, i) => renderNote(note, offset + i))}
      </>
    ) : null
  );

  const totalFiltered = filtered.length;
  const hasFilters = filterType !== 'all' || filterBook !== 'all' || showFavOnly;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: 'calc(env(safe-area-inset-top,0px) + 12px) 14px 10px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-base)', flexShrink: 0,
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
              onClick={() => setShowFavOnly(v => !v)}
              style={{
                width: 36, height: 36, borderRadius: '11px',
                background: showFavOnly ? 'rgba(196,129,60,0.15)' : 'var(--bg-raised)',
                border: `1px solid ${showFavOnly ? '#c4813c' : 'var(--border)'}`,
                color: showFavOnly ? '#c4813c' : 'var(--text-muted)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Star size={16} fill={showFavOnly ? '#c4813c' : 'none'} />
            </button>
            <button
              onClick={() => setShowFilters(v => !v)}
              style={{
                width: 36, height: 36, borderRadius: '11px',
                background: hasFilters ? 'var(--accent-glow)' : 'var(--bg-raised)',
                border: `1px solid ${hasFilters ? 'var(--accent-dim)' : 'var(--border)'}`,
                color: hasFilters ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
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
            style={{ paddingLeft: '36px', paddingRight: search ? '36px' : '14px',
              padding: '10px 14px 10px 36px', fontSize: '14px' }}
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
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Type filter */}
            <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '2px' }}>
              {(['all', ...Object.keys(TYPE_META)] as (NoteType | 'all')[]).map(t => (
                <button key={t}
                  onClick={() => setFilterType(t)}
                  style={{
                    padding: '4px 10px', borderRadius: '99px', whiteSpace: 'nowrap',
                    background: filterType === t ? 'var(--bg-active)' : 'var(--bg-raised)',
                    border: `1px solid ${filterType === t ? 'var(--border-mid)' : 'var(--border)'}`,
                    color: filterType === t ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor: 'pointer', fontSize: '12px', fontFamily: 'Inter, sans-serif',
                    fontWeight: filterType === t ? 600 : 400,
                  }}
                >
                  {t === 'all' ? 'Все' : TYPE_META[t as NoteType].icon + ' ' + TYPE_META[t as NoteType].label}
                </button>
              ))}
            </div>

            {/* Book filter */}
            {books.length > 0 && (
              <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '2px' }}>
                <button onClick={() => setFilterBook('all')}
                  style={{
                    padding: '4px 10px', borderRadius: '99px', whiteSpace: 'nowrap',
                    background: filterBook === 'all' ? 'var(--bg-active)' : 'var(--bg-raised)',
                    border: `1px solid ${filterBook === 'all' ? 'var(--border-mid)' : 'var(--border)'}`,
                    color: filterBook === 'all' ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor: 'pointer', fontSize: '12px', fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Все книги
                </button>
                {books.map(b => (
                  <button key={b.id} onClick={() => setFilterBook(b.id)}
                    style={{
                      padding: '4px 10px', borderRadius: '99px', whiteSpace: 'nowrap',
                      background: filterBook === b.id ? 'var(--bg-active)' : 'var(--bg-raised)',
                      border: `1px solid ${filterBook === b.id ? 'var(--border-mid)' : 'var(--border)'}`,
                      color: filterBook === b.id ? 'var(--text-primary)' : 'var(--text-muted)',
                      cursor: 'pointer', fontSize: '12px', fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    {b.coverEmoji} {b.title}
                  </button>
                ))}
              </div>
            )}

            {/* Sort */}
            <div style={{ display: 'flex', gap: '5px' }}>
              {([['updated','По изменению'],['created','По дате'],['alpha','А–Я']] as [SortKey,string][]).map(([k,l]) => (
                <button key={k} onClick={() => setSortBy(k)}
                  style={{
                    padding: '4px 10px', borderRadius: '99px',
                    background: sortBy === k ? 'var(--bg-active)' : 'var(--bg-raised)',
                    border: `1px solid ${sortBy === k ? 'var(--border-mid)' : 'var(--border)'}`,
                    color: sortBy === k ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor: 'pointer', fontSize: '12px', fontFamily: 'Inter, sans-serif',
                    fontWeight: sortBy === k ? 600 : 400,
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* List */}
      <div className="scroll-area" style={{ padding: '8px 14px 80px' }}>
        {totalFiltered === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
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
