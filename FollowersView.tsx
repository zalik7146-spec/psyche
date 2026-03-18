import { useState, useEffect } from 'react';
import { ArrowLeft, MessageCircle, UserMinus } from 'lucide-react';
import { supabase } from '../supabase';

interface Props {
  userId: string;
  initialTab?: 'followers' | 'following';
  onBack: () => void;
  onOpenMessages: (recipientId: string) => void;
}

interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar: string;
  bio: string;
  followers_count: number;
  posts_count: number;
}

const vibe = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };

export default function FollowersView({ userId, initialTab = 'followers', onBack, onOpenMessages }: Props) {
  const [tab, setTab] = useState<'followers' | 'following'>(initialTab);
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [following, setFollowing] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [myFollowing, setMyFollowing] = useState<Set<string>>(new Set());

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      // Load followers (people who follow me)
      const { data: followerLinks } = await supabase
        .from('social_follows')
        .select('follower_id')
        .eq('following_id', userId);

      const followerIds = (followerLinks || []).map((f: any) => f.follower_id);
      if (followerIds.length > 0) {
        const { data: followerProfiles } = await supabase
          .from('social_profiles')
          .select('id,username,display_name,avatar,bio,followers_count,posts_count')
          .in('id', followerIds);
        setFollowers((followerProfiles as Profile[]) || []);
      }

      // Load following (people I follow)
      const { data: followingLinks } = await supabase
        .from('social_follows')
        .select('following_id')
        .eq('follower_id', userId);

      const followingIds = (followingLinks || []).map((f: any) => f.following_id);
      setMyFollowing(new Set(followingIds));

      if (followingIds.length > 0) {
        const { data: followingProfiles } = await supabase
          .from('social_profiles')
          .select('id,username,display_name,avatar,bio,followers_count,posts_count')
          .in('id', followingIds);
        setFollowing((followingProfiles as Profile[]) || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const unfollow = async (targetId: string) => {
    vibe(10);
    await supabase.from('social_follows')
      .delete()
      .eq('follower_id', userId)
      .eq('following_id', targetId);
    setMyFollowing(prev => { const s = new Set(prev); s.delete(targetId); return s; });
    setFollowing(prev => prev.filter(p => p.id !== targetId));
  };

  const follow = async (targetId: string) => {
    vibe(10);
    await supabase.from('social_follows').insert({ follower_id: userId, following_id: targetId });
    setMyFollowing(prev => new Set([...prev, targetId]));
  };

  const avatarEl = (p: Profile) => (
    <div style={{
      width: 48, height: 48, borderRadius: '50%',
      background: 'linear-gradient(135deg,#d4914a,#8a5220)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 20, flexShrink: 0, overflow: 'hidden',
      border: '2px solid var(--border)',
    }}>
      {p.avatar?.startsWith('data:') || p.avatar?.startsWith('http')
        ? <img src={p.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
        : (p.avatar || p.username?.[0]?.toUpperCase() || '?')}
    </div>
  );

  const list = tab === 'followers' ? followers : following;

  const ProfileCard = ({ p }: { p: Profile }) => {
    const isFollowing = myFollowing.has(p.id);
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px',
        borderBottom: '1px solid var(--border)',
        animation: 'fadeSlideUp 0.25s ease both',
      }}>
        {avatarEl(p)}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Inter,sans-serif' }}>
            {p.display_name || p.username}
          </div>
          <div style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'Inter,sans-serif', marginBottom: 2 }}>
            @{p.username}
          </div>
          {p.bio && (
            <div style={{
              fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Inter,sans-serif',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{p.bio}</div>
          )}
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter,sans-serif' }}>
              {p.followers_count} читателей
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter,sans-serif' }}>
              {p.posts_count} публикаций
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => onOpenMessages(p.id)}
            style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-secondary)',
            }}
          ><MessageCircle size={16} /></button>
          {p.id !== userId && (
            <button
              onClick={() => isFollowing ? unfollow(p.id) : follow(p.id)}
              style={{
                height: 34, padding: '0 12px', borderRadius: 10,
                background: isFollowing ? 'var(--bg-raised)' : 'var(--accent)',
                border: `1px solid ${isFollowing ? 'var(--border)' : 'var(--accent)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                color: isFollowing ? 'var(--text-secondary)' : '#fff',
                fontSize: 12, fontWeight: 600, fontFamily: 'Inter,sans-serif',
                gap: 4,
              }}
            >
              {isFollowing ? <><UserMinus size={14} /> Отписаться</> : 'Читать'}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px 0',
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <button onClick={onBack} style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'var(--bg-raised)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--text-secondary)',
        }}><ArrowLeft size={18} /></button>
        <h2 style={{ flex: 1, margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Lora,serif' }}>
          Подписки
        </h2>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        {(['followers', 'following'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '14px 0',
            background: 'none', border: 'none',
            borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: 14, fontWeight: tab === t ? 700 : 400,
            fontFamily: 'Inter,sans-serif', cursor: 'pointer',
            transition: 'all 0.2s',
          }}>
            {t === 'followers' ? `Читатели (${followers.length})` : `Читаю (${following.length})`}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Inter,sans-serif', fontSize: 14 }}>
            Загрузка...
          </div>
        )}
        {!loading && list.length === 0 && (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'Lora,serif', marginBottom: 8 }}>
              {tab === 'followers' ? 'Нет читателей' : 'Вы никого не читаете'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'Inter,sans-serif' }}>
              {tab === 'followers' ? 'Публикуй интересный контент!' : 'Найди интересных людей в сообществе'}
            </div>
          </div>
        )}
        {list.map(p => <ProfileCard key={p.id} p={p} />)}
      </div>
    </div>
  );
}
