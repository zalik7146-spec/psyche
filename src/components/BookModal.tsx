import { useState } from 'react'
import { X, Star, Trash2 } from 'lucide-react'
import { Book, BookStatus } from '../types'

interface Props {
  book?: Book
  onSave: (book: Partial<Book>) => void
  onDelete?: () => void
  onClose: () => void
}

const STATUS = [
  { value: 'reading', label: '📖 Читаю' },
  { value: 'done', label: '✅ Прочитано' },
  { value: 'want', label: '🎯 Хочу' },
  { value: 'paused', label: '⏸️ Пауза' }
]

const vibe = (ms?: number) => navigator.vibrate?.(ms ?? 8)

export default function BookModal({ book, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(book?.title || '')
  const [author, setAuthor] = useState(book?.author || '')
  const [genre, setGenre] = useState(book?.genre || '')
  const [status, setStatus] = useState<BookStatus>(book?.status || 'want')
  const [color] = useState(book?.color || '#b07d4a')
  const [emoji] = useState(book?.coverEmoji || '📚')
  const [rating, setRating] = useState(book?.rating || 0)
  const [totalPages, setTotalPages] = useState(book?.totalPages?.toString() || '')
  const [currentPage, setCurrentPage] = useState(book?.currentPage?.toString() || '')
  const [description, setDescription] = useState(book?.description || '')
  const [coverUrl, setCoverUrl] = useState(book?.coverUrl || '')

  const handleSave = () => {
    if (!title.trim()) return
    vibe(10)
    onSave({
      title: title.trim(),
      author: author.trim(),
      genre: genre.trim(),
      status: status as Book['status'],
      color,
      coverEmoji: emoji,
      rating,
      totalPages: parseInt(totalPages) || undefined,
      currentPage: parseInt(currentPage) || 0,
      description: description.trim(),
      coverUrl
    })
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 300
    }} onClick={onClose}>
      <div style={{
        width: '100%', maxWidth: 430,
        background: 'var(--bg-raised)',
        borderRadius: 0,
        maxHeight: '92vh', overflowY: 'auto',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }} onClick={e => e.stopPropagation()}>

        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 16px' }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>
            {book ? 'Редактировать книгу' : 'Добавить книгу'}
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-primary)'
          }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Cover preview */}
          {coverUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src={coverUrl} alt='cover' style={{
                width: 60, height: 84, objectFit: 'cover', borderRadius: 0,
                border: '1px solid var(--border)'
              }} onError={() => setCoverUrl('')} />
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Обложка найдена</div>
                <button onClick={() => setCoverUrl('')} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--accent)', fontSize: 12
                }}>Убрать</button>
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>НАЗВАНИЕ *</div>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder='Название книги'
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 0,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: 15, outline: 'none',
                boxSizing: 'border-box'
              }} />
          </div>

          {/* Author */}
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>АВТОР</div>
            <input value={author} onChange={e => setAuthor(e.target.value)}
              placeholder='Автор книги'
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 0,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: 15, outline: 'none',
                boxSizing: 'border-box'
              }} />
          </div>

          {/* Genre */}
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>ЖАНР</div>
            <input value={genre} onChange={e => setGenre(e.target.value)}
              placeholder='Психология, философия...'
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 0,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: 15, outline: 'none',
                boxSizing: 'border-box'
              }} />
          </div>

          {/* Status */}
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>СТАТУС</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {STATUS.map(s => (
                <button key={s.value} onClick={() => setStatus(s.value as BookStatus)} style={{
                  padding: '10px', borderRadius: 0, cursor: 'pointer',
                  background: status === s.value ? 'var(--accent)' : 'var(--bg-card)',
                  border: `1px solid ${status === s.value ? 'var(--accent)' : 'var(--border)'}`,
                  color: status === s.value ? '#fff' : 'var(--text-primary)',
                  fontSize: 13, fontWeight: status === s.value ? 600 : 400,
                  transition: 'all 0.2s'
                }}>{s.label}</button>
              ))}
            </div>
          </div>

          {/* Pages */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>СТРАНИЦ</div>
              <input type='number' value={totalPages} onChange={e => setTotalPages(e.target.value)}
                placeholder='300'
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 0,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: 15, outline: 'none',
                  boxSizing: 'border-box'
                }} />
            </div>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>ТЕКУЩАЯ</div>
              <input type='number' value={currentPage} onChange={e => setCurrentPage(e.target.value)}
                placeholder='0'
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 0,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: 15, outline: 'none',
                  boxSizing: 'border-box'
                }} />
            </div>
          </div>

          {/* Rating */}
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>РЕЙТИНГ</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setRating(n === rating ? 0 : n)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                  transition: 'transform 0.15s'
                }}>
                  <Star size={26} strokeWidth={1.5} fill={n <= rating ? 'var(--text-primary)' : 'none'}
                    color={n <= rating ? 'var(--text-primary)' : 'var(--text-muted)'} />
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>ОПИСАНИЕ</div>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder='Краткое описание книги...'
              rows={3}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 0,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: 14, outline: 'none',
                resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                lineHeight: 1.6
              }} />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            {book && onDelete && (
              <button onClick={() => { vibe(15); onDelete() }} style={{
                width: 48, height: 48, borderRadius: 0, flexShrink: 0,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--red)'
              }}>
                <Trash2 size={18} />
              </button>
            )}
            <button onClick={handleSave} disabled={!title.trim()} style={{
              flex: 1, padding: '14px', borderRadius: 0, cursor: 'pointer',
              background: title.trim()
                ? 'var(--accent)'
                : 'var(--bg-card)',
              border: 'none',
              color: title.trim() ? 'var(--on-accent)' : 'var(--text-muted)',
              fontSize: 15, fontWeight: 500, transition: 'all 0.2s'
            }}>
              {book ? 'Сохранить' : 'Добавить книгу'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
