import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, Bookmark, BookOpen, Settings } from 'lucide-react'
import { searchBooks } from '../booksApi'

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
  onCreateNote: (title: string, content: string, type: string, page?: number) => void
  onReturnToCatalog?: () => void
  onProgress?: (page: number, totalPages: number) => void
}

const FONTS = ['Lora, serif', 'Inter, sans-serif', 'Georgia, serif', "'Courier New', monospace"]
const FONT_NAMES = ['Lora', 'Inter', 'Georgia', 'Mono']
const THEMES = {
  dark: { bg: '#15120e', text: '#eedfc4', panel: '#1e1b15' },
  light: { bg: '#faf6f0', text: '#2c2416', panel: '#f0ebe0' },
  sepia: { bg: '#1e1810', text: '#e8d4a0', panel: '#261f13' },
}

const WORDS_PER_PAGE = 300

function prepareBookText(raw: string) {
  const looksLikeHtml = /<\s*(html|body|p|div|br)\b/i.test(raw)
  const decoded = looksLikeHtml
    ? new DOMParser().parseFromString(raw.replace(/<\/(?:p|div|h[1-6]|li|br)>/gi, '$&\n\n'), 'text/html').body.textContent || ''
    : raw.replace(/<[^>]+>/g, ' ')
  const normalized = decoded
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\u00a0 ]+/g, ' ')
    .replace(/\n[ ]+/g, '\n')
    .trim()
  const start = normalized.search(/\*{3}\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*{3}/i)
  const body = start >= 0 ? normalized.slice(start).replace(/^[^\n]*\n/, '') : normalized
  const end = body.search(/\*{3}\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/i)
  return (end >= 0 ? body.slice(0, end) : body).trim()
}

function paginateText(text: string) {
  const paragraphs = text.split(/\n\s*\n+/).map(part => part.trim()).filter(Boolean)
  const pages: string[] = []
  let page: string[] = []
  let words = 0
  for (const paragraph of paragraphs) {
    const paragraphWords = paragraph.split(/\s+/)
    if (page.length && words + paragraphWords.length > WORDS_PER_PAGE) {
      pages.push(page.join('\n\n'))
      page = []
      words = 0
    }
    if (paragraphWords.length > WORDS_PER_PAGE) {
      for (let i = 0; i < paragraphWords.length; i += WORDS_PER_PAGE) {
        if (page.length) pages.push(page.join('\n\n'))
        pages.push(paragraphWords.slice(i, i + WORDS_PER_PAGE).join(' '))
        page = []
        words = 0
      }
    } else {
      page.push(paragraph)
      words += paragraphWords.length
    }
  }
  if (page.length) pages.push(page.join('\n\n'))
  return pages
}

