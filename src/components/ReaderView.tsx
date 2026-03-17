import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Settings, Bookmark, BookmarkCheck, Search, ChevronLeft, ChevronRight, X, Plus, Heart } from 'lucide-react'

interface Props {
  book: { title: string; author: string; gutenbergId?: number; coverId?: string }
  onBack: () => void
  onCreateNote?: (title: string, content: string, type: string) => void
}

const FONTS = [
  { label: 'Lora', value: "'Lora', serif" },
  { label: 'Inter', value: "'Inter', sans-serif" },
  { label: 'Georgia', value: "Georgia, serif" },
  { label: 'Mono', value: "'Courier New', monospace" },
]

const THEMES = [
  { label: '🌙', bg: '#1a1710', color: '#e8d8c0' },
  { label: '☀️', bg: '#f5ece0', color: '#2a2520' },
  { label: '📜', bg: '#f4ecd8', color: '#5a4e3c' },
]

export default function ReaderView({ book, onBack, onCreateNote }: Props) {
  const [text, setText] = useState('')
  const [pages, setPages] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fontSize, setFontSize] = useState(17)
  const [lineH, setLineH] = useState(1.8)
  const [fontIdx, setFontIdx] = useState(0)
  const [themeIdx, setThemeIdx] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [bookmarks, setBookmarks] = useState<number[]>([])
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [showTextMenu, setShowTextMenu] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const touchStart = useRef(0)

  // Load text
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        if (book.gutenbergId) {
          const urls = [
            `https://www.gutenberg.org/cache/epub/${book.gutenbergId}/pg${book.gutenbergId}.txt`,
            `https://www.gutenberg.org/files/${book.gutenbergId}/${book.gutenbergId}-0.txt`,
          ]
          let txt = ''
          for (const url of urls) {
            try {
              const r = await fetch(url)
              if (r.ok) { txt = await r.text(); break }
            } catch { continue }
          }
          if (txt) {
            const clean = txt
              .replace(/\r\n/g, '\n')
              .replace(/\n{4,}/g, '\n\n\n')
              .trim()
            setText(clean)
          } else {
            setError('Текст временно недоступен. Попробуйте позже.')
          }
        } else {
          try {
            const r = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(book.title)}&limit=1`)
            const d = await r.json()
            const doc = d.docs?.[0]
            if (doc) {
              const desc = doc.first_sentence?.join?.('\n\n') || ''
              setText(desc || `${book.title}\n\nАвтор: ${book.author}\n\nПолный текст доступен на OpenLibrary.org`)
            } else {
              setText(`${book.title}\n\nАвтор: ${book.author}`)
            }
          } catch {
            setText(`${book.title}\n\nАвтор: ${book.author}`)
          }
        }
      } catch {
        setError('Ошибка загрузки')
      }
      setLoading(false)
    }
    load()
    // Load bookmarks
    const saved = localStorage.getItem(`reader_bm_${book.title}`)
    if (saved) setBookmarks(JSON.parse(saved))
    // Load last page
    const savedPage = localStorage.getItem(`reader_pg_${book.title}`)
    if (savedPage) setPage(parseInt(savedPage))
  }, [book])

  // Paginate
  useEffect(() => {
    if (!text) return
    const charsPerPage = Math.floor((window.innerHeight - 140) / (fontSize * lineH)) * Math.floor(window.innerWidth / (fontSize * 0.55))
    const p: string[] = []
    for (let i = 0; i < text.length; i += charsPerPage) {
      p.push(text.slice(i, i + charsPerPage))
    }
    setPages(p.length ? p : [text])
    if (page >= p.length) setPage(Math.max(0, p.length - 1))
  }, [text, fontSize, lineH, page])

  // Save page
  useEffect(() => {
    if (pages.length > 0) localStorage.setItem(`reader_pg_${book.title}`, page.toString())
  }, [page, book.title, pages.length])

  const toggleBookmark = () => {
    const bm = bookmarks.includes(page) ? bookmarks.filter(b => b !== page) : [...bookmarks, page]
    setBookmarks(bm)
    localStorage.setItem(`reader_bm_${book.title}`, JSON.stringify(bm))
  }

  const handleTextSelect = () => {
    const sel = window.getSelection()?.toString().trim()
    if (sel && sel.length > 3) {
      setSelectedText(sel)
      setShowTextMenu(true)
    }
  }

  const goPage = (d: number) => setPage(p => Math.max(0, Math.min(pages.length - 1, p + d)))

  const handleTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX }
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStart.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 60) goPage(diff > 0 ? 1 : -1)
  }

  const progress = pages.length > 1 ? ((page + 1) / pages.length * 100) : 100
  const theme = THEMES[themeIdx]
  const font = FONTS[fontIdx]

  const searchResults = searchQ ? pages.reduce<number[]>((acc, p, i) => {
    if (p.toLowerCase().includes(searchQ.toLowerCase())) acc.push(i)
    return acc
  }, []) : []

  return (
    <div style={{ position: 'fixed', inset: 0, background: theme.bg, color: theme.color, zIndex: 200, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', paddingTop: 'max(8px, env(safe-area-inset-top))', gap: 8, borderBottom: '1px solid rgba(128,128,128,0.15)' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: theme.color, cursor: 'pointer', padding: 4 }}><ArrowLeft size={20} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</p>
          <p style={{ margin: 0, fontSize: 11, opacity: 0.6 }}>{book.author}</p>
        </div>
        <button onClick={() => setShowSearch(!showSearch)} style={{ background: 'none', border: 'none', color: theme.color, cursor: 'pointer', padding: 4 }}><Search size={18} /></button>
        <button onClick={toggleBookmark} style={{ background: 'none', border: 'none', color: bookmarks.includes(page) ? '#e8b84b' : theme.color, cursor: 'pointer', padding: 4 }}>
          {bookmarks.includes(page) ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
        </button>
        <button onClick={() => setShowBookmarks(!showBookmarks)} style={{ background: 'none', border: 'none', color: theme.color, cursor: 'pointer', padding: 4, fontSize: 12, opacity: 0.7 }}>
          {bookmarks.length > 0 ? `🔖${bookmarks.length}` : ''}
        </button>
        <button onClick={() => setShowSettings(!showSettings)} style={{ background: 'none', border: 'none', color: theme.color, cursor: 'pointer', padding: 4 }}><Settings size={18} /></button>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(128,128,128,0.15)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Поиск в тексте..."
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(128,128,128,0.2)', background: 'rgba(128,128,128,0.1)', color: theme.color, fontSize: 14, outline: 'none' }} autoFocus />
          {searchResults.length > 0 && <span style={{ fontSize: 12, opacity: 0.6 }}>{searchResults.length} стр.</span>}
          <button onClick={() => { setShowSearch(false); setSearchQ('') }} style={{ background: 'none', border: 'none', color: theme.color, cursor: 'pointer' }}><X size={18} /></button>
        </div>
      )}

      {/* Search results */}
      {showSearch && searchResults.length > 0 && (
        <div style={{ padding: '4px 12px', display: 'flex', gap: 4, flexWrap: 'wrap', borderBottom: '1px solid rgba(128,128,128,0.1)' }}>
          {searchResults.slice(0, 20).map(p => (
            <button key={p} onClick={() => setPage(p)} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: page === p ? 'var(--accent)' : 'rgba(128,128,128,0.15)', color: page === p ? '#fff' : theme.color, fontSize: 11, cursor: 'pointer' }}>стр.{p + 1}</button>
          ))}
        </div>
      )}

      {/* Bookmarks panel */}
      {showBookmarks && bookmarks.length > 0 && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(128,128,128,0.1)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: theme.color, opacity: 0.6, marginRight: 4 }}>Закладки:</span>
          {bookmarks.sort((a, b) => a - b).map(b => (
            <button key={b} onClick={() => setPage(b)} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: page === b ? '#e8b84b' : 'rgba(128,128,128,0.15)', color: page === b ? '#000' : theme.color, fontSize: 11, cursor: 'pointer' }}>📖 {b + 1}</button>
          ))}
        </div>
      )}

      {/* Settings */}
      {showSettings && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(128,128,128,0.15)', background: 'rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <span style={{ fontSize: 12, opacity: 0.6, width: 60 }}>Размер</span>
            <button onClick={() => setFontSize(s => Math.max(12, s - 1))} style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid rgba(128,128,128,0.2)', background: 'rgba(128,128,128,0.1)', color: theme.color, fontSize: 16, cursor: 'pointer' }}>A-</button>
            <span style={{ fontSize: 14, minWidth: 30, textAlign: 'center' }}>{fontSize}</span>
            <button onClick={() => setFontSize(s => Math.min(28, s + 1))} style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid rgba(128,128,128,0.2)', background: 'rgba(128,128,128,0.1)', color: theme.color, fontSize: 16, cursor: 'pointer' }}>A+</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <span style={{ fontSize: 12, opacity: 0.6, width: 60 }}>Интервал</span>
            <input type="range" min="1.2" max="2.4" step="0.1" value={lineH} onChange={e => setLineH(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: '#e8b84b' }} />
            <span style={{ fontSize: 12, minWidth: 24 }}>{lineH}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 12, opacity: 0.6, width: 60 }}>Шрифт</span>
            {FONTS.map((f, i) => (
              <button key={f.label} onClick={() => setFontIdx(i)}
                style={{ padding: '5px 10px', borderRadius: 6, border: fontIdx === i ? '2px solid #e8b84b' : '1px solid rgba(128,128,128,0.2)', background: 'rgba(128,128,128,0.1)', color: theme.color, fontSize: 12, cursor: 'pointer', fontFamily: f.value }}>
                {f.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, opacity: 0.6, width: 60 }}>Тема</span>
            {THEMES.map((t, i) => (
              <button key={i} onClick={() => setThemeIdx(i)}
                style={{ width: 36, height: 36, borderRadius: 8, border: themeIdx === i ? '2px solid #e8b84b' : '1px solid rgba(128,128,128,0.2)', background: t.bg, color: t.color, fontSize: 16, cursor: 'pointer' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div ref={contentRef} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onMouseUp={handleTextSelect}
        style={{ flex: 1, overflowY: 'auto', padding: '20px 20px', fontFamily: font.value, fontSize, lineHeight: lineH }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <p style={{ fontSize: 14, opacity: 0.6 }}>Загружаем книгу...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>📚</p>
            <p style={{ fontSize: 14, opacity: 0.6 }}>{error}</p>
          </div>
        ) : (
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {searchQ ? (
              pages[page]?.split(new RegExp(`(${searchQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')).map((part, i) =>
                part.toLowerCase() === searchQ.toLowerCase()
                  ? <mark key={i} style={{ background: '#e8b84b', color: '#000', borderRadius: 2, padding: '0 2px' }}>{part}</mark>
                  : part
              )
            ) : pages[page]}
          </div>
        )}
      </div>

      {/* Text selection menu */}
      {showTextMenu && selectedText && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, padding: '8px 12px', borderRadius: 12, background: 'var(--bg-raised)', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', zIndex: 300, animation: 'fadeSlideUp 0.2s ease' }}>
          <button onClick={() => { onCreateNote?.(book.title + ' — заметка', selectedText, 'note'); setShowTextMenu(false) }}
            style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Plus size={14} /> Заметка
          </button>
          <button onClick={() => { onCreateNote?.(book.title + ' — цитата', selectedText, 'quote'); setShowTextMenu(false) }}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Heart size={14} /> Цитата
          </button>
          <button onClick={() => setShowTextMenu(false)} style={{ padding: '4px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
        </div>
      )}

      {/* Bottom bar */}
      {pages.length > 1 && !loading && (
        <div style={{ padding: '8px 16px', paddingBottom: 'max(8px, env(safe-area-inset-bottom))', borderTop: '1px solid rgba(128,128,128,0.15)', background: theme.bg }}>
          {/* Progress bar */}
          <div style={{ height: 3, borderRadius: 2, background: 'rgba(128,128,128,0.2)', marginBottom: 8 }}>
            <div style={{ height: '100%', borderRadius: 2, background: '#e8b84b', width: `${progress}%`, transition: 'width 0.3s ease' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={() => goPage(-1)} disabled={page === 0}
              style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(128,128,128,0.2)', background: 'rgba(128,128,128,0.1)', color: page === 0 ? 'rgba(128,128,128,0.3)' : theme.color, cursor: page === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ChevronLeft size={16} /> Назад
            </button>
            <span style={{ fontSize: 12, opacity: 0.6 }}>{page + 1} / {pages.length} · {Math.round(progress)}%</span>
            <button onClick={() => goPage(1)} disabled={page === pages.length - 1}
              style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(128,128,128,0.2)', background: 'rgba(128,128,128,0.1)', color: page === pages.length - 1 ? 'rgba(128,128,128,0.3)' : theme.color, cursor: page === pages.length - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              Далее <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}