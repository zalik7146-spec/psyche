import { useState, useEffect, useRef } from 'react';
import {
  Mail, Lock, User, Eye, EyeOff, ArrowRight, ChevronLeft,
  BookOpen, Feather, Search, Bookmark, Sparkles, Cloud, RefreshCw,
} from 'lucide-react';
import { supabase } from '../supabase';
import { User as UserType } from '../types';

interface Props { onAuth: (user: UserType) => void; }
type Mode = 'welcome' | 'login' | 'register' | 'confirm';

const CARDS = [
  {
    type: 'quote',
    icon: '❝',
    text: 'Между стимулом и реакцией есть пространство. В этом пространстве — наша сила.',
    source: 'Виктор Франкл',
    book: 'Человек в поисках смысла',
    color: '#c4813c',
  },
  {
    type: 'insight',
    icon: '💡',
    text: 'Травма — это не то, что произошло с вами, а то, что произошло внутри вас в ответ на произошедшее.',
    source: 'Габор Матэ',
    book: 'Когда тело говорит «нет»',
    color: '#6a9e8a',
  },
  {
    type: 'note',
    icon: '✍️',
    text: 'Система 1 мыслит быстро, автоматически. Система 2 — медленно, с усилием. Большинство ошибок — из-за доверия системе 1.',
    source: 'Инсайт • сегодня',
    book: 'Мышление быстрое и медленное',
    color: '#8a7a4a',
  },
  {
    type: 'idea',
    icon: '🌱',
    text: 'Резилентность — не устойчивость к потрясениям, а способность восстанавливаться и расти после них.',
    source: 'Ключевая идея',
    book: 'Личная запись',
    color: '#6a8a9a',
  },
  {
    type: 'question',
    icon: '🔍',
    text: 'Что если тревога — это не враг, а информация? Что она пытается сообщить мне прямо сейчас?',
    source: 'Вопрос для рефлексии',
    book: 'Дневник практики',
    color: '#9a7a8a',
  },
];

const FEATURES = [
  { icon: <BookOpen size={18} />, title: 'Библиотека книг', desc: 'Организуй книги, следи за прогрессом' },
  { icon: <Feather size={18} />, title: 'Умные заметки', desc: 'Цитаты, инсайты, идеи с форматированием' },
  { icon: <Search size={18} />, title: 'Мгновенный поиск', desc: 'Находи любую мысль за секунду' },
  { icon: <Bookmark size={18} />, title: 'Теги и группировка', desc: 'Связывай идеи между книгами' },
  { icon: <Cloud size={18} />, title: 'Облачное хранилище', desc: 'Данные синхронизированы в Supabase' },
  { icon: <Sparkles size={18} />, title: '3 темы оформления', desc: 'Тёмная, светлая, сепия' },
];

function AnimatedCard({ card, isActive }: { card: typeof CARDS[0]; isActive: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity: isActive ? 1 : 0,
        transform: isActive ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.97)',
        transition: 'opacity 0.65s cubic-bezier(0.22,1,0.36,1), transform 0.65s cubic-bezier(0.22,1,0.36,1)',
        pointerEvents: isActive ? 'auto' : 'none',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '10px',
      }}
    >
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        color: card.color, fontSize: '11px', fontWeight: 600,
        fontFamily: 'Inter, sans-serif', letterSpacing: '0.04em',
        textTransform: 'uppercase', opacity: 0.9,
      }}>
        <BookOpen size={11} />
        {card.book}
      </div>

      <div style={{
        fontSize: '0.97rem', lineHeight: 1.78,
        fontFamily: 'Lora, Georgia, serif',
        color: 'var(--text-primary)',
        fontStyle: card.type === 'quote' ? 'italic' : 'normal',
      }}>
        {card.type === 'quote' ? `«${card.text}»` : card.text}
      </div>

      <div style={{
        fontSize: '12px', color: 'var(--text-muted)',
        fontFamily: 'Inter, sans-serif',
        display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        <span style={{ color: card.color, fontSize: '15px' }}>{card.icon}</span>
        {card.source}
      </div>
    </div>
  );
}

