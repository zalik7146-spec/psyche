import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Share2 } from 'lucide-react';
import { Note, Book } from '../types';

const vibe = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };

interface Props {
  notes: Note[];
  books: Book[];
  onClose: () => void;
}

interface Slide {
  emoji: string;
  label: string;
  value: string | number;
  sub: string;
  bg: string;
  color: string;
}

export default function YearWrapped({ notes, books, onClose }: Props) {
  const [idx, setIdx] = useState(0);
  const [animDir, setAnimDir] = useState<'left' | 'right'>('left');

  const year = new Date().getFullYear();
  const yearNotes = notes.filter(n => n.createdAt.startsWith(String(year)));
  const yearBooks = books.filter(b => b.finishedAt?.startsWith(String(year)) || b.createdAt.startsWith(String(year)));
  const totalWords = yearNotes.reduce((s, n) => s + (n.wordCount || 0), 0);
  const insights = yearNotes.filter(n => n.type === 'insight').length;
  const quotes = yearNotes.filter(n => n.type === 'quote').length;
  const topBook = books.reduce((best, b) => {
    const cnt = notes.filter(n => n.bookId === b.id).length;
    const bestCnt = notes.filter(n => n.bookId === best?.id).length;
    return cnt > bestCnt ? b : best;
  }, books[0]);
  const allTags = yearNotes.flatMap(n => n.tags || []);
  const tagCount: Record<string, number> = {};
  allTags.forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; });
  const topTag = Object.entries(tagCount).sort((a, b) => b[1] - a[1])[0];

  // Streak
  const dates = [...new Set(yearNotes.map(n => n.createdAt.slice(0, 10)))].sort();
  let streak = 0, maxStreak = 0, cur = 0;
  for (let i = 0; i < dates.length; i++) {
    if (i === 0) { cur = 1; }
    else {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diff = (curr.getTime() - prev.getTime()) / 86400000;
      cur = diff === 1 ? cur + 1 : 1;
    }
    if (cur > maxStreak) maxStreak = cur;
  }
  streak = maxStreak;

  const slides: Slide[] = [
    {
      emoji: '📅',
      label: `Итоги ${year}`,
      value: yearNotes.length,
      sub: 'записей сделано за год',
      bg: 'linear-gradient(135deg, #2a1f14 0%, #3d2b1a 100%)',
      color: '#e8c97a',
    },
    {
      emoji: '📚',
      label: 'Прочитано книг',
      value: yearBooks.length,
      sub: `книг добавлено в библиотеку в ${year}`,
      bg: 'linear-gradient(135deg, #1a2a1f 0%, #1a3d2b 100%)',
      color: '#7ac997',
    },
    {
      emoji: '✍️',
      label: 'Слов написано',
      value: totalWords.toLocaleString('ru'),
      sub: 'слов в твоих записях — это целая книга!',
      bg: 'linear-gradient(135deg, #1f1a2a 0%, #2b1a3d 100%)',
      color: '#c97ae8',
    },
    {
      emoji: '💡',
      label: 'Инсайтов поймано',
      value: insights,
      sub: `инсайтов + ${quotes} цитат сохранено`,
      bg: 'linear-gradient(135deg, #2a2a14 0%, #3d3d1a 100%)',
      color: '#e8e87a',
    },
    {
      emoji: '🔥',
      label: 'Лучший стрик',
      value: `${streak} дней`,
      sub: 'максимальная серия записей подряд',
      bg: 'linear-gradient(135deg, #2a1414 0%, #3d1a1a 100%)',
      color: '#e87a7a',
    },
    {
      emoji: '🏆',
      label: 'Топ книга',
      value: topBook ? `${topBook.coverEmoji} ${topBook.title}` : '—',
      sub: topBook ? `${notes.filter(n => n.bookId === topBook.id).length} записей к этой книге` : 'Добавь первую книгу!',
      bg: 'linear-gradient(135deg, #1a1f2a 0%, #1a2b3d 100%)',
      color: '#7ab8e8',
    },
    {
      emoji: '🏷️',
      label: 'Главный тег',
      value: topTag ? `#${topTag[0]}` : '—',
      sub: topTag ? `использован ${topTag[1]} раз` : 'Добавь теги к записям!',
      bg: 'linear-gradient(135deg, #1a2a2a 0%, #1a3d3d 100%)',
      color: '#7ae8e8',
    },
  ];

  const go = (dir: 'left' | 'right') => {
    vibe(6);
    setAnimDir(dir);
    setIdx(i => dir === 'left' ? Math.min(i + 1, slides.length - 1) : Math.max(i - 1, 0));
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go('left');
      if (e.key === 'ArrowLeft') go('right');
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const slide = slides[idx];

  const handleShare = async () => {
    vibe(10);
    const text = `Мой ${year} в Psyche:\n📝 ${yearNotes.length} записей\n📚 ${yearBooks.length} книг\n✍️ ${totalWords.toLocaleString('ru')} слов\n💡 ${insights} инсайтов\n🔥 Стрик: ${streak} дней`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Psyche Wrapped ${year}`, text });
      } else {
        await navigator.clipboard.writeText(text);
        alert('Скопировано в буфер обмена!');
      }
    } catch {}
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 600,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 0 env(safe-area-inset-bottom)',
    }}>
      <div style={{
        width: '100%', maxWidth: 430, height: '100%',
        display: 'flex', flexDirection: 'column',
        background: slide.bg,
        transition: 'background 0.5s ease',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Close */}
        <button onClick={() => { vibe(8); onClose(); }} style={{
          position: 'absolute', top: 'calc(env(safe-area-inset-top,0px) + 16px)', right: 16,
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', cursor: 'pointer', zIndex: 10,
        }}>
          <X size={18} />
        </button>

        {/* Progress bars */}
        <div style={{
          position: 'absolute', top: 'calc(env(safe-area-inset-top,0px) + 8px)',
          left: 16, right: 56,
          display: 'flex', gap: 4,
        }}>
          {slides.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i <= idx ? slide.color : 'rgba(255,255,255,0.2)',
              transition: 'background 0.3s ease',
            }} />
          ))}
        </div>

        {/* Content */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '80px 32px 32px',
          animation: `${animDir === 'left' ? 'slideInRight' : 'slideInLeft'} 0.35s cubic-bezier(0.22,1,0.36,1) both`,
        }}>
          <div style={{ fontSize: 80, marginBottom: 24, filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.5))' }}>
            {slide.emoji}
          </div>
          <p style={{
            fontSize: 14, fontWeight: 600, letterSpacing: '0.12em',
            color: slide.color, textTransform: 'uppercase', marginBottom: 16,
            fontFamily: 'Inter, sans-serif', opacity: 0.9,
          }}>
            {slide.label}
          </p>
          <p style={{
            fontSize: typeof slide.value === 'string' && slide.value.length > 10 ? 28 : 64,
            fontWeight: 800, color: '#fff',
            fontFamily: 'Lora, serif', textAlign: 'center',
            lineHeight: 1.1, marginBottom: 16,
            textShadow: `0 0 40px ${slide.color}60`,
          }}>
            {slide.value}
          </p>
          <p style={{
            fontSize: 16, color: 'rgba(255,255,255,0.65)',
            textAlign: 'center', lineHeight: 1.6,
            fontFamily: 'Inter, sans-serif',
          }}>
            {slide.sub}
          </p>
        </div>

        {/* Navigation */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px calc(32px + env(safe-area-inset-bottom))',
        }}>
          <button onClick={() => go('right')} style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', cursor: 'pointer', opacity: idx === 0 ? 0.3 : 1,
          }}>
            <ChevronLeft size={24} />
          </button>

          <button onClick={handleShare} style={{
            padding: '12px 24px', borderRadius: 24,
            background: slide.color, border: 'none',
            color: '#0e0c09', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Share2 size={16} /> Поделиться
          </button>

          <button onClick={() => go('left')} style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', cursor: 'pointer', opacity: idx === slides.length - 1 ? 0.3 : 1,
          }}>
            <ChevronRight size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}
