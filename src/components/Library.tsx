import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Search, Plus, LayoutGrid, List, X } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { Book } from '../types'
import BookModal from './BookModal'
import { BOOK_FILE_ACCEPT, parseBookFile, saveBookText } from '../bookFiles'
import { STOIC_LIBRARY, stoicTextFor, type StoicText } from '../stoicLibrary'

interface Props {
  books: Book[]
  notes: any[]
  onSave: (book: Book) => void
  onDelete: (id: string) => void
  onOpenReader: (book: any) => void
}

const SHELVES: [string, string][] = [['all', 'Все'], ['reading', 'Читаю'], ['finished', 'Прочитано'], ['want', 'Хочу'], ['paused', 'Пауза']]
const STATUS_LABEL: Record<string, string> = { reading: 'Читаю', finished: 'Прочитано', want: 'Хочу', paused: 'Пауза' }

const label: CSSProperties = { fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const iconBtn: CSSProperties = {
  width: 44, height: 44, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)',
}
const inkButton: CSSProperties = {
  height: 36, padding: '0 16px', border: 'none', cursor: 'pointer',
  background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-ui)',
}

const progressOf = (book: Book) => book.totalPages && book.currentPage ? Math.min(100, Math.round((book.currentPage / book.totalPages) * 100)) : 0