function Field({ label, icon, children }: {
  label: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: '12px', fontWeight: 500,
        color: 'var(--text-muted)', marginBottom: '6px',
        fontFamily: 'Inter, sans-serif',
      }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute', left: '14px', top: '50%',
          transform: 'translateY(-50%)', color: 'var(--text-muted)',
          pointerEvents: 'none',
        }}>
          {icon}
        </div>
        {children}
      </div>
    </div>
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
  const [cardIdx, setCardIdx]   = useState(0);
  const [progress, setProgress] = useState(0);
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check Supabase connection
  useEffect(() => {
    supabase.auth.getSession().then(({ error: err }) => {
      setCloudStatus(err ? 'error' : 'ok');
    });
  }, []);

  // Card carousel
  useEffect(() => {
    if (mode !== 'welcome') return;
    setProgress(0);
    const DURATION = 5000;
    const TICK = 50;

    progressRef.current = setInterval(() => {
      setProgress(p => p >= 100 ? 0 : p + (TICK / DURATION) * 100);
    }, TICK);

    intervalRef.current = setInterval(() => {
      setCardIdx(i => (i + 1) % CARDS.length);
      setProgress(0);
    }, DURATION);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [mode]);

  const goToCard = (i: number) => {
    setCardIdx(i);
    setProgress(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (progressRef.current) clearInterval(progressRef.current);
    const TICK = 50;
    const DURATION = 5000;
    progressRef.current = setInterval(() => {
      setProgress(p => p >= 100 ? 0 : p + (TICK / DURATION) * 100);
    }, TICK);
    intervalRef.current = setInterval(() => {
      setCardIdx(prev => (prev + 1) % CARDS.length);
      setProgress(0);
    }, DURATION);
  };

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
      setError('Введите email чтобы отправить письмо повторно');
      return;
    }
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email.toLowerCase().trim(),
        options: { emailRedirectTo: window.location.origin + window.location.pathname },
      });
      if (resendError) {
        setError(resendError.message);
      } else {
        setInfo('✓ Письмо отправлено повторно. Проверьте входящие и папку «Спам».');
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

  /* ── Экран подтверждения email ──────────────────────────────────── */
  if (mode === 'confirm') {
    return (
      <div className="auth-page" style={{ padding: '0 22px' }}>
        <div style={{
          paddingTop: 'calc(env(safe-area-inset-top,0px) + 48px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '0', textAlign: 'center',
        }}>
          {/* Иконка */}
          <div style={{
            width: 80, height: 80, borderRadius: '24px',
            background: 'linear-gradient(135deg, rgba(196,129,60,0.15), rgba(196,129,60,0.08))',
            border: '1px solid rgba(196,129,60,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '24px',
            boxShadow: '0 8px 32px rgba(196,129,60,0.15)',
          }}>
            <Mail size={36} style={{ color: 'var(--accent)' }} strokeWidth={1.5} />
          </div>

          <h2 className="font-serif" style={{
            fontSize: '1.4rem', fontWeight: 700,
            color: 'var(--text-primary)', margin: '0 0 10px',
          }}>
            Подтвердите email
          </h2>

          <p style={{
            fontSize: '14px', lineHeight: 1.7,
            color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif',
            margin: '0 0 6px', maxWidth: '320px',
          }}>
            Мы отправили письмо на
          </p>

          <div style={{
            padding: '8px 16px', borderRadius: '10px', marginBottom: '16px',
            background: 'var(--bg-raised)', border: '1px solid var(--border-mid)',
          }}>
            <span style={{
              fontSize: '14px', fontWeight: 600,
              color: 'var(--accent)', fontFamily: 'Inter, sans-serif',
            }}>
              {email || 'ваш email'}
            </span>
          </div>

          <p style={{
            fontSize: '13px', lineHeight: 1.7,
            color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif',
            margin: '0 0 32px', maxWidth: '300px',
          }}>
            Откройте письмо и нажмите на кнопку «Подтвердить». После этого нажмите кнопку ниже для входа.
          </p>

          {/* Шаги */}
          {[
            { n: '1', text: 'Откройте почту' },
            { n: '2', text: 'Найдите письмо от Psyche (проверьте Спам)' },
            { n: '3', text: 'Нажмите «Подтвердить email» в письме' },
            { n: '4', text: 'Вернитесь сюда и нажмите «Я подтвердил»' },
          ].map(step => (
            <div key={step.n} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              width: '100%', maxWidth: '320px',
              padding: '10px 14px', borderRadius: '12px',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              marginBottom: '8px', textAlign: 'left',
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                background: 'var(--accent)', color: '#0e0c09',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700, fontFamily: 'Inter, sans-serif',
              }}>
                {step.n}
              </div>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}>
                {step.text}
              </span>
            </div>
          ))}

          {/* Ошибки / инфо */}
          {error && (
            <div style={{
              width: '100%', maxWidth: '320px',
              padding: '12px 14px', borderRadius: '12px', marginTop: '12px',
              background: 'rgba(196,72,72,0.12)', color: 'var(--red)',
              border: '1px solid rgba(196,72,72,0.25)',
              fontSize: '13px', fontFamily: 'Inter, sans-serif', textAlign: 'left',
            }}>
              {error}
            </div>
          )}
          {info && (
            <div style={{
              width: '100%', maxWidth: '320px',
              padding: '12px 14px', borderRadius: '12px', marginTop: '12px',
              background: 'rgba(100,180,120,0.12)', color: '#6ab47a',
              border: '1px solid rgba(100,180,120,0.25)',
              fontSize: '13px', fontFamily: 'Inter, sans-serif', textAlign: 'left',
            }}>
              {info}
            </div>
          )}

          {/* Кнопки */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '320px', marginTop: '20px' }}>
            <button
              onClick={handleCheckSession}
              disabled={loading}
              style={{
                width: '100%', padding: '16px',
                borderRadius: '18px', border: 'none',
                background: loading ? 'var(--bg-active)' : 'linear-gradient(135deg, var(--accent), var(--accent-soft))',
                color: loading ? 'var(--text-muted)' : '#0e0c09',
                fontWeight: 700, fontSize: '15px', fontFamily: 'Inter, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? <div className="spinner" /> : <>Я подтвердил — войти <ArrowRight size={18} /></>}
            </button>

            <button
              onClick={handleResendEmail}
              disabled={loading}
              style={{
                width: '100%', padding: '14px',
                borderRadius: '18px',
                border: '1px solid var(--border-mid)',
                background: 'var(--bg-raised)',
                color: 'var(--text-secondary)', fontWeight: 500, fontSize: '14px',
                fontFamily: 'Inter, sans-serif', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              <RefreshCw size={15} />
              Отправить письмо повторно
            </button>

            <button
              onClick={() => { setMode('login'); setError(''); setInfo(''); }}
              style={{
                background: 'none', border: 'none',
                color: 'var(--text-muted)', fontSize: '13px',
                fontFamily: 'Inter, sans-serif', cursor: 'pointer',
                padding: '8px',
                marginBottom: 'calc(env(safe-area-inset-bottom,0px) + 20px)',
              }}
            >
              ← Вернуться к форме входа
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Welcome ─────────────────────────────────────────────────── */
  if (mode === 'welcome') {
    return (
      <div className="auth-page">

        {/* Logo */}
        <div style={{
          padding: 'calc(env(safe-area-inset-top,0px) + 36px) 24px 0',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
        }}>
          <div className="fade-in" style={{
            width: 74, height: 74, borderRadius: '24px',
            background: 'linear-gradient(135deg, var(--bg-raised), var(--bg-active))',
            border: '1px solid var(--border-mid)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            <Feather size={34} style={{ color: 'var(--accent)' }} strokeWidth={1.5} />
          </div>

          <div className="fade-in delay-1" style={{ textAlign: 'center' }}>
            <h1 className="gradient-text" style={{
              fontSize: '2.1rem', fontWeight: 700,
              fontFamily: 'Lora, Georgia, serif',
              margin: 0, lineHeight: 1.2,
            }}>
              Psyche
            </h1>
            <p style={{
              margin: '5px 0 0', fontSize: '13px',
              color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif',
              letterSpacing: '0.05em',
            }}>
              Дневник Разума
            </p>
            {/* Cloud status badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              marginTop: '8px', padding: '4px 10px', borderRadius: '99px',
              background: cloudStatus === 'ok' ? 'rgba(100,180,120,0.12)' : 'rgba(180,120,60,0.12)',
              border: `1px solid ${cloudStatus === 'ok' ? 'rgba(100,180,120,0.3)' : 'rgba(180,120,60,0.3)'}`,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: cloudStatus === 'ok' ? '#6ab47a' : '#c4813c',
              }} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
                {cloudStatus === 'ok' ? 'Облако подключено' : 'Подключение...'}
              </span>
            </div>
          </div>
        </div>

        {/* Carousel */}
        <div className="fade-in delay-2" style={{
          margin: '22px 18px 0',
          borderRadius: '20px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-mid)',
          height: 205,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: 'var(--shadow)',
          flexShrink: 0,
        }}>
          {/* top accent line */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
            background: `linear-gradient(90deg, ${CARDS[cardIdx].color}, transparent)`,
            transition: 'background 0.6s ease',
          }} />

          {CARDS.map((card, i) => (
            <AnimatedCard key={i} card={card} isActive={i === cardIdx} />
          ))}

          {/* Dots */}
          <div style={{
            position: 'absolute', bottom: 12, left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex', gap: '6px', alignItems: 'center',
          }}>
            {CARDS.map((_, i) => (
              <button
                key={i}
                onClick={() => goToCard(i)}
                style={{
                  width: i === cardIdx ? 20 : 6,
                  height: 6, borderRadius: 99,
                  background: i === cardIdx ? CARDS[cardIdx].color : 'var(--border-mid)',
                  border: 'none', cursor: 'pointer',
                  transition: 'all 0.4s cubic-bezier(0.22,1,0.36,1)',
                  padding: 0, overflow: 'hidden', position: 'relative',
                }}
              >
                {i === cardIdx && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, bottom: 0,
                    width: `${progress}%`,
                    background: 'rgba(255,255,255,0.35)',
                    transition: 'none',
                  }} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="fade-in delay-3" style={{
          margin: '18px 18px 0',
          display: 'flex', flexDirection: 'column', gap: '7px',
        }}>
          {FEATURES.map((f, i) => (
            <div key={i} className="card-hover" style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 13px', borderRadius: '14px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: '10px',
                background: 'var(--bg-active)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--accent)', flexShrink: 0,
              }}>
                {f.icon}
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}>
                  {f.title}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', fontFamily: 'Inter, sans-serif' }}>
                  {f.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="fade-in delay-5" style={{
          margin: '20px 18px',
          marginBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          <button
            onClick={() => setMode('register')}
            style={{
              width: '100%', padding: '16px',
              borderRadius: '18px', border: 'none',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-soft))',
              color: '#0e0c09', fontWeight: 700, fontSize: '15px',
              fontFamily: 'Inter, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              cursor: 'pointer', boxShadow: '0 4px 20px var(--accent-glow)',
              transition: 'transform 0.15s',
            }}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.97)')}
            onTouchEnd={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            Начать бесплатно
            <ArrowRight size={18} />
          </button>

          <button
            onClick={() => setMode('login')}
            style={{
              width: '100%', padding: '15px',
              borderRadius: '18px',
              border: '1px solid var(--border-mid)',
              background: 'var(--bg-raised)',
              color: 'var(--text-primary)', fontWeight: 500, fontSize: '15px',
              fontFamily: 'Inter, sans-serif', cursor: 'pointer',
              transition: 'transform 0.15s',
            }}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.97)')}
            onTouchEnd={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            Войти в аккаунт
          </button>

          <p style={{
            textAlign: 'center', fontSize: '11px',
            color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif',
            margin: '2px 0 0',
          }}>
            ☁️ Данные синхронизируются в облаке Supabase
          </p>
        </div>
      </div>
    );
  }

  /* ── Login / Register ────────────────────────────────────────── */
  return (
    <div className="auth-page" style={{ padding: '0 22px' }}>
      {/* Back + title */}
      <div style={{
        paddingTop: 'calc(env(safe-area-inset-top,0px) + 24px)',
        display: 'flex', alignItems: 'center', gap: '12px',
        marginBottom: '30px',
      }}>
        <button
          onClick={() => { setMode('welcome'); setError(''); setInfo(''); }}
          style={{
            width: 42, height: 42, borderRadius: '13px',
            background: 'var(--bg-raised)', border: '1px solid var(--border-mid)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0,
            transition: 'transform 0.15s',
          }}
          onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.9)')}
          onTouchEnd={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h2 className="font-serif" style={{
            fontSize: '1.3rem', fontWeight: 700,
            color: 'var(--text-primary)', margin: 0,
          }}>
            {mode === 'login' ? 'Добро пожаловать' : 'Создать аккаунт'}
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
            {mode === 'login' ? 'Войдите в Psyche' : 'Присоединяйтесь к Psyche'}
          </p>
        </div>
      </div>

      {/* Cloud indicator */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '10px 14px', borderRadius: '12px', marginBottom: '20px',
        background: 'rgba(100,180,120,0.08)',
        border: '1px solid rgba(100,180,120,0.2)',
      }}>
        <Cloud size={14} style={{ color: '#6ab47a', flexShrink: 0 }} />
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
          Ваши данные сохраняются в облаке и доступны на всех устройствах
        </span>
      </div>

      {/* Form */}
      <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {mode === 'register' && (
          <Field label="Ваше имя" icon={<User size={15} />}>
            <input
              className="input-base"
              style={{ paddingLeft: '42px' }}
              placeholder="Имя или псевдоним"
              value={name}
              onChange={e => setName(e.target.value)}
              autoComplete="name"
            />
          </Field>
        )}

        <Field label="Email" icon={<Mail size={15} />}>
          <input
            className="input-base"
            style={{ paddingLeft: '42px' }}
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="email"
          />
        </Field>

        <Field label="Пароль" icon={<Lock size={15} />}>
          <input
            className="input-base"
            style={{ paddingLeft: '42px', paddingRight: '48px' }}
            type={showPass ? 'text' : 'password'}
            placeholder={mode === 'register' ? 'Минимум 6 символов' : 'Ваш пароль'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          <button
            type="button"
            onClick={() => setShowPass(v => !v)}
            style={{
              position: 'absolute', right: '14px', top: '50%',
              transform: 'translateY(-50%)',
              background: 'none', border: 'none',
              color: 'var(--text-muted)', cursor: 'pointer', padding: '4px',
            }}
          >
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </Field>

        {error && (
          <div style={{
            padding: '12px 14px', borderRadius: '12px', fontSize: '13px',
            background: 'rgba(196,72,72,0.12)', color: 'var(--red)',
            border: '1px solid rgba(196,72,72,0.25)',
            fontFamily: 'Inter, sans-serif',
          }}>
            {error}
          </div>
        )}

        {info && (
          <div style={{
            padding: '12px 14px', borderRadius: '12px', fontSize: '13px',
            background: 'rgba(100,180,120,0.12)', color: '#6ab47a',
            border: '1px solid rgba(100,180,120,0.25)',
            fontFamily: 'Inter, sans-serif',
          }}>
            {info}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%', padding: '16px',
            borderRadius: '18px', border: 'none',
            background: loading
              ? 'var(--bg-active)'
              : 'linear-gradient(135deg, var(--accent), var(--accent-soft))',
            color: loading ? 'var(--text-muted)' : '#0e0c09',
            fontWeight: 700, fontSize: '15px', fontFamily: 'Inter, sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'transform 0.15s', marginTop: '4px',
          }}
          onMouseDown={e => { if (!loading) e.currentTarget.style.transform = 'scale(0.97)'; }}
          onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          onTouchStart={e => { if (!loading) e.currentTarget.style.transform = 'scale(0.97)'; }}
          onTouchEnd={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          {loading ? (
            <div className="spinner" />
          ) : (
            <>
              {mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
              <ArrowRight size={18} />
            </>
          )}
        </button>

        {/* Переключение Login / Register */}
        <p style={{
          textAlign: 'center', fontSize: '13px',
          color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif',
          marginBottom: 'calc(env(safe-area-inset-bottom,0px) + 20px)',
        }}>
          {mode === 'login' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}{' '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setInfo(''); }}
            style={{
              background: 'none', border: 'none',
              color: 'var(--accent)', fontWeight: 600,
              cursor: 'pointer', padding: '0',
              fontSize: '13px', fontFamily: 'Inter, sans-serif',
            }}
          >
            {mode === 'login' ? 'Создать' : 'Войти'}
          </button>
        </p>

        {/* Забыли пароль */}
        {mode === 'login' && (
          <p style={{
            textAlign: 'center', fontSize: '12px',
            color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif',
            margin: '-10px 0 0',
          }}>
            <button
              onClick={async () => {
                if (!email) { setError('Введите email для сброса пароля'); return; }
                setLoading(true);
                const { error: e } = await supabase.auth.resetPasswordForEmail(
                  email.toLowerCase().trim(),
                  { redirectTo: window.location.origin + window.location.pathname }
                );
                setLoading(false);
                if (e) setError(e.message);
                else setInfo('✓ Письмо для сброса пароля отправлено');
              }}
              style={{
                background: 'none', border: 'none',
                color: 'var(--text-muted)', cursor: 'pointer',
                fontSize: '12px', fontFamily: 'Inter, sans-serif',
                textDecoration: 'underline',
              }}
            >
              Забыли пароль?
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
