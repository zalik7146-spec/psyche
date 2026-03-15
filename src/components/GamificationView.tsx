import { useMemo } from 'react';
import { Note, Book, DailyNote } from '../types';

interface Props {
  notes: Note[];
  books: Book[];
  dailyNotes: DailyNote[];
}

interface Badge {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  earned: boolean;
  progress?: number;
  total?: number;
  color: string;
}

interface Level {
  level: number;
  title: string;
  emoji: string;
  minXP: number;
  maxXP: number;
  color: string;
}

const LEVELS: Level[] = [
  { level: 1,  title: 'Новичок',       emoji: '🌱', minXP: 0,    maxXP: 50,   color: '#72b472' },
  { level: 2,  title: 'Читатель',      emoji: '📖', minXP: 50,   maxXP: 150,  color: '#7ab4a4' },
  { level: 3,  title: 'Исследователь', emoji: '🔍', minXP: 150,  maxXP: 300,  color: '#7a8ab4' },
  { level: 4,  title: 'Аналитик',      emoji: '🧪', minXP: 300,  maxXP: 500,  color: '#a47ab4' },
  { level: 5,  title: 'Мыслитель',     emoji: '💭', minXP: 500,  maxXP: 800,  color: '#b47a7a' },
  { level: 6,  title: 'Мудрец',        emoji: '🦉', minXP: 800,  maxXP: 1200, color: '#d4a84e' },
  { level: 7,  title: 'Философ',       emoji: '⚗️', minXP: 1200, maxXP: 1800, color: '#d4914a' },
  { level: 8,  title: 'Психолог',      emoji: '🧠', minXP: 1800, maxXP: 2500, color: '#c8806a' },
  { level: 9,  title: 'Наставник',     emoji: '🎓', minXP: 2500, maxXP: 3500, color: '#b46a7a' },
  { level: 10, title: 'Архивариус',    emoji: '📚', minXP: 3500, maxXP: 9999, color: '#d4914a' },
];

function getLevel(xp: number): Level {
  let result = LEVELS[0];
  for (const l of LEVELS) { if (xp >= l.minXP) result = l; }
  return result;
}

function calcStreak(notes: Note[], dailyNotes: DailyNote[]): number {
  const days = new Set<string>();
  [...notes, ...dailyNotes].forEach(n => {
    days.add(n.createdAt.slice(0, 10));
  });
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (days.has(key)) streak++;
    else if (i > 0) break;
  }
  return streak;
}

