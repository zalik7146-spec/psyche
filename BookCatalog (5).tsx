import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, X, BookOpen, Plus, Star, Globe, ChevronLeft, Library, RefreshCw } from 'lucide-react'
import { Book } from '../types'

// ── Types ──────────────────────────────────────────────────────────────────
interface GBook {
  id: string
  volumeInfo: {
    title: string
    authors?: string[]
    description?: string
    imageLinks?: { thumbnail?: string; smallThumbnail?: string }
    publishedDate?: string
    averageRating?: number
    ratingsCount?: number
    pageCount?: number
    categories?: string[]
    language?: string
    previewLink?: string
  }
}

interface GutBook {
  id: number
  title: string
  authors: { name: string; birth_year?: number; death_year?: number }[]
  languages: string[]
  formats: Record<string, string>
  download_count: number
  subjects?: string[]
}

interface Props {
  onClose: () => void
  onAddToLibrary: (book: Partial<Book>) => void
  onOpenReader: (book: { id: string; title: string; author: string; textUrl: string; coverUrl?: string }) => void
  existingBooks: Book[]
}

// ── Constants ──────────────────────────────────────────────────────────────
const UI_FONT = 'Inter, system-ui, sans-serif'

const GBOOK_CATS = [
  { label: 'Психология',   query: 'психология',           emoji: '🧠' },
  { label: 'Философия',    query: 'философия',             emoji: '💭' },
  { label: 'Классика',     query: 'классика литература',   emoji: '📖' },
  { label: 'Наука',        query: 'популярная наука',      emoji: '🔬' },
  { label: 'Саморазвитие', query: 'личностный рост',       emoji: '🌱' },
  { label: 'Бизнес',       query: 'бизнес менеджмент',     emoji: '💼' },
  { label: 'История',      query: 'история',               emoji: '🏛️' },
  { label: 'Bestsellers',  query: 'bestseller self help',  emoji: '🌍' },
]

const GUT_CATS = [
  { label: 'Все русские', query: '', lang: 'ru', emoji: '🇷🇺' },
  { label: 'Достоевский', query: 'dostoevsky',  lang: 'ru', emoji: '✍️' },
  { label: 'Толстой',     query: 'tolstoy',     lang: 'ru', emoji: '📜' },
  { label: 'Чехов',       query: 'chekhov',     lang: 'ru', emoji: '🎭' },
  { label: 'Пушкин',      query: 'pushkin',     lang: 'ru', emoji: '🖊️' },
  { label: 'Тургенев',    query: 'turgenev',    lang: 'ru', emoji: '🌿' },
  { label: 'Гоголь',      query: 'gogol',       lang: 'ru', emoji: '👻' },
  { label: 'Классика EN',  query: 'classic',    lang: 'en', emoji: '🌐' },
]

// ── Helpers ────────────────────────────────────────────────────────────────
const cleanCover = (url?: string) =>
  url ? url.replace('zoom=1', 'zoom=3').replace('http://', 'https://') : null

const cleanDesc = (html?: string) =>
  html ? html.replace(/<[^>]+>/g, '').slice(0, 180) : ''

const getGutTextUrl = (book: GutBook): string | null => {
  const f = book.formats
  return f['text/plain; charset=utf-8']
    || f['text/plain; charset=UTF-8']
    || f['text/plain']
    || f['text/plain; charset=us-ascii']
    || null
}

const getGutCover = (book: GutBook): string | null => {
  const f = book.formats
  return f['image/jpeg'] || null
}

const authorDisplay = (book: GutBook) => {
  if (!book.authors?.length) return 'Неизвестен'
  const a = book.authors[0]
  // Gutenberg stores "Last, First" - convert to "First Last"
  const name = a.name || ''
  const parts = name.split(', ')
  return parts.length === 2 ? `${parts[1]} ${parts[0]}` : name
}

const bookColors = ['#b07d4a','#6a9e8a','#8a7a9a','#7a8a6a','#9a8a4a','#6a7a9a','#a07060','#608090']
const bookColor = (i: number) => bookColors[i % bookColors.length]

