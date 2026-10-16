import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, BookOpen, Link2,
  CheckCircle2, Lightbulb, Flame, BarChart2, Quote,
} from 'lucide-react';
import { DailyNote, Note } from '../types';
import { createDailyNote } from '../store';

interface Props {
  dailyNotes: DailyNote[];
  notes: Note[];
  onSave: (dn: DailyNote) => void;
  onOpenNote: (note: Note) => void;
}

const MOODS = [
  { value: 1, emoji: '😔', label: 'Тяжело',     color: '#8a5a5a' },
  { value: 2, emoji: '😕', label: 'Сложно',     color: '#8a7a5a' },
  { value: 3, emoji: '😐', label: 'Нейтрально', color: '#7a8a7a' },
  { value: 4, emoji: '🙂', label: 'Хорошо',     color: '#6a8a7a' },
  { value: 5, emoji: '😊', label: 'Отлично',    color: '#5a8a6a' },
];

// Вдохновляющие вопросы-подсказки для психолога
const PROMPTS = [
  'Какая мысль сегодня не даёт покоя?',
  'Что ты заметил в себе сегодня, чего раньше не замечал?',
  'Какой инсайт принесла сегодняшняя работа?',
  'Что ты хочешь запомнить из сегодняшнего дня?',
  'Какую книгу или идею хочется поразмышлять сегодня?',
  'Что тебя удивило или озадачило сегодня?',
  'Какой вопрос ты бы хотел задать себе завтра?',
  'Что ты чувствуешь прямо сейчас — и почему?',
  'Какая встреча или разговор запомнились больше всего?',
  'Что из прочитанного сегодня резонирует с тобой?',
];

// Случайная психологическая цитата
const QUOTES = [
  { text: 'Тот, кто знает «зачем», может вынести любое «как».', author: 'Фридрих Ницше' },
  { text: 'Между стимулом и реакцией есть пространство. В этом пространстве — наша свобода.', author: 'Виктор Франкл' },
  { text: 'Мы не видим мир таким, какой он есть. Мы видим его таким, какие мы есть.', author: 'Анаис Нин' },
  { text: 'Всё, что нас раздражает в других, может помочь нам понять себя.', author: 'Карл Юнг' },
  { text: 'Осознанность — это замечать мысли без того, чтобы ими становиться.', author: 'Дэниел Сигел' },
  { text: 'Эмоции — это данные, а не директивы.', author: 'Сьюзан Дэвид' },
  { text: 'Любопытство убивает тревогу. Будьте любопытны, а не тревожны.', author: 'Тодд Кашдан' },
  { text: 'Принятие — это не согласие. Это видение реальности такой, какая она есть.', author: 'Тара Брах' },
];

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const today = formatDate(new Date());
  const yesterday = formatDate(new Date(Date.now() - 86400000));
  if (dateStr === today) return 'Сегодня';
  if (dateStr === yesterday) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function getDayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('ru-RU', { weekday: 'long' });
}

function htmlToText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function textToHtml(text: string): string {
  return text
    .split('\n')
    .map(line => `<p>${line || '<br>'}</p>`)
    .join('');
}

// Стрик — количество дней подряд с записями
function calcStreak(dailyNotes: DailyNote[]): number {
  const today = formatDate(new Date());
  let streak = 0;
  let d = new Date();
  while (true) {
    const dateStr = formatDate(d);
    const note = dailyNotes.find(n => n.date === dateStr);
    const hasContent = note && (htmlToText(note.content).length > 0 || note.mood);
    if (!hasContent && dateStr !== today) break;
    if (hasContent) streak++;
    d.setDate(d.getDate() - 1);
    if (streak > 365) break;
  }
  return streak;
}

