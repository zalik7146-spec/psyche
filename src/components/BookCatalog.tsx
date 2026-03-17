import { useState, useEffect, useCallback } from 'react'

interface GutenbergBook {
  id: number
  title: string
  authors: { name: string }[]
  formats: Record<string, string>
  download_count: number
  subjects: string[]
}

interface CatalogBook {
  id: string
  title: string
  author: string
  cover: string
  year: string
  description: string
  textUrl: string
  source: 'gutenberg' | 'openlibrary'
  downloads?: number
}

interface Props {
  onClose: () => void
  onRead: (book: CatalogBook) => void
  onAddToLibrary: (book: any) => void
}

const CATEGORIES = [
  { id: 'psychology', label: '🧠 Психология', query: 'psychology mind' },
  { id: 'philosophy', label: '💭 Философия', query: 'philosophy stoicism' },
  { id: 'fiction', label: '📖 Классика', query: 'dostoevsky tolstoy chekhov' },
  { id: 'science', label: '🔬 Наука', query: 'science evolution darwin' },
  { id: 'history', label: '🏛️ История', query: 'history civilization' },
  { id: 'poetry', label: '✍️ Поэзия', query: 'poetry poems' },
  { id: 'medicine', label: '⚕️ Медицина', query: 'medicine health' },
  { id: 'self', label: '🌱 Саморазвитие', query: 'self improvement success' },
]

function mapGutenberg(book: GutenbergBook): CatalogBook {
  const textUrl = book.formats['text/html'] || book.formats['text/plain; charset=utf-8'] || book.formats['text/plain'] || ''
  const cover = book.formats['image/jpeg'] || ''
  return {
    id: `gutenberg_${book.id}`,
    title: book.title,
    author: book.authors.map(a => a.name).join(', '),
    cover,
    year: '',
    description: book.subjects.slice(0, 3).join(', '),
    textUrl,
    source: 'gutenberg',
    downloads: book.download_count,
  }
}

export default function BookCatalog({ onClose, onRead, onAddToLibrary }: Props) {
  const [query, setQuery] = useState('')
  const [books, setBooks] = useState<CatalogBook[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeCategory, setActiveCategory] = useState('psychology')
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const vibe = (ms = 8) => navigator.vibrate?.(ms)

  const searchGutenberg = useCallback(async (q: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`https://gutendex.com/books/?search=${encodeURIComponent(q)}&mime_type=text&page_size=20`)
      if (!res.ok) throw new Error('Ошибка загрузки')
      const data = await res.json()
      const mapped = (data.results || []).map(mapGutenberg).filter((b: CatalogBook) => b.textUrl)
      setBooks(mapped)
      if (mapped.length === 0) setError('Книги не найдены. Попробуй другой запрос.')
    } catch {
      setError('Ошибка подключения к каталогу')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const cat = CATEGORIES.find(c => c.id === activeCategory)
    if (cat) searchGutenberg(cat.query)
  }, [activeCategory, searchGutenberg])

  useEffect(() => {
    if (!query) return
    const t = setTimeout(() => searchGutenberg(query), 600)
    return () => clearTimeout(t)
  }, [query, searchGutenberg])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-base)', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '52px 16px 12px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <button onClick={() => { vibe(); onClose() }} style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 10, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 18, color: 'var(--text-primary)', flexShrink: 0 }}>←</button>
          <h2 style={{ fontFamily: 'Lora,serif', fontSize: 22, color: 'var(--text-primary)', margin: 0, flex: 1 }}>📚 Каталог книг</h2>
        </div>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="🔍 Поиск по названию или автору..."
          style={{ width: '100%', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', color: 'var(--text-primary)', fontSize: 15, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
        />
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => { vibe(); setQuery(''); setActiveCategory(cat.id) }} style={{ flexShrink: 0, padding: '7px 14px', borderRadius: 20, border: 'none', background: activeCategory === cat.id && !query ? 'var(--accent)' : 'var(--bg-raised)', color: activeCategory === cat.id && !query ? '#fff' : 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' }}>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 16 }}>
            <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Загружаем книги...</span>
          </div>
        )}
        {error && !loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>😕</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{error}</div>
          </div>
        )}
        {!loading && !error && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {books.map((book, i) => (
              <div key={book.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', animation: `fadeSlideUp 0.4s ease both`, animationDelay: `${i * 0.04}s` }}>
                {/* Cover */}
                <div style={{ height: 140, background: book.cover ? `url(${book.cover}) center/cover no-repeat` : 'linear-gradient(135deg, var(--accent)33, var(--accent)66)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {!book.cover && <span style={{ fontSize: 44 }}>📖</span>}
                  {book.downloads && (
                    <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.7)', borderRadius: 8, padding: '3px 8px', fontSize: 10, color: '#fff' }}>
                      ↓ {book.downloads.toLocaleString()}
                    </div>
                  )}
                  <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'var(--accent)', borderRadius: 8, padding: '3px 8px', fontSize: 10, color: '#fff', fontWeight: 600 }}>
                    📖 Бесплатно
                  </div>
                </div>
                <div style={{ padding: '10px 12px 12px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Lora,serif', lineHeight: 1.3, marginBottom: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{book.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.author}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { vibe(12); onRead(book) }} style={{ flex: 1, background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '8px 0', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      📖 Читать
                    </button>
                    <button onClick={() => {
                      vibe(8)
                      setAddedIds(prev => new Set([...prev, book.id]))
                      onAddToLibrary({ title: book.title, author: book.author, coverUrl: book.cover, status: 'want', coverEmoji: '📖', color: '#b07d4a' })
                    }} style={{ width: 36, background: addedIds.has(book.id) ? 'var(--bg-raised)' : 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 0', color: addedIds.has(book.id) ? 'var(--accent)' : 'var(--text-secondary)', fontSize: 14, cursor: 'pointer' }}>
                      {addedIds.has(book.id) ? '✓' : '+'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
