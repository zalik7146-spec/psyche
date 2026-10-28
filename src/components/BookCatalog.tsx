import { useEffect, useState } from 'react'
import { ArrowUpRight, BookOpen, Check, LoaderCircle, Plus, Search, X } from 'lucide-react'
import type { Book } from '../types'
import { searchBooks, type BookSearchResult } from '../booksApi'

interface ReaderBook {
  id: string
  title: string
  author: string
  textUrl: string
  coverUrl?: string
  source: string
}

interface Props {
  onClose: () => void
  onAddToLibrary: (book: Partial<Book>) => void
  onOpenReader: (book: ReaderBook) => void
  existingBooks: Book[]
}

const TOPICS = [
  { label: 'Психология', query: 'psychology' },
  { label: 'Философия', query: 'philosophy' },
  { label: 'Классика', query: 'classic literature' },
  { label: 'Наука', query: 'science' },
  { label: 'История', query: 'history' },
  { label: 'Саморазвитие', query: 'self improvement' },
]

export default function BookCatalog({ onClose, onAddToLibrary, onOpenReader, existingBooks }: Props) {
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('psychology')
  const [reloadKey, setReloadKey] = useState(0)
  const [books, setBooks] = useState<BookSearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [failedSources, setFailedSources] = useState<string[]>([])
  const [addedIds, setAddedIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setFailedSources([])
    searchBooks(submittedQuery, controller.signal).then(result => {
      if (controller.signal.aborted) return
      setBooks(result.books)
      setFailedSources(result.failedSources)
    }).catch(() => {
      if (!controller.signal.aborted) {
        setBooks([])
        setFailedSources(['Google Books', 'Open Library', 'Project Gutenberg'])
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [submittedQuery, reloadKey])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const libraryBookFor = (book: BookSearchResult) => existingBooks.find(existing =>
    existing.title.localeCompare(book.title, undefined, { sensitivity: 'accent' }) === 0
  )

  const submitSearch = (value = query) => {
    const next = value.trim()
    if (next) setSubmittedQuery(next)
  }

  const addToLibrary = (book: BookSearchResult) => {
    const existing = libraryBookFor(book)
    if (existing) return
    onAddToLibrary({
      id: book.gutenbergId ? `gutenberg_${book.gutenbergId}` : undefined,
      title: book.title,
      author: book.author,
      genre: book.genre,
      description: book.description,
      coverUrl: book.coverUrl,
      coverEmoji: '📚',
      color: '#3d2a1a',
      status: 'want',
      totalPages: book.pages,
      currentPage: 0,
      tags: [],
    })
    setAddedIds(current => new Set(current).add(book.id))
  }

  const openReader = (book: BookSearchResult) => {
    if (!book.textUrl) return
    const savedBook = libraryBookFor(book)
    onOpenReader({
      id: savedBook?.id || (book.gutenbergId ? `gutenberg_${book.gutenbergId}` : book.id),
      title: book.title,
      author: book.author,
      textUrl: book.textUrl,
      coverUrl: book.coverUrl,
      source: book.source,
    })
  }

  const label: React.CSSProperties = { fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }
  const quiet: React.CSSProperties = { fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 16, color: 'var(--text-muted)', margin: 0 }

  return (
    <div role="dialog" aria-label="Каталог книг" className="view-push" style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
      <header style={{ paddingTop: 'env(safe-area-inset-top)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', minHeight: 56, padding: '0 8px 0 4px' }}>
          <button aria-label="Закрыть каталог" onClick={onClose} style={{ width: 44, height: 44, display: 'grid', placeItems: 'center', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}><X size={20} strokeWidth={1.5} /></button>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 24 }}>Каталог</h2>
          </div>
        </div>
        <form onSubmit={event => { event.preventDefault(); submitSearch() }} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 20px', height: 48, borderBottom: '1px solid var(--text-primary)' }}>
          <Search size={17} strokeWidth={1.5} color="var(--text-muted)" />
          <input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Название, автор или тема" aria-label="Поиск книг" style={{ flex: 1, minWidth: 0, color: 'var(--text-primary)', background: 'transparent', border: 0, outline: 0, fontSize: 15, fontFamily: 'var(--font-ui)' }} />
          <button type="submit" disabled={!query.trim()} style={{ border: 0, height: 34, padding: '0 14px', background: query.trim() ? 'var(--accent)' : 'var(--bg-active)', color: query.trim() ? 'var(--on-accent)' : 'var(--text-muted)', fontSize: 13, fontWeight: 500, cursor: query.trim() ? 'pointer' : 'default' }}>Найти</button>
        </form>
        <div style={{ display: 'flex', gap: 18, overflowX: 'auto', padding: '0 20px', scrollbarWidth: 'none' }}>
          {TOPICS.map(topic => {
            const on = submittedQuery === topic.query
            return (
              <button key={topic.query} aria-pressed={on} onClick={() => { setQuery(topic.label); submitSearch(topic.query) }}
                style={{ flexShrink: 0, height: 44, background: 'none', border: 'none', borderBottom: on ? '1px solid var(--text-primary)' : '1px solid transparent', marginBottom: -1, color: on ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-ui)', transition: 'color var(--dur-quick) var(--ease-calm)' }}>
                {topic.label}
              </button>
            )
          })}
        </div>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', padding: '14px 20px calc(24px + env(safe-area-inset-bottom))' }}>
        <p style={{ ...label, margin: '0 0 6px', lineHeight: 1.6 }}>Google Books · Open Library · Project Gutenberg</p>
        {loading && (
          <div style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-muted)' }}>
            <LoaderCircle size={16} strokeWidth={1.5} className="spinner" /> <span style={label}>Ищем книги</span>
          </div>
        )}
        {!loading && failedSources.length > 0 && (
          <p role="status" style={{ margin: '8px 0', padding: '10px 0', borderTop: '1px dashed var(--border)', borderBottom: '1px dashed var(--border)', color: 'var(--text-muted)', fontSize: 13 }}>
            Не ответили: {failedSources.join(', ')}. Показаны результаты остальных источников.
          </p>
        )}
        {!loading && books.length === 0 && (
          <div style={{ padding: '36px 0', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
            <p style={quiet}>{failedSources.length === 3 ? 'Каталоги сейчас недоступны. Проверьте подключение.' : `По запросу «${submittedQuery}» ничего не найдено.`}</p>
            <button onClick={() => setReloadKey(value => value + 1)} style={{ border: 0, height: 40, padding: '0 16px', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 13, cursor: 'pointer' }}>Повторить поиск</button>
          </div>
        )}
        {!loading && books.length > 0 && <div style={{ display: 'flex', flexDirection: 'column' }}>
          {books.map(book => {
            const existing = libraryBookFor(book)
            const added = addedIds.has(book.id)
            const inLibrary = !!existing || added
            return <article key={book.id} className="view-enter" style={{ display: 'flex', gap: 16, padding: '18px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 64, height: 92, flexShrink: 0, overflow: 'hidden', display: 'grid', placeItems: 'center', border: '1px solid var(--text-primary)', background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
                {book.coverUrl ? <img src={book.coverUrl} alt={`Обложка «${book.title}»`} loading="lazy" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <BookOpen size={22} strokeWidth={1.25} />}
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 18, lineHeight: 1.25 }}>{book.title}</h3>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{book.author}{book.year ? ` · ${book.year}` : ''}{book.pages ? ` · ${book.pages} стр.` : ''}</span>
                <span style={{ ...label, letterSpacing: '0.08em', marginTop: 2 }}>{book.source}{book.textUrl ? ' · полный текст' : ''}</span>
                {book.description && <p style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>{book.description}</p>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  {book.textUrl
                    ? <button onClick={() => openReader(book)} style={{ height: 36, padding: '0 14px', border: 0, background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Читать</button>
                    : book.sourceUrl && <a href={book.sourceUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 36, padding: '0 12px', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13, textDecoration: 'none', boxSizing: 'border-box' }}>Подробнее <ArrowUpRight size={13} strokeWidth={1.5} /></a>}
                  <button onClick={() => addToLibrary(book)} disabled={inLibrary}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 12px', border: '1px solid var(--border)', background: 'none', color: inLibrary ? 'var(--text-muted)' : 'var(--text-primary)', fontSize: 13, cursor: inLibrary ? 'default' : 'pointer' }}>
                    {inLibrary ? <><Check size={14} strokeWidth={1.5} /> На полке</> : <><Plus size={14} strokeWidth={1.5} /> На полку</>}
                  </button>
                </div>
              </div>
            </article>
          })}
        </div>}
      </main>
    </div>
  )
}
