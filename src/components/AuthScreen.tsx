import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Eye, EyeOff, ChevronLeft } from 'lucide-react';
import { supabase } from '../supabase';
import { User as UserType } from '../types';

interface Props { onAuth: (user: UserType) => void; }
type Mode = 'welcome' | 'login' | 'register' | 'confirm';

// Что здесь есть: три коротких пункта на приветствии
const POINTS: { title: string; text: string }[] = [
  { title: 'Листы и поля', text: 'Пишите мысли и обсуждайте их на полях — медленно и по существу.' },
  { title: 'Книги и цитаты', text: 'Стоическая библиотека и свои книги, цитаты прямо из читалки.' },
  { title: 'Дневник дня', text: 'Утреннее намерение, вечерний вопрос, серия дней.' },
];

const label: CSSProperties = { fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' };
const typed: CSSProperties = { fontFamily: 'var(--font-typed)', color: 'var(--text-primary)', textShadow: '0 0 0.7px var(--ink-bleed)' };
const inkButton = (disabled = false): CSSProperties => ({
  width: '100%', height: 52, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
  background: disabled ? 'var(--bg-active)' : 'var(--accent)', color: disabled ? 'var(--text-muted)' : 'var(--on-accent)',
  fontSize: 15, fontWeight: 500, fontFamily: 'var(--font-ui)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background var(--dur-quick) var(--ease-calm)',
});
const quietButton: CSSProperties = {
  width: '100%', height: 52, border: '1px solid var(--border-mid)', background: 'none', cursor: 'pointer',
  fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
};
const linkButton: CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', fontSize: 14,
  color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', textDecoration: 'underline', textUnderlineOffset: 4,
};
const page: CSSProperties = {
  minHeight: '100%', boxSizing: 'border-box', background: 'var(--bg-base)', color: 'var(--text-primary)',
  display: 'flex', flexDirection: 'column', padding: 'calc(env(safe-area-inset-top, 0px) + 20px) 24px calc(env(safe-area-inset-bottom, 0px) + 24px)',
  overflowY: 'auto', fontFamily: 'var(--font-ui)',
};

// Поле с одной чернильной линией
function Field({ label: text, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={label}>{text}</span>
      <span style={{ position: 'relative', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--text-primary)' }}>
        {children}
      </span>
    </label>
  );
}
const input: CSSProperties = {
  flex: 1, minWidth: 0, height: 44, background: 'none', border: 'none', outline: 'none', padding: 0,
  fontSize: 16, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
};

function Note({ tone, children }: { tone: 'error' | 'info'; children: ReactNode }) {
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} style={{
      margin: 0, padding: '10px 0 10px 12px', fontSize: 14, lineHeight: 1.5,
      borderLeft: `1px solid ${tone === 'error' ? 'var(--red)' : 'var(--text-primary)'}`,
      color: tone === 'error' ? 'var(--red)' : 'var(--text-primary)',
    }}>{children}</p>
  );
}