// ── Gutendex fetch ─────────────────────────────────────────────────────────
async function fetchGutendex(search: string, lang: string, page = 1): Promise<{ results: GutBook[]; count: number }> {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (lang) params.set('languages', lang)
  params.set('page', String(page))
  const url = `https://gutendex.com/books/?${params}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Ошибка загрузки')
  return res.json()
}

// ── Google Books fetch ─────────────────────────────────────────────────────
async function fetchGoogleBooks(q: string, lang: string, startIndex = 0): Promise<GBook[]> {
  const langParam = lang !== 'all' ? `&langRestrict=${lang}` : ''
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=20&startIndex=${startIndex}&printType=books${langParam}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Ошибка')
  const data = await res.json()
  return (data.items || []) as GBook[]
}

// ── Gut Book Card ──────────────────────────────────────────────────────────
function GutCard({ book, idx, inLib, onAdd, onRead }: {
  book: GutBook; idx: number; inLib: boolean
  onAdd: () => void; onRead: () => void
}) {
  const cover = getGutCover(book)
  const hasText = !!getGutTextUrl(book)
  const [imgErr, setImgErr] = useState(false)
  const author = authorDisplay(book)

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 18, padding: 14, display: 'flex', gap: 14,
      animation: `fadeSlideUp 0.25s ease ${(idx % 8) * 0.04}s both`,
      fontFamily: UI_FONT,
    }}>
      {/* Cover */}
      <div onClick={onRead} style={{
        width: 68, height: 100, borderRadius: 10, flexShrink: 0,
        background: cover && !imgErr ? 'transparent' : `linear-gradient(145deg, ${bookColor(idx)}, ${bookColor(idx + 2)})`,
        overflow: 'hidden', border: '1px solid var(--border)',
        cursor: hasText ? 'pointer' : 'default',
        boxShadow: '2px 4px 12px rgba(0,0,0,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {cover && !imgErr
          ? <img src={cover} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgErr(true)} />
          : <div style={{ textAlign: 'center', padding: 4 }}>
              <div style={{ fontSize: 24 }}>📖</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', marginTop: 4, lineHeight: 1.2, padding: '0 2px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{book.title}</div>
            </div>
        }
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div onClick={onRead} style={{
          fontFamily: 'Lora, serif', fontWeight: 700, color: 'var(--text-primary)',
          fontSize: 15, lineHeight: 1.3, marginBottom: 4, cursor: hasText ? 'pointer' : 'default',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {book.title}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 6, fontFamily: UI_FONT }}>
          {author}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {hasText && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 9px', borderRadius: 20,
              background: 'rgba(100,180,100,0.12)', border: '1px solid rgba(100,180,100,0.25)',
              color: 'var(--green)', fontSize: 10, fontWeight: 600, fontFamily: UI_FONT,
            }}>
              ✓ Полный текст
            </div>
          )}
          {book.download_count > 0 && (
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: UI_FONT }}>
              ↓ {book.download_count.toLocaleString()}
            </div>
          )}
        </div>
        {book.subjects && book.subjects.length > 0 && (
          <div style={{
            fontSize: 10, color: 'var(--text-muted)', fontFamily: UI_FONT,
            display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            marginBottom: 8,
          }}>
            {book.subjects.slice(0, 2).join(' · ')}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          {hasText && (
            <button onClick={onRead} style={{
              flex: 1, padding: '7px 0', borderRadius: 10,
              background: 'linear-gradient(135deg, var(--accent), #8a5220)',
              border: 'none', color: '#fff', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              fontFamily: UI_FONT,
            }}>
              <BookOpen size={12} /> Читать
            </button>
          )}
          <button onClick={!inLib ? onAdd : undefined} style={{
            flex: 1, padding: '7px 0', borderRadius: 10,
            background: inLib ? 'var(--bg-active)' : 'var(--bg-raised)',
            border: `1px solid ${inLib ? 'var(--accent-dim)' : 'var(--border)'}`,
            color: inLib ? 'var(--accent)' : 'var(--text-secondary)',
            fontSize: 12, cursor: inLib ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            fontFamily: UI_FONT,
          }}>
            {inLib ? '✓ В библиотеке' : <><Plus size={12} /> В библиотеку</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Google Book Card ───────────────────────────────────────────────────────
function GBookCard({ book, idx, inLib, onAdd }: {
  book: GBook; idx: number; inLib: boolean; onAdd: () => void
}) {
  const vi = book.volumeInfo
  const cover = cleanCover(vi.imageLinks?.thumbnail)
  const [imgErr, setImgErr] = useState(false)

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 18, padding: 14, display: 'flex', gap: 14,
      animation: `fadeSlideUp 0.25s ease ${(idx % 8) * 0.04}s both`,
      fontFamily: UI_FONT,
    }}>
      <div style={{
        width: 68, height: 100, borderRadius: 10, flexShrink: 0,
        background: cover && !imgErr ? 'transparent' : `linear-gradient(145deg, ${bookColor(idx)}, ${bookColor(idx + 2)})`,
        overflow: 'hidden', border: '1px solid var(--border)',
        boxShadow: '2px 4px 12px rgba(0,0,0,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {cover && !imgErr
          ? <img src={cover} alt={vi.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgErr(true)} />
          : <span style={{ fontSize: 28 }}>📖</span>
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Lora, serif', fontWeight: 700, color: 'var(--text-primary)', fontSize: 15, lineHeight: 1.3, marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {vi.title}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4, fontFamily: UI_FONT }}>
          {vi.authors?.slice(0, 2).join(', ') || 'Автор неизвестен'}
          {vi.publishedDate && <span style={{ opacity: 0.7 }}> · {vi.publishedDate.slice(0, 4)}</span>}
        </div>
        {vi.averageRating && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 6 }}>
            <Star size={11} fill="var(--gold)" color="var(--gold)" />
            <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600, fontFamily: UI_FONT }}>{vi.averageRating.toFixed(1)}</span>
          </div>
        )}
        {vi.description && (
          <div style={{ color: 'var(--text-secondary)', fontSize: 12, fontFamily: UI_FONT, lineHeight: 1.5, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {cleanDesc(vi.description)}
          </div>
        )}
        <button onClick={!inLib ? onAdd : undefined} style={{
          width: '100%', padding: '7px 0', borderRadius: 10,
          background: inLib ? 'var(--bg-active)' : 'var(--bg-raised)',
          border: `1px solid ${inLib ? 'var(--accent-dim)' : 'var(--border)'}`,
          color: inLib ? 'var(--accent)' : 'var(--text-secondary)',
          fontSize: 12, cursor: inLib ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          fontFamily: UI_FONT,
        }}>
          {inLib ? '✓ В библиотеке' : <><Plus size={12} /> В библиотеку</>}
        </button>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function BookCatalog({ onClose, onAddToLibrary, onOpenReader, existingBooks }: Props) {
  const [mode, setMode] = useState<'read' | 'catalog'>('read')
  const [query, setQuery] = useState('')

  // Gutendex state
  const [gutCat, setGutCat] = useState(GUT_CATS[0])
  const [gutBooks, setGutBooks] = useState<GutBook[]>([])
  const [gutLoading, setGutLoading] = useState(false)
  const [gutError, setGutError] = useState('')
  const [gutPage, setGutPage] = useState(1)
  const [gutTotal, setGutTotal] = useState(0)

  // Google Books state
  const [gCat, setGCat] = useState(GBOOK_CATS[0])
  const [gBooks, setGBooks] = useState<GBook[]>([])
  const [gLoading, setGLoading] = useState(false)
  const [gError, setGError] = useState('')
  const [gPage, setGPage] = useState(0)

  const scrollRef = useRef<HTMLDivElement>(null)

  const isInLib = (title: string) => existingBooks.some(b => b.title.toLowerCase() === title.toLowerCase())

  // ── Load Gutendex ──────────────────────────────────────────────────────
  const loadGut = useCallback(async (search: string, cat: typeof GUT_CATS[0], page: number, append = false) => {
    if (page === 1 && !append) { setGutLoading(true); setGutError(''); setGutBooks([]) }
    try {
      const data = await fetchGutendex(search || cat.query, cat.lang, page)
      setGutBooks(prev => append ? [...prev, ...data.results] : data.results)
      setGutTotal(data.count)
    } catch {
      setGutError('Не удалось загрузить книги. Проверьте интернет.')
    }
    setGutLoading(false)
  }, [])

  // ── Load Google Books ──────────────────────────────────────────────────
  const loadGbooks = useCallback(async (search: string, cat: typeof GBOOK_CATS[0], idx: number, append = false) => {
    if (idx === 0 && !append) { setGLoading(true); setGError(''); setGBooks([]) }
    try {
      const results = await fetchGoogleBooks(search || cat.query, 'all', idx)
      setGBooks(prev => append ? [...prev, ...results] : results)
    } catch {
      setGError('Не удалось загрузить. Проверьте интернет.')
    }
    setGLoading(false)
  }, [])

  // Initial load
  useEffect(() => {
    if (mode === 'read') { setGutPage(1); loadGut('', gutCat, 1) }
    else { setGPage(0); loadGbooks('', gCat, 0) }
  }, [mode]) // eslint-disable-line

  // Gutendex: category change
  useEffect(() => { if (mode === 'read' && !query) { setGutPage(1); loadGut('', gutCat, 1) } }, [gutCat]) // eslint-disable-line
  useEffect(() => { if (mode === 'catalog' && !query) { setGPage(0); loadGbooks('', gCat, 0) } }, [gCat]) // eslint-disable-line

  // Search debounce
  useEffect(() => {
    if (!query.trim()) return
    const t = setTimeout(() => {
      if (mode === 'read') { setGutPage(1); loadGut(query, gutCat, 1) }
      else { setGPage(0); loadGbooks(query, gCat, 0) }
    }, 600)
    return () => clearTimeout(t)
  }, [query, mode]) // eslint-disable-line

  // Clear search
  useEffect(() => {
    if (!query) {
      if (mode === 'read') { setGutPage(1); loadGut('', gutCat, 1) }
      else { setGPage(0); loadGbooks('', gCat, 0) }
    }
  }, [query]) // eslint-disable-line

  // Infinite scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 150) {
      if (mode === 'read' && !gutLoading && gutBooks.length < gutTotal) {
        const next = gutPage + 1
        setGutPage(next)
        loadGut(query || '', gutCat, next, true)
      } else if (mode === 'catalog' && !gLoading) {
        const next = gPage + 20
        setGPage(next)
        loadGbooks(query || '', gCat, next, true)
      }
    }
  }, [mode, gutLoading, gutBooks.length, gutTotal, gutPage, gLoading, gPage, query, gutCat, gCat, loadGut, loadGbooks])

  const handleGutAdd = (book: GutBook) => {
    onAddToLibrary({
      title: book.title, author: authorDisplay(book),
      coverEmoji: '📖', color: bookColor(gutBooks.indexOf(book)),
      status: 'want', tags: book.subjects?.slice(0, 2) || [],
      coverUrl: getGutCover(book) || undefined,
    })
  }

  const handleGutRead = (book: GutBook) => {
    const url = getGutTextUrl(book)
    if (!url) return
    onOpenReader({
      id: `gut_${book.id}`,
      title: book.title,
      author: authorDisplay(book),
      textUrl: url,
      coverUrl: getGutCover(book) || undefined,
    })
  }

  const handleGAdd = (book: GBook) => {
    const vi = book.volumeInfo
    onAddToLibrary({
      title: vi.title, author: vi.authors?.[0] || 'Неизвестен',
      coverEmoji: '📖', color: bookColor(gBooks.indexOf(book)),
      status: 'want', tags: vi.categories?.slice(0, 2) || [],
      coverUrl: cleanCover(vi.imageLinks?.thumbnail) || undefined,
      description: cleanDesc(vi.description),
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', zIndex: 200, fontFamily: UI_FONT }}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, background: 'var(--bg-base)', borderBottom: '1px solid var(--border)', paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px 12px' }}>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-raised)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-primary)', flexShrink: 0 }}>
            <X size={18} />
          </button>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 12, padding: '9px 12px' }}>
            <Search size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={mode === 'read' ? 'Поиск книг для чтения...' : 'Поиск в каталоге...'} style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 14, fontFamily: UI_FONT }} />
            {query && <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}><X size={14} /></button>}
          </div>
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-raised)', borderRadius: 12, padding: 3, margin: '0 16px 12px' }}>
          {([
            { id: 'read', label: '📖 Читать онлайн', desc: 'Полные тексты' },
            { id: 'catalog', label: '🔍 Каталог', desc: 'Google Books' },
          ] as const).map(t => (
            <button key={t.id} onClick={() => { setMode(t.id); setQuery('') }}
              style={{
                flex: 1, padding: '8px 6px', borderRadius: 9, border: 'none',
                background: mode === t.id ? 'var(--bg-card)' : 'transparent',
                color: mode === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: 12, fontWeight: mode === t.id ? 700 : 400,
                cursor: 'pointer', fontFamily: UI_FONT, transition: 'all 0.15s',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Category chips */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 16px 14px', scrollbarWidth: 'none' }}>
          {(mode === 'read' ? GUT_CATS : GBOOK_CATS).map((cat) => {
            const isActive = mode === 'read' ? gutCat.label === cat.label && !query : gCat.label === cat.label && !query
            return (
              <button key={cat.label} onClick={() => { mode === 'read' ? setGutCat(cat as typeof GUT_CATS[0]) : setGCat(cat as typeof GBOOK_CATS[0]); setQuery('') }}
                style={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 13px', borderRadius: 22,
                  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                  background: isActive ? 'var(--accent-glow)' : 'var(--bg-raised)',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: 12, fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: UI_FONT, transition: 'all 0.15s',
                }}>
                {'emoji' in cat ? <span>{cat.emoji}</span> : null}
                <span>{cat.label}</span>
              </button>
            )
          })}
        </div>

        {/* Title */}
        <div style={{ padding: '0 16px 12px' }}>
          <h2 style={{ fontFamily: 'Lora, serif', color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, margin: 0 }}>
            {mode === 'read' ? '📖 Книги для чтения' : '🔍 Каталог книг'}
          </h2>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: UI_FONT, marginTop: 2 }}>
            {mode === 'read'
              ? `${gutTotal > 0 ? gutTotal.toLocaleString() + '+' : ''} книг с полным текстом`
              : 'Добавляйте книги в библиотеку'}
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>

        {/* Loading */}
        {(mode === 'read' ? gutLoading : gLoading) && (mode === 'read' ? gutBooks : gBooks).length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ color: 'var(--text-muted)', fontSize: 14, fontFamily: UI_FONT }}>Загружаем...</div>
          </div>
        )}

        {/* Error */}
        {(mode === 'read' ? gutError : gError) && (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 14, fontFamily: UI_FONT, marginBottom: 16 }}>
              {mode === 'read' ? gutError : gError}
            </div>
            <button onClick={() => mode === 'read' ? loadGut(query, gutCat, 1) : loadGbooks(query, gCat, 0)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 12, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 14, cursor: 'pointer', margin: '0 auto', fontFamily: UI_FONT }}>
              <RefreshCw size={14} /> Повторить
            </button>
          </div>
        )}

        {/* Read mode: Gutendex */}
        {mode === 'read' && !gutError && gutBooks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: UI_FONT, paddingBottom: 4 }}>
              {query ? `Результаты: "${query}"` : `${gutCat.emoji} ${gutCat.label}`} · {gutTotal.toLocaleString()} книг
            </div>
            {gutBooks.map((b, i) => (
              <GutCard key={b.id} book={b} idx={i} inLib={isInLib(b.title)} onAdd={() => handleGutAdd(b)} onRead={() => handleGutRead(b)} />
            ))}
            {gutLoading && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
              </div>
            )}
          </div>
        )}

        {/* Catalog mode: Google Books */}
        {mode === 'catalog' && !gError && gBooks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: UI_FONT, paddingBottom: 4 }}>
              {query ? `Результаты: "${query}"` : `${gCat.emoji} ${gCat.label}`}
              <span style={{ marginLeft: 8, color: 'var(--accent)', fontSize: 10, fontWeight: 400 }}>Google Books</span>
            </div>
            {gBooks.map((b, i) => (
              <GBookCard key={b.id} book={b} idx={i} inLib={isInLib(b.volumeInfo.title)} onAdd={() => handleGAdd(b)} />
            ))}
            {gLoading && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!gutLoading && !gLoading && !gutError && !gError && (mode === 'read' ? gutBooks : gBooks).length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 15, fontFamily: UI_FONT }}>Ничего не найдено</div>
          </div>
        )}
      </div>
    </div>
  )
}
