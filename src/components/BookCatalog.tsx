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

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16,
}

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
      color: 'var(--on-accent)',
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

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
      <header style={{ padding: 'calc(14px + env(safe-area-inset-top)) 18px 16px', background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button aria-label="Закрыть каталог" onClick={onClose} style={{ width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer' }}><X size={18} /></button>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', font: '700 20px var(--font-serif)' }}>Каталог книг</h2>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 3 }}>Google Books · Open Library · Project Gutenberg</div>
          </div>
        </div>
        <form onSubmit={event => { event.preventDefault(); submitSearch() }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14 }}>
          <Search size={17} color="var(--text-muted)" />
          <input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Название, автор или тема" aria-label="Поиск книг" style={{ flex: 1, minWidth: 0, padding: '13px 0', color: 'var(--text-primary)', background: 'transparent', border: 0, outline: 0, fontSize: 15 }} />
          <button type="submit" disabled={!query.trim()} style={{ border: 0, borderRadius: 10, padding: '8px 12px', background: 'var(--accent)', color: 'var(--on-accent)', fontWeight: 600, cursor: 'pointer', opacity: query.trim() ? 1 : .5 }}>Найти</button>
        </form>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 12, scrollbarWidth: 'none' }}>
          {TOPICS.map(topic => <button key={topic.query} onClick={() => { setQuery(topic.label); submitSearch(topic.query) }} style={{ flexShrink: 0, border: '1px solid var(--border)', borderRadius: 20, padding: '7px 12px', background: submittedQuery === topic.query ? 'var(--accent)' : 'var(--bg-card)', color: submittedQuery === topic.query ? '#fff' : 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>{topic.label}</button>)}
        </div>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', padding: '16px 18px calc(24px + env(safe-area-inset-bottom))' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12 }}>Полные тексты отмечены отдельно. Каталог показывает сведения о книгах даже когда открытого текста нет.</div>
        {loading && <div style={{ ...cardStyle, minHeight: 180, display: 'grid', placeItems: 'center', color: 'var(--text-secondary)' }}><span><LoaderCircle size={18} className="spinner" style={{ verticalAlign: 'middle', marginRight: 8 }} />Ищем книги…</span></div>}
        {!loading && failedSources.length > 0 && <div role="status" style={{ ...cardStyle, padding: 14, marginBottom: 12, color: 'var(--text-secondary)', fontSize: 13 }}>Не ответили источники: {failedSources.join(', ')}. Показаны результаты доступных источников.</div>}
        {!loading && books.length === 0 && <div style={{ ...cardStyle, padding: '38px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}><div style={{ fontSize: 34, marginBottom: 10 }}>📚</div>{failedSources.length === 3 ? 'Каталоги сейчас недоступны. Проверьте подключение и повторите поиск.' : `По запросу «${submittedQuery}» ничего не найдено.`}<div><button onClick={() => setReloadKey(value => value + 1)} style={{ marginTop: 14, border: 0, borderRadius: 10, padding: '9px 14px', background: 'var(--accent)', color: 'var(--on-accent)', cursor: 'pointer' }}>Повторить поиск</button></div></div>}
        {!loading && books.length > 0 && <div style={{ display: 'grid', gap: 12 }}>
          {books.map(book => {
            const existing = libraryBookFor(book)
            const added = addedIds.has(book.id)
            return <article key={book.id} style={{ ...cardStyle, display: 'flex', gap: 14, padding: 14 }}>
              <div style={{ width: 70, height: 98, flexShrink: 0, overflow: 'hidden', display: 'grid', placeItems: 'center', borderRadius: 9, background: 'var(--bg-raised)', color: 'var(--text-muted)' }}>
                {book.coverUrl ? <img src={book.coverUrl} alt={`Обложка «${book.title}»`} loading="lazy" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <BookOpen size={26} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: '0 0 4px', color: 'var(--text-primary)', font: '700 15px/1.35 var(--font-serif)' }}>{book.title}</h3>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{book.author}{book.year ? ` · ${book.year}` : ''}{book.pages ? ` · ${book.pages} стр.` : ''}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  <span style={{ padding: '3px 8px', borderRadius: 20, background: 'var(--bg-raised)', color: 'var(--text-muted)', fontSize: 10 }}>{book.source}</span>
                  {book.textUrl && <span style={{ padding: '3px 8px', borderRadius: 20, background: 'rgba(90,138,106,.17)', color: '#76b58d', fontSize: 10 }}>Полный текст · свободный доступ</span>}
                </div>
                {book.description && <p style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: '8px 0 10px', color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.45 }}>{book.description}</p>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  {book.textUrl ? <button onClick={() => openReader(book)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 0, borderRadius: 10, padding: '8px 11px', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}><BookOpen size={14} /> Читать</button> : book.sourceUrl && <a href={book.sourceUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid var(--border)', borderRadius: 10, padding: '7px 10px', color: 'var(--text-secondary)', fontSize: 12, textDecoration: 'none' }}>Подробнее <ArrowUpRight size={13} /></a>}
                  <button onClick={() => addToLibrary(book)} disabled={!!existing || added} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: 10, padding: '7px 10px', background: 'var(--bg-raised)', color: existing || added ? 'var(--text-muted)' : 'var(--text-primary)', fontSize: 12, cursor: existing || added ? 'default' : 'pointer' }}>{existing || added ? <><Check size={14} /> В библиотеке</> : <><Plus size={14} /> Добавить</>}</button>
                </div>
              </div>
            </article>
          })}
        </div>}
      </main>
    </div>
  )
}
