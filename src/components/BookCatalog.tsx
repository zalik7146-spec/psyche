import { useState, useEffect, useCallback } from 'react'
import { Book } from '../types'
import { ArrowLeft, Search, Plus, Check, BookOpen, X } from 'lucide-react'

interface Props {
  books: Book[]
  onBack: () => void
  onAddBook: (book: Book) => void
  onOpenReader: (book: { title: string; author: string; coverId?: string }) => void
}

interface SearchResult {
  id: string
  title: string
  author: string
  cover: string
  year?: number
  pages?: number
  description?: string
  subjects?: string[]
  coverId?: string
}

const CATEGORIES = [
  { id: 'psychology', label: '🧠 Психология', query: 'psychology' },
  { id: 'philosophy', label: '💭 Философия', query: 'philosophy' },
  { id: 'neuroscience', label: '🔬 Нейронауки', query: 'neuroscience' },
  { id: 'selfhelp', label: '✨ Саморазвитие', query: 'self help' },
  { id: 'mindfulness', label: '🧘 Осознанность', query: 'mindfulness meditation' },
  { id: 'business', label: '💼 Бизнес', query: 'business leadership' },
]

export default function BookCatalog({ books, onBack, onAddBook, onOpenReader }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')

  const searchBooks = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    setError('')

    try {
      const allResults: SearchResult[] = []

      // Open Library search
      const olUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(searchQuery)}&limit=15&language=rus`
      const olRes = await fetch(olUrl)
      if (olRes.ok) {
        const olData = await olRes.json()
        if (olData.docs) {
          olData.docs.forEach((doc: any) => {
            allResults.push({
              id: `ol_${doc.key}`,
              title: doc.title || 'Без названия',
              author: doc.author_name?.[0] || 'Неизвестен',
              cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '',
              year: doc.first_publish_year,
              pages: doc.number_of_pages_median,
              subjects: doc.subject?.slice(0, 3),
              coverId: doc.cover_i?.toString()
            })
          })
        }
      }

      // Google Books search  
      const gbUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=10&printType=books`
      const gbRes = await fetch(gbUrl)
      if (gbRes.ok) {
        const gbData = await gbRes.json()
        if (gbData.items) {
          gbData.items.forEach((item: any) => {
            const info = item.volumeInfo
            const existing = allResults.find(r => 
              r.title.toLowerCase() === info.title?.toLowerCase()
            )
            if (!existing) {
              allResults.push({
                id: `gb_${item.id}`,
                title: info.title || 'Без названия',
                author: info.authors?.[0] || 'Неизвестен',
                cover: info.imageLinks?.thumbnail?.replace('http://', 'https://') || '',
                year: info.publishedDate ? parseInt(info.publishedDate) : undefined,
                pages: info.pageCount,
                description: info.description?.slice(0, 200),
                subjects: info.categories?.slice(0, 3)
              })
            }
          })
        }
      }

      setResults(allResults)
      if (allResults.length === 0) {
        setError('Книги не найдены. Попробуйте другой запрос.')
      }
    } catch (err) {
      console.error('Search error:', err)
      setError('Ошибка поиска. Проверьте подключение к интернету.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) searchBooks(query)
    }, 600)
    return () => clearTimeout(timer)
  }, [query, searchBooks])

  const handleCategoryClick = (cat: typeof CATEGORIES[0]) => {
    setSelectedCategory(cat.id)
    setQuery(cat.query)
    searchBooks(cat.query)
  }

  const isInLibrary = (result: SearchResult) => {
    return books.some(b => b.title.toLowerCase() === result.title.toLowerCase())
  }

  const handleAddToLibrary = (result: SearchResult) => {
    const newBook: Book = {
      id: `book_${Date.now()}`,
      title: result.title,
      author: result.author,
      status: 'want',
      color: '#b07d4a',
      coverEmoji: '📚',
      coverUrl: result.cover,
      totalPages: result.pages,
      genre: result.subjects?.[0],
      createdAt: new Date().toISOString()
    }
    onAddBook(newBook)
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'var(--bg-base)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        paddingTop: 'calc(16px + env(safe-area-inset-top))',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-raised)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <button
            onClick={onBack}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-primary)'
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>
            📚 Каталог книг
          </h1>
        </div>

        {/* Search */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 16px',
          background: 'var(--bg-card)',
          borderRadius: '14px',
          border: '1px solid var(--border)'
        }}>
          <Search size={18} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск книг..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '16px',
              color: 'var(--text-primary)'
            }}
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]) }} style={{ background: 'none', border: 'none', padding: 0 }}>
              <X size={18} style={{ color: 'var(--text-muted)' }} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {/* Categories */}
        {!query && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Категории
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '20px',
                    background: selectedCategory === cat.id ? 'var(--accent)' : 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    color: selectedCategory === cat.id ? '#000' : 'var(--text-primary)',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s'
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            Поиск книг...
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            {error}
          </div>
        )}

        {/* Results */}
        {!loading && results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {results.map((result, idx) => (
              <div
                key={result.id}
                style={{
                  display: 'flex',
                  gap: '14px',
                  padding: '14px',
                  background: 'var(--bg-card)',
                  borderRadius: '16px',
                  border: '1px solid var(--border)',
                  animation: `fadeSlideUp 0.3s ease ${idx * 0.05}s both`
                }}
              >
                {/* Cover */}
                <div style={{
                  width: '70px',
                  height: '100px',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  flexShrink: 0,
                  background: 'var(--bg-raised)'
                }}>
                  {result.cover ? (
                    <img 
                      src={result.cover} 
                      alt={result.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>
                      📚
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ 
                    fontSize: '15px', 
                    fontWeight: '600', 
                    color: 'var(--text-primary)',
                    marginBottom: '4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {result.title}
                  </h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    {result.author} {result.year && `• ${result.year}`}
                  </p>
                  
                  {result.pages && (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                      {result.pages} стр.
                    </p>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => onOpenReader({ title: result.title, author: result.author, coverId: result.coverId })}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        borderRadius: '10px',
                        background: 'var(--accent)',
                        border: 'none',
                        color: '#000',
                        fontSize: '13px',
                        fontWeight: '600'
                      }}
                    >
                      <BookOpen size={14} />
                      Читать
                    </button>

                    <button
                      onClick={() => !isInLibrary(result) && handleAddToLibrary(result)}
                      disabled={isInLibrary(result)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        borderRadius: '10px',
                        background: isInLibrary(result) ? 'var(--bg-raised)' : 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        color: isInLibrary(result) ? 'var(--green)' : 'var(--text-primary)',
                        fontSize: '13px',
                        fontWeight: '500',
                        opacity: isInLibrary(result) ? 0.7 : 1
                      }}
                    >
                      {isInLibrary(result) ? <Check size={14} /> : <Plus size={14} />}
                      {isInLibrary(result) ? 'В библиотеке' : 'Добавить'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && !query && results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📖</div>
            <p>Выберите категорию или введите название книги</p>
          </div>
        )}
      </div>
    </div>
  )
}
