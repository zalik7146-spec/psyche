import { useState } from 'react';
import { X, Trash2, Check } from 'lucide-react';
import { Book, BookStatus } from '../types';

interface Props {
  book?: Book;
  onSave: (data: Partial<Book>) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
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

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      title:       title.trim(),
      author:      author.trim(),
      genre:       genre.trim() || undefined,
      description: desc.trim() || undefined,
      status,
      color,
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>

        {/* Handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 99,
          background: 'var(--border-mid)', margin: '-8px auto 18px',
        }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 className="font-serif" style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {book ? 'Редактировать книгу' : 'Добавить книгу'}
          </h2>
          <button onClick={onClose}
            style={{
              width: 36, height: 36, borderRadius: '10px',
              background: 'var(--bg-active)', border: 'none',
              color: 'var(--text-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Cover preview + emoji/color */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '18px', alignItems: 'flex-start' }}>
          <div style={{
            width: 64, height: 84, borderRadius: '12px',
            background: color, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
          }}>
            {emoji}
          </div>
          <div style={{ flex: 1 }}>
            {/* Emoji picker */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setEmoji(e)}
                  style={{
                    width: 32, height: 32, borderRadius: '8px', fontSize: '16px',
                    background: emoji === e ? 'var(--bg-active)' : 'var(--bg-raised)',
                    border: `1px solid ${emoji === e ? 'var(--accent-dim)' : 'var(--border)'}`,
                    cursor: 'pointer',
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
            {/* Color picker */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {COVER_COLORS.map(c => (
                <div key={c} className={`color-dot${color === c ? ' selected' : ''}`}
                  style={{ background: c }} onClick={() => setColor(c)} />
              ))}
            </div>
          </div>
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <Label>Название *</Label>
            <input className="input-base" placeholder="Название книги" value={title}
              onChange={e => setTitle(e.target.value)} />
          </div>

          <div>
            <Label>Автор</Label>
            <input className="input-base" placeholder="Имя автора" value={author}
              onChange={e => setAuthor(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <Label>Жанр</Label>
              <input className="input-base" placeholder="Психология…" value={genre}
                onChange={e => setGenre(e.target.value)} />
            </div>
          </div>

          {/* Status */}
          <div>
            <Label>Статус</Label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {STATUS_OPTIONS.map(s => (
                <button key={s.value} onClick={() => setStatus(s.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '7px 12px', borderRadius: '10px',
                    background: status === s.value ? 'var(--bg-active)' : 'var(--bg-raised)',
                    border: `1px solid ${status === s.value ? 'var(--accent-dim)' : 'var(--border)'}`,
                    color: status === s.value ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor: 'pointer', fontSize: '12px', fontFamily: 'Inter, sans-serif',
                    fontWeight: status === s.value ? 600 : 400,
                  }}
                >
                  {status === s.value && <Check size={11} />}
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pages */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <Label>Всего страниц</Label>
              <input className="input-base" type="number" placeholder="320"
                value={totalPages} onChange={e => setTotalPages(e.target.value)} />
            </div>
            {status === 'reading' && (
              <div style={{ flex: 1 }}>
                <Label>Текущая стр.</Label>
                <input className="input-base" type="number" placeholder="0"
                  value={currentPage} onChange={e => setCurrentPage(e.target.value)} />
              </div>
            )}
          </div>

          {/* Rating */}
          <div>
            <Label>Рейтинг</Label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[1,2,3,4,5].map(i => (
                <button key={i} onClick={() => setRating(i === rating ? 0 : i)}
                  style={{
                    fontSize: '22px', background: 'none', border: 'none',
                    cursor: 'pointer', color: i <= rating ? '#c4813c' : 'var(--border-mid)',
                    padding: '2px',
                  }}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <Label>Описание / заметки</Label>
            <textarea className="input-base"
              style={{ resize: 'none', height: '80px' }}
              placeholder="Краткое описание или личные заметки…"
              value={desc} onChange={e => setDesc(e.target.value)}
            />
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          {book && onDelete && (
            <button onClick={() => onDelete(book.id)}
              style={{
                width: 44, height: 44, borderRadius: '12px', flexShrink: 0,
                background: 'rgba(196,72,72,0.1)', border: '1px solid rgba(196,72,72,0.25)',
                color: 'var(--red)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Trash2 size={18} />
            </button>
          )}
          <button onClick={onClose}
            style={{
              flex: 1, padding: '14px',
              borderRadius: '14px', border: '1px solid var(--border)',
              background: 'var(--bg-raised)', color: 'var(--text-secondary)',
              fontFamily: 'Inter, sans-serif', fontSize: '14px',
              fontWeight: 500, cursor: 'pointer',
            }}
          >
            Отмена
          </button>
          <button onClick={handleSave}
            disabled={!title.trim()}
            style={{
              flex: 2, padding: '14px',
              borderRadius: '14px', border: 'none',
              background: title.trim()
                ? 'linear-gradient(135deg, var(--accent), var(--accent-soft))'
                : 'var(--bg-active)',
              color: title.trim() ? '#0e0c09' : 'var(--text-muted)',
              fontFamily: 'Inter, sans-serif', fontSize: '14px',
              fontWeight: 700, cursor: title.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            {book ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      </div>
    </div>
  );
}
