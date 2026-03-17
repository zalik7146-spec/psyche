import { useState, useEffect, useRef } from 'react';
import { Search, Star } from 'lucide-react';
import { Book } from '../types';

interface Props {
  book?: Book;
  onSave: (book: Partial<Book>) => void;
  onDelete?: (bookId: string) => void;
  onClose: () => void;
}

const STATUSES: { value: Book['status']; label: string }[] = [
  { value: 'reading',  label: '📖 Читаю' },
  { value: 'finished', label: '✅ Прочитано' },
  { value: 'want',     label: '🔖 Хочу' },
  { value: 'paused',   label: '⏸️ Пауза' },
];

const EMOJIS = ['📚','📖','📝','🧠','💡','🔬','🎭','🌍','❤️','🧘','⚡','🔮'];
const COLORS = ['#b07d4a','#7c6f5e','#5c7a6b','#6b5c7a','#7a5c5c','#4a6b7a'];

interface GBook {
  id: string;
  title: string;
  authors: string[];
  thumbnail: string;
  pages: number;
  description: string;
}

export default function BookModal({ book, onSave, onDelete, onClose }: Props) {
  const isEdit = !!book;
  const [title, setTitle]   = useState(book?.title || '');
  const [author, setAuthor] = useState(book?.author || '');
  const [status, setStatus] = useState<Book['status']>(book?.status || 'want');
  const [color, setColor]   = useState(book?.color || COLORS[0]);
  const [emoji, setEmoji]   = useState(book?.coverEmoji || '📚');
  const [pages, setPages]   = useState(book?.totalPages?.toString() || '');
  const [rating, setRating] = useState(book?.rating || 0);
  const [genre, setGenre]   = useState(book?.genre || '');
  const [query, setQuery]   = useState('');
  const [results, setResults] = useState<GBook[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>|null>(null);

  // Google Books search
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); setSearchErr(''); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSearching(true);
      setSearchErr('');
      try {
        const q = encodeURIComponent(query.trim());
        const url = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=8&printType=books`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.items?.length) { setResults([]); setSearchErr('Ничего не найдено'); setSearching(false); return; }
        const items: GBook[] = data.items.map((item: Record<string, unknown>) => {
          const info = (item.volumeInfo as Record<string, unknown>) || {};
          const links = (info.imageLinks as Record<string, string>) || {};
          const thumb = (links.thumbnail || links.smallThumbnail || '').replace('http://', 'https://');
          return {
            id: item.id as string,
            title: (info.title as string) || '',
            authors: (info.authors as string[]) || ['Автор неизвестен'],
            thumbnail: thumb,
            pages: (info.pageCount as number) || 0,
            description: ((info.description as string) || '').slice(0, 200),
          };
        }).filter((b: GBook) => b.title);
        setResults(items);
        if (!items.length) setSearchErr('Ничего не найдено');
      } catch (e) {
        console.error('Google Books error:', e);
        setSearchErr('Ошибка поиска. Попробуй ещё раз.');
        setResults([]);
      }
      setSearching(false);
    }, 600);
  }, [query]);

  const pickBook = (g: GBook) => {
    setTitle(g.title);
    setAuthor(g.authors.join(', '));
    if (g.pages) setPages(g.pages.toString());
    setResults([]);
    setQuery('');
    setSearchErr('');
  };

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      title:      title.trim(),
      author:     author.trim(),
      status, color,
      coverEmoji: emoji,
      genre:      genre.trim(),
      totalPages: pages ? parseInt(pages) : undefined,
      rating:     rating || undefined,
    });
    onClose();
  };

  const inp: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 12,
    background: 'var(--bg-raised)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', fontSize: 15, boxSizing: 'border-box',
    outline: 'none', fontFamily: 'Inter, sans-serif',
  };

  const lbl: React.CSSProperties = {
    fontSize: 11, color: 'var(--text-muted)', marginBottom: 6,
    fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' as const,
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', top:0, left:0, right:0, bottom:0,
      background: 'rgba(0,0,0,0.75)', zIndex: 3000,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 430,
        background: 'var(--bg-card)',
        borderRadius: '20px 20px 0 0',
        maxHeight: '92vh', overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        animation: 'sheetSlideUp 0.35s cubic-bezier(0.22,1,0.36,1)',
      }}>
        {/* Handle */}
        <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 4px' }}>
          <div style={{ width:36, height:4, borderRadius:2, background:'var(--border)' }}/>
        </div>

        {/* Header */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'8px 20px 14px', borderBottom:'1px solid var(--border)',
          position:'sticky', top:0, background:'var(--bg-card)', zIndex:10,
        }}>
          <button onClick={onClose} style={{
            background:'var(--bg-raised)', border:'none', borderRadius:10,
            color:'var(--text-secondary)', padding:'7px 14px', cursor:'pointer', fontSize:14,
          }}>Отмена</button>
          <span style={{ fontFamily:'Lora,serif', fontSize:18, fontWeight:700, color:'var(--text-primary)' }}>
            {isEdit ? 'Редактировать' : 'Добавить книгу'}
          </span>
          <button onClick={handleSave} style={{
            background:'linear-gradient(135deg,var(--accent),#8a5c30)',
            border:'none', borderRadius:10, color:'#fff',
            padding:'7px 16px', cursor:'pointer', fontSize:14, fontWeight:600,
          }}>Готово</button>
        </div>

        <div style={{ padding:'20px 20px 40px', display:'flex', flexDirection:'column', gap:18 }}>
          {/* Google Books Search */}
          <div>
            <div style={lbl}>🔍 Поиск в Google Books</div>
            <div style={{ position:'relative' }}>
              <Search size={16} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Введи название или автора..."
                style={{ ...inp, paddingLeft:36 }}
              />
              {searching && (
                <div style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                  color:'var(--text-muted)', fontSize:12 }}>Поиск...</div>
              )}
            </div>

            {searchErr && !searching && (
              <div style={{ marginTop:8, color:'var(--text-muted)', fontSize:13, textAlign:'center' }}>{searchErr}</div>
            )}

            {results.length > 0 && (
              <div style={{ marginTop:10, borderRadius:14, overflow:'hidden',
                border:'1px solid var(--border)', background:'var(--bg-raised)',
                maxHeight:280, overflowY:'auto' }}>
                {results.map((g, i) => (
                  <div key={g.id} onClick={() => pickBook(g)}
                    style={{ display:'flex', gap:12, padding:'12px 14px', cursor:'pointer',
                      borderBottom: i < results.length-1 ? '1px solid var(--border)' : 'none',
                      transition:'background 0.15s',
                      animation:`fadeSlideUp 0.2s ease ${i*0.04}s both` }}
                    onMouseEnter={e => (e.currentTarget.style.background='var(--bg-card)')}
                    onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                    {g.thumbnail ? (
                      <img src={g.thumbnail} alt={g.title}
                        style={{ width:44, height:60, objectFit:'cover', borderRadius:6, flexShrink:0 }}
                        onError={e => { (e.target as HTMLImageElement).style.display='none' }}/>
                    ) : (
                      <div style={{ width:44, height:60, borderRadius:6, flexShrink:0,
                        background:'var(--bg-card)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>📚</div>
                    )}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:600, color:'var(--text-primary)', fontSize:14,
                        overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box',
                        WebkitLineClamp:2, WebkitBoxOrient:'vertical' as const }}>{g.title}</div>
                      <div style={{ color:'var(--text-muted)', fontSize:12, marginTop:3 }}>{g.authors.join(', ')}</div>
                      {g.pages > 0 && <div style={{ color:'var(--text-muted)', fontSize:11, marginTop:2 }}>{g.pages} стр.</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <div style={lbl}>Название *</div>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Название книги" style={inp}/>
          </div>

          {/* Author */}
          <div>
            <div style={lbl}>Автор</div>
            <input value={author} onChange={e => setAuthor(e.target.value)}
              placeholder="Имя автора" style={inp}/>
          </div>

          {/* Genre */}
          <div>
            <div style={lbl}>Жанр</div>
            <input value={genre} onChange={e => setGenre(e.target.value)}
              placeholder="Психология, философия..." style={inp}/>
          </div>

          {/* Status */}
          <div>
            <div style={lbl}>Статус</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {STATUSES.map(st => (
                <button key={st.value} onClick={() => setStatus(st.value)}
                  style={{ padding:'10px 12px', borderRadius:12, border:'none', cursor:'pointer',
                    background: status === st.value ? 'var(--accent)' : 'var(--bg-raised)',
                    color: status === st.value ? '#fff' : 'var(--text-primary)',
                    fontSize:14, fontWeight: status === st.value ? 600 : 400,
                    transition:'all 0.15s' }}>
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pages */}
          <div>
            <div style={lbl}>Страниц</div>
            <input value={pages} onChange={e => setPages(e.target.value.replace(/\D/g,''))}
              placeholder="Количество страниц" style={inp} type="number" inputMode="numeric"/>
          </div>

          {/* Rating */}
          <div>
            <div style={lbl}>Оценка</div>
            <div style={{ display:'flex', gap:8 }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setRating(rating === n ? 0 : n)}
                  style={{ background:'none', border:'none', cursor:'pointer', padding:4,
                    transition:'transform 0.15s' }}
                  onMouseDown={e => (e.currentTarget.style.transform='scale(1.3)')}
                  onMouseUp={e => (e.currentTarget.style.transform='scale(1)')}>
                  <Star size={28} fill={n <= rating ? 'var(--accent)' : 'none'}
                    stroke={n <= rating ? 'var(--accent)' : 'var(--text-muted)'}/>
                </button>
              ))}
            </div>
          </div>

          {/* Emoji */}
          <div>
            <div style={lbl}>Иконка</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setEmoji(e)}
                  style={{ width:44, height:44, borderRadius:12, border:'none', cursor:'pointer',
                    background: emoji === e ? 'var(--accent)' : 'var(--bg-raised)',
                    fontSize:22, transition:'all 0.15s',
                    transform: emoji === e ? 'scale(1.15)' : 'scale(1)' }}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <div style={lbl}>Цвет обложки</div>
            <div style={{ display:'flex', gap:10 }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  style={{ width:36, height:36, borderRadius:'50%', border:'none', cursor:'pointer',
                    background:c, transition:'transform 0.15s',
                    transform: color === c ? 'scale(1.25)' : 'scale(1)',
                    boxShadow: color === c ? `0 0 0 3px var(--bg-card), 0 0 0 5px ${c}` : 'none' }}>
                </button>
              ))}
            </div>
          </div>

          {/* Delete */}
          {isEdit && onDelete && (
            <button onClick={() => { if (confirm('Удалить книгу?')) { onDelete(book!.id); onClose(); } }}
              style={{ padding:'12px', borderRadius:14, border:'1px solid #c0392b',
                background:'transparent', color:'#c0392b', cursor:'pointer', fontSize:15,
                fontWeight:600, marginTop:8, transition:'all 0.15s' }}>
              🗑️ Удалить книгу
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
