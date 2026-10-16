import { useState, useEffect, useCallback } from 'react';
import { Bell, Heart, MessageCircle, UserPlus, BookOpen, ArrowLeft, Check, CheckCheck } from 'lucide-react';
import { supabase } from '../supabase';
import type { User } from '../types';

const vibe = (ms = 8) => navigator.vibrate?.(ms);

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'daily_review';
  fromUser?: { username: string; display_name?: string; avatar?: string };
  postTitle?: string;
  message?: string;
  isRead: boolean;
  createdAt: string;
}

interface Props {
  user: User;
  onBack: () => void;
}

const TYPE_CONFIG = {
  like:         { icon: <Heart size={16} fill="currentColor" />, color: '#e74c3c', label: 'лайкнул(а) вашу запись' },
  comment:      { icon: <MessageCircle size={16} />, color: '#3498db', label: 'прокомментировал(а)' },
  follow:       { icon: <UserPlus size={16} />, color: '#2ecc71', label: 'подписался(лась) на вас' },
  daily_review: { icon: <BookOpen size={16} />, color: '#d4a060', label: 'Daily Review' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}д назад`;
  if (h > 0) return `${h}ч назад`;
  if (m > 0) return `${m}м назад`;
  return 'только что';
}

export default function NotificationsView({ user, onBack }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('notifications')
        .select(`
          *,
          from_profile:social_profiles!from_user_id(username, display_name, avatar)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) {
        const mapped = data.map((n: Record<string, unknown>) => ({
          id: n.id as string,
          type: n.type as Notification['type'],
          fromUser: n.from_profile as Notification['fromUser'],
          postTitle: n.message as string | undefined,
          message: n.message as string | undefined,
          isRead: n.is_read as boolean,
          createdAt: n.created_at as string,
        }));
        setNotifications(mapped);
        setUnreadCount(mapped.filter(n => !n.isRead).length);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    loadNotifications();

    // Realtime подписка
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        loadNotifications();
        vibe(12);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user.id, loadNotifications]);

  const markAllRead = async () => {
    vibe(8);
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  };

  const markRead = async (id: string) => {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* ignore */ }
  };

  // Если пусто — добавим примеры для нового пользователя
  const isEmpty = !loading && notifications.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)' }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 12px',
        background: 'var(--bg-base)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12,
        paddingTop: 'calc(16px + env(safe-area-inset-top))',
      }}>
        <button
          onClick={() => { vibe(6); onBack(); }}
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-primary)', flexShrink: 0,
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Lora, serif', margin: 0 }}>
            Уведомления
          </h2>
          {unreadCount > 0 && (
            <p style={{ fontSize: 12, color: 'var(--accent)', margin: 0 }}>{unreadCount} непрочитанных</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            style={{
              padding: '6px 12px', borderRadius: 8,
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <CheckCheck size={14} /> Все прочитано
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            Загрузка...
          </div>
        )}

        {isEmpty && (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔔</div>
            <p style={{ fontSize: 16, color: 'var(--text-primary)', fontFamily: 'Lora, serif', fontWeight: 600, marginBottom: 8 }}>
              Пока тихо
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Когда кто-то лайкнет или прокомментирует вашу запись — уведомление появится здесь
            </p>
          </div>
        )}

        {notifications.map((n, idx) => {
          const conf = TYPE_CONFIG[n.type] || TYPE_CONFIG.like;
          const name = n.fromUser?.display_name || n.fromUser?.username || 'Кто-то';
          const av = n.fromUser?.avatar;
          const initial = name[0]?.toUpperCase() || '?';

          return (
            <button
              key={n.id}
              onClick={() => { vibe(6); !n.isRead && markRead(n.id); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'flex-start',
                gap: 12, padding: '12px 16px', border: 'none', cursor: 'pointer',
                background: n.isRead ? 'transparent' : 'var(--accent-muted)',
                borderBottom: '1px solid var(--border)',
                animation: `fadeSlideUp 0.3s ease ${idx * 0.05}s both`,
                textAlign: 'left',
              }}
            >
              {/* Avatar */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: av && av.startsWith('data:') ? 'none' : 'linear-gradient(135deg, #d4a060, #8a5220)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 700, color: '#fff', overflow: 'hidden',
                  border: '2px solid var(--border)',
                }}>
                  {av
                    ? av.startsWith('data:')
                      ? <img src={av} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 22 }}>{av}</span>
                    : initial
                  }
                </div>
                <div style={{
                  position: 'absolute', bottom: -2, right: -2,
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'var(--bg-base)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%',
                    background: conf.color + '22',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: conf.color,
                  }}>
                    {conf.icon}
                  </div>
                </div>
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, color: 'var(--text-primary)', margin: 0, lineHeight: 1.5, fontFamily: 'Inter, sans-serif' }}>
                  <strong>{name}</strong> {conf.label}
                  {n.postTitle && <> «<em>{n.postTitle.slice(0, 40)}</em>»</>}
                </p>
                {n.message && n.type === 'daily_review' && (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.5 }}>
                    {n.message}
                  </p>
                )}
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  {timeAgo(n.createdAt)}
                </p>
              </div>

              {!n.isRead && (
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 4 }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Daily Review hint */}
      <div style={{
        padding: '12px 16px',
        background: 'var(--bg-raised)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--accent-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent)', flexShrink: 0,
          }}>
            <Bell size={18} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, fontFamily: 'Inter, sans-serif' }}>
              Daily Review
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              Каждый день вы будете получать случайную запись из прошлого
            </p>
          </div>
          <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
            <Check size={16} color="var(--accent)" />
          </div>
        </div>
      </div>
    </div>
  );
}
