import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { User as AppUser } from '../types';
import { upsertProfile } from '../socialStore';
import { STOIC_LIBRARY } from '../stoicLibrary';

const vibe = (ms = 8) => navigator.vibrate?.(ms);

const INTERESTS = [
  { id: 'stoicism', label: 'Стоицизм', desc: 'Сенека, Эпиктет, Марк Аврелий' },
  { id: 'philosophy', label: 'Философия', desc: 'Смыслы, этика, бытие' },
  { id: 'psychology', label: 'Психология', desc: 'Поведение, мышление, терапия' },
  { id: 'fiction', label: 'Литература', desc: 'Романы, рассказы, поэзия' },
  { id: 'history', label: 'История', desc: 'Люди и эпохи' },
  { id: 'science', label: 'Наука', desc: 'Мозг, природа, космос' },
  { id: 'mindfulness', label: 'Осознанность', desc: 'Внимание и присутствие' },
  { id: 'biography', label: 'Биографии', desc: 'Жизни, которые учат' },
];

// Три первые книги на выбор из Стоической библиотеки
const FIRST_BOOKS = [2680, 45109, 64576].map(id => STOIC_LIBRARY.find(b => b.gutenbergId === id)!);

const STEPS = ['Имя в Агоре', 'О себе', 'Что вам близко', 'Первая книга'];

interface Props {
  user: AppUser;
  onComplete: (username: string) => void;
  onAddBooks?: (books: { title: string; author: string }[]) => void;
}

const label: CSSProperties = { fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' };
const typed: CSSProperties = { fontFamily: 'var(--font-typed)', textShadow: '0 0 0.7px var(--ink-bleed)' };
const line: CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: 'none', border: 'none', borderBottom: '1px solid var(--text-primary)',
  padding: '10px 0', fontSize: 17, color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font-ui)',
};

