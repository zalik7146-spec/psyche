import { useState, useEffect, useRef } from 'react';
import { Book } from '../types';

interface Props {
  book?: Book;
  onSave: (book: Partial<Book>) => void;
  onDelete?: (bookId: string) => void;
  onClose: () => void;
}

const STATUSES: { value: Book['status']; label: string }[] = [
  { value: 'reading',    label: '📖 Читаю' },
  { value: 'finished',   label: '✅ Прочитано' },
  { value: 'want',       label: '🔖 Хочу' },
  { value: 'paused',     label: '⏸️ Пауза' },
];

const EMOJIS = ['📚','📖','📝','🧠','💡','🔬','🎭','🌍','❤️','🧘','⚡','🔮'];
const COLORS = ['#b07d4a','#7c6f5e','#5c7a6b','#6b5c7a','#7a5c5c','#4a6b7a'];

interface GBook {
  id: string;
  title: string;
  authors: string[];
  thumbnail: string;
  pages: number;
}

export default function BookModal({ book, onSave, onDelete, onClose }: Props) {
  const isEdit = !!book;
  const [title, setTitle]     = useState(book?.title || '');
  const [author, setAuthor]   = useState(book?.author || '');
  const [status, setStatus]   = useState<Book['status']>(book?.status || 'want');
  const [color, setColor]     = useState(book?.color || COLORS[0]);
  const [emoji, setEmoji]     = useState(book?.coverEmoji || '📚');
  const [pages, setPages]     = useState(book?.totalPages?.toString() || '');
  const [rating, setRating]   = useState(book?.rating || 0);
  const [genre, setGenre]     = useState(book?.genre || '');
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<GBook[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const q = encodeURIComponent(query.trim());
        const res = await fetch(
          `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=6&printType=books`
        );
        const data = await res.json();
        const items: GBook[] = (data.items || []).map((item: Record<string, unknown>) => {
          const info = (item.volumeInfo as Record<string, unknown>) || {};
          const links = (info.imageLinks as Record<string, string>) || {};
          const img = (links.thumbnail || links.smallThumbnail || '').replace('http://', 'https://');
          return {
            id:       item.id as string,
            title:    (info.title as string) || '',
            authors:  (info.authors as string[]) || [],
            thumbnail: img,
            pages:    (info.pageCount as number) || 0,
          };
        }).filter((b: GBook) => b.title);
        setResults(items);
      } catch { setResults([]); }
      setSearching(false);
    }, 500);
  }, [query]);

  const pickBook = (g: GBook) => {
    setTitle(g.title);
    setAuthor(g.authors.join(', '));
    if (g.pages) setPages(g.pages.toString());
    setResults([]);
    setQuery('');
  };

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      title:      title.trim(),
      author:     author.trim(),
      status,
      color,
      coverEmoji: emoji,
      genre:      genre.trim(),
      totalPages: pages ? parseInt(pages) : undefined,
      rating:     rating || undefined,
    });
    onClose();
  };

  const inp: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 12,
    background: 'var(--bg-raised)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', fontSize: 15, boxSizing: 'border-box',
    outline: 'none', fontFamily: 'Inter, sans-serif',
  };

  const label: React.CSSProperties = {
    fontSize: 11, color: 'var(--text-muted)', marginBottom: 6,
    fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.75)',
        zIndex: 3000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 430,
          background: 'var(--bg-card)',
          borderRadius: '20px 20px 0 0',
          maxHeight: '92vh',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Ручка */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
        </div>

        {/* Шапка */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 20px 14px',
          borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0,
          background: 'var(--bg-card)', zIndex: 10,
        }}>
          <button onClick={onClose} style={{
            background: 'var(--bg-raised)', border: 'none', borderRadius: 10,
            color: 'var(--text-secondary)', padding: '7px 14px', cursor: 'pointer', fontSize: 14,
          }}>Отмена</button>
          <span style={{
            fontFamily: 'Lora, serif', fontSize: 17,
            color: 'var(--text-primary)', fontWeight: 600,
          }}>
            {isEdit ? 'Редактировать' : 'Добавить книгу'}
          </span>
          <button onClick={handleSave} style={{
            background: 'var(--accent)', border: 'none', borderRadius: 10,
            color: '#fff', padding: '7px 16px', cursor: 'pointer',
            fontSize: 14, fontWeight: 700,
          }}>
            {isEdit ? 'Сохранить' : 'Добавить'}
          </button>
        </div>

        {/* Тело */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Поиск Google Books */}
          <div>
            <div style={label}>🔍 Поиск в Google Books</div>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Название, автор..."
              style={inp}
            />
            {searching && (
              <div style={{ textAlign: 'center', padding: '8px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                Ищем...
              </div>
            )}
            {results.length > 0 && (
              <div style={{
                marginTop: 8, borderRadius: 12, overflow: 'hidden',
                border: '1px solid var(--border)',
              }}>
                {results.map(g => (
                  <button key={g.id} onClick={() => pickBook(g)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px',
                    background: 'var(--bg-raised)',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer', textAlign: 'left',
                  }}>
                    {g.thumbnail ? (
                      <img src={g.thumbnail} alt=""
                        style={{ width: 32, height: 44, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                    ) : (
                      <div style={{
                        width: 32, height: 44, borderRadius: 4, flexShrink: 0,
                        background: 'var(--bg-base)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 18,
                      }}>📚</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14, color: 'var(--text-primary)', fontWeight: 600,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{g.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {g.authors.join(', ')}
                        {g.pages > 0 && ` · ${g.pages} стр.`}
                      </div>
                    </div>
                    <span style={{ color: 'var(--accent)', fontSize: 18 }}>+</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Название */}
          <div>
            <div style={label}>Название *</div>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Название книги" style={inp} />
          </div>

          {/* Автор */}
          <div>
            <div style={label}>Автор</div>
            <input value={author} onChange={e => setAuthor(e.target.value)}
              placeholder="Имя автора" style={inp} />
          </div>

          {/* Жанр */}
          <div>
            <div style={label}>Жанр</div>
            <input value={genre} onChange={e => setGenre(e.target.value)}
              placeholder="Психология, философия..." style={inp} />
          </div>

          {/* Статус */}
          <div>
            <div style={label}>Статус</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {STATUSES.map(s => (
                <button key={s.value} onClick={() => setStatus(s.value)} style={{
                  padding: '11px 8px', borderRadius: 12,
                  border: `2px solid ${status === s.value ? 'var(--accent)' : 'var(--border)'}`,
                  background: status === s.value ? 'var(--accent-muted)' : 'var(--bg-raised)',
                  color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer',
                  fontWeight: status === s.value ? 700 : 400,
                  transition: 'all 0.15s',
                }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Страниц */}
          <div>
            <div style={label}>Страниц</div>
            <input value={pages} onChange={e => setPages(e.target.value.replace(/\D/g, ''))}
              placeholder="Количество страниц" type="number"
              style={inp} />
          </div>

          {/* Рейтинг */}
          <div>
            <div style={label}>Рейтинг</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setRating(rating === n ? 0 : n)} style={{
                  fontSize: 28, background: 'none', border: 'none', cursor: 'pointer',
                  opacity: n <= rating ? 1 : 0.25, transition: 'opacity 0.15s',
                  padding: 0,
                }}>⭐</button>
              ))}
            </div>
          </div>

          {/* Иконка */}
          <div>
            <div style={label}>Иконка</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setEmoji(e)} style={{
                  width: 42, height: 42, fontSize: 22, borderRadius: 10,
                  border: `2px solid ${emoji === e ? 'var(--accent)' : 'var(--border)'}`,
                  background: emoji === e ? 'var(--accent-muted)' : 'var(--bg-raised)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>{e}</button>
              ))}
            </div>
          </div>

          {/* Цвет */}
          <div>
            <div style={label}>Цвет</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} style={{
                  width: 34, height: 34, borderRadius: '50%', background: c,
                  border: `3px solid ${color === c ? 'var(--text-primary)' : 'transparent'}`,
                  cursor: 'pointer', transition: 'border 0.15s',
                }} />
              ))}
            </div>
          </div>

          {/* Удалить (только при редактировании) */}
          {isEdit && onDelete && book && (
            <button onClick={() => {
              if (confirm('Удалить книгу и все её записи?')) {
                onDelete(book.id);
                onClose();
              }
            }} style={{
              width: '100%', padding: '12px', borderRadius: 12,
              background: 'rgba(220,60,60,0.12)', border: '1px solid rgba(220,60,60,0.3)',
              color: '#e05555', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              marginTop: 4,
            }}>
              🗑️ Удалить книгу
            </button>
          )}

          <div style={{ height: 20 }} />
        </div>
      </div>
    </div>
  );
}
