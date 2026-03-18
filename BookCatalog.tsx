import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, X, BookOpen, Plus, Star, ChevronRight, Filter, Globe } from 'lucide-react'
import { Book } from '../types'

// ── Google Books API types ─────────────────────────────────────────────────
interface GBook {
  id: string
  volumeInfo: {
    title: string
    authors?: string[]
    description?: string
    imageLinks?: {
      thumbnail?: string
      smallThumbnail?: string
    }
    publishedDate?: string
    averageRating?: number
    ratingsCount?: number
    pageCount?: number
    categories?: string[]
    language?: string
    previewLink?: string
    infoLink?: string
  }
  accessInfo?: {
    viewability?: string
    epub?: { isAvailable?: boolean }
    pdf?: { isAvailable?: boolean }
  }
}

interface Props {
  onClose: () => void
  onAddToLibrary: (book: Partial<Book>) => void
  onOpenReader?: (book: { title: string; author: string; textUrl: string; coverId?: number }) => void
  existingBooks: Book[]
}

// ── Categories ─────────────────────────────────────────────────────────────
const CATEGORIES = [
  { label: 'Тренд',        query: 'популярные книги психология',      emoji: '🔥', color: '#e07060' },
  { label: 'Психология',   query: 'психология саморазвитие',          emoji: '🧠', color: '#a090c0' },
  { label: 'Философия',    query: 'философия смысл жизни',            emoji: '💭', color: '#8090b0' },
  { label: 'Классика',     query: 'классическая литература русская',  emoji: '📖', color: '#b07050' },
  { label: 'Наука',        query: 'популярная наука открытия',        emoji: '🔬', color: '#70a090' },
  { label: 'История',      query: 'история мировая',                  emoji: '🏛️', color: '#9a8060' },
  { label: 'Саморазвитие', query: 'личностный рост мотивация',       emoji: '🌱', color: '#70b080' },
  { label: 'Бизнес',       query: 'бизнес менеджмент лидерство',     emoji: '💼', color: '#8090a0' },
  { label: 'Медицина',     query: 'медицина здоровье мозг',          emoji: '⚕️', color: '#c08070' },
  { label: 'Мировые хиты', query: 'bestseller world famous books',   emoji: '🌍', color: '#7080b0' },
]

const LANG_OPTS = [
  { id: 'all', label: 'Все' },
  { id: 'ru',  label: '🇷🇺 Русские' },
  { id: 'en',  label: '🌐 English' },
]

// ── Helpers ────────────────────────────────────────────────────────────────
const cleanCover = (url?: string) => {
  if (!url) return null
  // Upgrade to higher resolution
  return url.replace('zoom=1', 'zoom=2').replace('http://', 'https://')
}

const cleanDesc = (html?: string) => {
  if (!html) return ''
  return html.replace(/<[^>]+>/g, '').slice(0, 160)
}

const bookColor = (idx: number) => {
  const colors = ['#b07d4a','#6a9e8a','#8a7a9a','#7a8a6a','#9a8a4a','#6a7a9a','#a07060','#608090']
  return colors[idx % colors.length]
}

const fetchGBooks = async (q: string, lang: string, page = 0): Promise<GBook[]> => {
  const langParam = lang !== 'all' ? `&langRestrict=${lang}` : ''
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=20&startIndex=${page * 20}&orderBy=relevance&printType=books${langParam}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Ошибка загрузки')
  const data = await res.json()
  return (data.items || []) as GBook[]
}

