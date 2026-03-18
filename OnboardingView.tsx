import { useState } from 'react';
import { ArrowRight, Check, User, BookOpen, Brain } from 'lucide-react';
import type { User as AppUser } from '../types';
import { upsertProfile } from '../socialStore';

const vibe = (ms = 8) => navigator.vibrate?.(ms);

const INTERESTS = [
  { id: 'psychology', label: '🧠 Психология', desc: 'Поведение, терапия, развитие' },
  { id: 'philosophy', label: '📜 Философия', desc: 'Смыслы, этика, бытие' },
  { id: 'science', label: '🔬 Наука', desc: 'Нейронауки, биология' },
  { id: 'selfdev', label: '🌱 Саморазвитие', desc: 'Привычки, продуктивность' },
  { id: 'fiction', label: '📖 Художественная', desc: 'Романы, рассказы' },
  { id: 'biography', label: '👤 Биографии', desc: 'Жизнь великих людей' },
  { id: 'therapy', label: '💙 Терапия', desc: 'КПТ, гештальт, психоанализ' },
  { id: 'mindfulness', label: '🧘 Осознанность', desc: 'Медитация, присутствие' },
];

interface Props {
  user: AppUser;
  onComplete: (username: string) => void;
}

export default function OnboardingView({ user, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState(user.name || '');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [usernameError, setUsernameError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateUsername = (v: string) => {
    if (v.length < 3) return 'Минимум 3 символа';
    if (v.length > 30) return 'Максимум 30 символов';
    if (!/^[a-z0-9_]+$/.test(v)) return 'Только латиница, цифры и _';
    return '';
  };

  const handleUsernameChange = (v: string) => {
    const cleaned = v.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(cleaned);
    setUsernameError(validateUsername(cleaned));
  };

  const toggleInterest = (id: string) => {
    vibe(6);
    setInterests(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleNext = () => {
    vibe(8);
    if (step === 0) {
      const err = validateUsername(username);
      if (err) { setUsernameError(err); return; }
    }
    setStep(s => s + 1);
  };

  const handleComplete = async () => {
    vibe(12);
    setLoading(true);
    try {
      await upsertProfile(user.id, {
        username: username || `user_${user.id.slice(0, 8)}`,
        displayName: displayName || username,
        bio: bio + (interests.length ? `\n\nИнтересы: ${interests.join(', ')}` : ''),
        isPublic: true,
        interests,
      });
    } catch { /* продолжаем */ }
    setLoading(false);
    onComplete(username);
  };

  const steps = [
    { title: 'Ваш никнейм', icon: <User size={28} /> },
    { title: 'О себе', icon: <Brain size={28} /> },
    { title: 'Интересы', icon: <BookOpen size={28} /> },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '0 24px',
    }}>
      {/* Progress */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 40 }}>
        {steps.map((_, i) => (
          <div key={i} style={{
            height: 4, borderRadius: 2,
            width: i === step ? 32 : 16,
            background: i <= step ? 'var(--accent)' : 'var(--border)',
            transition: 'all 0.3s ease',
          }} />
        ))}
      </div>

      {/* Icon */}
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: 'var(--bg-raised)',
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--accent)', marginBottom: 24,
        animation: 'scaleInBounce 0.4s ease both',
      }}>
        {steps[step].icon}
      </div>

      <h2 style={{
        fontFamily: 'Lora, serif', fontSize: 24, fontWeight: 700,
        color: 'var(--text-primary)', marginBottom: 8, textAlign: 'center',
      }}>
        {steps[step].title}
      </h2>

      {/* Step 0 — Username */}
      {step === 0 && (
        <div style={{ width: '100%', maxWidth: 360, marginTop: 24 }}>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 24, lineHeight: 1.6 }}>
            Никнейм нужен для публичного профиля в сообществе. Только латиница и цифры.
          </p>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--accent)', fontSize: 15, fontWeight: 600,
            }}>@</span>
            <input
              value={username}
              onChange={e => handleUsernameChange(e.target.value)}
              placeholder="your_username"
              autoFocus
              style={{
                width: '100%', padding: '14px 16px 14px 32px',
                background: 'var(--bg-raised)', border: `1px solid ${usernameError ? '#c0392b' : 'var(--border)'}`,
                borderRadius: 12, color: 'var(--text-primary)', fontSize: 16,
                fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          {usernameError && (
            <p style={{ fontSize: 12, color: '#c0392b', marginTop: 6, textAlign: 'center' }}>{usernameError}</p>
          )}
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
            psyche.app/@{username || 'you'}
          </p>
        </div>
      )}

      {/* Step 1 — About */}
      {step === 1 && (
        <div style={{ width: '100%', maxWidth: 360, marginTop: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Имя или псевдоним
            </label>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Как к вам обращаться?"
              style={{
                width: '100%', padding: '12px 16px',
                background: 'var(--bg-raised)', border: '1px solid var(--border)',
                borderRadius: 12, color: 'var(--text-primary)', fontSize: 15,
                fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              О себе (необязательно)
            </label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Психолог, читатель, исследователь..."
              rows={3}
              style={{
                width: '100%', padding: '12px 16px',
                background: 'var(--bg-raised)', border: '1px solid var(--border)',
                borderRadius: 12, color: 'var(--text-primary)', fontSize: 15,
                fontFamily: 'Inter, sans-serif', outline: 'none', resize: 'none',
                lineHeight: 1.6, boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      )}

      {/* Step 2 — Interests */}
      {step === 2 && (
        <div style={{ width: '100%', maxWidth: 360, marginTop: 16 }}>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 16, lineHeight: 1.6 }}>
            Что вам интересно читать?
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {INTERESTS.map(int => {
              const selected = interests.includes(int.id);
              return (
                <button
                  key={int.id}
                  onClick={() => toggleInterest(int.id)}
                  style={{
                    padding: '10px 12px', borderRadius: 12, border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                    background: selected ? 'var(--accent-muted)' : 'var(--bg-raised)',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s ease',
                    transform: selected ? 'scale(0.97)' : 'scale(1)',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: selected ? 'var(--accent)' : 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}>
                    {int.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {int.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Buttons */}
      <div style={{ position: 'fixed', bottom: 40, left: 24, right: 24, maxWidth: 360, margin: '0 auto' }}>
        {step < 2 ? (
          <button
            onClick={handleNext}
            disabled={step === 0 && (!!usernameError || !username)}
            style={{
              width: '100%', padding: '16px',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
              border: 'none', borderRadius: 16, color: '#fff',
              fontSize: 16, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: (step === 0 && (!!usernameError || !username)) ? 0.5 : 1,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Далее <ArrowRight size={18} />
          </button>
        ) : (
          <button
            onClick={handleComplete}
            disabled={loading}
            style={{
              width: '100%', padding: '16px',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
              border: 'none', borderRadius: 16, color: '#fff',
              fontSize: 16, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {loading ? 'Сохранение...' : <>Начать <Check size={18} /></>}
          </button>
        )}
        {step > 0 && (
          <button
            onClick={() => { vibe(6); setStep(s => s - 1); }}
            style={{
              width: '100%', padding: '12px', marginTop: 8,
              background: 'none', border: 'none', color: 'var(--text-muted)',
              fontSize: 14, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}
          >
            Назад
          </button>
        )}
        {step === 2 && (
          <button
            onClick={() => handleComplete()}
            style={{
              width: '100%', padding: '12px',
              background: 'none', border: 'none', color: 'var(--text-muted)',
              fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}
          >
            Пропустить
          </button>
        )}
      </div>
    </div>
  );
}