export default function GamificationView({ notes, books, dailyNotes }: Props) {
  const stats = useMemo(() => {
    const totalNotes = notes.length;
    const totalBooks = books.length;
    const finishedBooks = books.filter(b => b.status === 'finished').length;
    const totalWords = notes.reduce((acc, n) => acc + (n.wordCount || 0), 0);
    const totalQuotes = notes.filter(n => n.type === 'quote').length;
    const totalInsights = notes.filter(n => n.type === 'insight').length;
    const totalFavorites = notes.filter(n => n.isFavorite).length;
    const streak = calcStreak(notes, dailyNotes);
    const totalDailyNotes = dailyNotes.length;
    const hasLinkedNotes = notes.some(n => (n.linkedNoteIds?.length || 0) > 0);
    const uniqueTags = new Set(notes.flatMap(n => n.tags || [])).size;

    // XP calculation
    const xp =
      totalNotes * 10 +
      totalBooks * 20 +
      finishedBooks * 50 +
      totalWords * 0.05 +
      totalQuotes * 15 +
      totalInsights * 20 +
      streak * 25 +
      totalDailyNotes * 8 +
      uniqueTags * 5;

    const currentLevel = getLevel(Math.floor(xp));
    const nextLevel = LEVELS[currentLevel.level] || currentLevel;
    const xpInLevel = Math.floor(xp) - currentLevel.minXP;
    const xpToNext = nextLevel.maxXP - currentLevel.minXP;
    const progress = Math.min(xpInLevel / xpToNext, 1);

    return {
      totalNotes, totalBooks, finishedBooks, totalWords, totalQuotes,
      totalInsights, totalFavorites, streak, totalDailyNotes,
      hasLinkedNotes, uniqueTags,
      xp: Math.floor(xp), currentLevel, nextLevel, progress,
    };
  }, [notes, books, dailyNotes]);

  const badges: Badge[] = useMemo(() => [
    {
      id: 'first_note',
      emoji: '✍️', title: 'Первая запись', color: '#72b472',
      desc: 'Создай свою первую заметку',
      earned: stats.totalNotes >= 1,
    },
    {
      id: 'ten_notes',
      emoji: '📝', title: 'Записной', color: '#7ab4a4',
      desc: '10 записей в дневнике',
      earned: stats.totalNotes >= 10,
      progress: Math.min(stats.totalNotes, 10), total: 10,
    },
    {
      id: 'fifty_notes',
      emoji: '🗂️', title: 'Архивариус', color: '#d4a84e',
      desc: '50 записей — серьёзный архив',
      earned: stats.totalNotes >= 50,
      progress: Math.min(stats.totalNotes, 50), total: 50,
    },
    {
      id: 'first_book',
      emoji: '📚', title: 'Библиофил', color: '#d4914a',
      desc: 'Добавь первую книгу в библиотеку',
      earned: stats.totalBooks >= 1,
    },
    {
      id: 'finished_book',
      emoji: '🏆', title: 'Дочитал!', color: '#d4a84e',
      desc: 'Отметь книгу как прочитанную',
      earned: stats.finishedBooks >= 1,
    },
    {
      id: 'five_books',
      emoji: '📖', title: 'Читатель', color: '#c8a882',
      desc: '5 прочитанных книг',
      earned: stats.finishedBooks >= 5,
      progress: Math.min(stats.finishedBooks, 5), total: 5,
    },
    {
      id: 'streak_3',
      emoji: '🔥', title: 'Три дня подряд', color: '#c86060',
      desc: '3 дня без перерыва',
      earned: stats.streak >= 3,
      progress: Math.min(stats.streak, 3), total: 3,
    },
    {
      id: 'streak_7',
      emoji: '⚡', title: 'Неделя', color: '#8a7ab4',
      desc: '7 дней без перерыва',
      earned: stats.streak >= 7,
      progress: Math.min(stats.streak, 7), total: 7,
    },
    {
      id: 'streak_30',
      emoji: '🌟', title: 'Месяц', color: '#d4a84e',
      desc: '30 дней без перерыва',
      earned: stats.streak >= 30,
      progress: Math.min(stats.streak, 30), total: 30,
    },
    {
      id: 'quotes',
      emoji: '💬', title: 'Коллекционер цитат', color: '#7a8ab4',
      desc: '10 цитат из книг',
      earned: stats.totalQuotes >= 10,
      progress: Math.min(stats.totalQuotes, 10), total: 10,
    },
    {
      id: 'insights',
      emoji: '💡', title: 'Мыслитель', color: '#a47ab4',
      desc: '5 инсайтов — ты глубоко мыслишь',
      earned: stats.totalInsights >= 5,
      progress: Math.min(stats.totalInsights, 5), total: 5,
    },
    {
      id: 'words_1000',
      emoji: '✒️', title: 'Тысяча слов', color: '#b47a7a',
      desc: '1000 слов написано',
      earned: stats.totalWords >= 1000,
      progress: Math.min(stats.totalWords, 1000), total: 1000,
    },
    {
      id: 'journal',
      emoji: '📔', title: 'Журналист', color: '#7ab4a4',
      desc: 'Сделай 7 записей в журнале дня',
      earned: stats.totalDailyNotes >= 7,
      progress: Math.min(stats.totalDailyNotes, 7), total: 7,
    },
    {
      id: 'tags',
      emoji: '🏷️', title: 'Организатор', color: '#72b472',
      desc: 'Используй 5 разных тегов',
      earned: stats.uniqueTags >= 5,
      progress: Math.min(stats.uniqueTags, 5), total: 5,
    },
    {
      id: 'linked',
      emoji: '🔗', title: 'Связист', color: '#8a7ab4',
      desc: 'Свяжи две записи между собой',
      earned: stats.hasLinkedNotes,
    },
    {
      id: 'favorites',
      emoji: '⭐', title: 'Любимчики', color: '#d4a84e',
      desc: 'Добавь 5 записей в избранное',
      earned: stats.totalFavorites >= 5,
      progress: Math.min(stats.totalFavorites, 5), total: 5,
    },
  ], [stats]);

  const earned = badges.filter(b => b.earned).length;
  const lv = stats.currentLevel;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', background: 'var(--bg-base)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 12px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <h2 style={{
          fontFamily: 'Lora, serif', fontSize: 20, fontWeight: 700,
          color: 'var(--text-primary)', margin: 0,
        }}>Достижения</h2>
        <p style={{
          fontFamily: 'Inter, sans-serif', fontSize: 12,
          color: 'var(--text-muted)', margin: '4px 0 0',
        }}>
          {earned} из {badges.length} бейджей получено
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

        {/* Level card */}
        <div style={{
          background: `linear-gradient(135deg, ${lv.color}18, ${lv.color}08)`,
          border: `1.5px solid ${lv.color}40`,
          borderRadius: 20,
          padding: '20px',
          marginBottom: 20,
          animation: 'fadeSlideUp 0.4s ease both',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20,
              background: `${lv.color}22`,
              border: `2px solid ${lv.color}60`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32,
            }}>{lv.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: 'Inter, sans-serif', fontSize: 11,
                color: 'var(--text-muted)', marginBottom: 2,
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>Уровень {lv.level}</div>
              <div style={{
                fontFamily: 'Lora, serif', fontSize: 22, fontWeight: 700,
                color: 'var(--text-primary)', lineHeight: 1.2,
              }}>{lv.title}</div>
              <div style={{
                fontFamily: 'Inter, sans-serif', fontSize: 13,
                color: lv.color, marginTop: 2, fontWeight: 600,
              }}>{stats.xp} XP</div>
            </div>
          </div>

          {/* XP Progress */}
          <div style={{ marginTop: 16 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontFamily: 'Inter, sans-serif', fontSize: 11,
              color: 'var(--text-muted)', marginBottom: 6,
            }}>
              <span>{stats.xp - lv.minXP} / {stats.nextLevel.maxXP - lv.minXP} XP до «{stats.nextLevel.title}»</span>
              <span>{Math.round(stats.progress * 100)}%</span>
            </div>
            <div style={{
              height: 8, background: 'var(--bg-raised)',
              borderRadius: 99, overflow: 'hidden',
              border: '1px solid var(--border)',
            }}>
              <div style={{
                height: '100%', width: `${stats.progress * 100}%`,
                background: `linear-gradient(90deg, ${lv.color}, ${lv.color}aa)`,
                borderRadius: 99,
                transition: 'width 1s cubic-bezier(0.22,1,0.36,1)',
              }} />
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
          marginBottom: 20,
        }}>
          {[
            { val: stats.streak,      label: 'Стрик',    emoji: '🔥' },
            { val: stats.totalNotes,  label: 'Записей',  emoji: '📝' },
            { val: stats.totalBooks,  label: 'Книг',     emoji: '📚' },
          ].map((s, i) => (
            <div key={i} style={{
              background: 'var(--bg-card)',
              border: 'var(--card-border)',
              borderRadius: 16, padding: '14px 10px',
              textAlign: 'center',
              animation: `fadeSlideUp 0.4s ease ${i * 0.08}s both`,
            }}>
              <div style={{ fontSize: 24 }}>{s.emoji}</div>
              <div style={{
                fontFamily: 'Lora, serif', fontSize: 22, fontWeight: 700,
                color: 'var(--text-primary)', lineHeight: 1.2,
              }}>{s.val}</div>
              <div style={{
                fontFamily: 'Inter, sans-serif', fontSize: 11,
                color: 'var(--text-muted)', marginTop: 2,
              }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Badges */}
        <div style={{
          fontFamily: 'Inter, sans-serif', fontSize: 12,
          color: 'var(--text-muted)', marginBottom: 12,
          textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
        }}>Бейджи</div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10,
        }}>
          {badges.map((badge, i) => (
            <BadgeCard key={badge.id} badge={badge} index={i} />
          ))}
        </div>

        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

function BadgeCard({ badge, index }: { badge: Badge; index: number }) {
  return (
    <div style={{
      background: badge.earned ? `${badge.color}12` : 'var(--bg-card)',
      border: badge.earned
        ? `1.5px solid ${badge.color}40`
        : 'var(--card-border)',
      borderRadius: 16,
      padding: '14px 12px',
      opacity: badge.earned ? 1 : 0.5,
      transition: 'opacity 0.2s',
      animation: `fadeSlideUp 0.35s ease ${index * 0.04}s both`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {badge.earned && (
        <div style={{
          position: 'absolute', top: 6, right: 8,
          fontSize: 10, color: badge.color,
          fontFamily: 'Inter, sans-serif', fontWeight: 700,
        }}>✓</div>
      )}
      <div style={{ fontSize: 28, marginBottom: 8 }}>{badge.emoji}</div>
      <div style={{
        fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 700,
        color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.3,
      }}>{badge.title}</div>
      <div style={{
        fontFamily: 'Inter, sans-serif', fontSize: 11,
        color: 'var(--text-muted)', lineHeight: 1.4,
      }}>{badge.desc}</div>

      {/* Progress bar for unearned badges */}
      {!badge.earned && badge.progress !== undefined && badge.total && (
        <div style={{ marginTop: 8 }}>
          <div style={{
            height: 4, background: 'var(--bg-raised)',
            borderRadius: 99, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${(badge.progress / badge.total) * 100}%`,
              background: badge.color,
              borderRadius: 99,
              transition: 'width 0.8s ease',
            }} />
          </div>
          <div style={{
            fontFamily: 'Inter, sans-serif', fontSize: 10,
            color: 'var(--text-muted)', marginTop: 3,
          }}>{badge.progress} / {badge.total}</div>
        </div>
      )}
    </div>
  );
}
