import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Bookmark, BookMarked, Settings, ChevronLeft, ChevronRight, Highlighter, FileText, MessageSquare, Hash } from 'lucide-react'

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

interface Highlight {
  id: string
  pageIndex: number
  text: string
  color: string
  createdAt: string
}

interface BookmarkItem {
  page: number
  preview: string
  createdAt: string
}

// ── Constants ──────────────────────────────────────────────────────────────
// UI always uses system font — NEVER changes with reader font
const UI_FONT = 'Inter, system-ui, sans-serif'

const READER_FONTS = [
  { name: 'Lora',    value: 'Lora, Georgia, serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Inter',   value: 'Inter, sans-serif' },
  { name: 'Mono',    value: "'Courier New', monospace" },
]

const READER_THEMES = {
  dark:  { bg: '#13100d', text: '#eedfc4', panel: '#1a1712', border: '#2e2820', accent: '#d4914a' },
  sepia: { bg: '#f4edd8', text: '#3a2c1a', panel: '#ede5cc', border: '#d4c4a0', accent: '#9e5018' },
  light: { bg: '#ffffff', text: '#1a1a1a', panel: '#f5f5f5', border: '#e0e0e0', accent: '#9e5018' },
  night: { bg: '#0d0d0f', text: '#c8c8d0', panel: '#141416', border: '#222228', accent: '#7090d0' },
}

const HIGHLIGHT_COLORS = [
  { color: 'rgba(255,220,0,0.38)',   label: 'Жёлтый',  id: 'yellow' },
  { color: 'rgba(100,220,120,0.38)', label: 'Зелёный', id: 'green'  },
  { color: 'rgba(100,160,255,0.38)', label: 'Синий',   id: 'blue'   },
  { color: 'rgba(255,100,100,0.38)', label: 'Красный', id: 'red'    },
  { color: 'rgba(220,130,255,0.38)', label: 'Фиолет',  id: 'purple' },
]

const WORDS_PER_PAGE = 350