// Обложка: настоящая картинка в тонкой рамке или машинописная библиотечная карточка
export function BookCover({ book, width, height }: { book: Pick<Book, 'title' | 'author' | 'coverUrl'>; width: number; height: number }) {
  const small = width < 60
  if (book.coverUrl) {
    return (
      <span style={{ width, height, flexShrink: 0, border: '1px solid var(--text-primary)', background: `var(--bg-card) url(${book.coverUrl}) center/cover`, display: 'block' }} />
    )
  }
  return (
    <span style={{
      width, height, flexShrink: 0, boxSizing: 'border-box', border: '1px solid var(--text-primary)', background: 'var(--bg-card)',
      padding: small ? 0 : '10px 9px', display: 'flex', flexDirection: 'column',
      justifyContent: small ? 'center' : 'space-between', alignItems: small ? 'center' : 'stretch', overflow: 'hidden',
      fontFamily: 'var(--font-typed)', color: 'var(--text-primary)', textShadow: '0 0 0.7px var(--ink-bleed)',
    }}>
      {small ? (
        <span style={{ fontSize: 15 }}>{(book.title[0] || '?').toUpperCase()}</span>
      ) : (
        <>
          <span style={{ fontSize: Math.max(9, width / 9.5), lineHeight: 1.25, textTransform: 'uppercase', wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{book.title}</span>
          <span style={{ fontSize: Math.max(8, width / 11), color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.author}</span>
        </>
      )}
    </span>
  )
}

function ProgressLine({ value }: { value: number }) {
  return (
    <span style={{ height: 1, background: 'var(--border)', display: 'flex' }}>
      <span style={{ width: `${value}%`, background: 'var(--text-primary)', transition: 'width var(--dur-screen) var(--ease-calm)' }} />
    </span>
  )
}

export default function Library({ books, notes, onSave, onDelete, onOpenReader }: Props) {
  const [filter, setFilter] = useState<string>('all')
  const [view, setView] = useState<'grid' | 'list'>('list')
  const [showModal, setShowModal] = useState(false)
  const [editBook, setEditBook] = useState<Book | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showGoal, setShowGoal] = useState(false)
  const [goal, setGoal] = useState(() => parseInt(localStorage.getItem('reading_goal') || '12'))
  const [goalInput, setGoalInput] = useState(goal.toString())
  const [showStoic, setShowStoic] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const vibe = (ms = 8) => navigator.vibrate?.(ms)

  // Своя книга: разбираем файл, сохраняем текст на устройстве и сразу открываем
  const uploadBook = async (file?: File) => {
    if (!file) return
    setUploading(true); setUploadError('')
    try {
      const parsed = await parseBookFile(file)
      if (parsed.text.length < 30) throw new Error('EMPTY')
      const book = { id: uuidv4(), title: parsed.title || 'Без названия', author: parsed.author || '', status: 'reading', currentPage: 0, tags: [] } as unknown as Book
      await saveBookText(book.id, { text: parsed.text, fileName: file.name, addedAt: new Date().toISOString() })
      onSave(book)
      vibe(12)
      onOpenReader(book)
    } catch {
      setUploadError('Не получилось прочитать файл. Подойдут TXT, FB2 и EPUB без защиты от копирования.')
    }
    setUploading(false)
  }

  const shelfBookFor = (item: StoicText) => books.find(b => stoicTextFor(b.title)?.gutenbergId === item.gutenbergId)
  const takeStoic = (item: StoicText, readNow: boolean) => {
    vibe(10)
    const existing = shelfBookFor(item)
    const book = existing || ({ id: uuidv4(), title: item.title, author: item.author, status: readNow ? 'reading' : 'want', currentPage: 0, tags: [] } as unknown as Book)
    if (!existing) onSave(book)
    if (readNow) { setShowStoic(false); onOpenReader(book) }
  }

  const filtered = books.filter(b => {
    const matchStatus = filter === 'all' || b.status === filter
    const q = search.toLowerCase()
    const matchSearch = !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  // Текущая книга — крупно наверху, если смотрим «Все» или «Читаю» без поиска
  const current = !search && (filter === 'all' || filter === 'reading') ? filtered.find(b => b.status === 'reading') : undefined
  const rest = current ? filtered.filter(b => b.id !== current.id) : filtered

  const doneCount = books.filter(b => b.status === 'finished').length
  const goalProgress = Math.min(100, Math.round((doneCount / goal) * 100))
  const notesFor = (id: string) => notes.filter((n: any) => n.bookId === id).length
  const openEdit = (book?: Book) => { vibe(); setEditBook(book); setShowModal(true) }
  const read = (book: Book) => { vibe(12); onOpenReader(book) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', overflow: 'hidden' }}>
      <header style={{ paddingTop: 'env(safe-area-inset-top)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, padding: '0 8px 0 20px' }}>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 28, color: 'var(--text-primary)' }}>Книги</h1>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button aria-label="Поиск по полке" aria-pressed={showSearch} onClick={() => { vibe(); setShowSearch(s => !s); if (showSearch) setSearch('') }} style={iconBtn}>
              {showSearch ? <X size={20} strokeWidth={1.5} /> : <Search size={20} strokeWidth={1.5} />}
            </button>
            <button aria-label={view === 'grid' ? 'Показать списком' : 'Показать сеткой'} onClick={() => { vibe(); setView(v => v === 'grid' ? 'list' : 'grid') }} style={iconBtn}>
              {view === 'grid' ? <List size={20} strokeWidth={1.5} /> : <LayoutGrid size={20} strokeWidth={1.5} />}
            </button>
            <button aria-label="Добавить книгу вручную" onClick={() => openEdit(undefined)} style={iconBtn}>
              <Plus size={21} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {showSearch && (
          <label className="view-enter" style={{ display: 'flex', alignItems: 'center', gap: 10, height: 44, margin: '0 20px 8px', borderBottom: '1px solid var(--text-primary)' }}>
            <Search size={16} strokeWidth={1.5} color="var(--text-muted)" />
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} aria-label="Поиск книг" placeholder="Название или автор"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 15, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }} />
          </label>
        )}

        <div role="tablist" aria-label="Полки" style={{ display: 'flex', padding: '0 12px', marginBottom: -1, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {SHELVES.map(([id, name]) => (
            <button key={id} role="tab" aria-selected={filter === id} onClick={() => { vibe(); setFilter(id) }}
              style={{
                flex: '1 0 auto', height: 44, padding: '0 10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-ui)',
                borderBottom: filter === id ? '1px solid var(--text-primary)' : '1px solid transparent',
                color: filter === id ? 'var(--text-primary)' : 'var(--text-muted)',
                transition: 'color var(--dur-quick) var(--ease-calm), border-color var(--dur-quick) var(--ease-calm)',
              }}>{name}</button>
          ))}
        </div>
      </header>

      <div key={filter + view} className="view-enter" style={{ flex: 1, overflowY: 'auto', padding: '16px 12px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {current && (
          <div style={{ display: 'flex', gap: 18, padding: 18, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <button onClick={() => openEdit(current)} aria-label="Карточка книги" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
              <BookCover book={current} width={92} height={132} />
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 0 }}>
              <span style={label}>Сейчас читаю</span>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, lineHeight: 1.2, color: 'var(--text-primary)' }}>{current.title}</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{current.author} · {notesFor(current.id)} записей</span>
              <span style={{ marginTop: 4 }}><ProgressLine value={progressOf(current)} /></span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{progressOf(current)}%</span>
              <button onClick={() => read(current)} style={{ ...inkButton, alignSelf: 'flex-start', marginTop: 2 }}>Читать</button>
            </div>
          </div>
        )}

        {filter === 'all' && !search && (
          <button onClick={() => { vibe(); setGoalInput(goal.toString()); setShowGoal(true) }}
            style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 8px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <span style={label}>Цель года · {doneCount} из {goal}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{goalProgress}%</span>
            </span>
            <span style={{ width: '100%' }}><ProgressLine value={goalProgress} /></span>
          </button>
        )}

        {filtered.length === 0 ? (
          <div style={{ padding: '40px 8px', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--text-primary)' }}>{search ? 'Ничего не нашлось' : 'Полка пуста'}</span>
            <span style={{ fontFamily: 'var(--font-typed)', fontSize: 15, color: 'var(--text-muted)' }}>
              {search ? `По «${search}» книг нет.` : 'Загрузите свою книгу (TXT, FB2, EPUB) или возьмите текст из Стоической библиотеки.'}
            </span>
            {!search && (
              <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                <button onClick={() => { vibe(); fileRef.current?.click() }} style={{ ...inkButton, height: 40 }}>Загрузить книгу</button>
                <button onClick={() => { vibe(); setShowStoic(true) }} style={{ ...inkButton, height: 40, background: 'none', color: 'var(--text-primary)', border: '1px solid var(--border-mid)' }}>Стоическая библиотека</button>
              </span>
            )}
          </div>
        ) : rest.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column' }}>
            {current && <span style={{ ...label, padding: '0 8px 4px' }}>На полке</span>}
            {view === 'list' ? (
              <div style={{ display: 'flex', flexDirection: 'column', padding: '0 8px' }}>
                {rest.map(book => (
                  <div key={book.id} style={{ display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid var(--border)' }}>
                    <button onClick={() => openEdit(book)} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <BookCover book={book} width={34} height={48} />
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                        <span style={{ fontSize: 15, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</span>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {book.author}{book.rating ? ` · ${'★'.repeat(book.rating)}` : ''}
                        </span>
                      </span>
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {book.status === 'reading' && progressOf(book) ? `${progressOf(book)}%` : STATUS_LABEL[book.status] || ''}
                    </span>
                    <button onClick={() => read(book)} style={{ ...iconBtn, width: 'auto', padding: '0 4px 0 8px', fontSize: 13, color: 'var(--text-primary)', textDecoration: 'underline', textUnderlineOffset: 4 }}>
                      Читать
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, padding: '6px 8px 0' }}>
                {rest.map(book => (
                  <button key={book.id} onClick={() => openEdit(book)} style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', minWidth: 0 }}>
                    <span style={{ width: '100%', aspectRatio: '2 / 3', display: 'flex' }}>
                      <BookCoverFill book={book} />
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{STATUS_LABEL[book.status] || ''}{book.status === 'reading' && progressOf(book) ? ` · ${progressOf(book)}%` : ''}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, margin: '4px 8px 0' }}>
            <button onClick={() => { vibe(); fileRef.current?.click() }} disabled={uploading}
              style={{ height: 48, background: 'none', border: '1px dashed var(--border-mid)', cursor: 'pointer', fontSize: 14, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
              {uploading ? 'Читаю файл…' : 'Загрузить книгу'}
            </button>
            <button onClick={() => { vibe(); setShowStoic(true) }}
              style={{ height: 48, background: 'none', border: '1px dashed var(--border-mid)', cursor: 'pointer', fontSize: 14, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
              Стоическая библиотека
            </button>
          </div>
        )}
        {uploadError && <p role="alert" style={{ margin: '0 8px', fontSize: 13, color: 'var(--red)' }}>{uploadError}</p>}
        <input ref={fileRef} type="file" accept={BOOK_FILE_ACCEPT} hidden onChange={e => { void uploadBook(e.currentTarget.files?.[0]); e.currentTarget.value = '' }} />
      </div>

      {showGoal && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000, animation: 'fadeIn var(--dur-quick) var(--ease-calm)' }} onClick={() => setShowGoal(false)}>
          <div role="dialog" aria-label="Цель чтения" className="view-feed" style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border)', padding: '24px 24px calc(24px + env(safe-area-inset-bottom))', width: '100%', maxWidth: 430, display: 'flex', flexDirection: 'column', gap: 14 }} onClick={e => e.stopPropagation()}>
            <span style={label}>Цель года</span>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--text-primary)' }}>Сколько книг прочитать в этом году?</span>
            <input type="number" min={1} value={goalInput} onChange={e => setGoalInput(e.target.value)} aria-label="Книг в год"
              style={{ background: 'none', border: 'none', borderBottom: '1px solid var(--text-primary)', padding: '8px 0', color: 'var(--text-primary)', fontSize: 28, fontFamily: 'var(--font-typed)', outline: 'none', textAlign: 'center' }} />
            <button onClick={() => { const v = Math.max(1, parseInt(goalInput) || 12); setGoal(v); localStorage.setItem('reading_goal', v.toString()); setShowGoal(false); vibe(12) }}
              style={{ ...inkButton, height: 48, fontSize: 15 }}>
              Сохранить
            </button>
          </div>
        </div>
      )}

      {showStoic && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--overlay)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'fadeIn var(--dur-quick) var(--ease-calm)' }} onClick={() => setShowStoic(false)}>
          <div role="dialog" aria-label="Стоическая библиотека" className="view-feed" onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 430, maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '18px 8px 10px 20px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--text-primary)' }}>Стоическая библиотека</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>Тексты из общественного достояния, английские переводы с Project Gutenberg</span>
              </span>
              <button aria-label="Закрыть" onClick={() => setShowStoic(false)} style={iconBtn}><X size={19} strokeWidth={1.5} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: '0 20px calc(16px + env(safe-area-inset-bottom))' }}>
              {STOIC_LIBRARY.map(item => {
                const onShelf = !!shelfBookFor(item)
                return (
                  <div key={item.gutenbergId} style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                    <BookCover book={{ title: item.title, author: item.author }} width={44} height={62} />
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 17, lineHeight: 1.25, color: 'var(--text-primary)' }}>{item.title}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.author} · {item.note}</span>
                      <span style={{ display: 'flex', gap: 14, marginTop: 6 }}>
                        <button onClick={() => takeStoic(item, true)} style={{ ...inkButton, height: 32, padding: '0 12px' }}>Читать</button>
                        <button onClick={() => takeStoic(item, false)} disabled={onShelf}
                          style={{ height: 32, padding: 0, background: 'none', border: 'none', cursor: onShelf ? 'default' : 'pointer', fontSize: 13, color: onShelf ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: onShelf ? 'none' : 'underline', textUnderlineOffset: 4 }}>
                          {onShelf ? 'На полке' : 'На полку'}
                        </button>
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <BookModal
          book={editBook}
          onSave={(b) => { onSave({ ...b, id: editBook?.id } as Book); setShowModal(false) }}
          onDelete={editBook ? () => { onDelete(editBook.id); setShowModal(false) } : undefined}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}

// Обложка, растянутая на ячейку сетки
function BookCoverFill({ book }: { book: Book }) {
  if (book.coverUrl) {
    return <span style={{ flex: 1, border: '1px solid var(--text-primary)', background: `var(--bg-card) url(${book.coverUrl}) center/cover` }} />
  }
  return (
    <span style={{
      flex: 1, boxSizing: 'border-box', border: '1px solid var(--text-primary)', background: 'var(--bg-card)', padding: '10px 8px',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden',
      fontFamily: 'var(--font-typed)', color: 'var(--text-primary)', textShadow: '0 0 0.7px var(--ink-bleed)',
    }}>
      <span style={{ fontSize: 11, lineHeight: 1.25, textTransform: 'uppercase', wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{book.title}</span>
      <span style={{ fontSize: 9, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.author}</span>
    </span>
  )
}
