import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Search, MessageCircle } from 'lucide-react';
import { supabase } from '../supabase';

interface Props {
  userId: string;
  onBack: () => void;
  initialRecipientId?: string;
}

interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar: string;
}

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

interface Conversation {
  profile: Profile;
  lastMessage: string;
  lastTime: string;
  unread: number;
}

const vibe = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };
const fmt = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'только что';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} мин`;
  if (diff < 86400000) return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' });
};

export default function MessagesView({ userId, onBack, initialRecipientId }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadConversations(); }, []);

  useEffect(() => {
    if (initialRecipientId) {
      loadProfile(initialRecipientId).then(p => { if (p) openConversation(p); });
    }
  }, [initialRecipientId]);

  useEffect(() => {
    if (!activeConv) return;
    const channel = supabase
      .channel(`messages:${userId}:${activeConv.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `recipient_id=eq.${userId}`,
      }, payload => {
        const msg = payload.new as Message;
        if (msg.sender_id === activeConv.id) {
          setMessages(prev => [...prev, msg]);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConv, userId]);

  const loadProfile = async (id: string): Promise<Profile | null> => {
    const { data } = await supabase.from('social_profiles').select('id,username,display_name,avatar').eq('id', id).single();
    return data as Profile | null;
  };

  const loadConversations = async () => {
    setLoading(true);
    try {
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (!msgs || msgs.length === 0) { setLoading(false); return; }

      const partnerIds = [...new Set(msgs.map((m: Message) =>
        m.sender_id === userId ? m.recipient_id : m.sender_id
      ))];

      const { data: profiles } = await supabase
        .from('social_profiles')
        .select('id,username,display_name,avatar')
        .in('id', partnerIds);

      const convMap = new Map<string, Conversation>();
      for (const msg of msgs as Message[]) {
        const partnerId = msg.sender_id === userId ? msg.recipient_id : msg.sender_id;
        if (!convMap.has(partnerId)) {
          const profile = (profiles as Profile[])?.find(p => p.id === partnerId);
          if (profile) {
            const unread = (msgs as Message[]).filter(m =>
              m.sender_id === partnerId && m.recipient_id === userId && !m.is_read
            ).length;
            convMap.set(partnerId, {
              profile,
              lastMessage: msg.content,
              lastTime: fmt(msg.created_at),
              unread,
            });
          }
        }
      }
      setConversations(Array.from(convMap.values()));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const openConversation = async (profile: Profile) => {
    setActiveConv(profile);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${userId},recipient_id.eq.${profile.id}),and(sender_id.eq.${profile.id},recipient_id.eq.${userId})`)
      .order('created_at', { ascending: true });
    setMessages((data as Message[]) || []);
    await supabase.from('messages').update({ is_read: true })
      .eq('sender_id', profile.id).eq('recipient_id', userId);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const sendMessage = async () => {
    if (!text.trim() || !activeConv) return;
    const content = text.trim();
    setText('');
    vibe(8);
    const tempMsg: Message = {
      id: Date.now().toString(),
      sender_id: userId,
      recipient_id: activeConv.id,
      content,
      created_at: new Date().toISOString(),
      is_read: false,
    };
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    await supabase.from('messages').insert({
      sender_id: userId,
      recipient_id: activeConv.id,
      content,
      is_read: false,
    });
  };

  const searchPeople = async (q: string) => {
    setSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const { data } = await supabase
      .from('social_profiles')
      .select('id,username,display_name,avatar')
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .neq('id', userId)
      .limit(10);
    setSearchResults((data as Profile[]) || []);
  };

  const avatarEl = (p: Profile, size = 44) => (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg,#d4914a,#8a5220)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, flexShrink: 0, overflow: 'hidden',
      border: '2px solid var(--border)',
    }}>
      {p.avatar?.startsWith('data:') || p.avatar?.startsWith('http')
        ? <img src={p.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
        : (p.avatar || p.username?.[0]?.toUpperCase() || '?')}
    </div>
  );

  /* ── Chat view ── */
  if (activeConv) return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px',
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <button onClick={() => { setActiveConv(null); loadConversations(); }} style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'var(--bg-raised)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--text-secondary)',
        }}><ArrowLeft size={18} /></button>
        {avatarEl(activeConv, 38)}
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Inter,sans-serif' }}>
            {activeConv.display_name || activeConv.username}
          </div>
          <div style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'Inter,sans-serif' }}>
            @{activeConv.username}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontFamily: 'Inter,sans-serif', fontSize: 14 }}>
            <MessageCircle size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <div>Начни разговор!</div>
          </div>
        )}
        {messages.map((msg, i) => {
          const isMine = msg.sender_id === userId;
          const showTime = i === 0 || new Date(msg.created_at).getTime() - new Date(messages[i-1].created_at).getTime() > 300000;
          return (
            <div key={msg.id}>
              {showTime && (
                <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter,sans-serif', margin: '8px 0' }}>
                  {fmt(msg.created_at)}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '75%', padding: '10px 14px',
                  borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: isMine
                    ? 'linear-gradient(135deg,#d4914a,#8a5220)'
                    : 'var(--bg-card)',
                  border: isMine ? 'none' : '1px solid var(--border)',
                  color: isMine ? '#fff' : 'var(--text-primary)',
                  fontSize: 15, fontFamily: 'Inter,sans-serif', lineHeight: 1.5,
                  animation: 'fadeSlideUp 0.2s ease',
                }}>
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 10,
        padding: '12px 16px',
        background: 'var(--bg-card)',
        borderTop: '1px solid var(--border)',
        flexShrink: 0,
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom,0px))',
      }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Написать сообщение..."
          rows={1}
          style={{
            flex: 1, padding: '10px 14px',
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            borderRadius: 18, color: 'var(--text-primary)',
            fontFamily: 'Inter,sans-serif', fontSize: 15,
            resize: 'none', outline: 'none', lineHeight: 1.5,
            maxHeight: 120, overflowY: 'auto',
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!text.trim()}
          style={{
            width: 42, height: 42, borderRadius: '50%',
            background: text.trim() ? 'var(--accent)' : 'var(--bg-raised)',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: text.trim() ? 'pointer' : 'default',
            color: text.trim() ? '#fff' : 'var(--text-muted)',
            transition: 'all 0.2s', flexShrink: 0,
          }}
        ><Send size={18} /></button>
      </div>
    </div>
  );

  /* ── Conversations list ── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px 10px',
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
          Сообщения
        </h2>
      </div>

      {/* Search */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => searchPeople(e.target.value)}
            placeholder="Найти человека..."
            style={{
              width: '100%', padding: '10px 12px 10px 36px',
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              borderRadius: 12, color: 'var(--text-primary)',
              fontFamily: 'Inter,sans-serif', fontSize: 14, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Search results */}
        {searchResults.length > 0 && (
          <div style={{
            marginTop: 8, background: 'var(--bg-card)',
            borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden',
          }}>
            {searchResults.map(p => (
              <button key={p.id} onClick={() => { setSearch(''); setSearchResults([]); openConversation(p); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', background: 'none', border: 'none',
                  borderBottom: '1px solid var(--border)', cursor: 'pointer',
                  textAlign: 'left',
                }}
                onPointerDown={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
                onPointerUp={e => (e.currentTarget.style.background = 'none')}
              >
                {avatarEl(p, 38)}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Inter,sans-serif' }}>
                    {p.display_name || p.username}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'Inter,sans-serif' }}>@{p.username}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Conversations */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Inter,sans-serif', fontSize: 14 }}>
            Загрузка...
          </div>
        )}
        {!loading && conversations.length === 0 && (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <MessageCircle size={48} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: 16 }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'Lora,serif', marginBottom: 8 }}>
              Нет сообщений
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'Inter,sans-serif' }}>
              Найди человека через поиск выше и начни разговор
            </div>
          </div>
        )}
        {conversations.map(conv => (
          <button
            key={conv.profile.id}
            onClick={() => openConversation(conv.profile)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px', background: 'none', border: 'none',
              borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left',
            }}
            onPointerDown={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
            onPointerUp={e => (e.currentTarget.style.background = 'none')}
          >
            {avatarEl(conv.profile)}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Inter,sans-serif' }}>
                  {conv.profile.display_name || conv.profile.username}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter,sans-serif' }}>
                  {conv.lastTime}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontSize: 13, color: 'var(--text-muted)', fontFamily: 'Inter,sans-serif',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%',
                }}>
                  {conv.lastMessage}
                </span>
                {conv.unread > 0 && (
                  <span style={{
                    minWidth: 20, height: 20, borderRadius: 10,
                    background: 'var(--accent)', color: '#fff',
                    fontSize: 11, fontWeight: 700, fontFamily: 'Inter,sans-serif',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 6px',
                  }}>{conv.unread}</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
