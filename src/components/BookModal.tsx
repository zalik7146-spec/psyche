import { useState, useCallback, useRef } from 'react'
import { X, Search, BookOpen, Star, Trash2 } from 'lucide-react'
import { Book, BookStatus } from '../types'

interface Props {
  book?: Book
  onSave: (book: Partial<Book>) => void
  onDelete?: () => void
  onClose: () => void
}

const EMOJIS = ['📚','📖','🧠','💭','🔮','✨','🌿','💬','🔬','📜','🎭','🌍','💡','🎨','🧬','⚡']
const COLORS = ['#b07d4a','#8a6a3a','#6b8a6b','#6b7a8a','#8a6b8a','#8a7a6b','#5a7a8a','#8a5a6b']
const STATUS = [
  { value: 'reading', label: '📖 Читаю' },
  { value: 'done', label: '✅ Прочитано' },
  { value: 'want', label: '🎯 Хочу' },
  { value: 'paused', label: '⏸️ Пауза' }
]

const vibe = (ms?: number) => navigator.vibrate?.(ms ?? 8)

export default function BookModal({ book, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(book?.title || '')
  const [author, setAuthor] = useState(book?.author || '')
  const [genre, setGenre] = useState(book?.genre || '')
  const [status, setStatus] = useState<BookStatus>(book?.status || 'want')
  const [color, setColor] = useState(book?.color || '#b07d4a')
  const [emoji, setEmoji] = useState(book?.coverEmoji || '📚')
  const [rating, setRating] = useState(book?.rating || 0)
  const [totalPages, setTotalPages] = useState(book?.totalPages?.toString() || '')
  const [currentPage, setCurrentPage] = useState(book?.currentPage?.toString() || '')
  const [description, setDescription] = useState(book?.description || '')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [coverUrl, setCoverUrl] = useState(book?.coverUrl || '')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchBooks = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return }
    setSearching(true)
    setSearchError('')
    try {
      const [googleRes, olRes] = await Promise.allSettled([
        fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=6&printType=books`).then(r => r.json()),
        fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=4`).then(r => r.json())
      ])

      const results: any[] = []

      if (googleRes.status === 'fulfilled' && googleRes.value?.items) {
        googleRes.value.items.forEach((item: any) => {
          const info = item.volumeInfo || {}
          let cover = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || ''
          if (cover) cover = cover.replace('http://', 'https://')
          results.push({
            id: item.id,
            title: info.title || '',
            author: (info.authors || []).join(', '),
            cover,
            pages: info.pageCount,
            genre: (info.categories || [])[0] || '',
            description: info.description || ''
          })
        })
      }

      if (olRes.status === 'fulfilled' && olRes.value?.docs) {
        olRes.value.docs.slice(0, 4).forEach((doc: any) => {
          const exists = results.some(r =>
            r.title.toLowerCase().includes((doc.title || '').toLowerCase().substring(0, 8))
          )
          if (!exists) {
            results.push({
              id: doc.key,
              title: doc.title || '',
              author: (doc.author_name || []).join(', '),
              cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '',
              pages: doc.number_of_pages_median,
              genre: (doc.subject || [])[0] || '',
              description: ''
            })
          }
        })
      }

      setSearchResults(results)
      if (results.length === 0) setSearchError('Ничего не найдено')
    } catch {
      setSearchError('Ошибка поиска')
    }
    setSearching(false)
  }, [])

  const handleSearchInput = (q: string) => {
    setSearchQuery(q)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => searchBooks(q), 600)
  }

  const handleSelectBook = (result: any) => {
    vibe(10)
    setTitle(result.title)
    setAuthor(result.author)
    if (result.genre) setGenre(result.genre)
    if (result.pages) setTotalPages(result.pages.toString())
    if (result.description) setDescription(result.description)
    if (result.cover) setCoverUrl(result.cover)
    setSearchQuery('')
    setSearchResults([])
  }

  const handleSave = () => {
    if (!title.trim()) return
    vibe(10)
    onSave({
      title: title.trim(),
      author: author.trim(),
      genre: genre.trim(),
      status: status as Book['status'],
      color,
      coverEmoji: emoji,
      rating,
      totalPages: parseInt(totalPages) || undefined,
      currentPage: parseInt(currentPage) || 0,
      description: description.trim(),
      coverUrl
    })
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 300
    }} onClick={onClose}>
      <div style={{
        width: '100%', maxWidth: 430,
        background: 'var(--bg-raised)',
        borderRadius: '24px 24px 0 0',
        maxHeight: '92vh', overflowY: 'auto',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }} onClick={e => e.stopPropagation()}>

        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 16px' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>
            {book ? 'Редактировать книгу' : 'Добавить книгу'}
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-primary)'
          }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Google Books Search */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>
              🔍 ПОИСК В КАТАЛОГЕ
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '0 12px'
            }}>
              <Search size={15} color='var(--text-muted)' />
              <input
                value={searchQuery}
                onChange={e => handleSearchInput(e.target.value)}
                placeholder='Найти книгу — автозаполнение...'
                style={{
                  flex: 1, padding: '11px 0', background: 'transparent',
                  border: 'none', outline: 'none', fontSize: 14,
                  color: 'var(--text-primary)'
                }}
              />
              {searching && (
                <div style={{
                  width: 14, height: 14, border: '2px solid var(--accent)',
                  borderTopColor: 'transparent', borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }} />
              )}
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div style={{
                marginTop: 8, background: 'var(--bg-card)',
                border: '1px solid var(--border)', borderRadius: 12,
                overflow: 'hidden', maxHeight: 280, overflowY: 'auto'
              }}>
                {searchResults.map((result, i) => (
                  <button key={result.id || i} onClick={() => handleSelectBook(result)} style={{
                    width: '100%', padding: '10px 12px',
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'transparent', border: 'none',
                    borderBottom: '1px solid var(--border)', cursor: 'pointer',
                    textAlign: 'left'
                  }}>
                    <div style={{
                      width: 40, height: 56, borderRadius: 6, flexShrink: 0,
                      background: 'var(--bg-raised)', overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {result.cover ? (
                        <img src={result.cover} alt={result.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : (
                        <BookOpen size={16} color='var(--text-muted)' />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>{result.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {result.author}
                        {result.pages ? ` · ${result.pages} стр.` : ''}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {searchError && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, paddingLeft: 4 }}>
                {searchError}
              </div>
            )}
          </div>

          {/* Cover preview */}
          {coverUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src={coverUrl} alt='cover' style={{
                width: 60, height: 84, objectFit: 'cover', borderRadius: 8,
                border: '1px solid var(--border)'
              }} onError={() => setCoverUrl('')} />
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Обложка найдена</div>
                <button onClick={() => setCoverUrl('')} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--accent)', fontSize: 12
                }}>Убрать</button>
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>НАЗВАНИЕ *</div>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder='Название книги'
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 12,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: 15, outline: 'none',
                boxSizing: 'border-box'
              }} />
          </div>

          {/* Author */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>АВТОР</div>
            <input value={author} onChange={e => setAuthor(e.target.value)}
              placeholder='Автор книги'
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 12,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: 15, outline: 'none',
                boxSizing: 'border-box'
              }} />
          </div>

          {/* Genre */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>ЖАНР</div>
            <input value={genre} onChange={e => setGenre(e.target.value)}
              placeholder='Психология, философия...'
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 12,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: 15, outline: 'none',
                boxSizing: 'border-box'
              }} />
          </div>

          {/* Status */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>СТАТУС</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {STATUS.map(s => (
                <button key={s.value} onClick={() => setStatus(s.value as BookStatus)} style={{
                  padding: '10px', borderRadius: 12, cursor: 'pointer',
                  background: status === s.value ? 'var(--accent)' : 'var(--bg-card)',
                  border: `1px solid ${status === s.value ? 'var(--accent)' : 'var(--border)'}`,
                  color: status === s.value ? '#fff' : 'var(--text-primary)',
                  fontSize: 13, fontWeight: status === s.value ? 600 : 400,
                  transition: 'all 0.2s'
                }}>{s.label}</button>
              ))}
            </div>
          </div>

          {/* Pages */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>СТРАНИЦ</div>
              <input type='number' value={totalPages} onChange={e => setTotalPages(e.target.value)}
                placeholder='300'
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 12,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: 15, outline: 'none',
                  boxSizing: 'border-box'
                }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>ТЕКУЩАЯ</div>
              <input type='number' value={currentPage} onChange={e => setCurrentPage(e.target.value)}
                placeholder='0'
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 12,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: 15, outline: 'none',
                  boxSizing: 'border-box'
                }} />
            </div>
          </div>

          {/* Rating */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>РЕЙТИНГ</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setRating(n === rating ? 0 : n)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                  transition: 'transform 0.15s'
                }}>
                  <Star size={28} fill={n <= rating ? '#c49a6c' : 'none'}
                    color={n <= rating ? '#c49a6c' : 'var(--text-muted)'} />
                </button>
              ))}
            </div>
          </div>

          {/* Emoji */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>ИКОНКА</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setEmoji(e)} style={{
                  width: 40, height: 40, borderRadius: 10, fontSize: 20,
                  background: emoji === e ? 'var(--accent)' : 'var(--bg-card)',
                  border: `1px solid ${emoji === e ? 'var(--accent)' : 'var(--border)'}`,
                  cursor: 'pointer', transition: 'all 0.15s',
                  transform: emoji === e ? 'scale(1.15)' : 'scale(1)'
                }}>{e}</button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>ЦВЕТ</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} style={{
                  width: 32, height: 32, borderRadius: '50%', background: c,
                  border: color === c ? '3px solid var(--text-primary)' : '2px solid var(--border)',
                  cursor: 'pointer', transition: 'all 0.15s',
                  transform: color === c ? 'scale(1.2)' : 'scale(1)'
                }} />
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>ОПИСАНИЕ</div>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder='Краткое описание книги...'
              rows={3}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 12,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: 14, outline: 'none',
                resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                lineHeight: 1.6
              }} />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            {book && onDelete && (
              <button onClick={() => { vibe(15); onDelete() }} style={{
                width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#e05a5a'
              }}>
                <Trash2 size={18} />
              </button>
            )}
            <button onClick={handleSave} disabled={!title.trim()} style={{
              flex: 1, padding: '14px', borderRadius: 14, cursor: 'pointer',
              background: title.trim()
                ? 'linear-gradient(135deg, var(--accent), #8a6a3a)'
                : 'var(--bg-card)',
              border: 'none',
              color: title.trim() ? '#fff' : 'var(--text-muted)',
              fontSize: 16, fontWeight: 700, transition: 'all 0.2s'
            }}>
              {book ? 'Сохранить' : 'Добавить книгу'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
