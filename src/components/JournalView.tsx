import type { CSSProperties } from 'react';
import { Search } from 'lucide-react';
import type { DailyNote, Flashcard, Note, NoteType, TabId } from '../types';
import { createDailyNote } from '../store';

interface Props {
  notes: Note[];
  dailyNotes: DailyNote[];
  flashcards: Flashcard[];
  onSaveDailyNote: (dn: DailyNote) => void;
  onNavigate: (tab: TabId) => void;
  onOpenNote: (note: Note) => void;
  onOpenChallenges: () => void;
}

const vibe = (ms = 8) => { try { navigator.vibrate?.(ms); } catch { /* ignore */ } };

// Те же значения настроения, что и в записи дня
const MOODS: { value: 1 | 2 | 3 | 4 | 5; label: string }[] = [
  { value: 1, label: 'Тяжело' },
  { value: 2, label: 'Сложно' },
  { value: 3, label: 'Нейтрально' },
  { value: 4, label: 'Хорошо' },
  { value: 5, label: 'Отлично' },
];

const TYPE_LABEL: Record<NoteType, string> = {
  note: 'Заметка', quote: 'Цитата', insight: 'Инсайт', question: 'Вопрос',
  summary: 'Конспект', idea: 'Идея', task: 'Задача',
};

const EVENING_QUESTION = 'Что сегодня было в твоей власти, а что — нет?';

const label: CSSProperties = { fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' };
const typed: CSSProperties = {
  fontFamily: 'var(--font-typed)', color: 'var(--text-primary)', textShadow: '0 0 0.7px var(--ink-bleed)',
  fontSize: 15, lineHeight: 1.55, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
};
const sheet: CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)' };

const isoDay = (d: Date) => d.toISOString().split('T')[0];
const plain = (html: string) => html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();

