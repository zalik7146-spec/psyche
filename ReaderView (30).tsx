import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ChevronLeft, Bookmark, BookMarked, Settings2, Highlighter,
  Hash, X, FileText, MessageSquare, Eye, EyeOff, ChevronRight,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────
interface ReaderBook {
  id: string; title: string; author: string
  textUrl?: string; coverUrl?: string
}
interface Props {
  book: ReaderBook
  onClose: () => void
  onCreateNote: (title: string, content: string, type: string) => void
}
interface Highlight {
  id: string; pageIndex: number; text: string; color: string; createdAt: string
}
interface BMark {
  page: number; preview: string; createdAt: string
}

// ── Constants — UI ALWAYS uses this font, never changes ────────────────────
const UI = 'Inter, system-ui, sans-serif'

const READER_FONTS = [
  { name: 'Lora',    css: 'Lora, Georgia, serif' },
  { name: 'Georgia', css: 'Georgia, serif' },
  { name: 'Inter',   css: 'Inter, sans-serif' },
  { name: 'Mono',    css: "'Courier New', monospace" },
]

const THEMES = {
  dark:  { bg: '#111009', text: '#eedfc4', panel: '#18150f', border: '#2a2418', accent: '#d4914a', tname: '🌙 Тёмная' },
  sepia: { bg: '#f4edd8', text: '#3a2c1a', panel: '#ede4cc', border: '#d0bc98', accent: '#9e5018', tname: '📜 Сепия'  },
  light: { bg: '#fafafa', text: '#1a1a1a', panel: '#f0f0f0', border: '#e0e0e0', accent: '#7a3800', tname: '☀️ Светлая' },
  night: { bg: '#0b0b10', text: '#b8c0d8', panel: '#11121a', border: '#1e2030', accent: '#6080cc', tname: '🌌 Ночь'  },
}

const HLS = [
  { color: 'rgba(255,215,0,0.40)',   id: 'y', label: 'Жёлтый'  },
  { color: 'rgba(80,200,100,0.35)',  id: 'g', label: 'Зелёный' },
  { color: 'rgba(80,140,255,0.35)',  id: 'b', label: 'Синий'   },
  { color: 'rgba(255,80,80,0.35)',   id: 'r', label: 'Красный' },
  { color: 'rgba(200,100,255,0.32)', id: 'p', label: 'Фиолет'  },
]

const WORDS_PER_PAGE = 380
const vibe = (ms = 8) => { try { navigator.vibrate?.(ms) } catch {} }

