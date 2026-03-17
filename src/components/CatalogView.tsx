import { useState, useCallback, useRef } from 'react'
import { X, Search, BookOpen, Plus, Check } from 'lucide-react'
import { Book } from '../types'

interface CatalogBook {
  id: string
  title: string
  author: string
  cover?: string
  year?: string
  pages?: number
  genre?: string
  description?: string
  source: 'google' | 'openlibrary'
}

interface Props {
  onClose: () => void
  onAddToLibrary: (book: Partial<Book>) => void
  existingBooks: Book[]
}

const vibe = (ms?: number) => navigator.vibrate?.(ms ?? 8)

export default function CatalogView({ onClose, onAddToLibrary, existingBooks }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CatalogBook[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchGoogle = async (q: string): Promise<CatalogBook[]> => {
    try {
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=12&printType=books`
      )
      if (!res.ok) return []
      const data = await res.json()
      if (!data.items) return []
      return data.items.map((item: any) => {
        const info = item.volumeInfo || {}
        let cover = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || ''
        if (cover) cover = cover.replace('http://', 'https://')
        return {
          id: `g_${item.id}`,
          title: info.title || 'Без названия',
          author: (info.authors || []).join(', ') || 'Автор неизвестен',
          cover,
          year: info.publishedDate?.substring(0, 4),
          pages: info.pageCount,
          genre: (info.categories || [])[0],
          description: info.description,
          source: 'google' as const
        }
      })
    } catch { return [] }
  }

  const searchOpenLibrary = async (q: string): Promise<CatalogBook[]> => {
    try {
      const res = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8&language=rus`
      )
      if (!res.ok) return []
      const data = await res.json()
      if (!data.docs) return []
      return data.docs.slice(0, 8).map((doc: any) => ({
        id: `ol_${doc.key}`,
        title: doc.title || 'Без названия',
        author: (doc.author_name || []).join(', ') || 'Автор неизвестен',
        cover: doc.cover_i
          ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
          : '',
        year: doc.first_publish_year?.toString(),
        pages: doc.number_of_pages_median,
        genre: (doc.subject || [])[0],
        description: '',
        source: 'openlibrary' as const
      }))
    } catch { return [] }
  }

  const handleSearch = useCallback((q: string) => {
    setQuery(q)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!q.trim()) { setResults([]); return }
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const [google, openlib] = await Promise.allSettled([
          searchGoogle(q),
          searchOpenLibrary(q)
        ])
        const googleBooks = google.status === 'fulfilled' ? google.value : []
        const olBooks = openlib.status === 'fulfilled' ? openlib.value : []
        const merged = [...googleBooks]
        olBooks.forEach(olBook => {
          const exists = googleBooks.some(gb =>
            gb.title.toLowerCase().includes(olBook.title.toLowerCase().substring(0, 10))
          )
          if (!exists) merged.push(olBook)
        })
        setResults(merged)
        if (merged.length === 0) setError('Книги не найдены. Попробуйте другой запрос.')
      } catch {
        setError('Ошибка поиска. Проверьте подключение к интернету.')
      }
      setLoading(false)
    }, 600)
  }, [])

  const isInLibrary = (book: CatalogBook) =>
    existingBooks.some(b =>
      b.title.toLowerCase() === book.title.toLowerCase()
    ) || added.has(book.id)

  const handleAdd = (book: CatalogBook) => {
    vibe(10)
    const EMOJIS: Record<string, string> = {
      'Psychology': '🧠', 'Психология': '🧠',
      'Philosophy': '💭', 'Философия': '💭',
      'Fiction': '📖', 'Self-help': '✨',
      'Science': '🔬', 'History': '📜'
    }
    const emoji = book.genre
      ? Object.entries(EMOJIS).find(([k]) =>
          book.genre?.toLowerCase().includes(k.toLowerCase())
        )?.[1] || '📚'
      : '📚'

    onAddToLibrary({
      title: book.title,
      author: book.author,
      genre: book.genre || '',
      totalPages: book.pages,
      coverEmoji: emoji,
      color: '#b07d4a',
      status: 'want',
      description: book.description || '',
      tags: [],
      rating: 0,
      currentPage: 0
    })
    setAdded(prev => new Set([...prev, book.id]))
  }

  const featured = [
    { q: 'психология', label: '🧠 Психология' },
    { q: 'философия', label: '💭 Философия' },
    { q: 'осознанность', label: '🌿 Осознанность' },
    { q: 'психотерапия', label: '💬 Терапия' },
    { q: 'юнг', label: '🔮 Юнг' },
    { q: 'когнитивная', label: '⚡ КПТ' }
  ]

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column',
      zIndex: 200
    }}>
      {/* Header */}
      <div style={{
        padding: '56px 20px 16px',
        background: 'var(--bg-raised)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={() => { vibe(8); onClose() }} style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-primary)', flexShrink: 0
          }}>
            <X size={18} />
          </button>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>
              📚 Каталог книг
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Google Books + Open Library
            </div>
          </div>
        </div>

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '0 14px'
        }}>
          <Search size={16} color='var(--text-muted)' />
          <input
            autoFocus
            value={query}
            onChange={e => handleSearch(e.target.value)}
            placeholder='Поиск книг на русском или английском...'
            style={{
              flex: 1, padding: '12px 0', background: 'transparent',
              border: 'none', outline: 'none', fontSize: 15,
              color: 'var(--text-primary)'
            }}
          />
          {loading && (
            <div style={{
              width: 16, height: 16, border: '2px solid var(--accent)',
              borderTopColor: 'transparent', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }} />
          )}
          {query && !loading && (
            <button onClick={() => { setQuery(''); setResults([]) }} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', display: 'flex', alignItems: 'center'
            }}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 100px' }}>
        {/* Categories */}
        {!query && (
          <>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, fontWeight: 600 }}>
              ПОПУЛЯРНЫЕ ТЕМЫ
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
              {featured.map(f => (
                <button key={f.q} onClick={() => handleSearch(f.q)} style={{
                  padding: '8px 14px', borderRadius: 20,
                  background: 'var(--bg-raised)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
                  transition: 'all 0.2s'
                }}>
                  {f.label}
                </button>
              ))}
            </div>
            <div style={{
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              borderRadius: 16, padding: 20, textAlign: 'center'
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📖</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, fontFamily: 'Lora, serif' }}>
                Найдите свою следующую книгу
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Поиск по 40+ миллионам книг.<br />Добавляйте в библиотеку одним нажатием.
              </div>
            </div>
          </>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            borderRadius: 16, padding: 20, textAlign: 'center',
            color: 'var(--text-muted)', fontSize: 14
          }}>
            {error}
          </div>
        )}

        {/* Results */}
        {results.map((book, i) => (
          <div key={book.id} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 16, marginBottom: 12, overflow: 'hidden',
            animation: 'fadeSlideUp 0.3s ease both',
            animationDelay: `${i * 0.05}s`
          }}>
            <div style={{ display: 'flex', gap: 12, padding: 14 }}>
              {/* Cover */}
              <div style={{
                width: 64, height: 90, borderRadius: 8, flexShrink: 0,
                background: 'var(--bg-raised)', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--border)'
              }}>
                {book.cover ? (
                  <img src={book.cover} alt={book.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ) : (
                  <BookOpen size={24} color='var(--text-muted)' />
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 15, fontWeight: 700, color: 'var(--text-primary)',
                  fontFamily: 'Lora, serif', marginBottom: 4,
                  display: '-webkit-box', WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden'
                }}>
                  {book.title}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
                  {book.author}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {book.year && (
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 10,
                      background: 'var(--bg-raised)', color: 'var(--text-muted)'
                    }}>{book.year}</span>
                  )}
                  {book.pages && (
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 10,
                      background: 'var(--bg-raised)', color: 'var(--text-muted)'
                    }}>{book.pages} стр.</span>
                  )}
                  {book.genre && (
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 10,
                      background: 'var(--bg-raised)', color: 'var(--accent)'
                    }}>{book.genre.substring(0, 20)}</span>
                  )}
                </div>
              </div>

              {/* Add button */}
              <button
                onClick={() => !isInLibrary(book) && handleAdd(book)}
                style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: isInLibrary(book)
                    ? 'var(--bg-raised)'
                    : 'linear-gradient(135deg, var(--accent), #8a6a3a)',
                  border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: isInLibrary(book) ? 'default' : 'pointer',
                  transition: 'all 0.2s', alignSelf: 'center'
                }}
              >
                {isInLibrary(book)
                  ? <Check size={16} color='var(--text-muted)' />
                  : <Plus size={16} color='#fff' />
                }
              </button>
            </div>

            {/* Description */}
            {book.description && (
              <div style={{ padding: '0 14px 14px' }}>
                <div style={{
                  fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6,
                  display: expanded === book.id ? 'block' : '-webkit-box',
                  WebkitLineClamp: expanded === book.id ? undefined : 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: expanded === book.id ? 'visible' : 'hidden'
                }}>
                  {book.description}
                </div>
                {book.description.length > 100 && (
                  <button onClick={() => setExpanded(expanded === book.id ? null : book.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--accent)', fontSize: 12, padding: '4px 0'
                    }}>
                    {expanded === book.id ? 'Свернуть' : 'Читать далее'}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