// Серия: сколько дней подряд до сегодня (или до вчера, если сегодня ещё пусто) были записи
function currentStreak(days: Set<string>): number {
  const d = new Date();
  if (!days.has(isoDay(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(isoDay(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export default function JournalView({ notes, dailyNotes, flashcards, onSaveDailyNote, onNavigate, onOpenNote, onOpenChallenges }: Props) {
  const today = isoDay(new Date());
  const todayNote = dailyNotes.find(d => d.date === today);
  const todayText = todayNote ? plain(todayNote.content) : '';

  const days = new Set<string>([
    ...notes.map(n => n.createdAt.slice(0, 10)),
    ...dailyNotes.filter(d => plain(d.content) || d.mood).map(d => d.date),
  ]);
  const streak = currentStreak(days);
  const weekGoal = 7;

  const dueCards = flashcards.filter(c => new Date(c.nextReview) <= new Date()).length;
  const links = notes.reduce((s, n) => s + (n.linkedNoteIds?.length || 0), 0);
  const recent = [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3);

  const setMood = (mood: 1 | 2 | 3 | 4 | 5) => {
    vibe(8);
    const base = todayNote || createDailyNote(today);
    onSaveDailyNote({ ...base, mood: base.mood === mood ? undefined : mood, updatedAt: new Date().toISOString() });
  };

  const dateLine = new Date().toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long' });

  const tools: { label: string; value: string; tab: TabId }[] = [
    { label: 'Повторение', value: dueCards ? `${dueCards} к повтору` : 'Всё повторено', tab: 'cards' },
    { label: 'Граф связей', value: `${links} связей`, tab: 'graph' },
    { label: 'Все записи', value: `${notes.length} листов`, tab: 'notes' },
    { label: 'Статистика', value: 'Чтение и письмо', tab: 'stats' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-base)' }}>
      <header style={{ paddingTop: 'env(safe-area-inset-top)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, padding: '0 8px 0 20px' }}>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 28, color: 'var(--text-primary)' }}>Дневник</h1>
          <button aria-label="Поиск по записям" onClick={() => { vibe(); onNavigate('notes'); }}
            style={{ width: 44, height: 44, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}>
            <Search size={20} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <span style={{ ...label, padding: '0 8px' }}>
          {dateLine}{streak > 0 ? ` · серия ${streak} ${plural(streak, 'день', 'дня', 'дней')}` : ''}
        </span>

        {/* Лист дня */}
        <div style={{ ...sheet, padding: '18px 18px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={label}>Запись дня</span>
          {todayText ? (
            <p style={{ ...typed, display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{todayText}</p>
          ) : (
            <p style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 21, lineHeight: 1.3, color: 'var(--text-primary)' }}>{EVENING_QUESTION}</p>
          )}
          <button onClick={() => { vibe(10); onNavigate('daily'); }}
            style={{ alignSelf: 'flex-start', height: 40, padding: '0 18px', border: 'none', cursor: 'pointer', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 14, fontWeight: 500, fontFamily: 'var(--font-ui)' }}>
            {todayText ? 'Продолжить' : 'Написать'}
          </button>
        </div>

        {/* Настроение */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 8px' }}>
          <span style={label}>Как ты сейчас</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {MOODS.map(m => {
              const on = todayNote?.mood === m.value;
              return (
                <button key={m.value} aria-pressed={on} onClick={() => setMood(m.value)}
                  style={{
                    height: 34, padding: '0 14px', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-ui)',
                    border: on ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: on ? 'var(--accent)' : 'none', color: on ? 'var(--on-accent)' : 'var(--text-primary)',
                    transition: 'background var(--dur-quick) var(--ease-calm), color var(--dur-quick) var(--ease-calm)',
                  }}>{m.label}</button>
              );
            })}
          </div>
        </div>

        {/* Вызов */}
        <button onClick={() => { vibe(); onOpenChallenges(); }}
          style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '0 8px', padding: '14px 0', background: 'none', border: 'none', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <span style={label}>Вызов</span>
            <span style={{ fontSize: 15, color: 'var(--text-primary)' }}>Семь дней записей подряд</span>
          </span>
          <span aria-label={`${Math.min(streak, weekGoal)} из ${weekGoal}`} style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: weekGoal }, (_, i) => (
              <span key={i} style={{ width: 10, height: 10, boxSizing: 'border-box', ...(i < streak ? { background: 'var(--text-primary)' } : { border: '1px solid var(--border-mid)' }) }} />
            ))}
          </span>
        </button>

        {/* Инструменты */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          {tools.map(t => (
            <button key={t.tab} onClick={() => { vibe(); onNavigate(t.tab); }}
              style={{ ...sheet, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: 14, cursor: 'pointer', textAlign: 'left' }}>
              <span style={label}>{t.label}</span>
              <span style={{ ...typed, fontSize: 14 }}>{t.value}</span>
            </button>
          ))}
        </div>

        {/* Последние записи */}
        {recent.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', padding: '0 8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 4 }}>
              <span style={label}>Последние записи</span>
              <button onClick={() => { vibe(); onNavigate('notes'); }}
                style={{ height: 32, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', textDecoration: 'underline', textUnderlineOffset: 4, padding: 0 }}>
                Все
              </button>
            </div>
            {recent.map(n => (
              <button key={n.id} onClick={() => { vibe(); onOpenNote(n); }}
                style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '14px 0', background: 'none', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}>
                <span style={label}>{TYPE_LABEL[n.type] || 'Заметка'} · {new Date(n.updatedAt).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}</span>
                {n.title && <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, lineHeight: 1.3, color: 'var(--text-primary)' }}>{n.title}</span>}
                <span style={{ ...typed, fontSize: 14, color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {plain(n.content) || '—'}
                </span>
              </button>
            ))}
          </section>
        )}

        {notes.length === 0 && (
          <div style={{ padding: '8px 8px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--text-primary)' }}>Записей пока нет</span>
            <span style={{ ...typed, fontSize: 14, color: 'var(--text-muted)' }}>Начните с записи дня или нажмите «+» внизу.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
