import { useState } from 'react'
import { Book } from '../types'
import BookModal from './BookModal'

interface Props {
  books: Book[]
  notes: any[]
  onSave: (book: Book) => void
  onDelete: (id: string) => void
  onOpenCatalog: () => void
  onOpenReader: (book: any) => void
}



export default function Library({ books, notes, onSave, onDelete, onOpenCatalog, onOpenReader }: Props) {
  const [filter, setFilter] = useState<string>('all')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [showModal, setShowModal] = useState(false)
  const [editBook, setEditBook] = useState<Book | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [showGoal, setShowGoal] = useState(false)
  const [goal, setGoal] = useState(() => parseInt(localStorage.getItem('reading_goal') || '12'))
  const [goalInput, setGoalInput] = useState(goal.toString())
  const vibe = (ms = 8) => navigator.vibrate?.(ms)

  const filtered = books.filter(b => {
    const matchStatus = filter === 'all' || b.status === filter
    const matchSearch = !search || b.title.toLowerCase().includes(search.toLowerCase()) || b.author.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const doneCount = books.filter(b => b.status === ('done' as any)).length
  const progress = Math.min(100, Math.round((doneCount / goal) * 100))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 8px', background: 'var(--bg-base)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontFamily: 'Lora,serif', fontSize: 22, color: 'var(--text-primary)', margin: 0 }}>Библиотека</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { vibe(); onOpenCatalog() }} style={{ background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '8px 12px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>📚 Каталог</button>
            <button onClick={() => { vibe(); setEditBook(undefined); setShowModal(true) }} style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer' }}>+ Книга</button>
          </div>
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Поиск книг..."
          style={{ width: '100%', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
        />

        {/* Reading goal */}
        <button onClick={() => { vibe(); setShowGoal(true) }} style={{ width: '100%', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>🎯 Цель: {doneCount} из {goal} книг</span>
            <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>{progress}%</span>
          </div>
          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), #d4a96a)', borderRadius: 2, transition: 'width 0.5s' }} />
          </div>
        </button>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto', paddingBottom: 2 }}>
          {[['all', '📚 Все'], ['reading', '📖 Читаю'], ['done', '✅ Прочитано'], ['want', '🔖 Хочу'], ['paused', '⏸ Пауза']].map(([id, label]) => (
            <button key={id} onClick={() => { vibe(); setFilter(id) }} style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 20, border: 'none', background: filter === id ? 'var(--accent)' : 'var(--bg-raised)', color: filter === id ? '#fff' : 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
              {label}
            </button>
          ))}
          <button onClick={() => { vibe(); setView(v => v === 'grid' ? 'list' : 'grid') }} style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--bg-raised)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
            {view === 'grid' ? '☰' : '⊞'}
          </button>
        </div>
      </div>

      {/* Books */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
            <div style={{ fontSize: 16, marginBottom: 8, color: 'var(--text-secondary)' }}>Книг нет</div>
            <div style={{ fontSize: 13 }}>Добавь книгу или найди в каталоге</div>
          </div>
        ) : view === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {filtered.map((book, i) => (
              <BookCard key={book.id} book={book} notes={notes} index={i} onEdit={() => { setEditBook(book); setShowModal(true) }} onRead={() => onOpenReader(book)} vibe={vibe} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((book, i) => (
              <BookListItem key={book.id} book={book} notes={notes} index={i} onEdit={() => { setEditBook(book); setShowModal(true) }} onRead={() => onOpenReader(book)} vibe={vibe} />
            ))}
          </div>
        )}
      </div>

      {/* Goal Modal */}
      {showGoal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowGoal(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 430 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'Lora,serif', fontSize: 20, color: 'var(--text-primary)', marginBottom: 16 }}>🎯 Цель чтения</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>Сколько книг хочешь прочитать в этом году?</p>
            <input
              type="number"
              value={goalInput}
              onChange={e => setGoalInput(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', color: 'var(--text-primary)', fontSize: 18, textAlign: 'center', boxSizing: 'border-box', outline: 'none', marginBottom: 16 }}
            />
            <button onClick={() => { const v = Math.max(1, parseInt(goalInput) || 12); setGoal(v); localStorage.setItem('reading_goal', v.toString()); setShowGoal(false); vibe(12) }} style={{ width: '100%', background: 'var(--accent)', border: 'none', borderRadius: 12, padding: 16, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
              Сохранить
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <BookModal
          book={editBook}
          onSave={(b) => { onSave(b as Book); setShowModal(false) }}
          onDelete={editBook ? () => { onDelete(editBook.id); setShowModal(false) } : undefined}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}

function BookCard({ book, notes, index, onEdit, onRead, vibe }: any) {
  const noteCount = notes.filter((n: any) => n.bookId === book.id).length
  const progress = book.totalPages && book.currentPage ? Math.round((book.currentPage / book.totalPages) * 100) : 0

  return (
    <div
      onClick={() => { vibe(); onEdit() }}
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', animation: `fadeSlideUp 0.4s ease both`, animationDelay: `${index * 0.05}s`, transition: 'transform 0.15s' }}
      onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
      onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {/* Cover */}
      <div style={{ height: 120, background: book.coverUrl ? `url(${book.coverUrl}) center/cover` : `linear-gradient(135deg, ${book.color}33, ${book.color}66)`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {!book.coverUrl && <span style={{ fontSize: 40 }}>{book.coverEmoji || '📚'}</span>}
        <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: '3px 8px', fontSize: 11, color: '#fff' }}>
          {noteCount} заметок
        </div>
        {book.status === 'reading' && (
          <button onClick={e => { e.stopPropagation(); vibe(12); onRead() }} style={{ position: 'absolute', bottom: 8, right: 8, background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '5px 10px', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            📖 Читать
          </button>
        )}
      </div>
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3, fontFamily: 'Lora,serif', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{book.title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.author}</div>
        {progress > 0 && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ height: 3, background: 'var(--border)', borderRadius: 2 }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{progress}% прочитано</div>
          </div>
        )}
        {book.rating && <div style={{ fontSize: 12, color: '#f59e0b' }}>{'★'.repeat(book.rating)}{'☆'.repeat(5 - book.rating)}</div>}
      </div>
    </div>
  )
}

function BookListItem({ book, notes, index, onEdit, onRead, vibe }: any) {
  const noteCount = notes.filter((n: any) => n.bookId === book.id).length
  return (
    <div
      onClick={() => { vibe(); onEdit() }}
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px', display: 'flex', gap: 12, cursor: 'pointer', animation: `fadeSlideUp 0.4s ease both`, animationDelay: `${index * 0.05}s` }}
      onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.98)')}
      onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      <div style={{ width: 56, height: 72, borderRadius: 8, background: book.coverUrl ? `url(${book.coverUrl}) center/cover` : `linear-gradient(135deg, ${book.color}33, ${book.color}66)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {!book.coverUrl && <span style={{ fontSize: 24 }}>{book.coverEmoji || '📚'}</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Lora,serif', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{book.author}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{noteCount} заметок</span>
          {book.rating && <span style={{ fontSize: 11, color: '#f59e0b' }}>{'★'.repeat(book.rating)}</span>}
        </div>
      </div>
      {book.status === 'reading' && (
        <button onClick={e => { e.stopPropagation(); vibe(12); onRead() }} style={{ background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '8px 12px', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
          📖
        </button>
      )}
    </div>
  )
}
