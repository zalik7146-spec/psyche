import { useState, useEffect } from 'react';
import { Flashcard, Note } from '../types';
import { createFlashcard, rateFlashcard } from '../store';
import {
  Plus, Brain, RotateCcw, Check, ChevronDown,
  Flame, Star, BookOpen, Trash2, ChevronLeft, ChevronRight,
} from 'lucide-react';

interface Props {
  flashcards: Flashcard[];
  notes: Note[];
  onSave: (card: Flashcard) => void;
  onDelete: (id: string) => void;
  onRate: (card: Flashcard) => void;
  onOpenAnki?: () => void;
}

type Mode = 'list' | 'create' | 'review';

export default function FlashcardsView({ flashcards, notes, onSave, onDelete, onRate }: Props) {
  const [mode, setMode] = useState<Mode>('list');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [noteId, setNoteId] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [reviewIdx, setReviewIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionRated, setSessionRated] = useState<string[]>([]);
  const [enterAnim, setEnterAnim] = useState(false);

  const dueCards = flashcards.filter(c => new Date(c.nextReview) <= new Date());
  const reviewCards = dueCards.filter(c => !sessionRated.includes(c.id));
  const current = reviewCards[reviewIdx] || null;

  useEffect(() => {
    if (mode === 'review') {
      setReviewIdx(0);
      setShowAnswer(false);
      setSessionRated([]);
    }
  }, [mode]);

  useEffect(() => {
    setEnterAnim(true);
    const t = setTimeout(() => setEnterAnim(false), 400);
    return () => clearTimeout(t);
  }, [reviewIdx]);

  const vibe = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };

  const handleCreate = () => {
    if (!front.trim() || !back.trim()) return;
    const card = createFlashcard({
      front: front.trim(),
      back: back.trim(),
      noteId,
      tags: tagInput ? tagInput.split(',').map(t => t.trim()).filter(Boolean) : [],
    });
    onSave(card);
    setFront(''); setBack(''); setNoteId(''); setTagInput('');
    setMode('list');
    vibe(12);
  };

  const handleRate = (rating: 1 | 2 | 3 | 4) => {
    if (!current) return;
    vibe(8);
    const updated = rateFlashcard(current, rating);
    onRate(updated);
    setSessionRated(prev => [...prev, current.id]);
    setShowAnswer(false);
    if (reviewIdx >= reviewCards.length - 2) {
      setReviewIdx(0);
    }
  };

  const ratingLabels: { rating: 1|2|3|4; label: string; color: string; emoji: string }[] = [
    { rating: 1, label: 'Снова', color: '#c07070', emoji: '✕' },
    { rating: 2, label: 'Трудно', color: '#c09040', emoji: '◑' },
    { rating: 3, label: 'Хорошо', color: '#6a9a6a', emoji: '◕' },
    { rating: 4, label: 'Легко', color: '#4a8a7a', emoji: '✓' },
  ];

  const totalDue = dueCards.length;
  const totalCards = flashcards.length;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', overflow: 'hidden',
      background: 'var(--bg-base)',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px 12px',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
        background: 'var(--bg-base)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        {mode !== 'list' ? (
          <button
            onClick={() => { setMode('list'); vibe(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--accent)', fontSize: '15px', fontFamily: 'Inter,sans-serif',
              padding: '4px 0',
            }}
          >
            <ChevronLeft size={18} /> Назад
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Brain size={20} color="var(--accent)" />
            <span style={{
              fontSize: '18px', fontWeight: 700,
              fontFamily: 'Lora, serif', color: 'var(--text-primary)',
            }}>Карточки</span>
          </div>
        )}

        {mode === 'list' && (
          <button
            onClick={() => { setMode('create'); vibe(); }}
            style={{
              width: 36, height: 36, borderRadius: '10px',
              background: 'var(--accent)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#fff',
            }}
          >
            <Plus size={18} />
          </button>
        )}

        {mode === 'create' && (
          <span style={{
            fontSize: '16px', fontWeight: 600,
            fontFamily: 'Inter,sans-serif', color: 'var(--text-primary)',
          }}>Новая карточка</span>
        )}
        {mode === 'review' && (
          <span style={{
            fontSize: '13px', color: 'var(--text-muted)',
            fontFamily: 'Inter,sans-serif',
          }}>
            {sessionRated.length} / {dueCards.length}
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain' }}>

        {/* LIST MODE */}
        {mode === 'list' && (
          <div style={{ padding: '16px 20px' }}>
            {/* Stats row */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px',
              marginBottom: '20px',
            }}>
              {[
                { label: 'Всего', value: totalCards, icon: <BookOpen size={16} />, color: 'var(--text-secondary)' },
                { label: 'К повторению', value: totalDue, icon: <Flame size={16} />, color: totalDue > 0 ? '#e07a3a' : 'var(--text-secondary)' },
                { label: 'Выучено', value: flashcards.filter(c => c.repetitions >= 3).length, icon: <Star size={16} />, color: '#6a9a4a' },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'var(--bg-card)', borderRadius: '14px',
                  padding: '14px 12px', textAlign: 'center',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ color: s.color, marginBottom: '6px', display: 'flex', justifyContent: 'center' }}>
                    {s.icon}
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Lora,serif' }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'Inter,sans-serif' }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Review button */}
            {totalDue > 0 && (
              <button
                onClick={() => { setMode('review'); vibe(12); }}
                style={{
                  width: '100%', padding: '16px',
                  background: 'linear-gradient(135deg, var(--accent), var(--accent-warm))',
                  border: 'none', borderRadius: '16px', cursor: 'pointer',
                  color: '#fff', fontSize: '16px', fontWeight: 600,
                  fontFamily: 'Inter,sans-serif',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  marginBottom: '20px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                  animation: 'scaleInBounce 0.4s ease',
                }}
              >
                <Brain size={20} />
                Начать повторение ({totalDue})
                <Flame size={16} color="rgba(255,255,255,0.8)" />
              </button>
            )}

            {/* Cards list */}
            {flashcards.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '60px 20px',
                color: 'var(--text-muted)', fontFamily: 'Inter,sans-serif',
              }}>
                <Brain size={48} color="var(--border-mid)" style={{ marginBottom: '16px' }} />
                <p style={{ fontSize: '16px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                  Нет карточек
                </p>
                <p style={{ fontSize: '13px', lineHeight: '1.5' }}>
                  Создайте первую карточку для повторения
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {flashcards.map((card, i) => {
                  const isDue = new Date(card.nextReview) <= new Date();
                  return (
                    <div
                      key={card.id}
                      style={{
                        background: 'var(--bg-card)', borderRadius: '14px',
                        padding: '14px 16px',
                        border: `1px solid ${isDue ? 'var(--accent)' : 'var(--border)'}`,
                        animation: `fadeSlideUp 0.3s ease ${i * 0.05}s both`,
                        opacity: 0,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{
                            fontSize: '14px', fontWeight: 600,
                            color: 'var(--text-primary)', fontFamily: 'Inter,sans-serif',
                            marginBottom: '4px', lineHeight: '1.4',
                          }}>
                            {card.front}
                          </p>
                          <p style={{
                            fontSize: '12px', color: 'var(--text-muted)',
                            fontFamily: 'Inter,sans-serif', lineHeight: '1.4',
                          }}>
                            {card.back.length > 80 ? card.back.slice(0, 80) + '…' : card.back}
                          </p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                          {isDue && (
                            <span style={{
                              fontSize: '10px', padding: '2px 8px',
                              background: 'rgba(224,122,58,0.2)',
                              color: '#e07a3a', borderRadius: '99px',
                              fontFamily: 'Inter,sans-serif',
                            }}>К повторению</span>
                          )}
                          <button
                            onClick={() => { onDelete(card.id); vibe(); }}
                            style={{
                              background: 'none', border: 'none',
                              color: 'var(--text-muted)', cursor: 'pointer',
                              padding: '4px',
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        marginTop: '10px', paddingTop: '10px',
                        borderTop: '1px solid var(--border)',
                      }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Inter,sans-serif' }}>
                          Повторений: {card.repetitions}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Inter,sans-serif' }}>
                          · Интервал: {card.interval}д
                        </span>
                        {card.lastRating && (
                          <span style={{
                            fontSize: '11px', marginLeft: 'auto',
                            color: card.lastRating >= 3 ? '#6a9a6a' : '#c07070',
                            fontFamily: 'Inter,sans-serif',
                          }}>
                            {['', '✕', '◑', '◕', '✓'][card.lastRating]}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* CREATE MODE */}
        {mode === 'create' && (
          <div style={{ padding: '20px' }}>
            <div style={{
              background: 'var(--bg-card)', borderRadius: '16px',
              padding: '20px', border: '1px solid var(--border)',
              marginBottom: '16px', animation: 'fadeSlideUp 0.3s ease',
            }}>
              <label style={{
                fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: 'var(--text-muted)',
                fontFamily: 'Inter,sans-serif', display: 'block', marginBottom: '8px',
              }}>
                Вопрос / Понятие
              </label>
              <textarea
                value={front}
                onChange={e => setFront(e.target.value)}
                placeholder="Что такое транзактный анализ?"
                rows={3}
                style={{
                  width: '100%', background: 'var(--bg-raised)',
                  border: '1px solid var(--border)', borderRadius: '10px',
                  padding: '12px 14px', color: 'var(--text-primary)',
                  fontSize: '15px', fontFamily: 'Inter,sans-serif',
                  resize: 'none', outline: 'none', lineHeight: '1.5',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{
              background: 'var(--bg-card)', borderRadius: '16px',
              padding: '20px', border: '1px solid var(--border)',
              marginBottom: '16px',
            }}>
              <label style={{
                fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: 'var(--text-muted)',
                fontFamily: 'Inter,sans-serif', display: 'block', marginBottom: '8px',
              }}>
                Ответ / Определение
              </label>
              <textarea
                value={back}
                onChange={e => setBack(e.target.value)}
                placeholder="Метод психотерапии, основанный на анализе ролей Родитель / Взрослый / Ребёнок..."
                rows={4}
                style={{
                  width: '100%', background: 'var(--bg-raised)',
                  border: '1px solid var(--border)', borderRadius: '10px',
                  padding: '12px 14px', color: 'var(--text-primary)',
                  fontSize: '15px', fontFamily: 'Inter,sans-serif',
                  resize: 'none', outline: 'none', lineHeight: '1.5',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Link to note */}
            <div style={{
              background: 'var(--bg-card)', borderRadius: '16px',
              padding: '16px 20px', border: '1px solid var(--border)',
              marginBottom: '16px',
            }}>
              <label style={{
                fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: 'var(--text-muted)',
                fontFamily: 'Inter,sans-serif', display: 'block', marginBottom: '8px',
              }}>
                Привязать к заметке (необязательно)
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  value={noteId}
                  onChange={e => setNoteId(e.target.value)}
                  style={{
                    width: '100%', background: 'var(--bg-raised)',
                    border: '1px solid var(--border)', borderRadius: '10px',
                    padding: '10px 36px 10px 14px', color: noteId ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontSize: '14px', fontFamily: 'Inter,sans-serif',
                    appearance: 'none', outline: 'none', cursor: 'pointer',
                  }}
                >
                  <option value="">— Без привязки —</option>
                  {notes.map(n => (
                    <option key={n.id} value={n.id}>{n.title || 'Без названия'}</option>
                  ))}
                </select>
                <ChevronDown size={16} color="var(--text-muted)" style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                }} />
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={!front.trim() || !back.trim()}
              style={{
                width: '100%', padding: '16px',
                background: front.trim() && back.trim()
                  ? 'linear-gradient(135deg, var(--accent), var(--accent-warm))'
                  : 'var(--bg-raised)',
                border: 'none', borderRadius: '14px', cursor: front.trim() && back.trim() ? 'pointer' : 'not-allowed',
                color: front.trim() && back.trim() ? '#fff' : 'var(--text-muted)',
                fontSize: '16px', fontWeight: 600, fontFamily: 'Inter,sans-serif',
                transition: 'all 0.2s',
              }}
            >
              Создать карточку
            </button>
          </div>
        )}

        {/* REVIEW MODE */}
        {mode === 'review' && (
          <div style={{ padding: '20px' }}>
            {reviewCards.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '60px 20px',
                animation: 'scaleInBounce 0.4s ease',
              }}>
                <div style={{ fontSize: '64px', marginBottom: '20px' }}>🎉</div>
                <p style={{
                  fontSize: '20px', fontWeight: 700,
                  color: 'var(--text-primary)', fontFamily: 'Lora,serif',
                  marginBottom: '10px',
                }}>
                  Сессия завершена!
                </p>
                <p style={{
                  fontSize: '14px', color: 'var(--text-muted)',
                  fontFamily: 'Inter,sans-serif', marginBottom: '30px',
                }}>
                  Вы повторили {sessionRated.length} карточек
                </p>
                <button
                  onClick={() => { setMode('list'); vibe(); }}
                  style={{
                    padding: '14px 32px',
                    background: 'var(--accent)', border: 'none',
                    borderRadius: '14px', color: '#fff',
                    fontSize: '15px', fontWeight: 600,
                    fontFamily: 'Inter,sans-serif', cursor: 'pointer',
                  }}
                >
                  Готово
                </button>
              </div>
            ) : (
              <>
                {/* Progress */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: '16px',
                }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'Inter,sans-serif' }}>
                    Осталось: {reviewCards.length}
                  </span>
                  <div style={{
                    flex: 1, margin: '0 14px',
                    height: '4px', background: 'var(--border)',
                    borderRadius: '99px', overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${(sessionRated.length / dueCards.length) * 100}%`,
                      background: 'var(--accent)',
                      borderRadius: '99px',
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--accent)', fontFamily: 'Inter,sans-serif', fontWeight: 600 }}>
                    {Math.round((sessionRated.length / dueCards.length) * 100)}%
                  </span>
                </div>

                {/* Card */}
                <div
                  onClick={() => { setShowAnswer(true); vibe(6); }}
                  style={{
                    minHeight: '260px', borderRadius: '20px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-mid)',
                    padding: '32px 24px',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    textAlign: 'center', cursor: 'pointer',
                    marginBottom: '16px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    animation: enterAnim ? 'fadeSlideUp 0.35s ease' : 'none',
                    transition: 'transform 0.1s',
                  }}
                >
                  {!showAnswer ? (
                    <>
                      <div style={{
                        fontSize: '11px', fontWeight: 600,
                        textTransform: 'uppercase', letterSpacing: '0.1em',
                        color: 'var(--text-muted)', fontFamily: 'Inter,sans-serif',
                        marginBottom: '20px',
                      }}>
                        Вопрос
                      </div>
                      <p style={{
                        fontSize: '18px', fontWeight: 600,
                        color: 'var(--text-primary)', fontFamily: 'Lora,serif',
                        lineHeight: '1.5',
                      }}>
                        {current?.front}
                      </p>
                      <div style={{
                        marginTop: '24px', display: 'flex',
                        alignItems: 'center', gap: '6px',
                        color: 'var(--text-muted)', fontSize: '13px',
                        fontFamily: 'Inter,sans-serif',
                      }}>
                        <RotateCcw size={14} /> Нажмите, чтобы открыть
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{
                        fontSize: '11px', fontWeight: 600,
                        textTransform: 'uppercase', letterSpacing: '0.1em',
                        color: 'var(--accent)', fontFamily: 'Inter,sans-serif',
                        marginBottom: '20px',
                      }}>
                        Ответ
                      </div>
                      <p style={{
                        fontSize: '16px', color: 'var(--text-primary)',
                        fontFamily: 'Inter,sans-serif', lineHeight: '1.6',
                      }}>
                        {current?.back}
                      </p>
                    </>
                  )}
                </div>

                {/* Rating buttons */}
                {showAnswer && (
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
                    gap: '8px', animation: 'fadeSlideUp 0.3s ease',
                  }}>
                    {ratingLabels.map(r => (
                      <button
                        key={r.rating}
                        onClick={() => handleRate(r.rating)}
                        style={{
                          padding: '14px 8px',
                          background: 'var(--bg-card)',
                          border: `1px solid ${r.color}40`,
                          borderRadius: '14px', cursor: 'pointer',
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', gap: '6px',
                        }}
                      >
                        <span style={{ fontSize: '18px', color: r.color }}>{r.emoji}</span>
                        <span style={{
                          fontSize: '11px', color: 'var(--text-secondary)',
                          fontFamily: 'Inter,sans-serif', fontWeight: 500,
                        }}>{r.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {!showAnswer && (
                  <button
                    onClick={() => { setShowAnswer(true); vibe(6); }}
                    style={{
                      width: '100%', padding: '16px',
                      background: 'var(--accent)', border: 'none',
                      borderRadius: '14px', cursor: 'pointer',
                      color: '#fff', fontSize: '16px', fontWeight: 600,
                      fontFamily: 'Inter,sans-serif',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    }}
                  >
                    <Check size={18} /> Показать ответ
                  </button>
                )}

                {/* Nav */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginTop: '16px',
                }}>
                  <button
                    onClick={() => { setReviewIdx(i => Math.max(0, i - 1)); vibe(6); }}
                    disabled={reviewIdx === 0}
                    style={{
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: '10px', padding: '10px 16px',
                      color: reviewIdx === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                      cursor: reviewIdx === 0 ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: '6px',
                      fontSize: '13px', fontFamily: 'Inter,sans-serif',
                    }}
                  >
                    <ChevronLeft size={16} /> Назад
                  </button>
                  <button
                    onClick={() => { setReviewIdx(i => Math.min(reviewCards.length - 1, i + 1)); setShowAnswer(false); vibe(6); }}
                    disabled={reviewIdx >= reviewCards.length - 1}
                    style={{
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: '10px', padding: '10px 16px',
                      color: reviewIdx >= reviewCards.length - 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                      cursor: reviewIdx >= reviewCards.length - 1 ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: '6px',
                      fontSize: '13px', fontFamily: 'Inter,sans-serif',
                    }}
                  >
                    Далее <ChevronRight size={16} />
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
