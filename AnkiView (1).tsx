import { useState, useEffect, useCallback } from 'react';
import { Flashcard, Note } from '../types';
import { rateFlashcard, createFlashcard } from '../store';
import {
  Brain, ChevronLeft, Plus, RotateCcw,
  Check, X,
  BookOpen, Star, Eye, EyeOff, Trash2,
  ChevronRight, Clock, Target,
} from 'lucide-react';

interface Props {
  flashcards: Flashcard[];
  notes: Note[];
  onSave: (card: Flashcard) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}

type Mode = 'home' | 'review' | 'create' | 'browse';
type Rating = 1 | 2 | 3 | 4;

const RATING_CONFIG: Record<Rating, { label: string; color: string; icon: string; desc: string }> = {
  1: { label: 'Снова',    color: '#e07070', icon: '✕', desc: 'Не помню совсем' },
  2: { label: 'Сложно',   color: '#d4914a', icon: '~', desc: 'С трудом' },
  3: { label: 'Хорошо',   color: '#6a9e8a', icon: '✓', desc: 'Вспомнил' },
  4: { label: 'Легко',    color: '#78c8a0', icon: '⚡', desc: 'Моментально' },
};

export default function AnkiView({ flashcards, notes, onSave, onDelete, onBack }: Props) {
  const [mode, setMode] = useState<Mode>('home');
  const [sessionCards, setSessionCards] = useState<Flashcard[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionStats, setSessionStats] = useState({ correct: 0, hard: 0, again: 0, total: 0 });
  const [sessionDone, setSessionDone] = useState(false);
  const [cardAnim, setCardAnim] = useState<'enter' | 'flip' | 'exit-left' | 'exit-right' | ''>('enter');

  // Create form
  const [front, setFront] = useState('');
  const [back, setBack]   = useState('');
  const [noteId, setNoteId] = useState('');
  const [tags, setTags]   = useState('');

  const vibe = (ms: number = 8) => { try { navigator.vibrate?.(ms); } catch {} };

  const dueCards    = flashcards.filter(c => new Date(c.nextReview) <= new Date());
  const futureCards = flashcards.filter(c => new Date(c.nextReview) > new Date());
  const current     = sessionCards[currentIdx] || null;

  // ── Start session ─────────────────────────────────────────────────────────
  const startSession = useCallback((cards: Flashcard[]) => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setSessionCards(shuffled);
    setCurrentIdx(0);
    setShowAnswer(false);
    setSessionStats({ correct: 0, hard: 0, again: 0, total: 0 });
    setSessionDone(false);
    setCardAnim('enter');
    setMode('review');
    vibe(12);
  }, []); // eslint-disable-line

  // ── Rate card ─────────────────────────────────────────────────────────────
  const handleRate = useCallback((rating: Rating) => {
    if (!current) return;
    vibe(rating >= 3 ? 8 : 15);

    const updated = rateFlashcard(current, rating);
    onSave(updated);

    setSessionStats(prev => ({
      ...prev,
      total: prev.total + 1,
      correct: rating >= 3 ? prev.correct + 1 : prev.correct,
      hard: rating === 2 ? prev.hard + 1 : prev.hard,
      again: rating === 1 ? prev.again + 1 : prev.again,
    }));

    // Animate card exit
    const dir = rating >= 3 ? 'exit-right' : 'exit-left';
    setCardAnim(dir);

    setTimeout(() => {
      if (currentIdx + 1 >= sessionCards.length) {
        setSessionDone(true);
        setMode('review');
      } else {
        setCurrentIdx(i => i + 1);
        setShowAnswer(false);
        setCardAnim('enter');
      }
    }, 280);
  }, [current, currentIdx, sessionCards.length, onSave]); // eslint-disable-line

  // ── Flip card ─────────────────────────────────────────────────────────────
  const handleFlip = () => {
    vibe(6);
    setCardAnim('flip');
    setShowAnswer(true);
  };

  // ── Create card ───────────────────────────────────────────────────────────
  const handleCreate = () => {
    if (!front.trim() || !back.trim()) return;
    const card = createFlashcard({
      front: front.trim(),
      back: back.trim(),
      noteId,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    });
    onSave(card);
    setFront(''); setBack(''); setNoteId(''); setTags('');
    vibe(20);
    setMode('home');
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const accuracy = sessionStats.total > 0
    ? Math.round((sessionStats.correct / sessionStats.total) * 100)
    : 0;

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'review' || sessionDone) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ' && !showAnswer) { e.preventDefault(); handleFlip(); }
      if (showAnswer) {
        if (e.key === '1') handleRate(1);
        if (e.key === '2') handleRate(2);
        if (e.key === '3') handleRate(3);
        if (e.key === '4') handleRate(4);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, showAnswer, sessionDone, handleFlip, handleRate]); // eslint-disable-line

  // ── Render helpers ────────────────────────────────────────────────────────
  const Progress = () => (
    <div style={{ padding: '0 20px 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6,
        fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
        <span>{currentIdx + 1} / {sessionCards.length}</span>
        <span>{Math.round(((currentIdx) / sessionCards.length) * 100)}%</span>
      </div>
      <div style={{ height: 4, borderRadius: 99, background: 'var(--bg-raised)' }}>
        <div style={{
          height: '100%', borderRadius: 99,
          background: 'linear-gradient(90deg, var(--accent), var(--accent-warm))',
          width: `${(currentIdx / sessionCards.length) * 100}%`,
          transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
    </div>
  );

  // ── HOME ──────────────────────────────────────────────────────────────────
  if (mode === 'home') return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => { vibe(6); onBack(); }} style={{
          width: 38, height: 38, borderRadius: 12,
          background: 'var(--bg-raised)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-secondary)', cursor: 'pointer',
        }}>
          <ChevronLeft size={18} />
        </button>
        <div>
          <div style={{ fontFamily: 'Lora, serif', fontSize: 18, fontWeight: 700,
            color: 'var(--text-primary)' }}>Повторение</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
            Алгоритм SM-2
          </div>
        </div>
        <button onClick={() => { vibe(6); setMode('create'); }} style={{
          marginLeft: 'auto', width: 38, height: 38, borderRadius: 12,
          background: 'var(--accent)', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', cursor: 'pointer',
        }}>
          <Plus size={18} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex',
        flexDirection: 'column', gap: 14 }}>

        {/* Due now hero */}
        <div style={{
          borderRadius: 20, overflow: 'hidden',
          background: dueCards.length > 0
            ? 'linear-gradient(135deg, var(--accent) 0%, var(--accent-warm) 100%)'
            : 'var(--bg-raised)',
          border: '1px solid var(--border-mid)',
          animation: 'fadeSlideUp 0.4s ease',
        }}>
          <div style={{ padding: '24px 24px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 32 }}>{dueCards.length > 0 ? '🧠' : '✅'}</div>
              <div>
                <div style={{ fontFamily: 'Lora, serif', fontSize: 22, fontWeight: 700,
                  color: dueCards.length > 0 ? '#fff' : 'var(--text-primary)' }}>
                  {dueCards.length > 0 ? `${dueCards.length} к повторению` : 'Всё повторено!'}
                </div>
                <div style={{ fontSize: 13, color: dueCards.length > 0 ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)',
                  fontFamily: 'Inter, sans-serif' }}>
                  {dueCards.length > 0 ? 'Готовы к сессии?' : 'Возвращайтесь позже'}
                </div>
              </div>
            </div>
            {dueCards.length > 0 && (
              <button onClick={() => startSession(dueCards)} style={{
                width: '100%', padding: '14px', borderRadius: 14,
                background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)',
                color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'Inter, sans-serif', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <Brain size={18} /> Начать повторение
              </button>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10,
          animation: 'fadeSlideUp 0.4s ease 0.05s both' }}>
          {[
            { label: 'Всего', value: flashcards.length, icon: <BookOpen size={16} />, color: 'var(--accent)' },
            { label: 'Скоро', value: futureCards.length, icon: <Clock size={16} />, color: '#a090c0' },
            { label: 'Сегодня', value: dueCards.length, icon: <Target size={16} />, color: '#6a9e8a' },
          ].map(s => (
            <div key={s.label} style={{ borderRadius: 16, padding: '14px 12px',
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
              <div style={{ color: s.color, marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* All cards browse */}
        {flashcards.length > 0 && (
          <button onClick={() => { vibe(6); setMode('browse'); }} style={{
            width: '100%', padding: '14px 20px', borderRadius: 16,
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontFamily: 'Inter, sans-serif', fontSize: 15,
            animation: 'fadeSlideUp 0.4s ease 0.1s both',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Star size={16} color="var(--accent)" />
              <span>Все карточки ({flashcards.length})</span>
            </div>
            <ChevronRight size={16} color="var(--text-muted)" />
          </button>
        )}

        {/* Study all */}
        {flashcards.length > 0 && dueCards.length === 0 && (
          <button onClick={() => startSession(flashcards)} style={{
            width: '100%', padding: '14px 20px', borderRadius: 16,
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontFamily: 'Inter, sans-serif', fontSize: 15,
            animation: 'fadeSlideUp 0.4s ease 0.15s both',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <RotateCcw size={16} color="var(--text-muted)" />
              <span>Повторить все карточки</span>
            </div>
            <ChevronRight size={16} color="var(--text-muted)" />
          </button>
        )}

        {/* Empty state */}
        {flashcards.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', fontFamily: 'Inter, sans-serif',
            animation: 'fadeSlideUp 0.4s ease 0.1s both' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🃏</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)',
              fontFamily: 'Lora, serif', marginBottom: 8 }}>Нет карточек</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 24 }}>
              Создайте первую карточку или сделайте карточку из любой записи — кнопка 🃏 в редакторе
            </div>
            <button onClick={() => { vibe(8); setMode('create'); }} style={{
              padding: '13px 28px', borderRadius: 14,
              background: 'linear-gradient(135deg, var(--accent), var(--accent-warm))',
              border: 'none', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}>
              Создать карточку
            </button>
          </div>
        )}

        {/* Upcoming cards */}
        {futureCards.length > 0 && (
          <div style={{ animation: 'fadeSlideUp 0.4s ease 0.2s both' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif',
              marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Предстоящие
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {futureCards.slice(0, 5).map(card => {
                const days = Math.ceil((new Date(card.nextReview).getTime() - Date.now()) / 86400000);
                return (
                  <div key={card.id} style={{ padding: '12px 16px', borderRadius: 14,
                    background: 'var(--bg-raised)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif',
                      flex: 1, marginRight: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {card.front}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap',
                      fontFamily: 'Inter, sans-serif' }}>
                      через {days}д
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ── REVIEW ────────────────────────────────────────────────────────────────
  if (mode === 'review') {
    if (sessionDone) return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => { vibe(6); setMode('home'); }} style={{
            width: 38, height: 38, borderRadius: 12,
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-secondary)', cursor: 'pointer',
          }}>
            <ChevronLeft size={18} />
          </button>
          <div style={{ fontFamily: 'Lora, serif', fontSize: 18, fontWeight: 700,
            color: 'var(--text-primary)' }}>Сессия завершена</div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '32px 24px', gap: 24 }}>

          {/* Trophy */}
          <div style={{ fontSize: 64, animation: 'scaleInBounce 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}>
            {accuracy >= 80 ? '🏆' : accuracy >= 60 ? '⭐' : '💪'}
          </div>

          <div style={{ textAlign: 'center', fontFamily: 'Lora, serif' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              {accuracy >= 80 ? 'Отлично!' : accuracy >= 60 ? 'Хорошо!' : 'Продолжай!'}
            </div>
            <div style={{ fontSize: 15, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
              Точность: {accuracy}%
            </div>
          </div>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, width: '100%' }}>
            {[
              { label: 'Верно', value: sessionStats.correct, color: '#6a9e8a', icon: '✓' },
              { label: 'Сложно', value: sessionStats.hard, color: '#d4914a', icon: '~' },
              { label: 'Снова', value: sessionStats.again, color: '#e07070', icon: '✕' },
            ].map(s => (
              <div key={s.label} style={{ borderRadius: 16, padding: '16px 12px',
                background: 'var(--bg-raised)', border: '1px solid var(--border)',
                textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
                <div style={{ fontSize: 20, color: s.color, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Accuracy bar */}
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8,
              fontSize: 13, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
              <span>Точность</span><span style={{ color: 'var(--accent)', fontWeight: 600 }}>{accuracy}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: 'var(--bg-raised)',
              border: '1px solid var(--border)' }}>
              <div style={{
                height: '100%', borderRadius: 99,
                background: accuracy >= 80
                  ? 'linear-gradient(90deg, #6a9e8a, #78c8a0)'
                  : accuracy >= 60
                  ? 'linear-gradient(90deg, var(--accent), var(--accent-warm))'
                  : 'linear-gradient(90deg, #d4914a, #e07070)',
                width: `${accuracy}%`,
                transition: 'width 1s ease',
              }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, width: '100%' }}>
            <button onClick={() => { vibe(8); setMode('home'); }} style={{
              flex: 1, padding: '14px', borderRadius: 14,
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}>
              На главную
            </button>
            {dueCards.length > 0 && (
              <button onClick={() => startSession(dueCards)} style={{
                flex: 1, padding: '14px', borderRadius: 14,
                background: 'linear-gradient(135deg, var(--accent), var(--accent-warm))',
                border: 'none', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}>
                Ещё раз
              </button>
            )}
          </div>
        </div>
      </div>
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px 8px', display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => { vibe(6); setMode('home'); setSessionDone(false); }} style={{
            width: 38, height: 38, borderRadius: 12,
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-secondary)', cursor: 'pointer',
          }}>
            <ChevronLeft size={18} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Lora, serif', fontSize: 16, fontWeight: 700,
              color: 'var(--text-primary)' }}>Повторение</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
              borderRadius: 99, background: 'var(--bg-raised)', border: '1px solid var(--border)',
              fontSize: 12, color: '#6a9e8a', fontFamily: 'Inter, sans-serif' }}>
              <Check size={11} /> {sessionStats.correct}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
              borderRadius: 99, background: 'var(--bg-raised)', border: '1px solid var(--border)',
              fontSize: 12, color: '#e07070', fontFamily: 'Inter, sans-serif' }}>
              <X size={11} /> {sessionStats.again}
            </div>
          </div>
        </div>

        {/* Progress */}
        <Progress />

        {/* Card */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
          padding: '8px 20px 20px', overflow: 'hidden' }}>

          {current && (
            <div
              onClick={!showAnswer ? handleFlip : undefined}
              style={{
                flex: 1, borderRadius: 24,
                background: 'var(--bg-raised)', border: '1px solid var(--border-mid)',
                display: 'flex', flexDirection: 'column',
                padding: '28px 24px',
                cursor: !showAnswer ? 'pointer' : 'default',
                position: 'relative',
                overflow: 'hidden',
                transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
                transform: cardAnim === 'exit-left'
                  ? 'translateX(-120%) rotate(-8deg)'
                  : cardAnim === 'exit-right'
                  ? 'translateX(120%) rotate(8deg)'
                  : cardAnim === 'enter'
                  ? 'translateX(0) scale(1)'
                  : 'none',
                animation: cardAnim === 'enter' ? 'fadeSlideUp 0.35s ease' : undefined,
              }}
            >
              {/* Accent top */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                background: 'linear-gradient(90deg, var(--accent), var(--accent-warm))' }} />

              {/* Front */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif',
                  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16, fontWeight: 600 }}>
                  {showAnswer ? 'ВОПРОС' : 'ВОПРОС — нажми чтобы увидеть ответ'}
                </div>
                <div style={{ fontSize: 20, fontFamily: 'Lora, serif', color: 'var(--text-primary)',
                  lineHeight: 1.5, fontWeight: 600, flex: 1 }}>
                  {current.front}
                </div>

                {current.tags?.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 16 }}>
                    {current.tags.map(t => (
                      <span key={t} style={{ padding: '3px 8px', borderRadius: 99,
                        background: 'var(--bg-active)', border: '1px solid var(--border)',
                        fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Answer */}
              {showAnswer && (
                <div style={{
                  marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)',
                  animation: 'fadeSlideUp 0.3s ease',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'Inter, sans-serif',
                    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, fontWeight: 600 }}>
                    ОТВЕТ
                  </div>
                  <div style={{ fontSize: 17, fontFamily: 'Lora, serif', color: 'var(--text-primary)',
                    lineHeight: 1.6 }}>
                    {current.back}
                  </div>
                </div>
              )}

              {!showAnswer && (
                <div style={{ marginTop: 'auto', textAlign: 'center', paddingTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    color: 'var(--text-muted)', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
                    <Eye size={14} /> Нажми чтобы открыть ответ
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rating buttons */}
          {showAnswer && current && (
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8,
              animation: 'fadeSlideUp 0.3s ease' }}>
              {([1, 2, 3, 4] as Rating[]).map(r => {
                const cfg = RATING_CONFIG[r];
                return (
                  <button key={r} onClick={() => handleRate(r)} style={{
                    padding: '12px 8px', borderRadius: 14,
                    background: 'var(--bg-raised)', border: `1px solid ${cfg.color}33`,
                    color: cfg.color, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    transition: 'all 0.15s ease',
                  }}
                  onPointerDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.95)'; }}
                  onPointerUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                  >
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{cfg.icon}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {!showAnswer && (
            <button onClick={handleFlip} style={{
              marginTop: 16, width: '100%', padding: '16px',
              borderRadius: 16, border: 'none',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-warm))',
              color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <EyeOff size={18} /> Показать ответ
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── BROWSE ────────────────────────────────────────────────────────────────
  if (mode === 'browse') return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => { vibe(6); setMode('home'); }} style={{
          width: 38, height: 38, borderRadius: 12,
          background: 'var(--bg-raised)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-secondary)', cursor: 'pointer',
        }}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ fontFamily: 'Lora, serif', fontSize: 18, fontWeight: 700,
          color: 'var(--text-primary)' }}>Все карточки</div>
        <button onClick={() => { vibe(6); setMode('create'); }} style={{
          marginLeft: 'auto', width: 38, height: 38, borderRadius: 12,
          background: 'var(--accent)', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', cursor: 'pointer',
        }}>
          <Plus size={18} />
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {flashcards.map((card, i) => {
          const isDue = new Date(card.nextReview) <= new Date();
          return (
            <div key={card.id} style={{
              padding: '14px 16px', borderRadius: 16,
              background: 'var(--bg-raised)', border: `1px solid ${isDue ? 'var(--accent)' : 'var(--border)'}`,
              animation: `fadeSlideUp 0.3s ease ${i * 0.04}s both`,
              display: 'flex', alignItems: 'flex-start', gap: 12,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif',
                  fontWeight: 600, marginBottom: 4 }}>{card.front}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif',
                  lineHeight: 1.5 }}>{card.back}</div>
                {isDue && (
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--accent)',
                    fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
                    🔔 Готова к повторению
                  </div>
                )}
              </div>
              <button onClick={() => { vibe(10); onDelete(card.id); }} style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'var(--bg-active)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0,
              }}>
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── CREATE ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => { vibe(6); setMode('home'); }} style={{
          width: 38, height: 38, borderRadius: 12,
          background: 'var(--bg-raised)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-secondary)', cursor: 'pointer',
        }}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ fontFamily: 'Lora, serif', fontSize: 18, fontWeight: 700,
          color: 'var(--text-primary)' }}>Новая карточка</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ borderRadius: 16, background: 'var(--bg-raised)', border: '1px solid var(--border)',
          overflow: 'hidden', animation: 'fadeSlideUp 0.35s ease' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)',
            fontSize: 11, color: 'var(--accent)', fontFamily: 'Inter, sans-serif',
            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Вопрос / Понятие
          </div>
          <textarea
            value={front}
            onChange={e => setFront(e.target.value)}
            placeholder="Что нужно запомнить?"
            style={{ width: '100%', minHeight: 100, padding: '14px 16px',
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: 16, fontFamily: 'Lora, serif',
              lineHeight: 1.6, resize: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ borderRadius: 16, background: 'var(--bg-raised)', border: '1px solid var(--border)',
          overflow: 'hidden', animation: 'fadeSlideUp 0.35s ease 0.05s both' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)',
            fontSize: 11, color: '#6a9e8a', fontFamily: 'Inter, sans-serif',
            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Ответ / Определение
          </div>
          <textarea
            value={back}
            onChange={e => setBack(e.target.value)}
            placeholder="Ответ или определение..."
            style={{ width: '100%', minHeight: 100, padding: '14px 16px',
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: 15, fontFamily: 'Inter, sans-serif',
              lineHeight: 1.6, resize: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ borderRadius: 16, background: 'var(--bg-raised)', border: '1px solid var(--border)',
          overflow: 'hidden', animation: 'fadeSlideUp 0.35s ease 0.1s both' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)',
            fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif',
            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Связать с записью (необязательно)
          </div>
          <select
            value={noteId}
            onChange={e => setNoteId(e.target.value)}
            style={{ width: '100%', padding: '14px 16px',
              background: 'transparent', border: 'none', outline: 'none',
              color: noteId ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 14, fontFamily: 'Inter, sans-serif', cursor: 'pointer',
              appearance: 'none', boxSizing: 'border-box' }}>
            <option value="">Выбрать запись...</option>
            {notes.map(n => (
              <option key={n.id} value={n.id}>{n.title || 'Без названия'}</option>
            ))}
          </select>
        </div>

        <div style={{ borderRadius: 16, background: 'var(--bg-raised)', border: '1px solid var(--border)',
          overflow: 'hidden', animation: 'fadeSlideUp 0.35s ease 0.15s both' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)',
            fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif',
            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Теги (через запятую)
          </div>
          <input
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="психология, память, концепция"
            style={{ width: '100%', padding: '14px 16px',
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: 14, fontFamily: 'Inter, sans-serif',
              boxSizing: 'border-box' }}
          />
        </div>

        <button
          onClick={handleCreate}
          disabled={!front.trim() || !back.trim()}
          style={{
            width: '100%', padding: '16px', borderRadius: 16, border: 'none',
            background: front.trim() && back.trim()
              ? 'linear-gradient(135deg, var(--accent), var(--accent-warm))'
              : 'var(--bg-raised)',
            color: front.trim() && back.trim() ? '#fff' : 'var(--text-muted)',
            fontSize: 16, fontWeight: 700, cursor: front.trim() && back.trim() ? 'pointer' : 'not-allowed',
            fontFamily: 'Inter, sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            animation: 'fadeSlideUp 0.35s ease 0.2s both',
            transition: 'all 0.2s ease',
          }}>
          <Plus size={18} /> Создать карточку
        </button>
      </div>
    </div>
  );
}
