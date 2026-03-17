import { useState } from 'react';
import { Plus, Search, FileText, X, ChevronRight } from 'lucide-react';
import { Book, BookStatus, Note } from '../types';

const vibe = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };

interface Props {
  books: Book[];
  notes: Note[];
  onAddBook: () => void;
  onEditBook: (book: Book) => void;
  onNewNoteForBook: (bookId: string) => void;
  onOpenCatalog?: () => void;
}

const STATUS_META: Record<BookStatus, { label: string; color: string; bg: string; icon: string }> = {
  reading:   { label: 'Читаю',     color: '#6a9e8a', bg: 'rgba(106,158,138,0.15)', icon: '📖' },
  finished:  { label: 'Прочитано', color: '#c4813c', bg: 'rgba(196,129,60,0.15)',  icon: '✅' },
  want:      { label: 'Хочу',      color: '#8a7a9a', bg: 'rgba(138,122,154,0.15)', icon: '🔖' },
  paused:    { label: 'Пауза',     color: '#9a8a4a', bg: 'rgba(154,138,74,0.15)',  icon: '⏸' },
  abandoned: { label: 'Брошено',   color: '#7a5a5a', bg: 'rgba(122,90,90,0.15)',   icon: '🚫' },
};

export default function Library({ books, notes, onAddBook, onEditBook, onNewNoteForBook, onOpenCatalog }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<BookStatus | 'all'>('all');

  const noteCount = (bookId: string) => notes.filter(n => n.bookId === bookId).length;

  const filtered = books
    .filter(b => {
      if (filter !== 'all' && b.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      const order: BookStatus[] = ['reading', 'finished', 'want', 'paused', 'abandoned'];
      return order.indexOf(a.status) - order.indexOf(b.status) || b.createdAt.localeCompare(a.createdAt);
    });

  const grouped = (Object.keys(STATUS_META) as BookStatus[]).reduce((acc, status) => {
    const g = filtered.filter(b => b.status === status);
    if (g.length > 0) acc[status] = g;
    return acc;
  }, {} as Record<BookStatus, Book[]>);

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
              Библиотека
            </h1>
            <p style={{ margin: '1px 0 0', fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
              {books.length} {books.length === 1 ? 'книга' : 'книг'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {onOpenCatalog && (
              <button
                onClick={() => { vibe(8); onOpenCatalog(); }}
                style={{
                  height: 38, padding: '0 12px', borderRadius: '12px',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--accent)', fontSize: 13, gap: 4,
                  fontWeight: 600,
                }}
              >
                📚 Каталог
              </button>
            )}
          <button
            onClick={() => { vibe(8); onAddBook(); }}
            style={{
              width: 38, height: 38, borderRadius: '12px',
              background: 'var(--accent)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'transform 0.12s',
            }}
            onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.88)'; }}
            onPointerUp={e   => { e.currentTarget.style.transform = 'scale(1)'; }}
            onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <Plus size={20} color="#0e0c09" strokeWidth={2.5} />
          </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '10px' }}>
          <Search size={14} style={{
            position: 'absolute', left: '12px', top: '50%',
            transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none',
          }} />
          <input
            className="input-base"
            style={{ paddingLeft: '36px', paddingRight: search ? '36px' : '14px', padding: '10px 14px 10px 36px', fontSize: '14px' }}
            placeholder="Поиск книг…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{
              position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px',
            }}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status filter */}
        <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '2px' }}>
          {(['all', ...Object.keys(STATUS_META)] as (BookStatus | 'all')[]).map(s => (
            <button key={s} onClick={() => { vibe(5); setFilter(s); }}
              style={{
                padding: '4px 11px', borderRadius: '99px', whiteSpace: 'nowrap',
                background: filter === s ? 'var(--bg-active)' : 'var(--bg-raised)',
                border: `1px solid ${filter === s ? 'var(--border-mid)' : 'var(--border)'}`,
                color: filter === s ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer', fontSize: '12px', fontFamily: 'Inter, sans-serif',
                fontWeight: filter === s ? 600 : 400,
              }}
            >
              {s === 'all' ? 'Все' : STATUS_META[s as BookStatus].icon + ' ' + STATUS_META[s as BookStatus].label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="scroll-area" style={{ padding: '8px 14px 80px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>📚</div>
            <p style={{ color: 'var(--text-muted)', fontFamily: 'Lora, serif', fontSize: '15px' }}>
              {search ? 'Ничего не найдено' : 'Библиотека пуста'}
            </p>
            {!search && (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'Inter, sans-serif', marginTop: '6px' }}>
                Добавьте первую книгу нажав +
              </p>
            )}
          </div>
        ) : (
          (Object.keys(grouped) as BookStatus[]).map(status => (
            <div key={status}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '14px 2px 8px',
                fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: STATUS_META[status].color,
                fontFamily: 'Inter, sans-serif',
              }}>
                {STATUS_META[status].icon} {STATUS_META[status].label}
                <span style={{
                  background: STATUS_META[status].bg, color: STATUS_META[status].color,
                  borderRadius: '99px', padding: '1px 8px', fontSize: '10px',
                }}>
                  {grouped[status].length}
                </span>
              </div>

              {grouped[status].map((book, bi) => {
                const nc = noteCount(book.id);
                const pct = (book.totalPages && book.currentPage)
                  ? Math.round((book.currentPage / book.totalPages) * 100) : 0;

                return (
                  <div
                    key={book.id}
                    className="card-hover"
                    onClick={() => { vibe(8); onEditBook(book); }}
                    style={{
                      display: 'flex', gap: '12px', alignItems: 'center',
                      padding: '13px 14px', borderRadius: '16px',
                      background: 'var(--bg-card)', border: 'var(--card-border)',
                      marginBottom: '9px',
                      animation: 'card-enter 0.35s cubic-bezier(0.22,1,0.36,1) both',
                      animationDelay: `${bi * 0.05}s`,
                    }}
                  >
                    {/* Cover */}
                    <div style={{
                      width: 52, height: 68, borderRadius: '10px',
                      background: book.color || 'var(--bg-raised)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '24px', flexShrink: 0,
                      boxShadow: '0 3px 10px rgba(0,0,0,0.3)',
                    }}>
                      {book.coverEmoji}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="book-title" style={{
                        marginBottom: '3px',
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      }}>
                        {book.title}
                      </div>
                      <div className="book-author" style={{ marginBottom: '6px' }}>
                        {book.author}
                      </div>

                      {/* Progress */}
                      {book.totalPages && book.status === 'reading' && (
                        <div style={{ marginBottom: '6px' }}>
                          <div style={{
                            height: '3px', background: 'var(--bg-active)',
                            borderRadius: '99px', overflow: 'hidden',
                          }}>
                            <div style={{
                              height: '100%', width: `${pct}%`,
                              background: 'var(--accent)', borderRadius: '99px',
                              transition: 'width 0.4s',
                            }} />
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'Inter, sans-serif' }}>
                            {book.currentPage} / {book.totalPages} стр. · {pct}%
                          </div>
                        </div>
                      )}

                      {/* Bottom row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {book.rating && (
                          <span style={{ fontSize: '12px', color: '#d4914a' }}>
                            {'★'.repeat(book.rating)}{'☆'.repeat(5 - book.rating)}
                          </span>
                        )}
                        {nc > 0 && (
                          <button
                            onClick={e => { e.stopPropagation(); onNewNoteForBook(book.id); }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '3px',
                              padding: '3px 8px', borderRadius: '99px',
                              background: 'var(--bg-raised)', border: '1px solid var(--border-mid)',
                              color: 'var(--text-secondary)', cursor: 'pointer',
                              fontSize: '11px', fontFamily: 'Inter, sans-serif',
                            }}
                          >
                            <FileText size={10} /> {nc} зам.
                          </button>
                        )}
                      </div>
                    </div>

                    <ChevronRight size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
