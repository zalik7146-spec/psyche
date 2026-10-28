import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, Bookmark, BookOpen } from 'lucide-react'
import { searchBooks, withTimeout } from '../booksApi'

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
  onShareToAgora?: (text: string) => void
}

const FONTS = ['var(--font-serif)', 'var(--font-ui)', 'Georgia, serif', 'var(--font-typed)']
const FONT_NAMES = ['Книжный', 'Простой', 'Georgia', 'Машинка']
// Те же бумаги, что и в приложении: бумага, ночная бумага, старая бумага
const THEMES = {
  light: { bg: '#F9F6EF', text: '#1B1A17', muted: '#6B655B', line: '#D6CFC1', panel: '#F9F6EF', name: 'Бумага' },
  dark: { bg: '#1D1B18', text: '#E9E3D6', muted: '#A39C8F', line: '#35312B', panel: '#1D1B18', name: 'Ночная' },
  sepia: { bg: '#F2EADA', text: '#2A2218', muted: '#6A5E4B', line: '#CDBFA3', panel: '#F2EADA', name: 'Старая' },
}
const appTheme = (): keyof typeof THEMES => {
  const t = document.documentElement.getAttribute('data-theme')
  return t === 'dark' || t === 'sepia' ? t : 'light'
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
  const requestSignal = withTimeout(signal, 15_000)
  try {
    const response = await fetch(url, { signal: requestSignal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    // Without the serverless function the SPA rewrite answers /api/* with index.html.
    if (response.headers.get('content-type')?.includes('text/html') && url.startsWith('/api/')) throw new Error('API_UNAVAILABLE')
    return await response.text()
  } catch (directError) {
    if (signal.aborted || url.startsWith('/api/')) throw directError
    const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
    const response = await fetch(proxy, { signal: requestSignal })
    if (!response.ok) throw directError
    return response.text()
  }
}

export default function ReaderView({ book, onClose, onCreateNote, onReturnToCatalog, onProgress, onShareToAgora }: Props) {
  const [pages, setPages] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [theme, setTheme] = useState<keyof typeof THEMES>(appTheme)
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
          if (publicId) urls.add(`/api/gutenberg/${publicId}`)
          urls.add(book.textUrl)
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
          if (match?.gutenbergId) urls.add(`/api/gutenberg/${match.gutenbergId}`)
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
  const ease = 'var(--dur-quick) var(--ease-calm)'
  const iconBtn: React.CSSProperties = { width: 44, height: 44, background: 'none', border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer', color: colors.text, flexShrink: 0, padding: 0 }
  const smallLabel: React.CSSProperties = { fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.muted, fontFamily: 'var(--font-ui)' }
  const pill = (on: boolean): React.CSSProperties => ({ flex: 1, height: 36, border: `1px solid ${on ? colors.text : colors.line}`, background: on ? colors.text : 'none', color: on ? colors.bg : colors.text, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)', transition: `background ${ease}, color ${ease}` })
  const stepBtn: React.CSSProperties = { width: 36, height: 36, border: `1px solid ${colors.line}`, background: 'none', color: colors.text, fontSize: 15, cursor: 'pointer', fontFamily: 'var(--font-ui)' }
  const outlineBtn: React.CSSProperties = { height: 40, padding: '0 16px', border: `1px solid ${colors.line}`, background: 'none', color: colors.text, fontSize: 13, cursor: 'pointer' }
  const selBtn: React.CSSProperties = { height: 44, padding: '0 14px', background: 'none', border: 'none', borderRight: `1px solid ${colors.muted}`, color: 'inherit', fontSize: 13, cursor: 'pointer' }
  const clearSelection = () => { setShowSelMenu(false); window.getSelection()?.removeAllRanges() }

  return (
    <div className="view-push" style={{ position: 'fixed', inset: 0, background: colors.bg, zIndex: 300, display: 'flex', flexDirection: 'column', fontFamily: FONTS[fontIndex], color: colors.text, transition: `background ${ease}` }}>
      {/* Шапка */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 'env(safe-area-inset-top) 6px 0', minHeight: 52, background: colors.panel, flexShrink: 0 }}>
        <button aria-label="Закрыть читалку" onClick={() => { vibe(); onClose() }} style={iconBtn}><ArrowLeft size={20} strokeWidth={1.5} /></button>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center', fontFamily: 'var(--font-ui)' }}>
          <div style={{ ...smallLabel, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{localFileName ? `Файл · ${localFileName}` : book.author}</div>
          <div style={{ fontSize: 13, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{book.title}</div>
        </div>
        <button aria-label={isBookmarked ? 'Убрать закладку' : 'Заложить страницу'} aria-pressed={isBookmarked} onClick={() => { vibe(); toggleBookmark() }} style={iconBtn}><Bookmark size={18} strokeWidth={1.5} fill={isBookmarked ? 'currentColor' : 'none'} /></button>
        <button aria-label="Закладки" aria-pressed={showBookmarks} onClick={() => { vibe(); setShowBookmarks(b => !b); setShowSettings(false) }} style={{ ...iconBtn, opacity: showBookmarks ? 1 : 0.75 }}><BookOpen size={18} strokeWidth={1.5} /></button>
        <button aria-label="Настройки текста" aria-pressed={showSettings} onClick={() => { vibe(); setShowSettings(s => !s); setShowBookmarks(false) }} style={{ ...iconBtn, fontFamily: 'var(--font-serif)', fontSize: 19, textDecoration: showSettings ? 'underline' : 'none', textUnderlineOffset: 5 }}>Aa</button>
      </div>

      {/* Настройки */}
      {showSettings && (
        <div className="view-enter" style={{ background: colors.panel, borderTop: `1px solid ${colors.line}`, borderBottom: `1px solid ${colors.line}`, padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 14, flexShrink: 0, fontFamily: 'var(--font-ui)' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['light', 'dark', 'sepia'] as const).map(t => (
              <button key={t} aria-pressed={theme === t} onClick={() => setTheme(t)}
                style={{ flex: 1, height: 40, border: `1px solid ${theme === t ? colors.text : colors.line}`, background: THEMES[t].bg, color: THEMES[t].text, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)', boxShadow: theme === t ? `inset 0 0 0 1px ${colors.text}` : 'none' }}>
                {THEMES[t].name}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...smallLabel, width: 82 }}>Размер</span>
            <button aria-label="Меньше" onClick={() => setFontSize(s => Math.max(12, s - 1))} style={stepBtn}>A−</button>
            <span style={{ fontSize: 14, minWidth: 30, textAlign: 'center' }}>{fontSize}</span>
            <button aria-label="Больше" onClick={() => setFontSize(s => Math.min(28, s + 1))} style={stepBtn}>A+</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...smallLabel, width: 82 }}>Интервал</span>
            <button aria-label="Плотнее" onClick={() => setLineHeight(h => Math.max(1.2, parseFloat((h - 0.2).toFixed(1))))} style={stepBtn}>−</button>
            <span style={{ fontSize: 14, minWidth: 30, textAlign: 'center' }}>{lineHeight}</span>
            <button aria-label="Свободнее" onClick={() => setLineHeight(h => Math.min(2.4, parseFloat((h + 0.2).toFixed(1))))} style={stepBtn}>+</button>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {FONT_NAMES.map((name, i) => (
              <button key={i} aria-pressed={fontIndex === i} onClick={() => setFontIndex(i)} style={{ ...pill(fontIndex === i), fontFamily: FONTS[i] }}>{name}</button>
            ))}
          </div>
        </div>
      )}

      {/* Закладки */}
      {showBookmarks && (
        <div className="view-enter" style={{ background: colors.panel, borderTop: `1px solid ${colors.line}`, borderBottom: `1px solid ${colors.line}`, padding: '12px 20px', maxHeight: 220, overflowY: 'auto', flexShrink: 0, fontFamily: 'var(--font-ui)' }}>
          <div style={{ ...smallLabel, marginBottom: 6 }}>Закладки</div>
          {bookmarks.length === 0 ? (
            <div style={{ fontSize: 13, color: colors.muted, padding: '6px 0' }}>Закладок пока нет. Заложите страницу значком закладки вверху.</div>
          ) : bookmarks.map(p => (
            <button key={p} onClick={() => { setCurrentPage(p); setShowBookmarks(false) }}
              style={{ display: 'flex', justifyContent: 'space-between', width: '100%', minHeight: 44, alignItems: 'center', background: 'none', border: 'none', borderBottom: `1px solid ${colors.line}`, color: colors.text, fontSize: 14, cursor: 'pointer', padding: 0 }}>
              <span>Страница {p + 1}</span>
              <span style={{ color: colors.muted, fontSize: 12 }}>из {pages.length}</span>
            </button>
          ))}
        </div>
      )}

      {/* Текст */}
      <div
        ref={contentRef}
        style={{ flex: 1, overflowY: 'auto', padding: '24px 26px', position: 'relative' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseUp={handleTextSelect}
        onTouchEndCapture={handleTextSelect}
      >
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, fontFamily: 'var(--font-ui)' }}>
            <div style={{ width: 28, height: 28, border: `1px solid ${colors.line}`, borderTopColor: colors.text, borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
            <span style={smallLabel}>Загружаем книгу</span>
          </div>
        )}
        {error && !loading && (
          <div style={{ padding: '40px 4px', display: 'flex', flexDirection: 'column', gap: 12, fontFamily: 'var(--font-ui)' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22 }}>Текст не загрузился</span>
            <span style={{ fontSize: 15, lineHeight: 1.5, color: colors.muted }}>{error}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              <button onClick={() => { setLoading(true); setLoadAttempt(value => value + 1) }} style={{ ...outlineBtn, border: `1px solid ${colors.text}`, background: colors.text, color: colors.bg }}>Повторить</button>
              <button onClick={() => fileInputRef.current?.click()} style={outlineBtn}>Открыть TXT-файл</button>
              {onReturnToCatalog && <button onClick={onReturnToCatalog} style={outlineBtn}>Найти в каталоге</button>}
            </div>
          </div>
        )}
        {!loading && !error && pages.length > 0 && (
          <div style={{ transform: pageAnim === 'left' ? 'translateX(-12px)' : pageAnim === 'right' ? 'translateX(12px)' : 'none', opacity: pageAnim ? 0 : 1, transition: 'opacity 200ms var(--ease-calm), transform 200ms var(--ease-calm)', fontSize, lineHeight, color: colors.text, userSelect: 'text', whiteSpace: 'pre-wrap', maxWidth: 680, margin: '0 auto', minHeight: '100%' }}>
            {pages[currentPage]}
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept=".txt,text/plain" hidden onChange={event => { void importTextFile(event.currentTarget.files?.[0]); event.currentTarget.value = '' }} />

      {/* Выделение: чернильная панель */}
      {showSelMenu && selection && (
        <div className="view-enter" role="toolbar" aria-label="Выделенный текст"
          style={{ position: 'fixed', left: 0, right: 0, margin: '0 auto', width: 'max-content', maxWidth: 'calc(100vw - 24px)', bottom: 'calc(110px + env(safe-area-inset-bottom))', zIndex: 500, background: colors.text, color: colors.bg, display: 'flex', fontFamily: 'var(--font-ui)' }}>
          <button onClick={() => { onCreateNote(book.title, selection, 'quote', currentPage + 1); clearSelection(); vibe(10) }} style={selBtn}>Цитата</button>
          <button onClick={() => { onCreateNote(book.title, selection, 'note', currentPage + 1); clearSelection(); vibe(10) }} style={selBtn}>Заметка</button>
          {onShareToAgora && (
            <button onClick={() => { const text = selection; clearSelection(); vibe(10); onShareToAgora(text) }} style={{ ...selBtn, fontWeight: 600 }}>В Агору</button>
          )}
          <button aria-label="Закрыть" onClick={clearSelection} style={{ width: 44, height: 44, background: 'none', border: 'none', color: 'inherit', fontSize: 15, cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Низ: страницы и прогресс */}
      {!loading && !error && pages.length > 0 && (
        <div style={{ background: colors.panel, padding: '10px 12px calc(10px + env(safe-area-inset-bottom))', flexShrink: 0, fontFamily: 'var(--font-ui)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button aria-label="Предыдущая страница" onClick={() => goPage('prev')} disabled={currentPage === 0} style={{ ...iconBtn, fontSize: 22, opacity: currentPage === 0 ? 0.3 : 1, cursor: currentPage === 0 ? 'default' : 'pointer' }}>‹</button>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input aria-label="Перейти к странице" type="range" min={0} max={pages.length - 1} value={currentPage}
                onChange={event => { if (pageTimer.current !== null) { window.clearTimeout(pageTimer.current); pageTimer.current = null; setPageAnim(null) } setCurrentPage(Number(event.target.value)) }}
                style={{ display: 'block', width: '100%', margin: 0, accentColor: colors.text, height: 16 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: colors.muted }}>
                <span>Стр. {currentPage + 1} из {pages.length}</span>
                <span>{progress}%</span>
              </div>
            </div>
            <button aria-label="Следующая страница" onClick={() => goPage('next')} disabled={currentPage === pages.length - 1} style={{ ...iconBtn, fontSize: 22, opacity: currentPage === pages.length - 1 ? 0.3 : 1, cursor: currentPage === pages.length - 1 ? 'default' : 'pointer' }}>›</button>
          </div>
        </div>
      )}
    </div>
  )
}
