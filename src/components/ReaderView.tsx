import { useState, useEffect, useRef, useCallback } from 'react'

interface ReaderBook {
  id: string
  title: string
  author: string
  textUrl?: string
  coverUrl?: string
  source?: string
}

interface Props {
  book: ReaderBook
  onClose: () => void
  onCreateNote: (title: string, content: string, type: string) => void
}

const FONTS = ['Lora, serif', 'Inter, sans-serif', 'Georgia, serif', "'Courier New', monospace"]
const FONT_NAMES = ['Lora', 'Inter', 'Georgia', 'Mono']
const THEMES = {
  dark: { bg: '#15120e', text: '#eedfc4', panel: '#1e1b15' },
  light: { bg: '#faf6f0', text: '#2c2416', panel: '#f0ebe0' },
  sepia: { bg: '#1e1810', text: '#e8d4a0', panel: '#261f13' },
}

const WORDS_PER_PAGE = 300

export default function ReaderView({ book, onClose, onCreateNote }: Props) {
  const [pages, setPages] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [theme, setTheme] = useState<'dark' | 'light' | 'sepia'>('dark')
  const [fontSize, setFontSize] = useState(17)
  const [lineHeight, setLineHeight] = useState(1.8)
  const [fontIndex, setFontIndex] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [bookmarks, setBookmarks] = useState<number[]>([])
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [selection, setSelection] = useState('')
  const [showSelMenu, setShowSelMenu] = useState(false)
  const [pageAnim, setPageAnim] = useState<'left' | 'right' | null>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const contentRef = useRef<HTMLDivElement>(null)
  const vibe = (ms = 8) => navigator.vibrate?.(ms)

  const colors = THEMES[theme]
  const progress = pages.length ? Math.round(((currentPage + 1) / pages.length) * 100) : 0
  const storageKey = `reader_${book.id}`

  // Load saved page
  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) setCurrentPage(parseInt(saved) || 0)
  }, [storageKey])

  // Save page on change
  useEffect(() => {
    localStorage.setItem(storageKey, currentPage.toString())
  }, [currentPage, storageKey])

  // Load bookmarks
  useEffect(() => {
    const saved = localStorage.getItem(`bookmarks_${book.id}`)
    if (saved) setBookmarks(JSON.parse(saved))
  }, [book.id])

  const saveBookmarks = (bm: number[]) => {
    setBookmarks(bm)
    localStorage.setItem(`bookmarks_${book.id}`, JSON.stringify(bm))
  }

  // Fetch book text
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        let text = ''
        if (book.textUrl) {
          // Try direct fetch first
          try {
            const res = await fetch(book.textUrl)
            if (res.ok) {
              const raw = await res.text()
              // Strip HTML tags if needed
              text = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
            }
          } catch {
            // If CORS blocked, use proxy
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(book.textUrl)}`
            const res = await fetch(proxyUrl)
            if (res.ok) {
              const raw = await res.text()
              text = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
            }
          }
        }

        if (!text || text.length < 100) {
          // Fallback: try Gutenberg ID from book.id
          const gutId = book.id.replace('gutenberg_', '')
          if (gutId && !isNaN(parseInt(gutId))) {
            const urls = [
              `https://www.gutenberg.org/cache/epub/${gutId}/pg${gutId}.txt`,
              `https://www.gutenberg.org/files/${gutId}/${gutId}-0.txt`,
              `https://www.gutenberg.org/files/${gutId}/${gutId}.txt`,
            ]
            for (const url of urls) {
              try {
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
                const res = await fetch(proxyUrl)
                if (res.ok) {
                  text = await res.text()
                  if (text.length > 500) break
                }
              } catch { continue }
            }
          }
        }

        if (!text || text.length < 100) {
          setError('Полный текст недоступен. Попробуй другую книгу из каталога.')
          setLoading(false)
          return
        }

        // Split into pages by words
        const words = text.split(/\s+/).filter(w => w.length > 0)
        const pageArr: string[] = []
        for (let i = 0; i < words.length; i += WORDS_PER_PAGE) {
          pageArr.push(words.slice(i, i + WORDS_PER_PAGE).join(' '))
        }
        setPages(pageArr)
      } catch {
        setError('Ошибка загрузки книги. Проверь подключение к интернету.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [book])

  const goPage = useCallback((dir: 'next' | 'prev') => {
    if (dir === 'next' && currentPage < pages.length - 1) {
      setPageAnim('left')
      setTimeout(() => { setCurrentPage(p => p + 1); setPageAnim(null) }, 200)
      vibe(6)
    } else if (dir === 'prev' && currentPage > 0) {
      setPageAnim('right')
      setTimeout(() => { setCurrentPage(p => p - 1); setPageAnim(null) }, 200)
      vibe(6)
    }
  }, [currentPage, pages.length])

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) goPage('next')
      else goPage('prev')
    }
  }

  const handleTextSelect = () => {
    const sel = window.getSelection()
    const text = sel?.toString().trim() || ''
    if (text.length > 3) {
      setSelection(text)
      setShowSelMenu(true)
    } else {
      setShowSelMenu(false)
    }
  }

  const toggleBookmark = () => {
    vibe(10)
    const bm = bookmarks.includes(currentPage)
      ? bookmarks.filter(b => b !== currentPage)
      : [...bookmarks, currentPage].sort((a, b) => a - b)
    saveBookmarks(bm)
  }

  const isBookmarked = bookmarks.includes(currentPage)

  return (
    <div style={{ position: 'fixed', inset: 0, background: colors.bg, zIndex: 300, display: 'flex', flexDirection: 'column', fontFamily: FONTS[fontIndex] }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '48px 16px 12px', background: colors.panel, borderBottom: `1px solid ${colors.text}22`, flexShrink: 0 }}>
        <button onClick={() => { vibe(); onClose() }} style={{ background: `${colors.text}18`, border: 'none', borderRadius: 10, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 18, color: colors.text, flexShrink: 0 }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</div>
          <div style={{ fontSize: 11, color: `${colors.text}80` }}>{book.author}</div>
        </div>
        <button onClick={() => { vibe(); toggleBookmark() }} style={{ background: isBookmarked ? '#b07d4a' : `${colors.text}18`, border: 'none', borderRadius: 10, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16 }}>🔖</button>
        <button onClick={() => { vibe(); setShowBookmarks(b => !b) }} style={{ background: `${colors.text}18`, border: 'none', borderRadius: 10, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16 }}>📑</button>
        <button onClick={() => { vibe(); setShowSettings(s => !s) }} style={{ background: showSettings ? '#b07d4a' : `${colors.text}18`, border: 'none', borderRadius: 10, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16 }}>⚙️</button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div style={{ background: colors.panel, borderBottom: `1px solid ${colors.text}22`, padding: '12px 16px', flexShrink: 0 }}>
          {/* Theme */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {(['dark', 'light', 'sepia'] as const).map(t => (
              <button key={t} onClick={() => setTheme(t)} style={{ flex: 1, padding: '8px 4px', borderRadius: 10, border: theme === t ? '2px solid #b07d4a' : `1px solid ${colors.text}30`, background: THEMES[t].bg, color: THEMES[t].text, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {t === 'dark' ? '🌙 Тёмная' : t === 'light' ? '☀️ Светлая' : '📜 Сепия'}
              </button>
            ))}
          </div>
          {/* Font size */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: `${colors.text}80`, width: 80 }}>Размер</span>
            <button onClick={() => setFontSize(s => Math.max(12, s - 1))} style={{ background: `${colors.text}18`, border: 'none', borderRadius: 8, width: 32, height: 32, color: colors.text, fontSize: 16, cursor: 'pointer' }}>A-</button>
            <span style={{ color: colors.text, fontSize: 14, minWidth: 30, textAlign: 'center' }}>{fontSize}</span>
            <button onClick={() => setFontSize(s => Math.min(28, s + 1))} style={{ background: `${colors.text}18`, border: 'none', borderRadius: 8, width: 32, height: 32, color: colors.text, fontSize: 16, cursor: 'pointer' }}>A+</button>
          </div>
          {/* Line height */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: `${colors.text}80`, width: 80 }}>Интервал</span>
            <button onClick={() => setLineHeight(h => Math.max(1.2, parseFloat((h - 0.2).toFixed(1))))} style={{ background: `${colors.text}18`, border: 'none', borderRadius: 8, width: 32, height: 32, color: colors.text, fontSize: 14, cursor: 'pointer' }}>−</button>
            <span style={{ color: colors.text, fontSize: 14, minWidth: 30, textAlign: 'center' }}>{lineHeight}</span>
            <button onClick={() => setLineHeight(h => Math.min(2.4, parseFloat((h + 0.2).toFixed(1))))} style={{ background: `${colors.text}18`, border: 'none', borderRadius: 8, width: 32, height: 32, color: colors.text, fontSize: 14, cursor: 'pointer' }}>+</button>
          </div>
          {/* Font */}
          <div style={{ display: 'flex', gap: 6 }}>
            {FONT_NAMES.map((name, i) => (
              <button key={i} onClick={() => setFontIndex(i)} style={{ flex: 1, padding: '6px 4px', borderRadius: 8, border: fontIndex === i ? '2px solid #b07d4a' : `1px solid ${colors.text}30`, background: `${colors.text}10`, color: colors.text, fontSize: 11, cursor: 'pointer', fontFamily: FONTS[i] }}>
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bookmarks Panel */}
      {showBookmarks && (
        <div style={{ background: colors.panel, borderBottom: `1px solid ${colors.text}22`, padding: '12px 16px', maxHeight: 200, overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, marginBottom: 8 }}>🔖 Закладки</div>
          {bookmarks.length === 0 ? (
            <div style={{ fontSize: 12, color: `${colors.text}60` }}>Нет закладок. Нажми 🔖 чтобы добавить.</div>
          ) : bookmarks.map(p => (
            <button key={p} onClick={() => { setCurrentPage(p); setShowBookmarks(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', background: `${colors.text}10`, border: 'none', borderRadius: 8, padding: '8px 12px', color: colors.text, fontSize: 13, cursor: 'pointer', marginBottom: 6 }}>
              Страница {p + 1} из {pages.length}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div
        ref={contentRef}
        style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', position: 'relative' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseUp={handleTextSelect}
        onTouchEndCapture={handleTextSelect}
      >
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 20 }}>
            <div style={{ width: 48, height: 48, border: `3px solid ${colors.text}30`, borderTopColor: '#b07d4a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ color: `${colors.text}80`, fontSize: 14 }}>Загружаем книгу...</span>
          </div>
        )}
        {error && !loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>😕</div>
            <div style={{ fontSize: 15, color: colors.text, marginBottom: 8 }}>{error}</div>
            <button onClick={onClose} style={{ background: '#b07d4a', border: 'none', borderRadius: 12, padding: '12px 24px', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 16 }}>
              ← Вернуться в каталог
            </button>
          </div>
        )}
        {!loading && !error && pages.length > 0 && (
          <div style={{ transform: pageAnim === 'left' ? 'translateX(-20px)' : pageAnim === 'right' ? 'translateX(20px)' : 'translateX(0)', opacity: pageAnim ? 0 : 1, transition: 'all 0.2s ease', fontSize, lineHeight, color: colors.text, letterSpacing: 0.3, userSelect: 'text' }}>
            {pages[currentPage]}
          </div>
        )}
      </div>

      {/* Selection Menu */}
      {showSelMenu && selection && (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 120, zIndex: 500, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '8px', display: 'flex', gap: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
          <button onClick={() => { onCreateNote(book.title, selection, 'note'); setShowSelMenu(false); window.getSelection()?.removeAllRanges(); vibe(10) }} style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 14px', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            📝 Заметка
          </button>
          <button onClick={() => { onCreateNote(book.title, selection, 'quote'); setShowSelMenu(false); window.getSelection()?.removeAllRanges(); vibe(10) }} style={{ background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '8px 14px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            ❝ Цитата
          </button>
          <button onClick={() => setShowSelMenu(false)} style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Bottom Navigation */}
      {!loading && !error && pages.length > 0 && (
        <div style={{ background: colors.panel, borderTop: `1px solid ${colors.text}22`, padding: `12px 16px calc(12px + env(safe-area-inset-bottom))`, flexShrink: 0 }}>
          {/* Progress bar */}
          <div style={{ height: 3, background: `${colors.text}20`, borderRadius: 2, marginBottom: 12, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #b07d4a, #d4a96a)', borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => goPage('prev')} disabled={currentPage === 0} style={{ background: currentPage === 0 ? `${colors.text}10` : `${colors.text}20`, border: 'none', borderRadius: 12, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentPage === 0 ? 'default' : 'pointer', fontSize: 20, color: currentPage === 0 ? `${colors.text}30` : colors.text }}>‹</button>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <span style={{ fontSize: 13, color: `${colors.text}80` }}>{currentPage + 1} / {pages.length}</span>
              <span style={{ fontSize: 11, color: `${colors.text}50`, marginLeft: 8 }}>{progress}%</span>
            </div>
            <button onClick={() => goPage('next')} disabled={currentPage === pages.length - 1} style={{ background: currentPage === pages.length - 1 ? `${colors.text}10` : 'linear-gradient(135deg, #b07d4a, #8a5a2a)', border: 'none', borderRadius: 12, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentPage === pages.length - 1 ? 'default' : 'pointer', fontSize: 20, color: currentPage === pages.length - 1 ? `${colors.text}30` : '#fff' }}>›</button>
          </div>
        </div>
      )}
    </div>
  )
}
