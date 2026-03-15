import { useState, useMemo, useEffect, useRef } from 'react';
import { Note, Book, Tag } from '../types';
import {
  BarChart2, Search, Star, TrendingUp,
  BookOpen, FileText, Lightbulb, X, Sparkles,
  Flame, Target, Clock, RefreshCw,
} from 'lucide-react';

interface Props {
  notes: Note[];
  books: Book[];
  tags: Tag[];
  onOpen: (note: Note) => void;
}

const NOTE_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  note:     { label: 'Заметки',  icon: '📝', color: '#8a6e50' },
  quote:    { label: 'Цитаты',   icon: '❝',  color: '#c4813c' },
  insight:  { label: 'Инсайты', icon: '💡', color: '#6a9e8a' },
  question: { label: 'Вопросы', icon: '🔍', color: '#8a7a9a' },
  summary:  { label: 'Резюме',  icon: '📋', color: '#7a8a6a' },
  idea:     { label: 'Идеи',    icon: '🌱', color: '#9a8a4a' },
  task:     { label: 'Задачи',  icon: '✓',  color: '#6a7a9a' },
};

const vibe = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };

// Animated number counter
function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    const start = ref.current;
    const end = value;
    const dur = 700;
    const startTime = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - startTime) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(start + (end - start) * ease));
      if (t < 1) requestAnimationFrame(step);
      else ref.current = end;
    };
    requestAnimationFrame(step);
  }, [value]);
  return <>{display.toLocaleString('ru')}</>;
}

