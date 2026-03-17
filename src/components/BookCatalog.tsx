import { useState, useEffect, useCallback } from 'react'
import { Search, X, BookOpen, Plus } from 'lucide-react'
import { Book } from '../types'

interface OLBook {
  key: string
  title: string
  author_name?: string[]
  cover_i?: number
  first_publish_year?: number
  subject?: string[]
  ia?: string[]
  has_fulltext?: boolean
}

interface Props {
  onClose: () => void
  onAddToLibrary: (book: Partial<Book>) => void
  onOpenReader: (book: { title: string; author: string; textUrl: string; coverId?: number }) => void
  existingBooks: Book[]
}

const CATEGORIES = [
  { label: 'Психология', query: 'psychology mind', emoji: '🧠' },
  { label: 'Философия', query: 'philosophy', emoji: '💭' },
  { label: 'Классика', query: 'classic literature', emoji: '📖' },
  { label: 'Наука', query: 'science', emoji: '🔬' },
  { label: 'История', query: 'history', emoji: '🏛️' },
  { label: 'Медицина', query: 'medicine health', emoji: '⚕️' },
  { label: 'Саморазвитие', query: 'self development', emoji: '🌱' },
  { label: 'Бизнес', query: 'business economics', emoji: '💼' },
]

export default function BookCatalog({ onClose, onAddToLibrary, onOpenReader, existingBooks }: Props) {
  const [query, setQuery] = useState('')
  const [books, setBooks] = useState<OLBook[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) return
    setLoading(true)
    setError('')
    setBooks([])
    try {
      const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=20&fields=key,title,author_name,cover_i,first_publish_year,subject,ia,has_fulltext`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Ошибка загрузки')
      const data = await res.json()
      setBooks(data.docs || [])
      if ((data.docs || []).length === 0) setError('Книги не найдены. Попробуйте другой запрос.')
    } catch (e) {
      setError('Не удалось загрузить книги. Проверьте подключение к интернету.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    search(activeCategory.query)
  }, [activeCategory])

  useEffect(() => {
    if (!query.trim()) return
    const t = setTimeout(() => search(query), 600)
    return () => clearTimeout(t)
  }, [query])

  const getCover = (coverId?: number) =>
    coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null

  const getTextUrl = (book: OLBook): string | null => {
    if (book.ia && book.ia.length > 0) {
      return `https://archive.org/download/${book.ia[0]}/${book.ia[0]}.txt`
    }
    return null
  }

  const isInLibrary = (title: string) =>
    existingBooks.some(b => b.title.toLowerCase() === title.toLowerCase())

  const handleAdd = (book: OLBook) => {
    onAddToLibrary({
      title: book.title,
      author: book.author_name?.[0] || 'Неизвестен',
      coverEmoji: '📖',
      color: '#b07d4a',
      status: 'want',
      tags: book.subject?.slice(0, 3) || [],
    })
  }

  const handleRead = (book: OLBook) => {
    const textUrl = getTextUrl(book)
    if (!textUrl) {
      alert('Полный текст этой книги недоступен. Попробуйте другую книгу.')
      return
    }
    onOpenReader({
      title: book.title,
      author: book.author_name?.[0] || 'Неизвестен',
      textUrl,
      coverId: book.cover_i,
    })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column', zIndex: 200,
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 0',
        paddingTop: 'calc(16px + env(safe-area-inset-top))',
        background: 'var(--bg-base)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-primary)',
          }}>
            <X size={18} />
          </button>
          <h2 style={{ fontFamily: 'Lora, serif', color: 'var(--text-primary)', fontSize: 20, fontWeight: 700 }}>
            📚 Каталог книг
          </h2>
        </div>

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-raised)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '10px 14px', marginBottom: 12,
        }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Поиск книг на русском или английском..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: 15,
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Categories */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, scrollbarWidth: 'none' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.label}
              onClick={() => { setActiveCategory(cat); setQuery('') }}
              style={{
                flexShrink: 0, padding: '6px 12px', borderRadius: 20,
                border: '1px solid var(--border)',
                background: activeCategory.label === cat.label ? 'var(--accent)' : 'var(--bg-raised)',
                color: activeCategory.label === cat.label ? '#fff' : 'var(--text-secondary)',
                fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
            <div>Загружаем книги...</div>
          </div>
        )}

        {error && !loading && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>😔</div>
            <div>{error}</div>
          </div>
        )}

        {!loading && !error && books.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {books.map(book => {
              const cover = getCover(book.cover_i)
              const hasText = !!(book.ia && book.ia.length > 0)
              const inLib = isInLibrary(book.title)
              return (
                <div key={book.key} style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 16, padding: 14, display: 'flex', gap: 12,
                  animation: 'fadeSlideUp 0.3s ease',
                }}>
                  {/* Cover */}
                  <div style={{
                    width: 64, height: 88, borderRadius: 8, flexShrink: 0,
                    background: cover ? 'transparent' : 'var(--bg-raised)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', border: '1px solid var(--border)',
                  }}>
                    {cover ? (
                      <img src={cover} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    ) : (
                      <span style={{ fontSize: 28 }}>📖</span>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'Lora, serif', fontWeight: 700,
                      color: 'var(--text-primary)', fontSize: 15,
                      marginBottom: 4, lineHeight: 1.3,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {book.title}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 6 }}>
                      {book.author_name?.[0] || 'Неизвестен'}
                      {book.first_publish_year ? ` · ${book.first_publish_year}` : ''}
                    </div>
                    {hasText && (
                      <div style={{
                        display: 'inline-block', padding: '2px 8px',
                        background: 'rgba(180,140,80,0.15)', borderRadius: 8,
                        color: 'var(--accent)', fontSize: 11, marginBottom: 8,
                      }}>
                        📖 Полный текст
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      {hasText && (
                        <button
                          onClick={() => handleRead(book)}
                          style={{
                            flex: 1, padding: '7px 0', borderRadius: 10,
                            background: 'linear-gradient(135deg, var(--accent), #8a6a3a)',
                            border: 'none', color: '#fff', fontSize: 13,
                            fontWeight: 600, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                          }}
                        >
                          <BookOpen size={13} /> Читать
                        </button>
                      )}
                      <button
                        onClick={() => !inLib && handleAdd(book)}
                        style={{
                          flex: 1, padding: '7px 0', borderRadius: 10,
                          background: inLib ? 'var(--bg-raised)' : 'var(--bg-raised)',
                          border: '1px solid var(--border)',
                          color: inLib ? 'var(--text-muted)' : 'var(--text-primary)',
                          fontSize: 13, cursor: inLib ? 'default' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        }}
                      >
                        {inLib ? '✓ В библиотеке' : <><Plus size={13} /> Добавить</>}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