async function fetchBookText(url: string, signal: AbortSignal) {
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(15_000)])
  try {
    const response = await fetch(url, { signal: requestSignal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.text()
  } catch (directError) {
    if (signal.aborted || url.startsWith('/api/')) throw directError
    const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
    const response = await fetch(proxy, { signal: requestSignal })
    if (!response.ok) throw directError
    return response.text()
  }
}

export default function ReaderView({ book, onClose, onCreateNote, onReturnToCatalog, onProgress }: Props) {
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
  const [localFileName, setLocalFileName] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const contentRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const progressCallback = useRef(onProgress)
  const pageTimer = useRef<number | null>(null)
  const vibe = (ms = 8) => { if (typeof navigator !== 'undefined') navigator.vibrate?.(ms) }

  const colors = THEMES[theme]
  const progress = pages.length ? Math.round(((currentPage + 1) / pages.length) * 100) : 0
  const storageKey = `reader_${book.id}`

  // Load saved page
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) setCurrentPage(parseInt(saved) || 0)
    } catch { setCurrentPage(0) }
  }, [storageKey])

  // Save page on change
  useEffect(() => {
    localStorage.setItem(storageKey, currentPage.toString())
  }, [currentPage, storageKey])

  // Load bookmarks
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`bookmarks_${book.id}`)
      const parsed: unknown = raw ? JSON.parse(raw) : []
      setBookmarks(Array.isArray(parsed) ? parsed.filter((page): page is number => Number.isInteger(page) && page >= 0) : [])
    } catch { setBookmarks([]) }
  }, [book.id])

  const saveBookmarks = (bm: number[]) => {
    setBookmarks(bm)
    try { localStorage.setItem(`bookmarks_${book.id}`, JSON.stringify(bm)) } catch { /* Bookmarks are optional. */ }
  }

  useEffect(() => { progressCallback.current = onProgress }, [onProgress])

  useEffect(() => {
    const preferenceKey = `reader_preferences_${book.id}`
    try {
      const saved = JSON.parse(localStorage.getItem(preferenceKey) || '{}') as Partial<{ theme: keyof typeof THEMES; fontSize: number; lineHeight: number; fontIndex: number }>
      if (saved.theme && saved.theme in THEMES) setTheme(saved.theme)
      if (typeof saved.fontSize === 'number') setFontSize(Math.max(12, Math.min(28, saved.fontSize)))
      if (typeof saved.lineHeight === 'number') setLineHeight(Math.max(1.2, Math.min(2.4, saved.lineHeight)))
      if (typeof saved.fontIndex === 'number') setFontIndex(Math.max(0, Math.min(FONTS.length - 1, saved.fontIndex)))
    } catch { /* Ignore damaged local reader preferences. */ }
  }, [book.id])

  useEffect(() => {
    try { localStorage.setItem(`reader_preferences_${book.id}`, JSON.stringify({ theme, fontSize, lineHeight, fontIndex })) } catch { /* Preferences are optional. */ }
  }, [book.id, theme, fontSize, lineHeight, fontIndex])

  // Fetch a direct text file when the catalog provides one. For library books,
  // look up a legal public-domain edition by title and author in Gutendex.
  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      setError('')
      setPages([])
      try {
        let text = ''
        const urls = new Set<string>()
        if (book.textUrl) {
          const publicId = book.textUrl.match(/(?:cache\/epub|files)\/(\d+)/)?.[1]
          urls.add(publicId ? `/api/gutenberg/${publicId}` : book.textUrl)
        }
        const gutenbergId = book.id.match(/^gutenberg_(\d+)$/)?.[1]
        if (gutenbergId) {
          urls.add(`/api/gutenberg/${gutenbergId}`)
        }
        if (urls.size === 0) {
          const result = await searchBooks(book.title, controller.signal)
          if (result.failedSources.length === 3) throw new Error('CATALOG_UNAVAILABLE')
          const normalized = book.title.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
          const match = result.books.find(candidate => candidate.textUrl && candidate.title.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim() === normalized)
          if (match?.textUrl) urls.add(match.textUrl)
        }

        for (const url of urls) {
          try {
            const raw = await fetchBookText(url, controller.signal)
            const cleaned = prepareBookText(raw)
            if (cleaned.length > 100) { text = cleaned; break }
          } catch {
            if (controller.signal.aborted) return
          }
        }
        if (controller.signal.aborted) return
        if (text.length <= 100) throw new Error('BOOK_TEXT_UNAVAILABLE')
        const pageArr = paginateText(text)
        setPages(pageArr)
        try { setCurrentPage(Math.max(0, Math.min(pageArr.length - 1, Number(localStorage.getItem(storageKey)) || 0))) } catch { setCurrentPage(0) }
      } catch (loadError) {
        if (controller.signal.aborted) return
        setError(loadError instanceof Error && loadError.message === 'BOOK_TEXT_UNAVAILABLE'
          ? 'Не удалось найти открытый полный текст этой книги. В каталоге можно искать книги Project Gutenberg и читать их в приложении.'
          : loadError instanceof Error && loadError.message === 'CATALOG_UNAVAILABLE'
            ? 'Не удалось подключиться к каталогам. Проверьте сеть и повторите попытку.'
            : 'Не удалось загрузить текст. Проверьте подключение и попробуйте ещё раз.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [book.id, book.title, book.author, book.textUrl, storageKey, loadAttempt])

  useEffect(() => {
    if (!pages.length) return
    const current = Math.max(0, Math.min(pages.length - 1, currentPage))
    if (current !== currentPage) setCurrentPage(current)
    try { localStorage.setItem(storageKey, String(current)) } catch { /* Resume is optional. */ }
    progressCallback.current?.(current + 1, pages.length)
    if (contentRef.current) contentRef.current.scrollTop = 0
  }, [currentPage, pages.length, storageKey])

  const goPage = useCallback((dir: 'next' | 'prev') => {
    if (pageTimer.current !== null) return
    if (dir === 'next' && currentPage < pages.length - 1) {
      setPageAnim('left')
      pageTimer.current = window.setTimeout(() => { setCurrentPage(p => p + 1); setPageAnim(null); pageTimer.current = null }, 200)
      vibe(6)
    } else if (dir === 'prev' && currentPage > 0) {
      setPageAnim('right')
      pageTimer.current = window.setTimeout(() => { setCurrentPage(p => p - 1); setPageAnim(null); pageTimer.current = null }, 200)
      vibe(6)
    }
  }, [currentPage, pages.length])

  useEffect(() => () => { if (pageTimer.current !== null) window.clearTimeout(pageTimer.current) }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (['ArrowRight', 'PageDown', ' '].includes(event.key)) { event.preventDefault(); goPage('next') }
      if (['ArrowLeft', 'PageUp'].includes(event.key)) { event.preventDefault(); goPage('prev') }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [goPage, onClose])

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

  const importTextFile = async (file?: File) => {
    if (!file) return
    try {
      const text = prepareBookText(await file.text())
      if (text.length < 30) {
        setError('В файле не найден читаемый текст. Выберите TXT-файл в кодировке UTF-8.')
        return
      }
      setLocalFileName(file.name)
      setPages(paginateText(text))
      setCurrentPage(0)
      setError('')
      setLoading(false)
    } catch {
      setError('Не удалось прочитать файл. Выберите TXT-файл в кодировке UTF-8.')
    }
  }

  const isBookmarked = bookmarks.includes(currentPage)

  return (
    <div style={{ position: 'fixed', inset: 0, background: colors.bg, zIndex: 300, display: 'flex', flexDirection: 'column', fontFamily: FONTS[fontIndex] }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(12px + env(safe-area-inset-top)) 16px 12px', background: colors.panel, borderBottom: `1px solid ${colors.text}22`, flexShrink: 0 }}>
        <button aria-label="Закрыть читалку" onClick={() => { vibe(); onClose() }} style={{ background: `${colors.text}18`, border: 'none', borderRadius: 10, width: 38, height: 38, display: 'grid', placeItems: 'center', cursor: 'pointer', color: colors.text, flexShrink: 0 }}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</div>
          <div style={{ fontSize: 11, color: `${colors.text}80`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{localFileName ? `Файл · ${localFileName}` : book.author}</div>
        </div>
        <button aria-label="Закладка страницы" onClick={() => { vibe(); toggleBookmark() }} style={{ background: isBookmarked ? '#b07d4a' : `${colors.text}18`, border: 'none', borderRadius: 10, width: 38, height: 38, display: 'grid', placeItems: 'center', cursor: 'pointer', color: colors.text }}><Bookmark size={17} fill={isBookmarked ? 'currentColor' : 'none'} /></button>
        <button aria-label="Показать закладки" onClick={() => { vibe(); setShowBookmarks(b => !b) }} style={{ background: showBookmarks ? '#b07d4a' : `${colors.text}18`, border: 'none', borderRadius: 10, width: 38, height: 38, display: 'grid', placeItems: 'center', cursor: 'pointer', color: colors.text }}><BookOpen size={17} /></button>
        <button aria-label="Настройки читалки" onClick={() => { vibe(); setShowSettings(s => !s) }} style={{ background: showSettings ? '#b07d4a' : `${colors.text}18`, border: 'none', borderRadius: 10, width: 38, height: 38, display: 'grid', placeItems: 'center', cursor: 'pointer', color: colors.text }}><Settings size={17} /></button>
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
            <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
              <button onClick={() => { setLoading(true); setLoadAttempt(value => value + 1) }} style={{ background: `${colors.text}18`, border: `1px solid ${colors.text}30`, borderRadius: 12, padding: '11px 16px', color: colors.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>↻ Повторить</button>
              <button onClick={() => fileInputRef.current?.click()} style={{ background: '#b07d4a', border: 'none', borderRadius: 12, padding: '11px 16px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Открыть TXT-файл</button>
              {onReturnToCatalog && <button onClick={onReturnToCatalog} style={{ background: `${colors.text}18`, border: `1px solid ${colors.text}30`, borderRadius: 12, padding: '11px 16px', color: colors.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Найти в каталоге</button>}
            </div>
          </div>
        )}
        {!loading && !error && pages.length > 0 && (
          <div style={{ transform: pageAnim === 'left' ? 'translateX(-20px)' : pageAnim === 'right' ? 'translateX(20px)' : 'translateX(0)', opacity: pageAnim ? 0 : 1, transition: 'all 0.2s ease', fontSize, lineHeight, color: colors.text, letterSpacing: 0.3, userSelect: 'text', whiteSpace: 'pre-wrap', maxWidth: 760, margin: '0 auto', minHeight: '100%' }}>
            {pages[currentPage]}
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept=".txt,text/plain" hidden onChange={event => { void importTextFile(event.currentTarget.files?.[0]); event.currentTarget.value = '' }} />

      {/* Selection Menu */}
      {showSelMenu && selection && (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 120, zIndex: 500, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '8px', display: 'flex', gap: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
          <button onClick={() => { onCreateNote(book.title, selection, 'note', currentPage + 1); setShowSelMenu(false); window.getSelection()?.removeAllRanges(); vibe(10) }} style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 14px', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            📝 Заметка
          </button>
          <button onClick={() => { onCreateNote(book.title, selection, 'quote', currentPage + 1); setShowSelMenu(false); window.getSelection()?.removeAllRanges(); vibe(10) }} style={{ background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '8px 14px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
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
            <button aria-label="Предыдущая страница" onClick={() => goPage('prev')} disabled={currentPage === 0} style={{ background: currentPage === 0 ? `${colors.text}10` : `${colors.text}20`, border: 'none', borderRadius: 12, width: 44, height: 44, display: 'grid', placeItems: 'center', cursor: currentPage === 0 ? 'default' : 'pointer', fontSize: 20, color: currentPage === 0 ? `${colors.text}30` : colors.text }}>‹</button>
            <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
              <span style={{ fontSize: 13, color: `${colors.text}80` }}>{currentPage + 1} / {pages.length}</span>
              <span style={{ fontSize: 11, color: `${colors.text}50`, marginLeft: 8 }}>{progress}%</span>
            </div>
            <button aria-label="Следующая страница" onClick={() => goPage('next')} disabled={currentPage === pages.length - 1} style={{ background: currentPage === pages.length - 1 ? `${colors.text}10` : 'linear-gradient(135deg, #b07d4a, #8a5a2a)', border: 'none', borderRadius: 12, width: 44, height: 44, display: 'grid', placeItems: 'center', cursor: currentPage === pages.length - 1 ? 'default' : 'pointer', fontSize: 20, color: currentPage === pages.length - 1 ? `${colors.text}30` : '#fff' }}>›</button>
          </div>
          <input aria-label="Перейти к странице" type="range" min={0} max={pages.length - 1} value={currentPage} onChange={event => { if (pageTimer.current !== null) { window.clearTimeout(pageTimer.current); pageTimer.current = null; setPageAnim(null) } setCurrentPage(Number(event.target.value)) }} style={{ display: 'block', width: '100%', marginTop: 10, accentColor: '#b07d4a' }} />
        </div>
      )}
    </div>
  )
}
