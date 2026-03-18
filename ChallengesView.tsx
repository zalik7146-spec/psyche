import { useState } from 'react';
import { X, Trophy, Flame, BookOpen, PenLine, Star, Target, Zap, Check } from 'lucide-react';
import { Note, Book } from '../types';

const vibe = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };

interface Props {
  notes: Note[];
  books: Book[];
  onClose: () => void;
}

interface Challenge {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  target: number;
  current: number;
  color: string;
  bg: string;
  badge: string;
  completed: boolean;
}

export default function ChallengesView({ notes, books, onClose }: Props) {
  const [tab, setTab] = useState<'active' | 'completed'>('active');

  // Streak
  const dates = [...new Set(notes.map(n => n.createdAt.slice(0, 10)))].sort();
  let streak = 0, cur = 0;
  for (let i = 0; i < dates.length; i++) {
    if (i === 0) { cur = 1; }
    else {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diff = (curr.getTime() - prev.getTime()) / 86400000;
      cur = diff === 1 ? cur + 1 : 1;
    }
    if (cur > streak) streak = cur;
  }

  const finishedBooks = books.filter(b => b.status === 'finished').length;
  const insights = notes.filter(n => n.type === 'insight').length;
  const quotes = notes.filter(n => n.type === 'quote').length;
  const year = new Date().getFullYear();
  const yearNotes = notes.filter(n => n.createdAt.startsWith(String(year)));
  const totalWords = notes.reduce((s, n) => s + (n.wordCount || 0), 0);
  const favorites = notes.filter(n => n.isFavorite).length;
  const pinned = notes.filter(n => n.isPinned).length;

  const challenges: Challenge[] = [
    {
      id: 'streak7',
      icon: <Flame size={22} />,
      title: '7 дней подряд',
      description: 'Делай записи 7 дней без пропусков',
      target: 7, current: Math.min(streak, 7),
      color: '#e87a7a', bg: 'rgba(232,122,122,0.12)',
      badge: '🔥 Стрик-мастер',
      completed: streak >= 7,
    },
    {
      id: 'streak30',
      icon: <Flame size={22} />,
      title: '30 дней подряд',
      description: 'Месяц ежедневных записей — настоящий подвиг',
      target: 30, current: Math.min(streak, 30),
      color: '#e87a7a', bg: 'rgba(232,122,122,0.12)',
      badge: '🔥 Легенда стрика',
      completed: streak >= 30,
    },
    {
      id: 'books5',
      icon: <BookOpen size={22} />,
      title: '5 книг прочитано',
      description: 'Прочитай и отметь 5 книг как прочитанные',
      target: 5, current: Math.min(finishedBooks, 5),
      color: '#7ac997', bg: 'rgba(122,201,151,0.12)',
      badge: '📚 Книжный червь',
      completed: finishedBooks >= 5,
    },
    {
      id: 'books10',
      icon: <BookOpen size={22} />,
      title: '10 книг прочитано',
      description: 'Стань настоящим читателем — 10 книг!',
      target: 10, current: Math.min(finishedBooks, 10),
      color: '#7ac997', bg: 'rgba(122,201,151,0.12)',
      badge: '📚 Библиофил',
      completed: finishedBooks >= 10,
    },
    {
      id: 'notes50',
      icon: <PenLine size={22} />,
      title: '50 записей',
      description: 'Сделай 50 заметок — идеи, инсайты, цитаты',
      target: 50, current: Math.min(notes.length, 50),
      color: '#e8c97a', bg: 'rgba(232,201,122,0.12)',
      badge: '✍️ Летописец',
      completed: notes.length >= 50,
    },
    {
      id: 'notes100',
      icon: <PenLine size={22} />,
      title: '100 записей',
      description: 'Достигни отметки в 100 записей!',
      target: 100, current: Math.min(notes.length, 100),
      color: '#e8c97a', bg: 'rgba(232,201,122,0.12)',
      badge: '✍️ Мастер пера',
      completed: notes.length >= 100,
    },
    {
      id: 'insights20',
      icon: <Zap size={22} />,
      title: '20 инсайтов',
      description: 'Зафиксируй 20 озарений и открытий',
      target: 20, current: Math.min(insights, 20),
      color: '#c97ae8', bg: 'rgba(201,122,232,0.12)',
      badge: '💡 Мыслитель',
      completed: insights >= 20,
    },
    {
      id: 'quotes20',
      icon: <Star size={22} />,
      title: '20 цитат',
      description: 'Сохрани 20 вдохновляющих цитат',
      target: 20, current: Math.min(quotes, 20),
      color: '#7ab8e8', bg: 'rgba(122,184,232,0.12)',
      badge: '💬 Цитатник',
      completed: quotes >= 20,
    },
    {
      id: 'words5000',
      icon: <Target size={22} />,
      title: '5000 слов',
      description: 'Напиши в сумме 5000 слов в заметках',
      target: 5000, current: Math.min(totalWords, 5000),
      color: '#e87ab8', bg: 'rgba(232,122,184,0.12)',
      badge: '📝 Писатель',
      completed: totalWords >= 5000,
    },
    {
      id: 'year50',
      icon: <Trophy size={22} />,
      title: `50 записей в ${year}`,
      description: `Сделай 50 записей в ${year} году`,
      target: 50, current: Math.min(yearNotes.length, 50),
      color: '#e8c97a', bg: 'rgba(232,201,122,0.12)',
      badge: `🏆 Рекордсмен ${year}`,
      completed: yearNotes.length >= 50,
    },
    {
      id: 'favorites10',
      icon: <Star size={22} />,
      title: '10 избранных',
      description: 'Добавь 10 записей в избранное',
      target: 10, current: Math.min(favorites, 10),
      color: '#e8c97a', bg: 'rgba(232,201,122,0.12)',
      badge: '⭐ Коллекционер',
      completed: favorites >= 10,
    },
    {
      id: 'pinned5',
      icon: <Star size={22} />,
      title: '5 закреплённых',
      description: 'Закрепи 5 важных записей',
      target: 5, current: Math.min(pinned, 5),
      color: '#7ac997', bg: 'rgba(122,201,151,0.12)',
      badge: '📌 Организатор',
      completed: pinned >= 5,
    },
  ];

  const active = challenges.filter(c => !c.completed);
  const completed = challenges.filter(c => c.completed);
  const shown = tab === 'active' ? active : completed;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column',
      maxWidth: 430, margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{
        padding: 'calc(env(safe-area-inset-top,0px) + 16px) 16px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-base)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => { vibe(8); onClose(); }} style={{
            width: 36, height: 36, borderRadius: 12,
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-secondary)', cursor: 'pointer',
          }}>
            <X size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: 'Lora, serif' }}>
              🏆 Челленджи
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              {completed.length}/{challenges.length} выполнено
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {(['active', 'completed'] as const).map(t => (
            <button key={t} onClick={() => { vibe(6); setTab(t); }} style={{
              flex: 1, padding: '8px', borderRadius: 10,
              background: tab === t ? 'var(--accent)' : 'var(--bg-raised)',
              border: `1px solid ${tab === t ? 'var(--accent)' : 'var(--border)'}`,
              color: tab === t ? '#0e0c09' : 'var(--text-muted)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              {t === 'active' ? `Активные (${active.length})` : `Выполнено (${completed.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Progress overview */}
      <div style={{
        padding: '12px 16px',
        background: 'var(--bg-raised)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Общий прогресс</span>
          <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
            {Math.round(completed.length / challenges.length * 100)}%
          </span>
        </div>
        <div style={{ height: 6, background: 'var(--border)', borderRadius: 3 }}>
          <div style={{
            height: '100%', borderRadius: 3,
            width: `${completed.length / challenges.length * 100}%`,
            background: 'linear-gradient(90deg, var(--accent), var(--accent-dark))',
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
        {shown.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>
              {tab === 'completed' ? '🎯' : '🏆'}
            </div>
            <p style={{ fontSize: 16, color: 'var(--text-secondary)', fontFamily: 'Lora, serif' }}>
              {tab === 'completed' ? 'Выполни первый челлендж!' : 'Все челленджи выполнены!'}
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {shown.map((c, i) => (
            <div key={c.id} style={{
              background: c.completed ? 'var(--bg-raised)' : 'var(--bg-card)',
              border: `1px solid ${c.completed ? c.color + '40' : 'var(--border)'}`,
              borderRadius: 16, padding: '16px',
              animation: `fadeSlideUp 0.4s ease-out ${i * 0.06}s both`,
              position: 'relative', overflow: 'hidden',
            }}>
              {c.completed && (
                <div style={{
                  position: 'absolute', top: 12, right: 12,
                  width: 28, height: 28, borderRadius: '50%',
                  background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Check size={14} color="#0e0c09" strokeWidth={3} />
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 14,
                  background: c.bg, border: `1px solid ${c.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: c.color, flexShrink: 0,
                }}>
                  {c.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px', fontFamily: 'Inter, sans-serif' }}>
                    {c.title}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                    {c.description}
                  </p>
                </div>
              </div>

              {/* Progress */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {c.current} / {c.target}
                  </span>
                  <span style={{ fontSize: 11, color: c.color, fontWeight: 600 }}>
                    {Math.round(c.current / c.target * 100)}%
                  </span>
                </div>
                <div style={{ height: 5, background: 'var(--border)', borderRadius: 3 }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    width: `${Math.min(c.current / c.target * 100, 100)}%`,
                    background: c.color,
                    transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)',
                  }} />
                </div>
              </div>

              {/* Badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 8,
                background: c.completed ? `${c.color}20` : 'var(--bg-raised)',
                border: `1px solid ${c.completed ? c.color + '40' : 'var(--border)'}`,
              }}>
                <span style={{ fontSize: 11, color: c.completed ? c.color : 'var(--text-muted)', fontWeight: 600 }}>
                  {c.completed ? c.badge : `🎯 ${c.badge}`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