export default function OnboardingView({ user, onComplete, onAddBooks }: Props) {
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState(user.name || '');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [books, setBooks] = useState<number[]>([]);
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
    setUsernameError(cleaned ? validateUsername(cleaned) : '');
  };

  const toggle = <T,>(list: T[], set: (v: T[]) => void, v: T) => {
    vibe(6);
    set(list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  };

  const handleNext = () => {
    vibe(8);
    if (step === 0) {
      const err = validateUsername(username);
      if (err) { setUsernameError(err); return; }
    }
    setStep(s => s + 1);
  };

  const handleComplete = async (withBooks: boolean) => {
    vibe(12);
    setLoading(true);
    try {
      await upsertProfile(user.id, {
        username: username || `user_${user.id.slice(0, 8)}`,
        displayName: displayName || username,
        bio: bio.trim(),
        isPublic: true,
        interests,
      });
    } catch { /* продолжаем без профиля, его можно заполнить позже */ }
    if (withBooks && books.length && onAddBooks) {
      onAddBooks(FIRST_BOOKS.filter(b => books.includes(b.gutenbergId)).map(b => ({ title: b.title, author: b.author })));
    }
    setLoading(false);
    onComplete(username);
  };

  const last = step === STEPS.length - 1;
  const nextDisabled = step === 0 && (!!usernameError || !username);

  const chip = (on: boolean): CSSProperties => ({
    padding: '12px 14px', textAlign: 'left', cursor: 'pointer',
    border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
    background: on ? 'var(--accent)' : 'var(--bg-card)',
    transition: 'background var(--dur-quick) var(--ease-calm), border-color var(--dur-quick) var(--ease-calm)',
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--bg-base)', color: 'var(--text-primary)',
      display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-ui)',
      padding: 'calc(env(safe-area-inset-top, 0px) + 24px) 24px calc(env(safe-area-inset-bottom, 0px) + 24px)',
    }}>
      {/* Шаги: тонкие линии */}
      <div aria-label={`Шаг ${step + 1} из ${STEPS.length}`} style={{ display: 'flex', gap: 6 }}>
        {STEPS.map((_, i) => (
          <span key={i} style={{ flex: 1, height: 1, background: i <= step ? 'var(--text-primary)' : 'var(--border)', transition: 'background var(--dur-screen) var(--ease-calm)' }} />
        ))}
      </div>

      <div key={step} className="view-enter" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18, padding: '36px 0 24px' }}>
        <span style={label}>Шаг {step + 1} из {STEPS.length}</span>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 32, lineHeight: 1.15 }}>{STEPS[step]}</h1>

        {step === 0 && (
          <>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: 'var(--text-muted)' }}>
              Под этим именем вас увидят в Агоре. Латиница, цифры и подчёркивание.
            </p>
            <label style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${usernameError ? 'var(--red)' : 'var(--text-primary)'}` }}>
              <span style={{ fontSize: 17, color: 'var(--text-muted)' }}>@</span>
              <input value={username} onChange={e => handleUsernameChange(e.target.value)} placeholder="seneca_reader" autoFocus
                aria-label="Имя пользователя" autoCapitalize="none" autoCorrect="off"
                style={{ ...line, borderBottom: 'none', paddingLeft: 4 }} />
            </label>
            {usernameError && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--red)' }}>{usernameError}</p>}
          </>
        )}

        {step === 1 && (
          <>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={label}>Имя или псевдоним</span>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Как к вам обращаться" style={line} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={label}>О себе, если хочется</span>
              <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="Читаю стоиков по утрам."
                style={{ ...line, ...typed, fontSize: 16, lineHeight: 1.55, resize: 'none' }} />
            </label>
          </>
        )}

        {step === 2 && (
          <>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: 'var(--text-muted)' }}>Отметьте, о чём вам интересно читать и думать.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              {INTERESTS.map(it => {
                const on = interests.includes(it.id);
                return (
                  <button key={it.id} aria-pressed={on} onClick={() => toggle(interests, setInterests, it.id)} style={chip(on)}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: on ? 'var(--on-accent)' : 'var(--text-primary)' }}>{it.label}</span>
                    <span style={{ display: 'block', fontSize: 12, marginTop: 2, color: on ? 'var(--on-accent)' : 'var(--text-muted)', opacity: on ? 0.8 : 1 }}>{it.desc}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: 'var(--text-muted)' }}>
              Поставим на полку, чтобы было с чего начать. Тексты из Стоической библиотеки, на английском.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {FIRST_BOOKS.map(b => {
                const on = books.includes(b.gutenbergId);
                return (
                  <button key={b.gutenbergId} aria-pressed={on} onClick={() => toggle(books, setBooks, b.gutenbergId)} style={chip(on)}>
                    <span style={{ display: 'block', fontFamily: 'var(--font-serif)', fontSize: 18, color: on ? 'var(--on-accent)' : 'var(--text-primary)' }}>{b.title}</span>
                    <span style={{ display: 'block', fontSize: 12, marginTop: 3, color: on ? 'var(--on-accent)' : 'var(--text-muted)', opacity: on ? 0.8 : 1 }}>{b.author} · {b.note}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          onClick={last ? () => handleComplete(true) : handleNext}
          disabled={nextDisabled || loading}
          style={{
            width: '100%', height: 52, border: 'none', cursor: nextDisabled || loading ? 'not-allowed' : 'pointer',
            background: nextDisabled ? 'var(--bg-active)' : 'var(--accent)', color: nextDisabled ? 'var(--text-muted)' : 'var(--on-accent)',
            fontSize: 15, fontWeight: 500, fontFamily: 'var(--font-ui)',
          }}
        >
          {loading ? 'Сохраняю…' : last ? (books.length ? 'На полку и войти' : 'Войти в Агору') : 'Дальше'}
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {step > 0 ? (
            <button onClick={() => { vibe(6); setStep(s => s - 1); }} style={{ height: 44, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)' }}>Назад</button>
          ) : <span />}
          {step >= 2 && (
            <button onClick={() => (last ? handleComplete(false) : setStep(s => s + 1))} style={{ height: 44, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)' }}>Пропустить</button>
          )}
        </div>
      </div>
    </div>
  );
}
