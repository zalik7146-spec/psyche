import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, Heart, Minus, Sun, Moon, BookOpen, ExternalLink } from 'lucide-react'

interface Props {
  book: { title: string; author: string; coverId?: string }
  onBack: () => void
  onCreateNote: (data: { title: string; content: string; bookTitle: string; type: string }) => void
}

export default function ReaderView({ book, onBack, onCreateNote }: Props) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [fontSize, setFontSize] = useState(18)
  const [theme, setTheme] = useState<'dark' | 'light' | 'sepia'>('dark')
  const [progress, setProgress] = useState(0)
  const [archiveUrl, setArchiveUrl] = useState('')

  useEffect(() => {
    const loadBook = async () => {
      setLoading(true)
      try {
        // Search for the book
        const searchUrl = `https://openlibrary.org/search.json?title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}&limit=1`
        const searchRes = await fetch(searchUrl)
        const searchData = await searchRes.json()

        if (searchData.docs && searchData.docs.length > 0) {
          const doc = searchData.docs[0]
          const workKey = doc.key

          // Get work details
          const workUrl = `https://openlibrary.org${workKey}.json`
          const workRes = await fetch(workUrl)
          const workData = await workRes.json()

          // Get description
          let desc = ''
          if (workData.description) {
            desc = typeof workData.description === 'string' 
              ? workData.description 
              : workData.description.value || ''
          }

          // Archive.org link
          if (doc.ia && doc.ia.length > 0) {
            setArchiveUrl(`https://archive.org/details/${doc.ia[0]}`)
          }

          // Build content
          let fullContent = ''
          
          if (desc) {
            fullContent += `📖 О книге\n\n${desc}\n\n`
          }

          if (workData.excerpts && workData.excerpts.length > 0) {
            fullContent += `📝 Отрывки\n\n`
            workData.excerpts.forEach((exc: any, i: number) => {
              const text = typeof exc === 'string' ? exc : exc.excerpt || ''
              if (text) {
                fullContent += `${i + 1}. ${text}\n\n`
              }
            })
          }

          if (workData.subjects) {
            fullContent += `🏷️ Темы: ${workData.subjects.slice(0, 5).join(', ')}\n\n`
          }

          if (workData.first_sentence) {
            const sentence = typeof workData.first_sentence === 'string' 
              ? workData.first_sentence 
              : workData.first_sentence.value || ''
            if (sentence) {
              fullContent += `✨ Первое предложение:\n"${sentence}"\n\n`
            }
          }

          if (!fullContent.trim()) {
            fullContent = `К сожалению, полный текст книги "${book.title}" не доступен в Open Library.\n\nВы можете:\n• Найти книгу на Archive.org\n• Добавить собственные заметки и цитаты\n• Искать отрывки в других источниках`
          }

          setContent(fullContent)
        } else {
          setContent(`Книга "${book.title}" не найдена в каталоге Open Library.\n\nВы можете добавить собственные заметки и цитаты к этой книге.`)
        }
      } catch (err) {
        console.error('Error loading book:', err)
        setContent(`Не удалось загрузить информацию о книге.\n\nПроверьте подключение к интернету.`)
      } finally {
        setLoading(false)
      }
    }

    loadBook()
  }, [book.title, book.author])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const scrollPercent = (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100
    setProgress(Math.min(100, Math.max(0, scrollPercent)))
  }

  const handleCreateNote = () => {
    onCreateNote({
      title: `Заметка: ${book.title}`,
      content: '',
      bookTitle: book.title,
      type: 'note'
    })
    onBack()
  }

  const handleCreateQuote = () => {
    onCreateNote({
      title: `Цитата: ${book.title}`,
      content: '',
      bookTitle: book.title,
      type: 'quote'
    })
    onBack()
  }

  const themes = {
    dark: { bg: 'var(--bg-base)', text: 'var(--text-primary)', card: 'var(--bg-card)' },
    light: { bg: '#f5f0e8', text: '#1a1a1a', card: '#ffffff' },
    sepia: { bg: '#f4ecd8', text: '#5c4b37', card: '#fffef9' }
  }

  const currentTheme = themes[theme]

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: currentTheme.bg,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      transition: 'background 0.3s'
    }}>
      {/* Progress bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        background: 'var(--border)',
        zIndex: 10
      }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: 'var(--accent)',
          transition: 'width 0.1s'
        }} />
      </div>

      {/* Header */}
      <div style={{
        padding: '12px 16px',
        paddingTop: 'calc(12px + env(safe-area-inset-top))',
        borderBottom: `1px solid ${theme === 'dark' ? 'var(--border)' : '#ddd'}`,
        background: currentTheme.card,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <button
          onClick={onBack}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: theme === 'dark' ? 'var(--bg-card)' : '#f0f0f0',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: currentTheme.text
          }}
        >
          <ArrowLeft size={20} />
        </button>

        <div style={{ textAlign: 'center', flex: 1, padding: '0 10px' }}>
          <h3 style={{ 
            fontSize: '14px', 
            fontWeight: '600', 
            color: currentTheme.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {book.title}
          </h3>
          <p style={{ fontSize: '12px', color: theme === 'dark' ? 'var(--text-muted)' : '#666' }}>
            {book.author}
          </p>
        </div>

        <div style={{ width: '40px' }} />
      </div>

      {/* Toolbar */}
      <div style={{
        padding: '10px 16px',
        borderBottom: `1px solid ${theme === 'dark' ? 'var(--border)' : '#ddd'}`,
        background: currentTheme.card,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Font size */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setFontSize(Math.max(14, fontSize - 2))}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: theme === 'dark' ? 'var(--bg-raised)' : '#f0f0f0',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: currentTheme.text
            }}
          >
            <Minus size={16} />
          </button>
          <span style={{ fontSize: '14px', color: currentTheme.text, minWidth: '30px', textAlign: 'center' }}>
            {fontSize}
          </span>
          <button
            onClick={() => setFontSize(Math.min(28, fontSize + 2))}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: theme === 'dark' ? 'var(--bg-raised)' : '#f0f0f0',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: currentTheme.text
            }}
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Theme switcher */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setTheme('dark')}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: theme === 'dark' ? 'var(--accent)' : 'var(--bg-raised)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme === 'dark' ? '#000' : 'var(--text-muted)'
            }}
          >
            <Moon size={16} />
          </button>
          <button
            onClick={() => setTheme('light')}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: theme === 'light' ? 'var(--accent)' : (theme === 'dark' ? 'var(--bg-raised)' : '#f0f0f0'),
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme === 'light' ? '#000' : (theme === 'dark' ? 'var(--text-muted)' : '#666')
            }}
          >
            <Sun size={16} />
          </button>
          <button
            onClick={() => setTheme('sepia')}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: theme === 'sepia' ? 'var(--accent)' : (theme === 'dark' ? 'var(--bg-raised)' : '#f0f0f0'),
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme === 'sepia' ? '#000' : (theme === 'dark' ? 'var(--text-muted)' : '#666')
            }}
          >
            <BookOpen size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 20px',
          paddingBottom: '100px'
        }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            Загрузка книги...
          </div>
        ) : (
          <>
            <div style={{
              fontSize: `${fontSize}px`,
              lineHeight: '1.8',
              color: currentTheme.text,
              fontFamily: 'Georgia, serif',
              whiteSpace: 'pre-wrap'
            }}>
              {content}
            </div>

            {archiveUrl && (
              <a
                href={archiveUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '24px',
                  padding: '12px 20px',
                  background: 'var(--accent)',
                  color: '#000',
                  borderRadius: '12px',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                <ExternalLink size={16} />
                Читать на Archive.org
              </a>
            )}
          </>
        )}
      </div>

      {/* Bottom actions */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '16px',
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
        background: `linear-gradient(transparent, ${currentTheme.bg})`,
        display: 'flex',
        gap: '12px',
        justifyContent: 'center'
      }}>
        <button
          onClick={handleCreateNote}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '14px 24px',
            borderRadius: '14px',
            background: 'var(--accent)',
            border: 'none',
            color: '#000',
            fontSize: '15px',
            fontWeight: '600',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}
        >
          <Plus size={18} />
          Заметка
        </button>
        <button
          onClick={handleCreateQuote}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '14px 24px',
            borderRadius: '14px',
            background: currentTheme.card,
            border: `1px solid ${theme === 'dark' ? 'var(--border)' : '#ddd'}`,
            color: currentTheme.text,
            fontSize: '15px',
            fontWeight: '600',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}
        >
          <Heart size={18} />
          Цитата
        </button>
      </div>
    </div>
  )
}