export default function StatsView({ notes, books, tags, onOpen }: Props) {
  const [query, setQuery] = useState('');
  const [dailyNote, setDailyNote] = useState<Note | null>(null);
  const [dailyIdx, setDailyIdx] = useState(0);
  const [insightKey, setInsightKey] = useState(0);

  // ── Daily Insight pool ──────────────────────────────────────────────
  const insightPool = useMemo(() =>
    notes.filter(n => n.type === 'insight' || n.type === 'quote' || n.isFavorite),
    [notes]
  );

  useEffect(() => {
    if (insightPool.length > 0) setDailyNote(insightPool[dailyIdx % insightPool.length]);
    else if (notes.length > 0) setDailyNote(notes[dailyIdx % notes.length]);
    else setDailyNote(null);
    setInsightKey(k => k + 1);
  }, [insightPool, notes, dailyIdx]);

  const nextInsight = () => {
    vibe(8);
    setDailyIdx(i => i + 1);
  };

  // ── Search ──────────────────────────────────────────────────────────
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return notes.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.content.replace(/<[^>]+>/g, ' ').toLowerCase().includes(q) ||
      (n.quote || '').toLowerCase().includes(q) ||
      (n.tags || []).some(tid => {
        const tag = tags.find(t => t.id === tid);
        return tag?.name.toLowerCase().includes(q);
      })
    ).slice(0, 20);
  }, [query, notes, tags]);

  // ── Stats ───────────────────────────────────────────────────────────
  const totalWords   = useMemo(() => notes.reduce((s, n) => s + (n.wordCount || 0), 0), [notes]);
  const byType       = useMemo(() => { const m: Record<string, number> = {}; notes.forEach(n => { m[n.type] = (m[n.type]||0)+1; }); return m; }, [notes]);
  const booksFinished = books.filter(b => b.status === 'finished').length;
  const booksReading  = books.filter(b => b.status === 'reading').length;
  const favorites     = notes.filter(n => n.isFavorite).length;

  const streak = useMemo(() => {
    if (!notes.length) return 0;
    let count = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().slice(0, 10);
      if (notes.some(n => n.createdAt.slice(0, 10) === dayStr)) count++;
      else if (i > 0) break;
    }
    return count;
  }, [notes]);

  const activity = useMemo(() => {
    const days: { label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().slice(0, 10);
      days.push({
        label: i === 0 ? 'Сег' : i === 1 ? 'Вчр' : d.toLocaleDateString('ru', { weekday: 'short' }),
        count: notes.filter(n => n.createdAt.slice(0, 10) === dayStr).length,
      });
    }
    return days;
  }, [notes]);

  const maxActivity = Math.max(...activity.map(d => d.count), 1);

  const topTags = useMemo(() => {
    const map: Record<string, number> = {};
    notes.forEach(n => n.tags.forEach(tid => { map[tid] = (map[tid]||0)+1; }));
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,6)
      .map(([id,count]) => ({ tag: tags.find(t=>t.id===id), count }))
      .filter(x=>x.tag);
  }, [notes, tags]);

  const getBookTitle = (bookId?: string) => books.find(b=>b.id===bookId)?.title || null;
  const strip = (html: string) => html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base)' }}>

      {/* Header */}
      <div style={{
        paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)',
        padding: 'calc(env(safe-area-inset-top,0px) + 12px) 16px 12px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0, background: 'var(--bg-base)',
        animation: 'fadeIn 0.3s ease-out both',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 size={18} color="var(--accent)" />
            <h1 style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'Lora, serif', color: 'var(--text-primary)', margin: 0 }}>
              Прогресс
            </h1>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
            {notes.length} записей
          </span>
        </div>

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'var(--bg-raised)', borderRadius: '12px',
          border: '1px solid var(--border-mid)', padding: '0 12px',
        }}>
          <Search size={15} color="var(--text-muted)" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Поиск по всем записям…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              padding: '10px 0', fontSize: '14px', color: 'var(--text-primary)',
              fontFamily: 'Inter, sans-serif',
            }}
          />
          {query && (
            <button onClick={() => setQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '4px' }}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="scroll-area" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* Search results */}
        {query.trim() ? (
          <div style={{ animation: 'fadeUp 0.3s ease-out both' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', marginBottom: '10px' }}>
              Найдено: <strong style={{ color: 'var(--accent)' }}>{searchResults.length}</strong>
            </p>
            {searchResults.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                <Search size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                <p style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>Ничего не найдено</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {searchResults.map((note, i) => {
                  const bookTitle = getBookTitle(note.bookId);
                  const preview = strip(note.content).slice(0, 100);
                  const meta = NOTE_TYPE_LABELS[note.type];
                  return (
                    <button key={note.id}
                      onClick={() => { vibe(8); onOpen(note); }}
                      className="card-hover"
                      style={{
                        background: 'var(--bg-card)', border: 'var(--card-border)',
                        borderRadius: '14px', padding: '12px 14px',
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                        animation: `card-enter 0.3s both`, animationDelay: `${i * 0.04}s`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ fontSize: 13 }}>{meta?.icon}</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, fontFamily: 'Lora, serif', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {note.title}
                        </span>
                        {note.isFavorite && <Star size={12} fill="#d4914a" color="#d4914a" />}
                      </div>
                      {preview && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', margin: '0 0 6px', lineHeight: 1.5 }}>
                          {preview}{preview.length >= 100 ? '…' : ''}
                        </p>
                      )}
                      {bookTitle && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
                          📖 {bookTitle}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* ══ ИНСАЙТ ДНЯ — БОЛЬШАЯ КАРТОЧКА ══ */}
            {dailyNote ? (
              <div
                key={insightKey}
                style={{
                  background: 'linear-gradient(145deg, var(--bg-raised) 0%, var(--bg-card) 100%)',
                  border: '1px solid var(--border-mid)',
                  borderRadius: '20px',
                  padding: '20px',
                  position: 'relative',
                  overflow: 'hidden',
                  animation: 'scaleIn 0.35s cubic-bezier(0.22,1,0.36,1) both',
                  minHeight: 200,
                }}
              >
                {/* Ambient glow */}
                <div style={{
                  position: 'absolute', top: -40, right: -40,
                  width: 180, height: 180, borderRadius: '50%',
                  background: 'var(--accent-glow)', filter: 'blur(50px)',
                  pointerEvents: 'none',
                }} />
                <div style={{
                  position: 'absolute', bottom: -30, left: -20,
                  width: 120, height: 120, borderRadius: '50%',
                  background: 'rgba(106,158,138,0.08)', filter: 'blur(40px)',
                  pointerEvents: 'none',
                }} />

                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 9,
                      background: 'var(--accent-glow)',
                      border: '1px solid var(--accent-dim)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Sparkles size={14} color="var(--accent)" />
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', fontFamily: 'Inter, sans-serif', display: 'block' }}>
                        Инсайт дня
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
                        {insightPool.length} в коллекции
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={nextInsight}
                    style={{
                      background: 'var(--bg-base)', border: '1px solid var(--border)',
                      borderRadius: '10px', padding: '6px 10px',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
                      color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'Inter, sans-serif',
                      transition: 'all 0.15s',
                    }}
                  >
                    <RefreshCw size={11} />
                    Другой
                  </button>
                </div>

                {/* Content — full tap area */}
                <button
                  onClick={() => { vibe(8); onOpen(dailyNote); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left', width: '100%', padding: 0,
                    position: 'relative',
                  }}
                >
                  <h3 style={{
                    fontSize: '1.15rem', fontWeight: 700,
                    fontFamily: 'Lora, serif', color: 'var(--text-primary)',
                    margin: '0 0 12px', lineHeight: 1.4,
                  }}>
                    {dailyNote.title || 'Без заголовка'}
                  </h3>

                  {dailyNote.quote ? (
                    <div style={{
                      borderLeft: `3px solid var(--accent)`,
                      paddingLeft: '14px', marginBottom: '12px',
                    }}>
                      <p style={{
                        fontSize: '0.95rem', fontStyle: 'italic',
                        color: 'var(--text-secondary)', fontFamily: 'Lora, serif',
                        margin: 0, lineHeight: 1.7,
                      }}>
                        «{dailyNote.quote.length > 200 ? dailyNote.quote.slice(0, 200) + '…' : dailyNote.quote}»
                      </p>
                    </div>
                  ) : (
                    <p style={{
                      fontSize: '0.92rem', color: 'var(--text-secondary)',
                      fontFamily: 'Inter, sans-serif', margin: '0 0 12px',
                      lineHeight: 1.7,
                    }}>
                      {strip(dailyNote.content).slice(0, 220)}{strip(dailyNote.content).length > 220 ? '…' : ''}
                    </p>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    {dailyNote.bookId && (
                      <span style={{
                        fontSize: '11px', color: 'var(--text-muted)',
                        fontFamily: 'Inter, sans-serif',
                        background: 'var(--bg-base)', borderRadius: 99,
                        padding: '3px 9px', border: '1px solid var(--border)',
                      }}>
                        📖 {getBookTitle(dailyNote.bookId)}
                      </span>
                    )}
                    {dailyNote.isFavorite && (
                      <span style={{ fontSize: 14 }}>⭐</span>
                    )}
                    <span style={{
                      fontSize: '11px', color: 'var(--accent)',
                      fontFamily: 'Inter, sans-serif',
                      background: 'var(--accent-glow)', borderRadius: 99,
                      padding: '3px 9px', border: '1px solid var(--accent-dim)',
                      marginLeft: 'auto',
                    }}>
                      Открыть →
                    </span>
                  </div>
                </button>
              </div>
            ) : (
              <div style={{
                background: 'var(--bg-card)', borderRadius: '20px',
                padding: '32px', textAlign: 'center',
                border: '1px dashed var(--border-mid)',
                animation: 'fadeUp 0.4s ease-out both',
                minHeight: 160, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={32} color="var(--accent)" style={{ opacity: 0.4, marginBottom: '12px' }} />
                <p style={{ fontSize: '15px', color: 'var(--text-muted)', fontFamily: 'Lora, serif', margin: '0 0 6px' }}>
                  Создайте первые записи
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', margin: 0 }}>
                  Здесь появится ваш инсайт дня
                </p>
              </div>
            )}

            {/* ══ METRICS GRID ══ */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px',
              animation: 'fadeUp 0.4s ease-out 0.08s both',
            }}>
              {[
                { icon: <Flame size={16} color="#d45858" />,     value: streak,       label: 'дней подряд', accent: '#d45858' },
                { icon: <FileText size={16} color="var(--accent)" />, value: notes.length,  label: 'записей',     accent: 'var(--accent)' },
                { icon: <BookOpen size={16} color="#6a9e8a" />,  value: booksReading, label: 'читаю',        accent: '#6a9e8a' },
                { icon: <Target size={16} color="#8a7a9a" />,    value: booksFinished,label: 'прочитано',    accent: '#8a7a9a' },
                { icon: <Star size={16} color="#d4914a" />,      value: favorites,    label: 'избранных',    accent: '#d4914a' },
                { icon: <TrendingUp size={16} color="#9a8a4a" />,value: totalWords,   label: 'слов',         accent: '#9a8a4a' },
              ].map((m, i) => (
                <div key={i}
                  className="card-enter"
                  style={{
                    background: 'var(--bg-card)', borderRadius: '16px',
                    border: 'var(--card-border)', padding: '14px 10px',
                    animationDelay: `${0.1 + i * 0.05}s`,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ marginBottom: '6px', display: 'flex', justifyContent: 'center' }}>{m.icon}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: m.accent, fontFamily: 'Inter, sans-serif', lineHeight: 1, marginBottom: '3px' }}>
                    <AnimatedNumber value={m.value} />
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>{m.label}</div>
                </div>
              ))}
            </div>

            {/* ══ ACTIVITY CHART ══ */}
            {notes.length > 0 && (
              <div style={{
                background: 'var(--bg-card)', borderRadius: '18px',
                border: 'var(--card-border)', padding: '16px',
                animation: 'fadeUp 0.4s ease-out 0.14s both',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                  <Clock size={14} color="var(--accent)" />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}>
                    Активность — 7 дней
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '7px', height: '80px' }}>
                  {activity.map((day, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
                        <div style={{
                          width: '100%',
                          height: `${Math.max(day.count / maxActivity * 60, day.count > 0 ? 8 : 3)}px`,
                          background: day.count > 0
                            ? `linear-gradient(180deg, var(--accent) 0%, var(--accent-soft) 100%)`
                            : 'var(--bg-raised)',
                          borderRadius: '5px 5px 3px 3px',
                          transition: 'height 0.7s cubic-bezier(0.34,1.1,0.64,1)',
                          transitionDelay: `${i * 0.07}s`,
                          opacity: i === 6 ? 1 : 0.6 + i * 0.06,
                        }} />
                      </div>
                      <span style={{
                        fontSize: '9px', color: i === 6 ? 'var(--accent)' : 'var(--text-muted)',
                        fontFamily: 'Inter, sans-serif', fontWeight: i === 6 ? 700 : 400,
                      }}>{day.label}</span>
                      {day.count > 0 && (
                        <span style={{ fontSize: '9px', color: 'var(--accent)', fontFamily: 'Inter, sans-serif', fontWeight: 700 }}>
                          {day.count}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ══ BY TYPE ══ */}
            {Object.keys(byType).length > 0 && (
              <div style={{
                background: 'var(--bg-card)', borderRadius: '18px',
                border: 'var(--card-border)', padding: '16px',
                animation: 'fadeUp 0.4s ease-out 0.18s both',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                  <Lightbulb size={14} color="var(--accent)" />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}>
                    По типу записей
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([type, count]) => {
                    const meta = NOTE_TYPE_LABELS[type];
                    const pct  = Math.round(count / notes.length * 100);
                    return (
                      <div key={type}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: 13 }}>{meta?.icon}</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}>{meta?.label}</span>
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>{count} · {pct}%</span>
                        </div>
                        <div style={{ height: '6px', background: 'var(--bg-raised)', borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${pct}%`, height: '100%',
                            background: meta?.color || 'var(--accent)',
                            borderRadius: '99px',
                            transition: 'width 0.9s cubic-bezier(0.34,1.1,0.64,1)',
                            opacity: 0.85,
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ══ READING PROGRESS ══ */}
            {books.filter(b => b.status === 'reading' && b.totalPages && b.currentPage).length > 0 && (
              <div style={{
                background: 'var(--bg-card)', borderRadius: '18px',
                border: 'var(--card-border)', padding: '16px',
                animation: 'fadeUp 0.4s ease-out 0.22s both',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                  <BookOpen size={14} color="var(--accent)" />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}>
                    Прогресс чтения
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {books.filter(b => b.status === 'reading' && b.totalPages && b.currentPage).map(b => {
                    const pct = Math.min(Math.round((b.currentPage! / b.totalPages!) * 100), 100);
                    return (
                      <div key={b.id}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px' }}>
                          <span style={{ fontSize: 18 }}>{b.coverEmoji}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'Lora, serif', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {b.title}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
                              стр. {b.currentPage} / {b.totalPages}
                            </div>
                          </div>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'Inter, sans-serif' }}>
                            {pct}%
                          </span>
                        </div>
                        <div style={{ height: '6px', background: 'var(--bg-raised)', borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${pct}%`, height: '100%',
                            background: 'linear-gradient(90deg, var(--accent-soft), var(--accent))',
                            borderRadius: '99px',
                            transition: 'width 0.9s cubic-bezier(0.34,1.1,0.64,1)',
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ══ TOP TAGS ══ */}
            {topTags.length > 0 && (
              <div style={{
                background: 'var(--bg-card)', borderRadius: '18px',
                border: 'var(--card-border)', padding: '16px',
                animation: 'fadeUp 0.4s ease-out 0.26s both',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                  <TrendingUp size={14} color="var(--accent)" />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}>
                    Популярные теги
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                  {topTags.map(({ tag, count }) => tag && (
                    <div key={tag.id} style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      padding: '5px 10px', borderRadius: '99px',
                      background: 'var(--bg-raised)',
                      border: `1px solid ${tag.color}40`,
                      color: tag.color, fontSize: '12px', fontFamily: 'Inter, sans-serif',
                    }}>
                      #{tag.name}
                      <span style={{ fontSize: '10px', opacity: 0.7, background: `${tag.color}20`, borderRadius: '99px', padding: '1px 5px' }}>
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {notes.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', animation: 'fadeUp 0.4s ease-out both' }}>
                <BarChart2 size={40} style={{ opacity: 0.2, marginBottom: '12px' }} />
                <p style={{ fontSize: '15px', fontFamily: 'Lora, serif', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Начните вести записи
                </p>
                <p style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                  Здесь появится ваша статистика
                </p>
              </div>
            )}

            <div style={{ height: 16 }} />
          </>
        )}
      </div>
    </div>
  );
}