export default function DailyNoteView({ dailyNotes, notes, onSave, onOpenNote }: Props) {
  const [currentDate, setCurrentDate] = useState(formatDate(new Date()));
  const [isSaved, setIsSaved] = useState(false);
  const [showLinked, setShowLinked] = useState(false);
  const [textValue, setTextValue] = useState('');
  const [activePrompt, setActivePrompt] = useState(0);
  const [showQuote, setShowQuote] = useState(true);
  const [quoteIdx] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ротация промпта раз в минуту
  useEffect(() => {
    const todayIdx = new Date().getDate() % PROMPTS.length;
    setActivePrompt(todayIdx);
  }, [currentDate]);

  const getDailyNote = useCallback((date: string): DailyNote => {
    return dailyNotes.find(d => d.date === date) || createDailyNote(date);
  }, [dailyNotes]);

  const currentNote = getDailyNote(currentDate);

  useEffect(() => {
    const note = getDailyNote(currentDate);
    setTextValue(htmlToText(note.content));
    setIsSaved(false);
  }, [currentDate, getDailyNote]);

  // Manual save
  const handleSave = () => {
    try { navigator.vibrate?.(10); } catch {}
    const updated: DailyNote = {
      ...getDailyNote(currentDate),
      content: textToHtml(textValue),
      updatedAt: new Date().toISOString(),
    };
    onSave(updated);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  // Auto-save every 5 seconds if text changed
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (!textValue) return;
    saveTimerRef.current = setTimeout(() => {
      const updated: DailyNote = {
        ...getDailyNote(currentDate),
        content: textToHtml(textValue),
        updatedAt: new Date().toISOString(),
      };
      onSave(updated);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 1500);
    }, 5000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [textValue, currentDate]); // eslint-disable-line

  const handleMood = (mood: 1 | 2 | 3 | 4 | 5) => {
    try { navigator.vibrate?.(8); } catch {}
    const updated: DailyNote = {
      ...currentNote,
      content: textToHtml(textValue),
      mood,
      updatedAt: new Date().toISOString(),
    };
    onSave(updated);
  };

  const goBack = () => {
    const d = new Date(currentDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setCurrentDate(formatDate(d));
    try { navigator.vibrate?.(6); } catch {}
  };

  const goForward = () => {
    const today = formatDate(new Date());
    if (currentDate >= today) return;
    const d = new Date(currentDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    setCurrentDate(formatDate(d));
    try { navigator.vibrate?.(6); } catch {}
  };

  const isToday = currentDate === formatDate(new Date());
  const linkedNotes = notes.filter(n => formatDate(new Date(n.createdAt)) === currentDate);
  const wordCount = textValue.trim() ? textValue.trim().split(/\s+/).length : 0;
  const charCount = textValue.length;
  const streak = calcStreak(dailyNotes);
  const totalEntries = dailyNotes.filter(d => htmlToText(d.content).length > 0).length;
  const moodLabel = currentNote.mood ? MOODS.find(m => m.value === currentNote.mood)?.label : null;
  const moodColor = currentNote.mood ? MOODS.find(m => m.value === currentNote.mood)?.color : null;

  // Последние 7 дней — заполненность
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = formatDate(d);
    const note = dailyNotes.find(n => n.date === dateStr);
    const filled = note && (htmlToText(note.content).length > 10 || note.mood);
    return { dateStr, filled, mood: note?.mood };
  });

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', overflow: 'hidden',
      background: 'var(--bg-base)',
    }}>
      {/* ── Header ────────────────────────────────────────────────── */}
      <div style={{
        paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))',
        paddingBottom: 12,
        paddingLeft: 16, paddingRight: 16,
        background: 'var(--bg-base)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {/* Date navigation */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <button onClick={goBack} style={{
            width: 36, height: 36, borderRadius: 11,
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-secondary)',
          }}><ChevronLeft size={18} /></button>

          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 20, fontWeight: 700,
              fontFamily: 'Lora, serif',
              color: 'var(--text-primary)',
              lineHeight: 1.2,
            }}>
              {formatDisplayDate(currentDate)}
            </div>
            <div style={{
              fontSize: 12, color: 'var(--text-muted)',
              fontFamily: 'Inter, sans-serif',
              textTransform: 'capitalize', marginTop: 2,
            }}>
              {getDayOfWeek(currentDate)}
              {moodLabel && (
                <span style={{ marginLeft: 8, color: moodColor || 'var(--text-muted)' }}>
                  · {moodLabel}
                </span>
              )}
            </div>
          </div>

          <button onClick={goForward} disabled={isToday} style={{
            width: 36, height: 36, borderRadius: 11,
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: isToday ? 'default' : 'pointer',
            color: isToday ? 'var(--border-mid)' : 'var(--text-secondary)',
            opacity: isToday ? 0.4 : 1,
          }}><ChevronRight size={18} /></button>
        </div>

        {/* Mood selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 10, color: 'var(--text-muted)',
            fontFamily: 'Inter,sans-serif',
            textTransform: 'uppercase', letterSpacing: '0.07em',
            flexShrink: 0,
          }}>Настроение</span>
          <div style={{ display: 'flex', gap: 5, flex: 1 }}>
            {MOODS.map(m => (
              <button
                key={m.value}
                onClick={() => handleMood(m.value as 1|2|3|4|5)}
                title={m.label}
                style={{
                  flex: 1, height: 34, borderRadius: 10,
                  background: currentNote.mood === m.value ? 'var(--bg-active)' : 'var(--bg-raised)',
                  border: currentNote.mood === m.value ? `1.5px solid ${m.color}` : '1px solid var(--border)',
                  cursor: 'pointer', fontSize: 17,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                  transform: currentNote.mood === m.value ? 'scale(1.15)' : 'scale(1)',
                }}
              >{m.emoji}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Scrollable body ───────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Quote of the day — only on today, collapsible */}
        {isToday && showQuote && (
          <div
            style={{
              margin: '12px 16px 0',
              padding: '12px 14px',
              borderRadius: 14,
              background: 'var(--bg-raised)',
              border: '1px solid var(--border)',
              animation: 'fadeUp 0.3s ease',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Quote size={14} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <p style={{
                  fontSize: 13, lineHeight: 1.55,
                  color: 'var(--text-secondary)',
                  fontFamily: 'Lora, serif',
                  fontStyle: 'italic',
                  margin: 0, marginBottom: 4,
                }}>{QUOTES[quoteIdx].text}</p>
                <p style={{
                  fontSize: 11, color: 'var(--text-muted)',
                  fontFamily: 'Inter, sans-serif',
                  margin: 0,
                }}>— {QUOTES[quoteIdx].author}</p>
              </div>
            </div>
            <button
              onClick={() => setShowQuote(false)}
              style={{
                position: 'absolute', top: 8, right: 8,
                width: 20, height: 20, borderRadius: 6,
                background: 'var(--bg-active)', border: 'none',
                cursor: 'pointer', color: 'var(--text-muted)',
                fontSize: 11, lineHeight: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >✕</button>
          </div>
        )}

        {/* Writing prompt */}
        <div style={{ margin: '10px 16px 0' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 12px',
            borderRadius: 11,
            background: 'linear-gradient(135deg, var(--bg-raised), var(--bg-active))',
            border: '1px solid var(--border)',
          }}>
            <Lightbulb size={13} color="var(--gold)" />
            <span style={{
              fontSize: 12, color: 'var(--text-secondary)',
              fontFamily: 'Inter, sans-serif', lineHeight: 1.4,
              fontStyle: 'italic',
            }}>{PROMPTS[activePrompt]}</span>
          </div>
        </div>

        {/* Textarea — main writing area */}
        <div style={{
          margin: '10px 16px 0',
          borderRadius: 14,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-mid)',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          <textarea
            ref={textareaRef}
            value={textValue}
            onChange={e => setTextValue(e.target.value)}
            placeholder="Начни писать здесь..."
            rows={10}
            style={{
              width: '100%',
              padding: '16px',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontSize: 15.5,
              lineHeight: 1.78,
              color: 'var(--text-primary)',
              fontFamily: 'Lora, Georgia, serif',
              boxSizing: 'border-box',
              caretColor: 'var(--accent)',
              minHeight: 200,
            }}
          />
          {/* Word / char count bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 14px',
            borderTop: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter,sans-serif' }}>
              {wordCount} {wordCount === 1 ? 'слово' : wordCount < 5 ? 'слова' : 'слов'}
              &nbsp;·&nbsp;{charCount} симв.
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isSaved && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, color: '#6a9e8a',
                  fontFamily: 'Inter,sans-serif',
                  animation: 'fadeIn 0.2s ease',
                }}>
                  <CheckCircle2 size={12} /> Сохранено
                </div>
              )}
              <button
                onClick={handleSave}
                style={{
                  padding: '5px 12px', borderRadius: 8,
                  background: textValue.trim()
                    ? 'linear-gradient(135deg, var(--accent), var(--accent-soft))'
                    : 'var(--bg-raised)',
                  border: textValue.trim() ? 'none' : '1px solid var(--border)',
                  color: textValue.trim() ? '#0e0c09' : 'var(--text-muted)',
                  fontSize: 12, fontWeight: 600,
                  fontFamily: 'Inter, sans-serif',
                  cursor: textValue.trim() ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                }}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{
          margin: '12px 16px 0',
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: 8,
        }}>
          {/* Streak */}
          <div style={{
            padding: '12px 10px',
            borderRadius: 12,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            textAlign: 'center',
            animation: 'card-enter 0.35s ease 0.05s both',
          }}>
            <div style={{ fontSize: 20, marginBottom: 3 }}>
              <Flame size={18} color={streak > 0 ? '#d4914a' : 'var(--text-muted)'} style={{ display: 'inline' }} />
            </div>
            <div style={{
              fontSize: 18, fontWeight: 700,
              color: streak > 0 ? 'var(--accent)' : 'var(--text-muted)',
              fontFamily: 'Lora, serif', lineHeight: 1,
            }}>{streak}</div>
            <div style={{
              fontSize: 10, color: 'var(--text-muted)',
              fontFamily: 'Inter,sans-serif', marginTop: 3,
            }}>Стрик</div>
          </div>

          {/* Total entries */}
          <div style={{
            padding: '12px 10px',
            borderRadius: 12,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            textAlign: 'center',
            animation: 'card-enter 0.35s ease 0.10s both',
          }}>
            <div style={{ marginBottom: 3 }}>
              <BarChart2 size={18} color="var(--text-muted)" style={{ display: 'inline' }} />
            </div>
            <div style={{
              fontSize: 18, fontWeight: 700,
              color: 'var(--text-secondary)',
              fontFamily: 'Lora, serif', lineHeight: 1,
            }}>{totalEntries}</div>
            <div style={{
              fontSize: 10, color: 'var(--text-muted)',
              fontFamily: 'Inter,sans-serif', marginTop: 3,
            }}>Записей</div>
          </div>

          {/* Linked notes */}
          <div style={{
            padding: '12px 10px',
            borderRadius: 12,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            textAlign: 'center',
            animation: 'card-enter 0.35s ease 0.15s both',
          }}>
            <div style={{ marginBottom: 3 }}>
              <Link2 size={18} color="var(--text-muted)" style={{ display: 'inline' }} />
            </div>
            <div style={{
              fontSize: 18, fontWeight: 700,
              color: 'var(--text-secondary)',
              fontFamily: 'Lora, serif', lineHeight: 1,
            }}>{linkedNotes.length}</div>
            <div style={{
              fontSize: 10, color: 'var(--text-muted)',
              fontFamily: 'Inter,sans-serif', marginTop: 3,
            }}>Заметок</div>
          </div>
        </div>

        {/* Last 7 days activity */}
        <div style={{ margin: '12px 16px 0' }}>
          <p style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.07em', color: 'var(--text-muted)',
            fontFamily: 'Inter,sans-serif', marginBottom: 8,
          }}>Последние 7 дней</p>
          <div style={{
            display: 'flex', gap: 6, alignItems: 'flex-end',
          }}>
            {last7.map((day, i) => {
              const mood = day.mood ? MOODS.find(m => m.value === day.mood) : null;
              const isCurrentDay = day.dateStr === currentDate;
              return (
                <div
                  key={i}
                  onClick={() => setCurrentDate(day.dateStr)}
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 4,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: '100%', height: day.filled ? 28 : 14,
                    borderRadius: 6,
                    background: day.filled
                      ? (mood?.color || 'var(--accent-dim)')
                      : 'var(--bg-raised)',
                    border: isCurrentDay ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                    transition: 'all 0.2s',
                    opacity: day.filled ? 0.85 : 0.5,
                  }} />
                  <span style={{
                    fontSize: 9, color: isCurrentDay ? 'var(--accent)' : 'var(--text-muted)',
                    fontFamily: 'Inter,sans-serif', fontWeight: isCurrentDay ? 700 : 400,
                  }}>
                    {new Date(day.dateStr + 'T12:00:00').toLocaleDateString('ru-RU', { weekday: 'narrow' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Linked notes section */}
        {linkedNotes.length > 0 && (
          <div style={{ margin: '12px 16px 0' }}>
            <button
              onClick={() => setShowLinked(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                width: '100%', padding: '10px 12px',
                borderRadius: 12,
                background: showLinked ? 'var(--bg-active)' : 'var(--bg-card)',
                border: '1px solid var(--border)',
                cursor: 'pointer', textAlign: 'left',
                transition: 'background 0.15s',
              }}
            >
              <BookOpen size={14} color="var(--text-muted)" />
              <span style={{
                flex: 1, fontSize: 12, color: 'var(--text-secondary)',
                fontFamily: 'Inter,sans-serif', fontWeight: 600,
              }}>
                Записи за этот день ({linkedNotes.length})
              </span>
              <ChevronRight
                size={14}
                color="var(--text-muted)"
                style={{
                  transform: showLinked ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              />
            </button>

            {showLinked && (
              <div style={{
                marginTop: 6, display: 'flex', flexDirection: 'column', gap: 5,
                animation: 'slideDown 0.2s ease',
              }}>
                {linkedNotes.map(n => (
                  <button
                    key={n.id}
                    onClick={() => { onOpenNote(n); setShowLinked(false); }}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 12px', borderRadius: 11,
                      background: 'var(--bg-raised)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <div style={{
                      fontSize: 14, flex: 1,
                      color: 'var(--text-primary)',
                      fontFamily: 'Inter,sans-serif',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {n.title || 'Без названия'}
                    </div>
                    <span style={{
                      fontSize: 11, color: 'var(--text-muted)',
                      fontFamily: 'Inter,sans-serif', flexShrink: 0,
                    }}>
                      {new Date(n.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bottom spacer */}
        <div style={{ height: 24, flexShrink: 0 }} />
      </div>
    </div>
  );
}