const splitIntoPages = (text: string): string[] => {
  const paras = text.split(/\n{2,}/)
    .map(p => p.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(p => p.length > 0)
  const pages: string[] = []
  let current: string[] = []
  let wordCount = 0
  for (const para of paras) {
    const words = para.split(/\s+/).length
    if (wordCount + words > WORDS_PER_PAGE && current.length > 0) {
      pages.push(current.join('\n\n'))
      current = [para]
      wordCount = words
    } else {
      current.push(para)
      wordCount += words
    }
  }
  if (current.length > 0) pages.push(current.join('\n\n'))
  return pages
}

const vibe = (ms = 8) => navigator.vibrate?.(ms)

export default function ReaderView({ book, onClose, onCreateNote }: Props) {
  const [pages, setPages] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [themeName, setThemeName] = useState<keyof typeof READER_THEMES>('dark')
  const [fontSize, setFontSize] = useState(17)
  const [lineHeight, setLineHeight] = useState(1.85)
  const [fontIndex, setFontIndex] = useState(0)
  const [paraSpacing, setParaSpacing] = useState(1.2)
  const [panel, setPanel] = useState<'none' | 'settings' | 'bookmarks' | 'highlights'>('none')
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([])
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [selectionInfo, setSelectionInfo] = useState<{ text: string } | null>(null)
  const [pageAnim, setPageAnim] = useState<'left' | 'right' | null>(null)

  const contentRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  const theme = READER_THEMES[themeName]
  const progress = pages.length ? Math.round(((currentPage + 1) / pages.length) * 100) : 0
  const storageKey = `reader_${book.id}`
  const isBookmarked = bookmarks.some(b => b.page === currentPage)

  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) setCurrentPage(parseInt(saved) || 0)
    const bm = localStorage.getItem(`bm_${book.id}`)
    if (bm) try { setBookmarks(JSON.parse(bm)) } catch { /* */ }
    const hl = localStorage.getItem(`hl_${book.id}`)
    if (hl) try { setHighlights(JSON.parse(hl)) } catch { /* */ }
    const prefs = localStorage.getItem('reader_prefs')
    if (prefs) try {
      const p = JSON.parse(prefs)
      if (p.fontSize) setFontSize(p.fontSize)
      if (p.fontIndex !== undefined) setFontIndex(p.fontIndex)
      if (p.lineHeight) setLineHeight(p.lineHeight)
      if (p.themeName) setThemeName(p.themeName)
    } catch { /* */ }
  }, [storageKey, book.id])

  useEffect(() => { localStorage.setItem(storageKey, currentPage.toString()) }, [currentPage, storageKey])

  const saveBookmarks = useCallback((bm: BookmarkItem[]) => {
    setBookmarks(bm)
    localStorage.setItem(`bm_${book.id}`, JSON.stringify(bm))
  }, [book.id])

  const saveHighlights = useCallback((hl: Highlight[]) => {
    setHighlights(hl)
    localStorage.setItem(`hl_${book.id}`, JSON.stringify(hl))
  }, [book.id])

  const savePrefs = useCallback((overrides: Record<string, unknown>) => {
    const prefs = JSON.parse(localStorage.getItem('reader_prefs') || '{}')
    localStorage.setItem('reader_prefs', JSON.stringify({ ...prefs, ...overrides }))
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError('')
      try {
        let text = ''
        if (book.textUrl) {
          try {
            const res = await fetch(book.textUrl)
            if (res.ok) text = await res.text()
          } catch {
            try {
              const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(book.textUrl)}`
              const res = await fetch(proxy)
              if (res.ok) text = await res.text()
            } catch { /* */ }
          }
        }
        if (!text || text.length < 200) {
          const gutId = book.id.replace('gutenberg_', '')
          if (!isNaN(parseInt(gutId))) {
            for (const url of [
              `https://www.gutenberg.org/cache/epub/${gutId}/pg${gutId}.txt`,
              `https://www.gutenberg.org/files/${gutId}/${gutId}-0.txt`,
              `https://www.gutenberg.org/files/${gutId}/${gutId}.txt`,
            ]) {
              try {
                const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`)
                if (res.ok) { text = await res.text(); if (text.length > 500) break }
              } catch { continue }
            }
          }
        }
        if (!text || text.length < 200) {
          setError('Полный текст недоступен для этой книги.\nПопробуй другую книгу из каталога.')
          setLoading(false); return
        }
        if (text.includes('<html') || text.includes('<body')) {
          text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          text = text.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '')
          text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        }
        let start = 0, end = text.length
        for (const m of ['*** START OF', '***START OF', 'START OF THE PROJECT', 'START OF THIS PROJECT']) {
          const i = text.toUpperCase().indexOf(m); if (i !== -1) { start = text.indexOf('\n', i) + 1; break }
        }
        for (const m of ['*** END OF', '***END OF', 'END OF THE PROJECT', 'END OF THIS PROJECT']) {
          const i = text.toUpperCase().indexOf(m); if (i !== -1) { end = i; break }
        }
        setPages(splitIntoPages(text.slice(start, end).trim()))
      } catch { setError('Ошибка загрузки. Проверьте подключение.') }
      setLoading(false)
    }
    load()
  }, [book])

  const goPage = useCallback((dir: 'prev' | 'next') => {
    if (dir === 'prev' && currentPage === 0) return
    if (dir === 'next' && currentPage === pages.length - 1) return
    vibe(6)
    setPageAnim(dir === 'next' ? 'left' : 'right')
    setTimeout(() => {
      setCurrentPage(p => dir === 'next' ? p + 1 : p - 1)
      setPageAnim(null)
      setSelectionInfo(null)
      contentRef.current?.scrollTo({ top: 0 })
    }, 160)
  }, [currentPage, pages.length])

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = touchStartX.current - e.changedTouches[0].clientX
    const dy = Math.abs(touchStartY.current - e.changedTouches[0].clientY)
    if (Math.abs(dx) > 60 && dy < 80) dx > 0 ? goPage('next') : goPage('prev')
  }

  const handleMouseUp = () => {
    const sel = window.getSelection()
    const text = sel?.toString().trim()
    if (!text || text.length < 3) { setSelectionInfo(null); return }
    setSelectionInfo({ text })
  }

  const toggleBookmark = () => {
    vibe(10)
    if (isBookmarked) saveBookmarks(bookmarks.filter(b => b.page !== currentPage))
    else saveBookmarks([...bookmarks, { page: currentPage, preview: (pages[currentPage] || '').slice(0, 80) + '…', createdAt: new Date().toISOString() }].sort((a, b) => a.page - b.page))
  }

  const addHighlight = (hc: typeof HIGHLIGHT_COLORS[0]) => {
    if (!selectionInfo) return
    vibe(8)
    saveHighlights([...highlights, { id: Date.now().toString(), pageIndex: currentPage, text: selectionInfo.text, color: hc.color, createdAt: new Date().toISOString() }])
    window.getSelection()?.removeAllRanges()
    setSelectionInfo(null)
  }

  const createNoteFromSelection = (type: 'note' | 'quote') => {
    if (!selectionInfo) return
    onCreateNote(book.title, selectionInfo.text, type)
    vibe(10)
    window.getSelection()?.removeAllRanges()
    setSelectionInfo(null)
  }

  const renderPageText = () => {
    const pageText = pages[currentPage] || ''
    const pageHighlights = highlights.filter(h => h.pageIndex === currentPage)
    return pageText.split('\n\n').map((para, i) => {
      if (pageHighlights.length === 0) {
        return (
          <p key={i} style={{ margin: 0, marginBottom: `${paraSpacing}em`, textIndent: i > 0 ? '1.5em' : 0, wordBreak: 'break-word', hyphens: 'auto' as const }}>
            {para}
          </p>
        )
      }
      let segments: { text: string; hl?: Highlight }[] = [{ text: para }]
      for (const hl of pageHighlights) {
        const next: typeof segments = []
        for (const seg of segments) {
          if (seg.hl) { next.push(seg); continue }
          const idx = seg.text.indexOf(hl.text)
          if (idx === -1) { next.push(seg); continue }
          if (idx > 0) next.push({ text: seg.text.slice(0, idx) })
          next.push({ text: hl.text, hl })
          if (idx + hl.text.length < seg.text.length) next.push({ text: seg.text.slice(idx + hl.text.length) })
        }
        segments = next
      }
      return (
        <p key={i} style={{ margin: 0, marginBottom: `${paraSpacing}em`, textIndent: i > 0 ? '1.5em' : 0, wordBreak: 'break-word', hyphens: 'auto' as const }}>
          {segments.map((seg, j) => seg.hl
            ? <mark key={j} style={{ background: seg.hl.color, borderRadius: 3, padding: '1px 2px', color: 'inherit' }}>{seg.text}</mark>
            : <span key={j}>{seg.text}</span>
          )}
        </p>
      )
    })
  }

  const uiBtn = (active = false) => ({
    width: 38, height: 38, borderRadius: 11,
    background: active ? `${theme.accent}30` : `${theme.text}12`,
    border: `1px solid ${active ? theme.accent + '60' : 'transparent'}`,
    color: active ? theme.accent : theme.text,
    display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    cursor: 'pointer', flexShrink: 0,
    fontFamily: UI_FONT, transition: 'all 0.15s',
  })

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: theme.bg,
      zIndex: 300,
      display: 'flex', flexDirection: 'column',
      // ⚠️ No fontFamily on root — font only applied in content area
    }}>

      {/* ── Header — UI_FONT always ──────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px',
        paddingTop: 'calc(10px + env(safe-area-inset-top, 0px))',
        background: theme.panel,
        borderBottom: `1px solid ${theme.border}`,
        flexShrink: 0,
        fontFamily: UI_FONT,
      }}>
        <button onClick={() => { vibe(); onClose() }} style={uiBtn()}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: theme.text, fontFamily: UI_FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {book.title}
          </div>
          <div style={{ fontSize: 11, color: `${theme.text}70`, fontFamily: UI_FONT }}>{book.author}</div>
        </div>
        <button onClick={toggleBookmark} style={uiBtn(isBookmarked)}>
          {isBookmarked ? <BookMarked size={18} /> : <Bookmark size={18} />}
        </button>
        <button onClick={() => setPanel(p => p === 'highlights' ? 'none' : 'highlights')} style={uiBtn(panel === 'highlights')}>
          <Highlighter size={17} />
        </button>
        <button onClick={() => setPanel(p => p === 'bookmarks' ? 'none' : 'bookmarks')} style={uiBtn(panel === 'bookmarks')}>
          <Hash size={17} />
        </button>
        <button onClick={() => setPanel(p => p === 'settings' ? 'none' : 'settings')} style={uiBtn(panel === 'settings')}>
          <Settings size={17} />
        </button>
      </div>

      {/* ── Settings Panel — all UI_FONT ─────────────────────────── */}
      {panel === 'settings' && (
        <div style={{ background: theme.panel, borderBottom: `1px solid ${theme.border}`, padding: '14px 16px', flexShrink: 0, fontFamily: UI_FONT, animation: 'slideDown 0.2s ease both' }}>
          <div style={{ fontSize: 11, color: `${theme.text}60`, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: 8, fontFamily: UI_FONT }}>Тема</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {(Object.keys(READER_THEMES) as (keyof typeof READER_THEMES)[]).map(t => {
              const tc = READER_THEMES[t]
              return (
                <button key={t} onClick={() => { setThemeName(t); savePrefs({ themeName: t }) }}
                  style={{ flex: 1, padding: '9px 4px', borderRadius: 11, background: tc.bg, border: themeName === t ? `2px solid ${tc.accent}` : `1px solid ${tc.border}`, color: tc.text, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: UI_FONT, boxShadow: themeName === t ? `0 0 0 2px ${tc.accent}40` : 'none' }}>
                  {t === 'dark' ? '🌙' : t === 'sepia' ? '📜' : t === 'light' ? '☀️' : '🌌'}
                  <div style={{ marginTop: 3, fontSize: 10 }}>{t === 'dark' ? 'Тёмная' : t === 'sepia' ? 'Сепия' : t === 'light' ? 'Светлая' : 'Ночь'}</div>
                </button>
              )
            })}
          </div>

          <div style={{ fontSize: 11, color: `${theme.text}60`, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: 8, fontFamily: UI_FONT }}>Шрифт текста книги</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {READER_FONTS.map((f, i) => (
              <button key={i} onClick={() => { setFontIndex(i); savePrefs({ fontIndex: i }) }}
                style={{ flex: 1, padding: '9px 4px', borderRadius: 11, border: fontIndex === i ? `2px solid ${theme.accent}` : `1px solid ${theme.border}`, background: fontIndex === i ? `${theme.accent}15` : `${theme.text}08`, color: fontIndex === i ? theme.accent : theme.text,
                  // ← Preview button uses reader font for the name, but that's intentional — it's a preview
                  fontFamily: f.value, fontSize: 13, cursor: 'pointer', boxShadow: fontIndex === i ? `0 0 0 1px ${theme.accent}40` : 'none' }}>
                {f.name}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {[
              { label: 'Размер', val: fontSize, min: 12, max: 28, step: 1, set: (v: number) => { setFontSize(v); savePrefs({ fontSize: v }) }, fmt: (v: number) => `${v}` },
              { label: 'Интервал', val: lineHeight, min: 1.2, max: 2.6, step: 0.1, set: (v: number) => { setLineHeight(parseFloat(v.toFixed(1))); savePrefs({ lineHeight: v }) }, fmt: (v: number) => v.toFixed(1) },
              { label: 'Отступ', val: paraSpacing, min: 0.5, max: 2.0, step: 0.2, set: (v: number) => setParaSpacing(parseFloat(v.toFixed(1))), fmt: (v: number) => v.toFixed(1) },
            ].map(ctrl => (
              <div key={ctrl.label} style={{ background: `${theme.text}08`, borderRadius: 12, padding: '10px 8px', textAlign: 'center' as const }}>
                <div style={{ fontSize: 10, color: `${theme.text}60`, fontWeight: 600, marginBottom: 8, fontFamily: UI_FONT, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{ctrl.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <button onClick={() => ctrl.set(Math.max(ctrl.min, ctrl.val - ctrl.step))}
                    style={{ width: 26, height: 26, borderRadius: 7, background: `${theme.text}15`, border: 'none', color: theme.text, fontSize: 15, cursor: 'pointer', fontFamily: UI_FONT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <span style={{ color: theme.text, fontSize: 13, fontWeight: 700, minWidth: 28, textAlign: 'center' as const, fontFamily: UI_FONT }}>{ctrl.fmt(ctrl.val)}</span>
                  <button onClick={() => ctrl.set(Math.min(ctrl.max, ctrl.val + ctrl.step))}
                    style={{ width: 26, height: 26, borderRadius: 7, background: `${theme.text}15`, border: 'none', color: theme.text, fontSize: 15, cursor: 'pointer', fontFamily: UI_FONT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Bookmarks Panel ─────────────────────────────────────────── */}
      {panel === 'bookmarks' && (
        <div style={{ background: theme.panel, borderBottom: `1px solid ${theme.border}`, padding: '12px 16px', maxHeight: 220, overflowY: 'auto', flexShrink: 0, fontFamily: UI_FONT, animation: 'slideDown 0.2s ease both' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: theme.text, marginBottom: 10, fontFamily: UI_FONT }}>🔖 Закладки</div>
          {bookmarks.length === 0 ? (
            <div style={{ fontSize: 13, color: `${theme.text}50`, fontFamily: UI_FONT }}>Нажми 🔖 чтобы добавить закладку на текущую страницу</div>
          ) : bookmarks.map(bm => (
            <div key={bm.page} onClick={() => { setCurrentPage(bm.page); setPanel('none'); vibe(6) }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, background: `${theme.text}08`, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '10px 12px', marginBottom: 6, cursor: 'pointer' }}>
              <Bookmark size={14} color={theme.accent} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: theme.text, fontFamily: UI_FONT }}>Стр. {bm.page + 1} из {pages.length}</div>
                <div style={{ fontSize: 11, color: `${theme.text}60`, fontFamily: UI_FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bm.preview}</div>
              </div>
              <button onClick={e => { e.stopPropagation(); saveBookmarks(bookmarks.filter(b => b.page !== bm.page)) }}
                style={{ background: 'none', border: 'none', color: `${theme.text}40`, cursor: 'pointer', padding: 4 }}><X size={14} /></button>
            </div>
          ))}
        </div>
      )}

      {/* ── Highlights Panel ────────────────────────────────────────── */}
      {panel === 'highlights' && (
        <div style={{ background: theme.panel, borderBottom: `1px solid ${theme.border}`, padding: '12px 16px', maxHeight: 250, overflowY: 'auto', flexShrink: 0, fontFamily: UI_FONT, animation: 'slideDown 0.2s ease both' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: theme.text, marginBottom: 10, fontFamily: UI_FONT }}>🖊 Выделения</div>
          {highlights.length === 0 ? (
            <div style={{ fontSize: 13, color: `${theme.text}50`, fontFamily: UI_FONT }}>Выдели текст в книге — появится меню с цветами</div>
          ) : highlights.map(hl => (
            <div key={hl.id} onClick={() => { setCurrentPage(hl.pageIndex); setPanel('none'); vibe(6) }}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 10, borderLeft: `3px solid ${hl.color.replace('0.38', '0.8')}`, padding: '8px 12px', marginBottom: 8, background: `${theme.text}06`, borderRadius: '0 10px 10px 0', cursor: 'pointer' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: theme.text, fontFamily: UI_FONT, fontStyle: 'italic', lineHeight: 1.5 }}>«{hl.text.slice(0, 100)}{hl.text.length > 100 ? '…' : ''}»</div>
                <div style={{ fontSize: 10, color: `${theme.text}50`, fontFamily: UI_FONT, marginTop: 4 }}>Стр. {hl.pageIndex + 1}</div>
              </div>
              <button onClick={e => { e.stopPropagation(); saveHighlights(highlights.filter(h => h.id !== hl.id)) }}
                style={{ background: 'none', border: 'none', color: `${theme.text}40`, cursor: 'pointer', padding: 2, flexShrink: 0 }}><X size={12} /></button>
            </div>
          ))}
        </div>
      )}

      {/* ── Content — font applied HERE only ────────────────────────── */}
      <div ref={contentRef}
        style={{ flex: 1, overflowY: 'auto', position: 'relative', background: theme.bg }}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
        onMouseUp={handleMouseUp} onTouchEndCapture={handleMouseUp}
        onClick={() => { if (!window.getSelection()?.toString()) setSelectionInfo(null) }}>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 20 }}>
            <div style={{ width: 48, height: 48, border: `3px solid ${theme.border}`, borderTopColor: theme.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ color: `${theme.text}70`, fontSize: 14, fontFamily: UI_FONT }}>Загружаем книгу…</div>
          </div>
        )}
        {error && !loading && (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📖</div>
            <div style={{ fontSize: 15, color: theme.text, whiteSpace: 'pre-line', lineHeight: 1.6, marginBottom: 20, fontFamily: UI_FONT }}>{error}</div>
            <button onClick={onClose} style={{ background: theme.accent, border: 'none', borderRadius: 12, padding: '12px 24px', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: UI_FONT }}>← В каталог</button>
          </div>
        )}
        {!loading && !error && pages.length > 0 && (
          <div style={{
            padding: '24px 22px 32px', maxWidth: 640, margin: '0 auto',
            transform: pageAnim === 'left' ? 'translateX(-24px)' : pageAnim === 'right' ? 'translateX(24px)' : 'translateX(0)',
            opacity: pageAnim ? 0 : 1, transition: 'transform 0.16s ease, opacity 0.16s ease',
            userSelect: 'text', WebkitUserSelect: 'text',
          }}>
            <div style={{ fontSize: 10, color: `${theme.text}40`, fontFamily: UI_FONT, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 20, textAlign: 'center' as const }}>
              {book.title} · {currentPage + 1} / {pages.length}
            </div>
            {/* ⭐ FONT APPLIED ONLY HERE — scoped to reader content */}
            <div style={{ fontFamily: READER_FONTS[fontIndex].value, fontSize, lineHeight, color: theme.text, letterSpacing: '0.01em' }}>
              {renderPageText()}
            </div>
          </div>
        )}
      </div>

      {/* ── Selection Popup ──────────────────────────────────────────── */}
      {selectionInfo && (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 100, zIndex: 500, background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 18, padding: '8px 6px', display: 'flex', gap: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.45)', animation: 'slideUp 0.2s cubic-bezier(0.34,1.1,0.64,1) both', fontFamily: UI_FONT, flexWrap: 'wrap' as const, maxWidth: 320, justifyContent: 'center' }}>
          {HIGHLIGHT_COLORS.map(hc => (
            <button key={hc.id} onClick={() => addHighlight(hc)} title={hc.label}
              style={{ width: 32, height: 32, borderRadius: '50%', background: hc.color.replace('0.38', '0.75'), border: '2px solid transparent', cursor: 'pointer', flexShrink: 0 }} />
          ))}
          <div style={{ width: 1, background: theme.border, margin: '4px 2px' }} />
          <button onClick={() => createNoteFromSelection('note')}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 10, background: `${theme.text}12`, border: 'none', color: theme.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: UI_FONT }}>
            <FileText size={13} /> Заметка
          </button>
          <button onClick={() => createNoteFromSelection('quote')}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 10, background: theme.accent, border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: UI_FONT }}>
            <MessageSquare size={13} /> Цитата
          </button>
          <button onClick={() => { setSelectionInfo(null); window.getSelection()?.removeAllRanges() }}
            style={{ width: 28, height: 28, borderRadius: '50%', background: `${theme.text}12`, border: 'none', color: `${theme.text}60`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: UI_FONT }}><X size={13} /></button>
        </div>
      )}

      {/* ── Bottom Nav ───────────────────────────────────────────────── */}
      {!loading && !error && pages.length > 0 && (
        <div style={{ background: theme.panel, borderTop: `1px solid ${theme.border}`, padding: '10px 16px', paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))', flexShrink: 0, fontFamily: UI_FONT }}>
          <div style={{ height: 3, background: `${theme.text}18`, borderRadius: 2, marginBottom: 10, overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
            onClick={e => {
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
              setCurrentPage(Math.max(0, Math.min(pages.length - 1, Math.round(((e.clientX - rect.left) / rect.width) * (pages.length - 1)))))
            }}>
            <div style={{ width: `${progress}%`, height: '100%', background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent}aa)`, borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => goPage('prev')} disabled={currentPage === 0}
              style={{ width: 46, height: 46, borderRadius: 14, border: 'none', background: currentPage === 0 ? `${theme.text}08` : `${theme.text}14`, color: currentPage === 0 ? `${theme.text}25` : theme.text, cursor: currentPage === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: UI_FONT, flexShrink: 0 }}>
              <ChevronLeft size={22} />
            </button>
            <div style={{ flex: 1, textAlign: 'center' as const }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: theme.text, fontFamily: UI_FONT }}>
                {currentPage + 1}<span style={{ fontSize: 11, color: `${theme.text}50`, fontWeight: 400 }}> / {pages.length}</span>
              </div>
              <div style={{ fontSize: 10, color: `${theme.text}50`, fontFamily: UI_FONT, marginTop: 2 }}>
                {progress}% · ~{Math.round((pages.length - currentPage - 1) * WORDS_PER_PAGE / 200)} мин
              </div>
            </div>
            <button onClick={() => goPage('next')} disabled={currentPage === pages.length - 1}
              style={{ width: 46, height: 46, borderRadius: 14, border: 'none', background: currentPage === pages.length - 1 ? `${theme.text}08` : `linear-gradient(135deg, ${theme.accent}, ${theme.accent}aa)`, color: currentPage === pages.length - 1 ? `${theme.text}25` : '#fff', cursor: currentPage === pages.length - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: UI_FONT, flexShrink: 0, boxShadow: currentPage === pages.length - 1 ? 'none' : `0 2px 12px ${theme.accent}40` }}>
              <ChevronRight size={22} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