export default function AuthScreen({ onAuth }: Props) {
  const [mode, setMode]         = useState<Mode>('welcome');
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [info, setInfo]         = useState('');
  const [loading, setLoading]   = useState(false);

  const go = (next: Mode) => { setMode(next); setError(''); setInfo(''); };

  // ── Регистрация / Вход ──────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError('');
    setInfo('');
    if (!email || !password) { setError('Заполните все поля'); return; }
    if (mode === 'register' && !name.trim()) { setError('Введите имя'); return; }
    if (mode === 'register' && password.length < 6) { setError('Пароль — минимум 6 символов'); return; }
    if (!email.includes('@')) { setError('Введите корректный email'); return; }

    setLoading(true);

    try {
      if (mode === 'register') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.toLowerCase().trim(),
          password,
          options: {
            data: { name: name.trim() },
            // Redirect URL — ссылка в письме ведёт обратно в приложение
            emailRedirectTo: window.location.origin + window.location.pathname,
          },
        });

        if (signUpError) {
          if (signUpError.message.includes('already registered') || signUpError.message.includes('already been registered') || signUpError.message.includes('User already registered')) {
            setError('Этот email уже зарегистрирован. Войдите в аккаунт.');
          } else {
            setError(signUpError.message);
          }
          setLoading(false);
          return;
        }

        if (data.session && data.user) {
          // Email confirmation ОТКЛЮЧЁН в настройках Supabase — входим сразу
          const user: UserType = {
            id:        data.user.id,
            email:     data.user.email!,
            name:      name.trim(),
            createdAt: data.user.created_at,
          };
          onAuth(user);
        } else if (data.user && !data.session) {
          // Email confirmation ВКЛЮЧЁН — показываем экран ожидания
          setMode('confirm');
        }

      } else {
        // Вход
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.toLowerCase().trim(),
          password,
        });

        if (signInError) {
          if (
            signInError.message.includes('Invalid login credentials') ||
            signInError.message.includes('invalid_credentials') ||
            signInError.message.includes('Invalid email or password')
          ) {
            setError('Неверный email или пароль');
          } else if (signInError.message.includes('Email not confirmed')) {
            // Email не подтверждён — показываем экран подтверждения
            setMode('confirm');
            setLoading(false);
            return;
          } else {
            setError(signInError.message);
          }
          setLoading(false);
          return;
        }

        if (data.user) {
          const meta = data.user.user_metadata;
          const user: UserType = {
            id:        data.user.id,
            email:     data.user.email!,
            name:      meta?.name || data.user.email!.split('@')[0],
            createdAt: data.user.created_at,
          };
          onAuth(user);
        }
      }
    } catch {
      setError('Ошибка соединения. Проверьте интернет.');
    }

    setLoading(false);
  };

  // ── Повторная отправка письма ───────────────────────────────────────────
  const handleResendEmail = async () => {
    if (!email) {
      setError('Введите почту, чтобы отправить письмо ещё раз');
      return;
    }
    setLoading(true);
    setError('');
    setInfo('');
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: resendError } = await (supabase.auth as any).resend({
        type: 'signup',
        email: email.toLowerCase().trim(),
        options: { emailRedirectTo: window.location.origin + window.location.pathname },
      }) as { error: { message: string } | null };
      if (resendError) {
        setError(resendError.message);
      } else {
        setInfo('Письмо отправлено ещё раз. Проверьте входящие и «Спам».');
      }
    } catch {
      setError('Ошибка отправки. Попробуйте позже.');
    }
    setLoading(false);
  };

  // ── Войти без подтверждения (если Supabase настроен без confirm) ────────
  const handleCheckSession = async () => {
    setLoading(true);
    setError('');
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      const u = data.session.user;
      const user: UserType = {
        id:        u.id,
        email:     u.email!,
        name:      u.user_metadata?.name || u.email!.split('@')[0],
        createdAt: u.created_at,
      };
      onAuth(user);
    } else {
      setError('Сессия ещё не создана. Перейдите по ссылке в письме и вернитесь сюда.');
    }
    setLoading(false);
  };


  /* ── Подтверждение почты ──────────────────────────────────────── */
  if (mode === 'confirm') {
    return (
      <div className="view-push" style={page}>
        <button aria-label="Назад" onClick={() => go('login')} style={{ ...linkButton, textDecoration: 'none', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4, marginLeft: -6 }}>
          <ChevronLeft size={20} strokeWidth={1.5} /> Назад
        </button>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, padding: '32px 0' }}>
          <span style={label}>Почти готово</span>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 32, lineHeight: 1.15 }}>Подтвердите почту</h1>
          <p style={{ ...typed, margin: 0, fontSize: 16, lineHeight: 1.6 }}>
            Мы отправили письмо на {email || 'ваш адрес'}. Откройте его, нажмите «Подтвердить» и вернитесь сюда. Если письма нет, загляните в «Спам».
          </p>
          {error && <Note tone="error">{error}</Note>}
          {info && <Note tone="info">{info}</Note>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={handleCheckSession} disabled={loading} style={inkButton(loading)}>
            {loading ? 'Проверяю…' : 'Я подтвердил — войти'}
          </button>
          <button onClick={handleResendEmail} disabled={loading} style={quietButton}>Отправить письмо ещё раз</button>
        </div>
      </div>
    );
  }

  /* ── Приветствие ──────────────────────────────────────────────── */
  if (mode === 'welcome') {
    return (
      <div className="view-enter" style={page}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28, padding: '24px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, fontSize: 52, lineHeight: 1, letterSpacing: '-0.01em' }}>Psyche</h1>
            <p style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 22, lineHeight: 1.3 }}>Агора для тех, кто читает и думает</p>
          </div>

          <figure style={{ margin: 0, padding: '18px 0', borderTop: '1px solid var(--text-primary)', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <blockquote style={{ ...typed, margin: 0, fontSize: 16, lineHeight: 1.6 }}>
              Из существующего одно находится в нашей власти, другое — нет.
            </blockquote>
            <figcaption style={label}>Эпиктет · Энхиридион, 1</figcaption>
          </figure>

          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
            {POINTS.map((p, i) => (
              <li key={p.title} className="view-enter" style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '12px 0', borderBottom: '1px solid var(--border)', animationDelay: `${0.08 + i * 0.06}s` }}>
                <span style={{ fontSize: 15, fontWeight: 500 }}>{p.title}</span>
                <span style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--text-muted)' }}>{p.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => go('register')} style={inkButton()}>Начать</button>
          <button onClick={() => go('login')} style={quietButton}>У меня есть аккаунт</button>
        </div>
      </div>
    );
  }

  /* ── Вход и регистрация ───────────────────────────────────────── */
  const isLogin = mode === 'login';
  return (
    <div key={mode} className="view-push" style={page}>
      <button aria-label="Назад" onClick={() => go('welcome')} style={{ ...linkButton, textDecoration: 'none', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4, marginLeft: -6 }}>
        <ChevronLeft size={20} strokeWidth={1.5} /> Назад
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '28px 0 32px' }}>
        <span style={label}>{isLogin ? 'С возвращением' : 'Новый читатель'}</span>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 32, lineHeight: 1.15 }}>
          {isLogin ? 'Войти в Psyche' : 'Создать аккаунт'}
        </h1>
      </div>

      <form onSubmit={e => { e.preventDefault(); void handleSubmit(); }} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {!isLogin && (
          <Field label="Имя">
            <input style={input} placeholder="Как к вам обращаться" value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
          </Field>
        )}
        <Field label="Почта">
          <input style={input} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)}
            autoCapitalize="none" autoCorrect="off" autoComplete="email" />
        </Field>
        <Field label="Пароль">
          <input style={input} type={showPass ? 'text' : 'password'} placeholder={isLogin ? 'Ваш пароль' : 'Не короче 6 символов'}
            value={password} onChange={e => setPassword(e.target.value)} autoComplete={isLogin ? 'current-password' : 'new-password'} />
          <button type="button" aria-label={showPass ? 'Скрыть пароль' : 'Показать пароль'} onClick={() => setShowPass(v => !v)}
            style={{ width: 44, height: 44, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: -10 }}>
            {showPass ? <EyeOff size={17} strokeWidth={1.5} /> : <Eye size={17} strokeWidth={1.5} />}
          </button>
        </Field>

        {error && <Note tone="error">{error}</Note>}
        {info && <Note tone="info">{info}</Note>}

        <button type="submit" disabled={loading} style={{ ...inkButton(loading), marginTop: 6 }}>
          {loading ? (isLogin ? 'Вхожу…' : 'Создаю…') : (isLogin ? 'Войти' : 'Создать аккаунт')}
        </button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginTop: 20 }}>
        <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          {isLogin ? 'Ещё нет аккаунта? ' : 'Уже есть аккаунт? '}
          <button onClick={() => go(isLogin ? 'register' : 'login')} style={linkButton}>{isLogin ? 'Создать' : 'Войти'}</button>
        </span>
        {isLogin && (
          <button
            onClick={async () => {
              if (!email) { setError('Введите почту, чтобы сбросить пароль'); return; }
              setLoading(true);
              const { error: e } = await supabase.auth.resetPasswordForEmail(
                email.toLowerCase().trim(),
                { redirectTo: window.location.origin + window.location.pathname }
              );
              setLoading(false);
              if (e) setError(e.message);
              else setInfo('Письмо для сброса пароля отправлено.');
            }}
            style={{ ...linkButton, fontSize: 13, color: 'var(--text-muted)' }}
          >
            Забыли пароль?
          </button>
        )}
      </div>
    </div>
  );
}