// ── BookCard component ─────────────────────────────────────────────────────
function BookCard({
  book, idx, inLib, onAdd, onPreview
}: {
  book: GBook
  idx: number
  inLib: boolean
  onAdd: () => void
  onPreview: () => void
}) {
  const vi = book.volumeInfo
  const cover = cleanCover(vi.imageLinks?.thumbnail)
  const rating = vi.averageRating
  const [imgError, setImgError] = useState(false)

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 18,
      padding: 14,
      display: 'flex',
      gap: 14,
      animation: `fadeSlideUp 0.3s ease ${(idx % 6) * 0.05}s both`,
    }}>
      {/* Cover */}
      <div
        onClick={onPreview}
        style={{
          width: 72, height: 104, borderRadius: 10, flexShrink: 0,
          background: cover && !imgError
            ? 'transparent'
            : `linear-gradient(145deg, ${bookColor(idx)}, ${bookColor(idx + 2)})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', border: '1px solid var(--border)',
          cursor: 'pointer', position: 'relative',
          boxShadow: '2px 4px 12px rgba(0,0,0,0.35)',
        }}
      >
        {cover && !imgError ? (
          <img
            src={cover}
            alt={vi.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 6 }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>📖</div>
            <div style={{
              fontSize: 9, color: 'rgba(255,255,255,0.8)',
              fontFamily: 'Inter, sans-serif', fontWeight: 600,
              lineHeight: 1.2,
              display: '-webkit-box', WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {vi.title}
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Title */}
        <div
          onClick={onPreview}
          style={{
            fontFamily: 'Lora, serif', fontWeight: 700,
            color: 'var(--text-primary)', fontSize: 15,
            lineHeight: 1.3, cursor: 'pointer',
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}
        >
          {vi.title}
        </div>

        {/* Author */}
        <div style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
          {vi.authors?.slice(0, 2).join(', ') || 'Автор неизвестен'}
          {vi.publishedDate && (
            <span style={{ marginLeft: 6, opacity: 0.7 }}>
              · {vi.publishedDate.slice(0, 4)}
            </span>
          )}
        </div>

        {/* Rating + pages */}
        {(rating || vi.pageCount) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {rating && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Star size={11} fill="var(--gold)" color="var(--gold)" />
                <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
                  {rating.toFixed(1)}
                </span>
                {vi.ratingsCount && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
                    ({vi.ratingsCount > 999 ? `${(vi.ratingsCount/1000).toFixed(1)}k` : vi.ratingsCount})
                  </span>
                )}
              </div>
            )}
            {vi.pageCount && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
                {vi.pageCount} стр.
              </span>
            )}
          </div>
        )}

        {/* Description */}
        {vi.description && (
          <div style={{
            color: 'var(--text-secondary)', fontSize: 12,
            fontFamily: 'Inter, sans-serif', lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {cleanDesc(vi.description)}
          </div>
        )}

        {/* Category tag */}
        {vi.categories?.[0] && (
          <div style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '2px 8px', borderRadius: 20,
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            color: 'var(--text-muted)', fontSize: 10,
            fontFamily: 'Inter, sans-serif', alignSelf: 'flex-start',
            marginTop: 2,
          }}>
            {vi.categories[0].split(' / ')[0].slice(0, 24)}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 6 }}>
          {vi.previewLink && (
            <button
              onClick={onPreview}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 10,
                background: 'linear-gradient(135deg, var(--accent), #8a6a3a)',
                border: 'none', color: '#fff', fontSize: 12,
                fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              <BookOpen size={12} /> Посмотреть
            </button>
          )}
          <button
            onClick={!inLib ? onAdd : undefined}
            style={{
              flex: 1, padding: '7px 0', borderRadius: 10,
              background: inLib ? 'var(--bg-active)' : 'var(--bg-raised)',
              border: `1px solid ${inLib ? 'var(--accent-dim)' : 'var(--border)'}`,
              color: inLib ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 12, cursor: inLib ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              fontFamily: 'Inter, sans-serif', fontWeight: 500,
            }}
          >
            {inLib ? '✓ В библиотеке' : <><Plus size={12} /> В библиотеку</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Book Detail Modal ──────────────────────────────────────────────────────
function BookDetailModal({
  book, inLib, onAdd, onClose
}: {
  book: GBook
  inLib: boolean
  onAdd: () => void
  onClose: () => void
}) {
  const vi = book.volumeInfo
  const cover = cleanCover(vi.imageLinks?.thumbnail)

  const openPreview = () => {
    if (vi.previewLink) window.open(vi.previewLink, '_blank')
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--overlay)',
      zIndex: 300, display: 'flex', flexDirection: 'column',
      justifyContent: 'flex-end',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-raised)',
          borderRadius: '22px 22px 0 0',
          borderTop: '1px solid var(--border-mid)',
          padding: '20px 20px 40px',
          maxHeight: '85%', overflowY: 'auto',
          animation: 'slideUp 0.3s cubic-bezier(0.34,1.1,0.64,1) both',
        }}
      >
        {/* Handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'var(--border-mid)', margin: '0 auto 20px',
        }} />

        {/* Header */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          {/* Cover */}
          <div style={{
            width: 90, height: 130, borderRadius: 10, flexShrink: 0,
            background: cover ? 'transparent' : 'linear-gradient(135deg, var(--accent), #6a4020)',
            overflow: 'hidden', border: '1px solid var(--border)',
            boxShadow: '4px 6px 20px rgba(0,0,0,0.45)',
          }}>
            {cover ? (
              <img src={cover} alt={vi.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <span style={{ fontSize: 36 }}>📖</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'Lora, serif', fontSize: 17, fontWeight: 700,
              color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.3,
            }}>
              {vi.title}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 8 }}>
              {vi.authors?.join(', ') || 'Автор неизвестен'}
            </div>
            {vi.averageRating && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                {[1,2,3,4,5].map(n => (
                  <Star
                    key={n}
                    size={14}
                    fill={n <= Math.round(vi.averageRating!) ? 'var(--gold)' : 'transparent'}
                    color="var(--gold)"
                  />
                ))}
                <span style={{ fontSize: 12, color: 'var(--gold)', marginLeft: 4 }}>
                  {vi.averageRating.toFixed(1)}
                </span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {vi.pageCount && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
                  📄 {vi.pageCount} стр.
                </span>
              )}
              {vi.publishedDate && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
                  📅 {vi.publishedDate.slice(0, 4)}
                </span>
              )}
              {vi.language && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
                  🌐 {vi.language === 'ru' ? 'Русский' : vi.language === 'en' ? 'English' : vi.language}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {vi.description && (
          <div style={{
            color: 'var(--text-secondary)', fontSize: 14,
            fontFamily: 'Inter, sans-serif', lineHeight: 1.7,
            marginBottom: 16, padding: '14px', background: 'var(--bg-card)',
            borderRadius: 12, border: '1px solid var(--border)',
          }}>
            {cleanDesc(vi.description)}
          </div>
        )}

        {/* Categories */}
        {vi.categories && vi.categories.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {vi.categories.slice(0, 4).map(cat => (
              <span key={cat} style={{
                padding: '3px 10px', borderRadius: 20,
                background: 'var(--bg-active)', border: '1px solid var(--border)',
                color: 'var(--text-muted)', fontSize: 11,
                fontFamily: 'Inter, sans-serif',
              }}>
                {cat.split(' / ')[0]}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          {vi.previewLink && (
            <button
              onClick={openPreview}
              style={{
                flex: 1, padding: '13px 0', borderRadius: 14,
                background: 'linear-gradient(135deg, var(--accent), #8a5220)',
                border: 'none', color: '#fff', fontSize: 15,
                fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              <BookOpen size={16} /> Открыть
            </button>
          )}
          <button
            onClick={() => { onAdd(); onClose(); }}
            style={{
              flex: 1, padding: '13px 0', borderRadius: 14,
              background: inLib ? 'var(--bg-active)' : 'var(--bg-raised)',
              border: `1px solid ${inLib ? 'var(--accent)' : 'var(--border-mid)'}`,
              color: inLib ? 'var(--accent)' : 'var(--text-primary)',
              fontSize: 15, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontFamily: 'Inter, sans-serif', fontWeight: 600,
            }}
          >
            {inLib ? '✓ В библиотеке' : <><Plus size={16} /> В библиотеку</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Catalog ───────────────────────────────────────────────────────────
export default function BookCatalog({ onClose, onAddToLibrary, existingBooks }: Props) {
  const [query, setQuery] = useState('')
  const [books, setBooks] = useState<GBook[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeCat, setActiveCat] = useState(CATEGORIES[0])
  const [lang, setLang] = useState('all')
  const [showLang, setShowLang] = useState(false)
  const [selectedBook, setSelectedBook] = useState<GBook | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const isInLib = (b: GBook) =>
    existingBooks.some(e => e.title.toLowerCase() === b.volumeInfo.title.toLowerCase())

  const doSearch = useCallback(async (q: string, l: string, p = 0, append = false) => {
    if (p === 0) { setLoading(true); setError(''); if (!append) setBooks([]) }
    else setLoadingMore(true)
    try {
      const results = await fetchGBooks(q, l, p)
      setBooks(prev => append ? [...prev, ...results] : results)
      setHasMore(results.length === 20)
      if (results.length === 0 && p === 0) setError('Ничего не найдено. Попробуйте изменить запрос.')
    } catch {
      setError('Не удалось загрузить книги. Проверьте подключение.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  // Load on category/lang change
  useEffect(() => {
    setPage(0)
    if (!query.trim()) doSearch(activeCat.query, lang, 0)
  }, [activeCat, lang])

  // Search debounce
  useEffect(() => {
    if (!query.trim()) {
      doSearch(activeCat.query, lang, 0)
      return
    }
    const t = setTimeout(() => { setPage(0); doSearch(query, lang, 0) }, 600)
    return () => clearTimeout(t)
  }, [query, lang])

  // Infinite scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || loadingMore || !hasMore) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
      const nextPage = page + 1
      setPage(nextPage)
      doSearch(query.trim() || activeCat.query, lang, nextPage, true)
    }
  }, [loadingMore, hasMore, page, query, activeCat, lang])

  const handleAdd = (book: GBook) => {
    const vi = book.volumeInfo
    onAddToLibrary({
      title: vi.title,
      author: vi.authors?.[0] || 'Неизвестен',
      coverEmoji: '📖',
      color: bookColor(books.indexOf(book)),
      status: 'want',
      tags: vi.categories?.slice(0, 2) || [],
      coverUrl: cleanCover(vi.imageLinks?.thumbnail) || undefined,
      description: cleanDesc(vi.description),
    })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column', zIndex: 200,
    }}>
      {/* ── Header ────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        background: 'var(--bg-base)',
        borderBottom: '1px solid var(--border)',
        paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
      }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px 12px' }}>
          <button
            onClick={onClose}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-primary)', flexShrink: 0,
            }}
          >
            <X size={18} />
          </button>

          {/* Search bar */}
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '9px 12px',
          }}>
            <Search size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Поиск книг..."
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: 'var(--text-primary)', fontSize: 14, fontFamily: 'Inter, sans-serif',
              }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* Language filter */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowLang(v => !v)}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: lang !== 'all' ? 'var(--accent-glow)' : 'var(--bg-raised)',
                border: `1px solid ${lang !== 'all' ? 'var(--accent)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: lang !== 'all' ? 'var(--accent)' : 'var(--text-secondary)',
                flexShrink: 0,
              }}
            >
              <Globe size={16} />
            </button>
            {showLang && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setShowLang(false)} />
                <div style={{
                  position: 'absolute', top: 42, right: 0,
                  background: 'var(--bg-raised)', border: '1px solid var(--border-mid)',
                  borderRadius: 12, overflow: 'hidden', zIndex: 11,
                  boxShadow: 'var(--shadow-lg)', minWidth: 130,
                  animation: 'scaleIn 0.15s ease-out both', transformOrigin: 'top right',
                }}>
                  {LANG_OPTS.map(o => (
                    <button
                      key={o.id}
                      onClick={() => { setLang(o.id); setShowLang(false) }}
                      style={{
                        display: 'block', width: '100%', padding: '10px 14px',
                        background: lang === o.id ? 'var(--accent-glow)' : 'none',
                        border: 'none', color: lang === o.id ? 'var(--accent)' : 'var(--text-primary)',
                        fontSize: 13, textAlign: 'left', cursor: 'pointer',
                        fontFamily: 'Inter, sans-serif', fontWeight: lang === o.id ? 600 : 400,
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Title */}
        <div style={{ padding: '0 16px 10px' }}>
          <h2 style={{
            fontFamily: 'Lora, serif', color: 'var(--text-primary)',
            fontSize: 20, fontWeight: 700, margin: 0,
          }}>
            📚 Каталог книг
          </h2>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', marginTop: 2 }}>
            {books.length > 0 && !loading ? `${books.length}+ книг` : 'Открой что-то новое'}
          </div>
        </div>

        {/* Categories */}
        <div style={{
          display: 'flex', gap: 8, overflowX: 'auto',
          padding: '0 16px 14px', scrollbarWidth: 'none',
        }}>
          {CATEGORIES.map(cat => {
            const isActive = activeCat.label === cat.label && !query
            return (
              <button
                key={cat.label}
                onClick={() => { setActiveCat(cat); setQuery('') }}
                style={{
                  flexShrink: 0,
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 13px', borderRadius: 22,
                  border: `1px solid ${isActive ? cat.color : 'var(--border)'}`,
                  background: isActive
                    ? `${cat.color}22`
                    : 'var(--bg-raised)',
                  color: isActive ? cat.color : 'var(--text-secondary)',
                  fontSize: 12, fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  fontFamily: 'Inter, sans-serif',
                  transition: 'all 0.15s',
                }}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}
      >
        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              border: '3px solid var(--border)', borderTopColor: 'var(--accent)',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }} />
            <div style={{ color: 'var(--text-muted)', fontSize: 14, fontFamily: 'Inter, sans-serif' }}>
              Ищем книги...
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 15, fontFamily: 'Inter, sans-serif', marginBottom: 8 }}>
              {error}
            </div>
            <button
              onClick={() => doSearch(query || activeCat.query, lang, 0)}
              style={{
                padding: '10px 20px', borderRadius: 12,
                background: 'var(--accent)', border: 'none',
                color: '#fff', fontSize: 14, cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Попробовать снова
            </button>
          </div>
        )}

        {/* Book list */}
        {!loading && !error && books.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Section header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              paddingBottom: 4,
            }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: 'var(--text-muted)',
                fontFamily: 'Inter, sans-serif', textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>
                {query ? `Результаты: "${query}"` : activeCat.emoji + ' ' + activeCat.label}
              </div>
              {lang !== 'all' && (
                <div style={{
                  padding: '2px 8px', borderRadius: 20,
                  background: 'var(--accent-glow)', border: '1px solid var(--accent-dim)',
                  color: 'var(--accent)', fontSize: 10,
                  fontFamily: 'Inter, sans-serif', fontWeight: 600,
                }}>
                  {lang === 'ru' ? '🇷🇺 Русские' : '🌐 English'}
                </div>
              )}
            </div>

            {books.map((book, i) => (
              <BookCard
                key={book.id}
                book={book}
                idx={i}
                inLib={isInLib(book)}
                onAdd={() => handleAdd(book)}
                onPreview={() => setSelectedBook(book)}
              />
            ))}

            {/* Load more */}
            {loadingMore && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  border: '2px solid var(--border)', borderTopColor: 'var(--accent)',
                  animation: 'spin 0.8s linear infinite', margin: '0 auto',
                }} />
              </div>
            )}

            {!hasMore && books.length > 0 && (
              <div style={{
                textAlign: 'center', padding: '16px 0',
                color: 'var(--text-muted)', fontSize: 12,
                fontFamily: 'Inter, sans-serif',
              }}>
                Все книги загружены
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Book Detail Modal ──────────────────────────────────────── */}
      {selectedBook && (
        <BookDetailModal
          book={selectedBook}
          inLib={isInLib(selectedBook)}
          onAdd={() => handleAdd(selectedBook)}
          onClose={() => setSelectedBook(null)}
        />
      )}
    </div>
  )
}
