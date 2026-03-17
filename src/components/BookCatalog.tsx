import { useState, useCallback } from 'react'
import { Book } from '../types'
import { ArrowLeft, Search, Plus, Check, BookOpen, X } from 'lucide-react'

interface CatalogBook {
  id: string
  title: string
  author: string
  cover: string
  year?: number
  pages?: number
  desc?: string
  gutenbergId?: number
  hasFullText: boolean
  downloads?: number
  subjects?: string[]
}

interface Props {
  books: Book[]
  onBack: () => void
  onAddBook: (b: Book) => void
  onOpenReader: (b: { title: string; author: string; gutenbergId?: number; coverId?: string }) => void
}

const CATS = [
  { label: '🧠 Психология', q: 'psychology' },
  { label: '💭 Философия', q: 'philosophy' },
  { label: '📖 Классика', q: 'fiction' },
  { label: '🔬 Наука', q: 'science' },
  { label: '✨ Саморазвитие', q: 'self-help' },
  { label: '🧘 Осознанность', q: 'mindfulness' },
  { label: '📚 История', q: 'history' },
  { label: '🎭 Драма', q: 'drama' },
]

export default function BookCatalog({ books, onBack, onAddBook, onOpenReader }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CatalogBook[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'gutenberg' | 'search'>('gutenberg')
  const [expanded, setExpanded] = useState<string | null>(null)

  const searchGutenberg = useCallback(async (q: string) => {
    try {
      const r = await fetch(`https://gutendex.com/books/?search=${encodeURIComponent(q)}`)
      const d = await r.json()
      return (d.results || []).map((b: any) => ({
        id: 'g_' + b.id,
        title: b.title || '',
        author: b.authors?.[0]?.name || 'Unknown',
        cover: b.formats?.['image/jpeg'] || '',
        year: b.authors?.[0]?.birth_year,
        downloads: b.download_count,
        gutenbergId: b.id,
        hasFullText: true,
        subjects: b.subjects?.slice(0, 3) || [],
        desc: b.subjects?.join(', ') || '',
      })) as CatalogBook[]
    } catch { return [] }
  }, [])

  const searchOpenLibrary = useCallback(async (q: string) => {
    try {
      const r = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=12`)
      const d = await r.json()
      return (d.docs || []).map((b: any) => ({
        id: 'ol_' + (b.key || b.cover_edition_key || Math.random()),
        title: b.title || '',
        author: b.author_name?.[0] || 'Unknown',
        cover: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg` : '',
        year: b.first_publish_year,
        pages: b.number_of_pages_median,
        hasFullText: !!b.has_fulltext,
        desc: b.subject?.slice(0, 3)?.join(', ') || '',
      })) as CatalogBook[]
    } catch { return [] }
  }, [])

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      if (tab === 'gutenberg') {
        const r = await searchGutenberg(q)
        setResults(r)
      } else {
        const [g, o] = await Promise.allSettled([searchGutenberg(q), searchOpenLibrary(q)])
        const all = [
          ...(g.status === 'fulfilled' ? g.value : []),
          ...(o.status === 'fulfilled' ? o.value : []),
        ]
        const seen = new Set<string>()
        setResults(all.filter(b => {
          const k = b.title.toLowerCase()
          if (seen.has(k)) return false
          seen.add(k)
          return true
        }))
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [tab, searchGutenberg, searchOpenLibrary])

  const inLib = (t: string) => books.some(b => b.title.toLowerCase() === t.toLowerCase())

  const addToLib = (b: CatalogBook) => {
    const book: Book = {
      id: Date.now().toString(),
      title: b.title,
      author: b.author,
      genre: '',
      description: b.desc || '',
      status: 'want',
      color: '#b07d4a',
      coverEmoji: '📚',
      coverUrl: b.cover || undefined,
      rating: 0,
      totalPages: b.pages,
      currentPage: 0,
      tags: [],
      createdAt: new Date().toISOString(),
    }
    onAddBook(book)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-base)', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', paddingTop: 'max(12px, env(safe-area-inset-top))', borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 20, cursor: 'pointer', padding: 4 }}><ArrowLeft size={22} /></button>
          <h2 style={{ flex: 1, margin: 0, fontSize: 18, color: 'var(--text-primary)', fontFamily: 'var(--font-head)' }}>📚 Каталог книг</h2>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(['gutenberg', 'search'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setResults([]) }}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid var(--border)', background: tab === t ? 'var(--accent)' : 'var(--bg-card)', color: tab === t ? '#fff' : 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {t === 'gutenberg' ? '📖 Полные тексты' : '🔍 Все книги'}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch(query)}
              placeholder={tab === 'gutenberg' ? 'Freud, Dostoevsky, Psychology...' : 'Поиск на русском и английском...'}
              style={{ width: '100%', padding: '10px 10px 10px 34px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            {query && <button onClick={() => { setQuery(''); setResults([]) }} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>}
          </div>
          <button onClick={() => doSearch(query)} style={{ padding: '0 14px', borderRadius: 8, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Найти</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Categories */}
        {results.length === 0 && !loading && (
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>Популярные темы:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {CATS.map(c => (
                <button key={c.q} onClick={() => { setQuery(c.q); doSearch(c.q) }}
                  style={{ padding: '8px 14px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer' }}>
                  {c.label}
                </button>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 48, color: 'var(--text-muted)' }}>
              <BookOpen size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p style={{ fontSize: 14 }}>Введите название книги или выберите тему</p>
              {tab === 'gutenberg' && <p style={{ fontSize: 12, marginTop: 8 }}>70,000+ книг с полным текстом — Gutenberg Project</p>}
            </div>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: 14 }}>Ищем книги...</p>
          </div>
        )}

        {/* Results */}
        {results.map((b, i) => (
          <div key={b.id} style={{ display: 'flex', gap: 12, padding: 12, marginBottom: 10, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-card)', animation: `fadeSlideUp 0.3s ease ${i * 0.05}s both` }}>
            {/* Cover */}
            <div style={{ width: 64, height: 90, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-raised)' }}>
              {b.cover ? <img src={b.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> :
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>📚</div>}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4 style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', fontFamily: 'var(--font-head)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{b.title}</h4>
              <p style={{ margin: '3px 0', fontSize: 12, color: 'var(--text-secondary)' }}>{b.author}{b.year ? ` · ${b.year}` : ''}</p>

              {b.hasFullText && <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: 4, background: 'rgba(76,175,80,0.15)', color: '#81c784', fontSize: 10, fontWeight: 600, marginBottom: 4 }}>📖 Полный текст</span>}

              {b.downloads && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>⬇ {b.downloads.toLocaleString()}</span>}

              {expanded === b.id && b.desc && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '6px 0', lineHeight: 1.5 }}>{b.desc}</p>}

              {b.desc && <button onClick={() => setExpanded(expanded === b.id ? null : b.id)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, cursor: 'pointer', padding: 0, marginTop: 2 }}>{expanded === b.id ? 'Свернуть' : 'Подробнее'}</button>}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {b.hasFullText && (
                  <button onClick={() => onOpenReader({ title: b.title, author: b.author, gutenbergId: b.gutenbergId })}
                    style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <BookOpen size={13} /> Читать
                  </button>
                )}
                {inLib(b.title) ? (
                  <span style={{ padding: '6px 12px', borderRadius: 6, background: 'rgba(76,175,80,0.15)', color: '#81c784', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Check size={13} /> В библиотеке
                  </span>
                ) : (
                  <button onClick={() => addToLib(b)}
                    style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Plus size={13} /> Добавить
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {!loading && results.length === 0 && query && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            <p>Ничего не найдено</p>
            <p style={{ fontSize: 12, marginTop: 8 }}>Попробуйте другой запрос{tab === 'gutenberg' ? ' или переключитесь на "Все книги"' : ''}</p>
          </div>
        )}
      </div>
    </div>
  )
}