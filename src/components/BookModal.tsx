import { useState, useEffect, useRef } from 'react';
import { X, Trash2, Search, Loader } from 'lucide-react';
import { Book, BookStatus } from '../types';

interface Props {
  book?: Book;
  onSave: (data: Partial<Book>) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

interface GoogleBook {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    description?: string;
    pageCount?: number;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    categories?: string[];
  };
}

const STATUS_OPTIONS: { value: BookStatus; label: string; icon: string }[] = [
  { value: 'reading',   label: 'Читаю',     icon: '📖' },
  { value: 'finished',  label: 'Прочитано', icon: '✅' },
  { value: 'want',      label: 'Хочу',      icon: '🔖' },
  { value: 'paused',    label: 'Пауза',     icon: '⏸' },
  { value: 'abandoned', label: 'Брошено',   icon: '🚫' },
];

const COVER_COLORS = [
  '#3d2a1a', '#2a3d2a', '#1a2a3d', '#3d1a2a',
  '#2a2a1a', '#3d2a3d', '#1a3d3d', '#3d3d2a',
];

const EMOJIS = ['📚','📖','🧠','💡','🌱','🔍','✍️','📝','💭','🎯','🌿','🧩','🔮','📊','🗺️','⚡'];

const vibe = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };

export default function BookModal({ book, onSave, onDelete, onClose }: Props) {
  const [title, setTitle]   = useState(book?.title || '');
  const [author, setAuthor] = useState(book?.author || '');
  const [genre, setGenre]   = useState(book?.genre || '');
  const [desc, setDesc]     = useState(book?.description || '');
  const [status, setStatus] = useState<BookStatus>(book?.status || 'want');
  const [color, setColor]   = useState(book?.color || COVER_COLORS[0]);
  const [emoji, setEmoji]   = useState(book?.coverEmoji || '📚');
  const [rating, setRating] = useState(book?.rating || 0);
  const [totalPages, setTotalPages] = useState(book?.totalPages?.toString() || '');
  const [currentPage, setCurrentPage] = useState(book?.currentPage?.toString() || '');
  const [coverUrl, setCoverUrl] = useState(book?.color?.startsWith('http') ? book.color : '');

  // Google Books search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GoogleBook[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 3) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=6&langRestrict=ru`
        );
        const data = await res.json();
        setSearchResults(data.items || []);
        setShowResults(true);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 600);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery]);

  const selectGoogleBook = (gb: GoogleBook) => {
    vibe(8);
    const info = gb.volumeInfo;
    setTitle(info.title || '');
    setAuthor(info.authors?.join(', ') || '');
    setDesc(info.description?.slice(0, 300) || '');
    if (info.pageCount) setTotalPages(String(info.pageCount));
    if (info.categories?.[0]) setGenre(info.categories[0]);
    const thumb = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '';
    if (thumb) setCoverUrl(thumb.replace('http://', 'https://'));
    setShowResults(false);
    setSearchQuery('');
  };

  const handleSave = () => {
    if (!title.trim()) return;
    vibe(10);
    onSave({
      title:       title.trim(),
      author:      author.trim(),
      genre:       genre.trim() || undefined,
      description: desc.trim() || undefined,
      status,
      color:       coverUrl || color,
      coverEmoji:  emoji,
      rating:      rating || undefined,
      totalPages:  totalPages ? parseInt(totalPages) : undefined,
      currentPage: currentPage ? parseInt(currentPage) : undefined,
    });
  };

  const Label = ({ children }: { children: React.ReactNode }) => (
    <label style={{
      display: 'block', fontSize: '12px', fontWeight: 500,
      color: 'var(--text-muted)', marginBottom: '6px',
      fontFamily: 'Inter, sans-serif',
    }}>
      {children}
    </label>
  );

  const Input = ({ value, onChange, placeholder, type = 'text' }: {
    value: string; onChange: (v: string) => void;
    placeholder?: string; type?: string;
  }) => (
    <input
      type={type} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', padding: '10px 14px', borderRadius: 10,
        background: 'var(--bg-input)', border: '1px solid var(--border)',
        color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
        fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
      }}
    />
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: 'min(100%, 430px)',
        background: 'var(--bg-raised)',
        borderRadius: '20px 20px 0 0',
        border: '1px solid var(--border)',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        animation: 'sheetSlideUp 0.35s cubic-bezier(0.22,1,0.36,1) both',
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '12px auto 0' }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 8px' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Lora, serif', margin: 0 }}>
            {book ? 'Редактировать книгу' : 'Добавить книгу'}
          </h3>
          <button onClick={onClose} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 10, padding: 8, cursor: 'pointer', color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 16px 16px' }}>

          {/* Google Books Search */}
          {!book && (
            <div style={{ marginBottom: 16, position: 'relative' }}>
              <Label>🔍 Найти книгу</Label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-muted)', pointerEvents: 'none',
                }} />
                {searching && <Loader size={14} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--accent)', animation: 'spin 1s linear infinite',
                }} />}
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Название или автор..."
                  style={{
                    width: '100%', padding: '10px 14px 10px 36px',
                    borderRadius: 10, background: 'var(--bg-input)',
                    border: '1px solid var(--accent)', color: 'var(--text-primary)',
                    fontSize: 14, outline: 'none', fontFamily: 'Inter, sans-serif',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Results */}
              {showResults && searchResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  background: 'var(--bg-raised)', border: '1px solid var(--border)',
                  borderRadius: 12, zIndex: 10, overflow: 'hidden',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)', marginTop: 4,
                }}>
                  {searchResults.map(gb => (
                    <button key={gb.id} onClick={() => selectGoogleBook(gb)} style={{
                      width: '100%', padding: '10px 12px', background: 'none',
                      border: 'none', borderBottom: '1px solid var(--border)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                      textAlign: 'left',
                    }}>
                      {gb.volumeInfo.imageLinks?.smallThumbnail ? (
                        <img
                          src={gb.volumeInfo.imageLinks.smallThumbnail.replace('http://', 'https://')}
                          alt="" style={{ width: 36, height: 48, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                        />
                      ) : (
                        <div style={{
                          width: 36, height: 48, background: 'var(--bg-card)',
                          borderRadius: 4, flexShrink: 0, display: 'flex',
                          alignItems: 'center', justifyContent: 'center', fontSize: 18,
                        }}>📚</div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {gb.volumeInfo.title}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          {gb.volumeInfo.authors?.join(', ') || 'Автор неизвестен'}
                        </div>
                        {gb.volumeInfo.pageCount && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                            {gb.volumeInfo.pageCount} стр.
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Cover preview if from Google Books */}
          {coverUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
              padding: '10px 12px', background: 'var(--bg-card)', borderRadius: 12,
              border: '1px solid var(--border)',
            }}>
              <img src={coverUrl} alt="Обложка" style={{ width: 48, height: 64, objectFit: 'cover', borderRadius: 6 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>Обложка из Google Books</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Нажмите ✕ чтобы удалить</div>
              </div>
              <button onClick={() => setCoverUrl('')} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4,
              }}>
                <X size={14} />
              </button>
            </div>
          )}

          {/* Title */}
          <div style={{ marginBottom: 12 }}>
            <Label>Название *</Label>
            <Input value={title} onChange={setTitle} placeholder="Название книги" />
          </div>

          {/* Author */}
          <div style={{ marginBottom: 12 }}>
            <Label>Автор</Label>
            <Input value={author} onChange={setAuthor} placeholder="Автор" />
          </div>

          {/* Genre */}
          <div style={{ marginBottom: 12 }}>
            <Label>Жанр</Label>
            <Input value={genre} onChange={setGenre} placeholder="Психология, философия..." />
          </div>

          {/* Status */}
          <div style={{ marginBottom: 12 }}>
            <Label>Статус</Label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STATUS_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => { vibe(6); setStatus(opt.value); }} style={{
                  padding: '7px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 13,
                  background: status === opt.value ? 'var(--accent)' : 'var(--bg-card)',
                  border: `1px solid ${status === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                  color: status === opt.value ? '#fff' : 'var(--text-secondary)',
                  fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
                }}>
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pages */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <Label>Всего страниц</Label>
              <Input value={totalPages} onChange={setTotalPages} placeholder="300" type="number" />
            </div>
            <div>
              <Label>Текущая страница</Label>
              <Input value={currentPage} onChange={setCurrentPage} placeholder="0" type="number" />
            </div>
          </div>

          {/* Rating */}
          <div style={{ marginBottom: 12 }}>
            <Label>Оценка</Label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[1,2,3,4,5].map(r => (
                <button key={r} onClick={() => { vibe(6); setRating(r === rating ? 0 : r); }} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 24, padding: '2px 4px',
                  filter: r <= rating ? 'none' : 'grayscale(1) opacity(0.3)',
                  transition: 'all 0.15s',
                }}>⭐</button>
              ))}
            </div>
          </div>

          {/* Emoji — only if no cover URL */}
          {!coverUrl && (
            <div style={{ marginBottom: 12 }}>
              <Label>Эмодзи обложки</Label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => { vibe(4); setEmoji(e); }} style={{
                    width: 36, height: 36, borderRadius: 8, cursor: 'pointer', fontSize: 18,
                    background: emoji === e ? 'var(--accent)' : 'var(--bg-card)',
                    border: `1px solid ${emoji === e ? 'var(--accent)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Color — only if no cover URL */}
          {!coverUrl && (
            <div style={{ marginBottom: 12 }}>
              <Label>Цвет обложки</Label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {COVER_COLORS.map(c => (
                  <button key={c} onClick={() => { vibe(4); setColor(c); }} style={{
                    width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
                    background: c,
                    border: color === c ? '2px solid var(--accent)' : '2px solid transparent',
                    outline: color === c ? '2px solid var(--accent)' : 'none',
                    outlineOffset: 2, transition: 'all 0.15s',
                  }} />
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div style={{ marginBottom: 16 }}>
            <Label>Описание / Заметки</Label>
            <textarea
              value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Краткое описание или личные заметки о книге..."
              rows={3}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: 14, outline: 'none',
                fontFamily: 'Inter, sans-serif', resize: 'none', boxSizing: 'border-box',
                lineHeight: 1.6,
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            {book && onDelete && (
              <button onClick={() => { vibe(15); if (confirm('Удалить книгу?')) onDelete(book.id); }} style={{
                width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                background: 'rgba(220,80,80,0.12)', border: '1px solid rgba(220,80,80,0.3)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#dc5050',
              }}>
                <Trash2 size={18} />
              </button>
            )}
            <button onClick={handleSave} disabled={!title.trim()} style={{
              flex: 1, padding: '14px', borderRadius: 12,
              background: title.trim()
                ? 'linear-gradient(135deg, var(--accent), var(--accent-dark))'
                : 'var(--bg-card)',
              border: 'none', color: title.trim() ? '#fff' : 'var(--text-muted)',
              fontSize: 15, fontWeight: 600, cursor: title.trim() ? 'pointer' : 'not-allowed',
              fontFamily: 'Inter, sans-serif', transition: 'all 0.2s',
            }}>
              {book ? 'Сохранить изменения' : 'Добавить книгу'}
            </button>
          </div>

          <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
        </div>
      </div>
    </div>
  );
}