// ── Text processing ────────────────────────────────────────────────────────
function makeParagraphs(raw: string): string[] {
  // Normalise line endings
  let text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  // Strip Gutenberg header/footer
  for (const m of ['*** START OF', 'START OF THE PROJECT', 'START OF THIS PROJECT']) {
    const i = text.toUpperCase().indexOf(m); if (i !== -1) { text = text.slice(text.indexOf('\n', i) + 1); break }
  }
  for (const m of ['*** END OF', 'END OF THE PROJECT', 'END OF THIS PROJECT']) {
    const i = text.toUpperCase().indexOf(m); if (i !== -1) { text = text.slice(0, i); break }
  }
  // Strip HTML if needed
  if (/<[a-z]/i.test(text)) {
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
               .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
               .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n')
               .replace(/<h[1-6][^>]*>/gi, '\n\n').replace(/<\/h[1-6]>/gi, '\n\n')
               .replace(/<[^>]+>/g, '')
               .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
               .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
               .replace(/&quot;/g, '"').replace(/&#[0-9]+;/g, ' ')
  }
  // Split into paragraphs
  const paras = text.split(/\n{2,}/)
    .map(p => p.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(p => p.length > 3)
  return paras
}

function paginate(paras: string[]): string[] {
  const pages: string[] = []; let cur: string[] = []; let wc = 0
  for (const p of paras) {
    const w = p.split(/\s+/).length
    if (wc + w > WORDS_PER_PAGE && cur.length > 0) { pages.push(cur.join('\n\n')); cur = [p]; wc = w }
    else { cur.push(p); wc += w }
  }
  if (cur.length > 0) pages.push(cur.join('\n\n'))
  return pages
}

async function fetchText(url: string): Promise<string> {
  // Try direct, then proxy
  const proxies = [
    url,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
  ]
  let lastErr = ''
  for (const u of proxies) {
    try {
      const res = await fetch(u, { signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined })
      if (!res.ok) { lastErr = `HTTP ${res.status}`; continue }
      const ct = res.headers.get('content-type') || ''
      let text: string
      // Force UTF-8 for Russian texts
      if (ct.includes('charset=utf-8') || ct.includes('charset=UTF-8') || url.includes('-0.txt')) {
        text = await res.text()
      } else {
        // Try reading as UTF-8 bytes
        const buf = await res.arrayBuffer()
        text = new TextDecoder('utf-8').decode(buf)
      }
      // If we got HTML wrapper from allorigins, extract contents field
      if (u.includes('allorigins') && text.startsWith('{"')) {
        try { text = JSON.parse(text).contents || text } catch { /* keep as is */ }
      }
      if (text.length > 300) return text
      lastErr = 'Слишком короткий ответ'
    } catch (e: unknown) {
      lastErr = e instanceof Error ? e.message : 'Ошибка'
    }
  }
  throw new Error(lastErr || 'Не удалось загрузить текст')
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function ReaderView({ book, onClose, onCreateNote }: Props) {
  const [pages, setPages] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadMsg, setLoadMsg] = useState('Загружаем книгу…')
  const [error, setError] = useState('')
  const [theme, setTheme] = useState<keyof typeof THEMES>('dark')
  const [fontSize, setFontSize] = useState(17)
  const [lineH, setLineH] = useState(1.85)
  const [fontI, setFontI] = useState(0)
  const [paraGap, setParaGap] = useState(1.1)

  const [panel, setPanel] = useState<'none' | 'settings' | 'bm' | 'hl'>('none')
  const [bookmarks, setBookmarks] = useState<BMark[]>([])
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [selText, setSelText] = useState<string | null>(null)
  const [pageAnim, setPageAnim] = useState<'l' | 'r' | null>(null)

  // Immersive mode: hide all controls, only text visible
  const [immersive, setImmersive] = useState(false)
  const [showUI, setShowUI] = useState(true) // in immersive: briefly visible on tap

  const scrollRef = useRef<HTMLDivElement>(null)
  const txX = useRef(0), txY = useRef(0)
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTap = useRef(0)

  const T = THEMES[theme]
  const progress = pages.length ? Math.round(((page + 1) / pages.length) * 100) : 0
  const sKey = `reader_${book.id}`
  const isBookmarked = bookmarks.some(b => b.page === page)
  const pageHls = highlights.filter(h => h.pageIndex === page)

  // ── Persist ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const p = parseInt(localStorage.getItem(sKey) || '0')
    if (!isNaN(p)) setPage(p)
    try { setBookmarks(JSON.parse(localStorage.getItem(`bm_${book.id}`) || '[]')) } catch { /* */ }
    try { setHighlights(JSON.parse(localStorage.getItem(`hl_${book.id}`) || '[]')) } catch { /* */ }
    try {
      const prefs = JSON.parse(localStorage.getItem('reader_prefs') || '{}')
      if (prefs.fontSize) setFontSize(prefs.fontSize)
      if (prefs.fontI !== undefined) setFontI(prefs.fontI)
      if (prefs.lineH) setLineH(prefs.lineH)
      if (prefs.theme) setTheme(prefs.theme)
      if (prefs.immersive) setImmersive(prefs.immersive)
    } catch { /* */ }
  }, [sKey, book.id])

  useEffect(() => { localStorage.setItem(sKey, String(page)) }, [page, sKey])

  const saveBM = (bm: BMark[]) => { setBookmarks(bm); localStorage.setItem(`bm_${book.id}`, JSON.stringify(bm)) }
  const saveHL = (hl: Highlight[]) => { setHighlights(hl); localStorage.setItem(`hl_${book.id}`, JSON.stringify(hl)) }
  const savePrefs = (o: Record<string, unknown>) => {
    const p = JSON.parse(localStorage.getItem('reader_prefs') || '{}')
    localStorage.setItem('reader_prefs', JSON.stringify({ ...p, ...o }))
  }

  // ── Load text ────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true); setError('')
      try {
        if (!book.textUrl) {
          setError('Нет ссылки на текст книги.\n\nОткрой книгу через «📖 Читать онлайн» в каталоге — там доступны полные тексты книг с Gutenberg.')
          setLoading(false); return
        }
        setLoadMsg('Подключаемся к источнику…')
        const raw = await fetchText(book.textUrl)
        setLoadMsg('Обрабатываем текст…')
        const paras = makeParagraphs(raw)
        if (paras.length < 5) {
          setError('Не удалось прочитать текст книги.\n\nВозможно, файл повреждён или заблокирован.')
          setLoading(false); return
        }
        const ps = paginate(paras)
        setPages(ps)
        // Restore saved page
        const saved = parseInt(localStorage.getItem(sKey) || '0')
        if (saved > 0 && saved < ps.length) setPage(saved)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Неизвестная ошибка'
        setError(`Ошибка загрузки: ${msg}\n\nПроверьте подключение к интернету и попробуйте снова.`)
      }
      setLoading(false)
    }
    load()
  }, [book, sKey])

  // ── Navigation ────────────────────────────────────────────────────────────
  const goPage = useCallback((dir: 'prev' | 'next') => {
    if (dir === 'prev' && page === 0) return
    if (dir === 'next' && page === pages.length - 1) return
    vibe(5)
    setPageAnim(dir === 'next' ? 'l' : 'r')
    setTimeout(() => {
      setPage(p => dir === 'next' ? p + 1 : p - 1)
      setPageAnim(null)
      setSelText(null)
      scrollRef.current?.scrollTo({ top: 0 })
    }, 140)
  }, [page, pages.length])

  // ── Immersive tap logic ──────────────────────────────────────────────────
  const handleContentTap = (e: React.MouseEvent | React.TouchEvent) => {
    if (selText) return
    if (!immersive) return

    const now = Date.now()
    if (now - lastTap.current < 350) {
      // Double-tap: exit immersive
      lastTap.current = 0
      if (tapTimer.current) clearTimeout(tapTimer.current)
      setImmersive(false)
      setShowUI(true)
      savePrefs({ immersive: false })
      return
    }
    lastTap.current = now
    tapTimer.current = setTimeout(() => {
      // Single tap: briefly show UI
      setShowUI(true)
      setTimeout(() => setShowUI(false), 3000)
    }, 350)
  }

  // ── Touch swipe ──────────────────────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => { txX.current = e.touches[0].clientX; txY.current = e.touches[0].clientY }
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = txX.current - e.changedTouches[0].clientX
    const dy = Math.abs(txY.current - e.changedTouches[0].clientY)
    if (Math.abs(dx) > 55 && dy < 70) { dx > 0 ? goPage('next') : goPage('prev'); return }
    if (immersive) handleContentTap(e)
  }

  // ── Text selection ────────────────────────────────────────────────────────
  const handleMouseUp = () => {
    const sel = window.getSelection()?.toString().trim()
    setSelText(sel && sel.length >= 3 ? sel : null)
  }

  // ── Bookmark ──────────────────────────────────────────────────────────────
  const toggleBM = () => {
    vibe(10)
    if (isBookmarked) saveBM(bookmarks.filter(b => b.page !== page))
    else saveBM([...bookmarks, { page, preview: (pages[page] || '').slice(0, 80) + '…', createdAt: new Date().toISOString() }].sort((a, b) => a.page - b.page))
  }

  // ── Highlight ─────────────────────────────────────────────────────────────
  const addHL = (hc: typeof HLS[0]) => {
    if (!selText) return
    vibe(8)
    saveHL([...highlights, { id: Date.now().toString(), pageIndex: page, text: selText, color: hc.color, createdAt: new Date().toISOString() }])
    window.getSelection()?.removeAllRanges()
    setSelText(null)
  }

  // ── Render page text with highlights ──────────────────────────────────────
  const renderText = () => {
    const pageText = pages[page] || ''
    return pageText.split('\n\n').map((para, i) => {
      if (!pageHls.length) {
        return <p key={i} style={{ margin: 0, marginBottom: `${paraGap}em`, textIndent: '1.5em' }}>{para}</p>
      }
      let segs: { t: string; h?: Highlight }[] = [{ t: para }]
      for (const hl of pageHls) {
        const next: typeof segs = []
        for (const seg of segs) {
          if (seg.h) { next.push(seg); continue }
          const idx = seg.t.indexOf(hl.text)
          if (idx === -1) { next.push(seg); continue }
          if (idx > 0) next.push({ t: seg.t.slice(0, idx) })
          next.push({ t: hl.text, h: hl })
          const rest = seg.t.slice(idx + hl.text.length)
          if (rest) next.push({ t: rest })
        }
        segs = next
      }
      return (
        <p key={i} style={{ margin: 0, marginBottom: `${paraGap}em`, textIndent: '1.5em' }}>
          {segs.map((s, j) => s.h
            ? <mark key={j} style={{ background: s.h.color, borderRadius: 3, padding: '0 2px', color: 'inherit' }}>{s.t}</mark>
            : <span key={j}>{s.t}</span>
          )}
        </p>
      )
    })
  }

  // ── UI helpers ────────────────────────────────────────────────────────────
  const uibtn = (active = false, accent = false) => ({
    width: 38, height: 38, borderRadius: 11,
    background: active ? `${T.accent}28` : accent ? `${T.accent}18` : `${T.text}10`,
    border: `1px solid ${active ? T.accent + '80' : 'transparent'}`,
    color: active || accent ? T.accent : T.text,
    display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    cursor: 'pointer', flexShrink: 0, fontFamily: UI, transition: 'all 0.15s',
  })

  const uiVisible = !immersive || showUI

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ position: 'fixed', inset: 0, background: T.bg, zIndex: 300, display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px',
        paddingTop: 'calc(10px + env(safe-area-inset-top, 0px))',
        background: T.panel, borderBottom: `1px solid ${T.border}`,
        flexShrink: 0, fontFamily: UI,
        opacity: uiVisible ? 1 : 0,
        transform: uiVisible ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'opacity 0.3s, transform 0.3s',
        pointerEvents: uiVisible ? 'auto' : 'none',
        position: 'relative', zIndex: 10,
      }}>
        <button onClick={() => { vibe(); onClose() }} style={uibtn()}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: UI, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</div>
          <div style={{ fontSize: 11, color: `${T.text}70`, fontFamily: UI }}>{book.author}</div>
        </div>
        {/* Immersive toggle */}
        <button onClick={() => { const n = !immersive; setImmersive(n); setShowUI(!n); savePrefs({ immersive: n }); vibe(6) }} style={uibtn(immersive, false)} title={immersive ? 'Выйти из режима чтения' : 'Режим погружения'}>
          {immersive ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
        <button onClick={toggleBM} style={uibtn(isBookmarked)}>
          {isBookmarked ? <BookMarked size={17} /> : <Bookmark size={17} />}
        </button>
        <button onClick={() => setPanel(p => p === 'hl' ? 'none' : 'hl')} style={uibtn(panel === 'hl')}>
          <Highlighter size={16} />
        </button>
        <button onClick={() => setPanel(p => p === 'bm' ? 'none' : 'bm')} style={uibtn(panel === 'bm')}>
          <Hash size={16} />
        </button>
        <button onClick={() => setPanel(p => p === 'settings' ? 'none' : 'settings')} style={uibtn(panel === 'settings')}>
          <Settings2 size={16} />
        </button>
      </div>

      {/* ── Settings Panel ─────────────────────────────────────────────────── */}
      {panel === 'settings' && (
        <div style={{ background: T.panel, borderBottom: `1px solid ${T.border}`, padding: '14px 16px', flexShrink: 0, fontFamily: UI, animation: 'slideDown 0.2s ease both', zIndex: 9 }}>
          {/* Themes */}
          <div style={{ fontSize: 11, color: `${T.text}55`, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: 8, fontFamily: UI }}>Тема</div>
          <div style={{ display: 'flex', gap: 7, marginBottom: 14 }}>
            {(Object.entries(THEMES) as [keyof typeof THEMES, typeof THEMES[keyof typeof THEMES]][]).map(([k, tc]) => (
              <button key={k} onClick={() => { setTheme(k); savePrefs({ theme: k }) }}
                style={{ flex: 1, padding: '9px 4px', borderRadius: 12, background: tc.bg, border: theme === k ? `2px solid ${tc.accent}` : `1px solid ${tc.border}`, color: tc.text, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: UI, lineHeight: 1.4 }}>
                {tc.tname}
              </button>
            ))}
          </div>
          {/* Font */}
          <div style={{ fontSize: 11, color: `${T.text}55`, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: 8, fontFamily: UI }}>Шрифт книги</div>
          <div style={{ display: 'flex', gap: 7, marginBottom: 14 }}>
            {READER_FONTS.map((f, i) => (
              <button key={i} onClick={() => { setFontI(i); savePrefs({ fontI: i }) }}
                style={{ flex: 1, padding: '9px 4px', borderRadius: 12, border: fontI === i ? `2px solid ${T.accent}` : `1px solid ${T.border}`, background: fontI === i ? `${T.accent}14` : `${T.text}08`, color: fontI === i ? T.accent : T.text, fontFamily: f.css, fontSize: 13, cursor: 'pointer' }}>
                {f.name}
              </button>
            ))}
          </div>
          {/* Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { lbl: 'Размер',   val: fontSize, min: 12, max: 28, step: 1,   set: (v: number) => { setFontSize(v); savePrefs({ fontSize: v }) }, fmt: (v: number) => `${v}` },
              { lbl: 'Интервал', val: lineH,    min: 1.2, max: 2.6, step: 0.1, set: (v: number) => { setLineH(parseFloat(v.toFixed(1))); savePrefs({ lineH: v }) }, fmt: (v: number) => v.toFixed(1) },
              { lbl: 'Отступ',   val: paraGap,  min: 0.4, max: 2.0, step: 0.2, set: (v: number) => setParaGap(parseFloat(v.toFixed(1))), fmt: (v: number) => v.toFixed(1) },
            ].map(c => (
              <div key={c.lbl} style={{ background: `${T.text}08`, borderRadius: 12, padding: '10px 8px', textAlign: 'center' as const }}>
                <div style={{ fontSize: 10, color: `${T.text}55`, fontWeight: 600, marginBottom: 8, fontFamily: UI, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{c.lbl}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <button onClick={() => c.set(Math.max(c.min, c.val - c.step))} style={{ width: 26, height: 26, borderRadius: 7, background: `${T.text}14`, border: 'none', color: T.text, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: UI }}>−</button>
                  <span style={{ color: T.text, fontSize: 13, fontWeight: 700, minWidth: 28, textAlign: 'center' as const, fontFamily: UI }}>{c.fmt(c.val)}</span>
                  <button onClick={() => c.set(Math.min(c.max, c.val + c.step))} style={{ width: 26, height: 26, borderRadius: 7, background: `${T.text}14`, border: 'none', color: T.text, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: UI }}>+</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Bookmarks Panel ─────────────────────────────────────────────────── */}
      {panel === 'bm' && (
        <div style={{ background: T.panel, borderBottom: `1px solid ${T.border}`, padding: '12px 16px', maxHeight: 220, overflowY: 'auto', flexShrink: 0, fontFamily: UI, animation: 'slideDown 0.2s ease both', zIndex: 9 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 10, fontFamily: UI }}>🔖 Закладки</div>
          {bookmarks.length === 0
            ? <div style={{ fontSize: 13, color: `${T.text}50`, fontFamily: UI }}>Нажми 🔖 чтобы сохранить страницу</div>
            : bookmarks.map(bm => (
              <div key={bm.page} onClick={() => { setPage(bm.page); setPanel('none'); vibe(5) }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, background: `${T.text}07`, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', marginBottom: 6, cursor: 'pointer' }}>
                <Bookmark size={13} color={T.accent} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.text, fontFamily: UI }}>Стр. {bm.page + 1} / {pages.length}</div>
                  <div style={{ fontSize: 11, color: `${T.text}55`, fontFamily: UI, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bm.preview}</div>
                </div>
                <button onClick={e => { e.stopPropagation(); saveBM(bookmarks.filter(b => b.page !== bm.page)) }} style={{ background: 'none', border: 'none', color: `${T.text}40`, cursor: 'pointer', padding: 4 }}><X size={13} /></button>
              </div>
            ))
          }
        </div>
      )}

      {/* ── Highlights Panel ─────────────────────────────────────────────────── */}
      {panel === 'hl' && (
        <div style={{ background: T.panel, borderBottom: `1px solid ${T.border}`, padding: '12px 16px', maxHeight: 240, overflowY: 'auto', flexShrink: 0, fontFamily: UI, animation: 'slideDown 0.2s ease both', zIndex: 9 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 10, fontFamily: UI }}>🖊 Выделения</div>
          {highlights.length === 0
            ? <div style={{ fontSize: 13, color: `${T.text}50`, fontFamily: UI }}>Выдели текст — появится меню с цветами</div>
            : highlights.map(hl => (
              <div key={hl.id} onClick={() => { setPage(hl.pageIndex); setPanel('none'); vibe(5) }}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 10, borderLeft: `3px solid ${hl.color.replace(/[\d.]+\)$/, '0.9)')}`, padding: '8px 12px', marginBottom: 7, background: `${T.text}06`, borderRadius: '0 10px 10px 0', cursor: 'pointer' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: T.text, fontFamily: UI, fontStyle: 'italic', lineHeight: 1.5 }}>«{hl.text.slice(0, 100)}{hl.text.length > 100 ? '…' : ''}»</div>
                  <div style={{ fontSize: 10, color: `${T.text}50`, fontFamily: UI, marginTop: 3 }}>Стр. {hl.pageIndex + 1}</div>
                </div>
                <button onClick={e => { e.stopPropagation(); saveHL(highlights.filter(h => h.id !== hl.id)) }} style={{ background: 'none', border: 'none', color: `${T.text}40`, cursor: 'pointer', padding: 2, flexShrink: 0 }}><X size={12} /></button>
              </div>
            ))
          }
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', position: 'relative', background: T.bg }}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
        onMouseUp={handleMouseUp} onTouchEndCapture={handleMouseUp}
        onClick={e => {
          if (!window.getSelection()?.toString()) setSelText(null)
          if (immersive) handleContentTap(e)
        }}>
        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 18 }}>
            <div style={{ width: 44, height: 44, border: `3px solid ${T.border}`, borderTopColor: T.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ color: `${T.text}80`, fontSize: 14, fontFamily: UI, textAlign: 'center' }}>{loadMsg}</div>
          </div>
        )}
        {/* Error */}
        {error && !loading && (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📖</div>
            <div style={{ fontSize: 15, color: T.text, whiteSpace: 'pre-line', lineHeight: 1.7, marginBottom: 24, fontFamily: UI }}>{error}</div>
            <button onClick={onClose} style={{ background: T.accent, border: 'none', borderRadius: 12, padding: '12px 28px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: UI }}>← Вернуться</button>
          </div>
        )}
        {/* Text — font only applied here */}
        {!loading && !error && pages.length > 0 && (
          <div style={{
            padding: immersive ? '32px 24px 48px' : '24px 22px 32px',
            maxWidth: 640, margin: '0 auto',
            transform: pageAnim === 'l' ? 'translateX(-28px)' : pageAnim === 'r' ? 'translateX(28px)' : 'translateX(0)',
            opacity: pageAnim ? 0 : 1,
            transition: 'transform 0.14s ease, opacity 0.14s ease',
            userSelect: 'text', WebkitUserSelect: 'text',
          }}>
            {/* Page label — hidden in immersive unless showUI */}
            {(!immersive || showUI) && (
              <div style={{ fontSize: 10, color: `${T.text}35`, fontFamily: UI, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase' as const, marginBottom: 22, textAlign: 'center' as const, transition: 'opacity 0.3s', opacity: !immersive || showUI ? 1 : 0 }}>
                {book.title} · {page + 1} / {pages.length}
              </div>
            )}
            {/* ⭐ FONT SCOPED ONLY HERE */}
            <div style={{ fontFamily: READER_FONTS[fontI].css, fontSize, lineHeight: lineH, color: T.text, letterSpacing: '0.012em' }}>
              {renderText()}
            </div>
            {/* Immersive hint */}
            {immersive && !showUI && (
              <div style={{ textAlign: 'center', marginTop: 24, opacity: 0.25, fontSize: 11, color: T.text, fontFamily: UI }}>
                Нажми для управления · Двойное нажатие — выйти
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Selection Popup ──────────────────────────────────────────────────── */}
      {selText && (
        <div style={{
          position: 'fixed', left: '50%', transform: 'translateX(-50%)',
          bottom: 110, zIndex: 600,
          background: T.panel, border: `1px solid ${T.border}`,
          borderRadius: 20, padding: '8px 6px',
          display: 'flex', gap: 4, flexWrap: 'wrap' as const, justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
          animation: 'slideUp 0.18s cubic-bezier(0.34,1.1,0.64,1) both',
          maxWidth: 320, fontFamily: UI,
        }}>
          {HLS.map(hc => (
            <button key={hc.id} onClick={() => addHL(hc)} title={hc.label}
              style={{ width: 30, height: 30, borderRadius: '50%', background: hc.color.replace(/[\d.]+\)$/, '0.75)'), border: '2px solid transparent', cursor: 'pointer', flexShrink: 0, transition: 'transform 0.1s' }} />
          ))}
          <div style={{ width: 1, background: T.border, margin: '4px 2px' }} />
          <button onClick={() => { onCreateNote(book.title, selText, 'note'); window.getSelection()?.removeAllRanges(); setSelText(null); vibe(10) }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 10, background: `${T.text}12`, border: 'none', color: T.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: UI }}>
            <FileText size={12} /> Заметка
          </button>
          <button onClick={() => { onCreateNote(book.title, selText, 'quote'); window.getSelection()?.removeAllRanges(); setSelText(null); vibe(10) }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 10, background: T.accent, border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: UI }}>
            <MessageSquare size={12} /> Цитата
          </button>
          <button onClick={() => { window.getSelection()?.removeAllRanges(); setSelText(null) }}
            style={{ width: 28, height: 28, borderRadius: '50%', background: `${T.text}12`, border: 'none', color: `${T.text}60`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: UI }}><X size={13} /></button>
        </div>
      )}

      {/* ── Bottom Nav ────────────────────────────────────────────────────────── */}
      {!loading && !error && pages.length > 0 && (
        <div style={{
          background: T.panel, borderTop: `1px solid ${T.border}`,
          padding: '10px 16px', paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
          flexShrink: 0, fontFamily: UI,
          opacity: uiVisible ? 1 : 0,
          transform: uiVisible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'opacity 0.3s, transform 0.3s',
          pointerEvents: uiVisible ? 'auto' : 'none',
        }}>
          {/* Progress bar — tappable */}
          <div style={{ height: 3, background: `${T.text}15`, borderRadius: 2, marginBottom: 10, cursor: 'pointer', overflow: 'hidden' }}
            onClick={e => {
              const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
              setPage(Math.max(0, Math.min(pages.length - 1, Math.round(((e.clientX - r.left) / r.width) * (pages.length - 1)))))
            }}>
            <div style={{ width: `${progress}%`, height: '100%', background: `linear-gradient(90deg, ${T.accent}, ${T.accent}bb)`, borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => goPage('prev')} disabled={page === 0}
              style={{ width: 46, height: 46, borderRadius: 14, border: 'none', background: page === 0 ? `${T.text}08` : `${T.text}12`, color: page === 0 ? `${T.text}22` : T.text, cursor: page === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: UI, flexShrink: 0 }}>
              <ChevronLeft size={22} />
            </button>
            <div style={{ flex: 1, textAlign: 'center' as const }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: UI }}>
                {page + 1}<span style={{ fontSize: 11, color: `${T.text}50`, fontWeight: 400 }}> / {pages.length}</span>
              </div>
              <div style={{ fontSize: 10, color: `${T.text}45`, fontFamily: UI, marginTop: 2 }}>
                {progress}% · ~{Math.round((pages.length - page - 1) * WORDS_PER_PAGE / 200)} мин
              </div>
            </div>
            <button onClick={() => goPage('next')} disabled={page === pages.length - 1}
              style={{ width: 46, height: 46, borderRadius: 14, border: 'none', background: page === pages.length - 1 ? `${T.text}08` : `linear-gradient(135deg, ${T.accent}, ${T.accent}cc)`, color: page === pages.length - 1 ? `${T.text}22` : '#fff', cursor: page === pages.length - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: UI, flexShrink: 0, boxShadow: page === pages.length - 1 ? 'none' : `0 3px 14px ${T.accent}45` }}>
              <ChevronRight size={22} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
