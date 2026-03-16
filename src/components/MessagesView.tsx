import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabase'
import { ArrowLeft, Send, Search, MessageCircle } from 'lucide-react'

interface Profile {
  id: string
  username: string
  display_name: string
  avatar: string
}

interface Message {
  id: string
  from_user_id: string
  to_user_id: string
  content: string
  is_read: boolean
  created_at: string
}

interface Conversation {
  partner: Profile
  lastMessage: string
  lastTime: string
  unread: number
}

interface Props {
  userId: string
  onClose: () => void
  initialPartnerId?: string
}

const vibe = (ms = 8) => navigator.vibrate?.(ms)

const timeAgo = (iso: string) => {
  const d = new Date(iso)
  const now = new Date()
  const diff = (now.getTime() - d.getTime()) / 1000
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)}м`
  if (diff < 86400) return `${Math.floor(diff / 3600)}ч`
  if (diff < 172800) return 'вчера'
  return d.toLocaleDateString('ru', { day: '2-digit', month: '2-digit' })
}

const EMOJI = ['❤️', '🔥', '💡', '👍', '🙏', '😊', '✨', '💭']

export default function MessagesView({ userId, onClose, initialPartnerId }: Props) {
  const [view, setView] = useState<'list' | 'chat'>(initialPartnerId ? 'chat' : 'list')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [partner, setPartner] = useState<Profile | null>(null)
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [showEmoji, setShowEmoji] = useState(false)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const channelRef = useRef<any>(null)

  const loadConversations = useCallback(async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('created_at', { ascending: false })
    if (!data) return
    const partnerIds = [...new Set(data.map((m: Message) =>
      m.from_user_id === userId ? m.to_user_id : m.from_user_id
    ))]
    if (!partnerIds.length) return
    const { data: profiles } = await supabase
      .from('social_profiles')
      .select('id,username,display_name,avatar')
      .in('id', partnerIds)
    if (!profiles) return
    const convs: Conversation[] = partnerIds.map(pid => {
      const msgs = data.filter((m: Message) =>
        m.from_user_id === pid || m.to_user_id === pid
      )
      const last = msgs[0]
      const prof = profiles.find((p: Profile) => p.id === pid)
      const unread = msgs.filter((m: Message) =>
        m.from_user_id === pid && !m.is_read
      ).length
      return {
        partner: prof || { id: pid, username: '...', display_name: '...', avatar: '' },
        lastMessage: last?.content || '',
        lastTime: last ? timeAgo(last.created_at) : '',
        unread
      }
    })
    setConversations(convs)
  }, [userId])

  const openChat = useCallback(async (prof: Profile) => {
    setPartner(prof)
    setView('chat')
    vibe(6)
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(from_user_id.eq.${userId},to_user_id.eq.${prof.id}),and(from_user_id.eq.${prof.id},to_user_id.eq.${userId})`
      )
      .order('created_at', { ascending: true })
    setMessages(data || [])
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('from_user_id', prof.id)
      .eq('to_user_id', userId)
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }, 100)
    channelRef.current?.unsubscribe()
    channelRef.current = supabase
      .channel(`chat_${userId}_${prof.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `to_user_id=eq.${userId}`
      }, (payload: any) => {
        if (payload.new.from_user_id === prof.id) {
          setMessages(prev => [...prev, payload.new])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        }
      })
      .subscribe()
  }, [userId])

  useEffect(() => {
    loadConversations()
    if (initialPartnerId) {
      supabase
        .from('social_profiles')
        .select('id,username,display_name,avatar')
        .eq('id', initialPartnerId)
        .single()
        .then(({ data }) => { if (data) openChat(data) })
    }
    return () => { channelRef.current?.unsubscribe() }
  }, [loadConversations, initialPartnerId, openChat])

  const searchPeople = async (q: string) => {
    setSearch(q)
    if (q.length < 2) { setSearchResults([]); return }
    const { data } = await supabase
      .from('social_profiles')
      .select('id,username,display_name,avatar')
      .neq('id', userId)
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(8)
    setSearchResults(data || [])
  }

  const sendMsg = async () => {
    if (!text.trim() || !partner || sending) return
    setSending(true)
    vibe(8)
    const newMsg = {
      from_user_id: userId,
      to_user_id: partner.id,
      content: text.trim(),
      is_read: false,
      created_at: new Date().toISOString()
    }
    setMessages(prev => [...prev, { ...newMsg, id: Date.now().toString() }])
    setText('')
    setShowEmoji(false)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    const { error } = await supabase.from('messages').insert(newMsg)
    if (error) console.error('Send error:', error)
    setSending(false)
    loadConversations()
  }

  const addEmoji = (emoji: string) => {
    setText(prev => prev + emoji)
    inputRef.current?.focus()
  }

  const av = (p: Profile) => p.avatar
    ? (p.avatar.length === 2 || p.avatar.length === 1
      ? <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{p.avatar}</div>
      : <img src={p.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />)
    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>{(p.display_name || p.username || '?')[0].toUpperCase()}</div>

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column',
      maxWidth: 430, margin: '0 auto',
      animation: 'slideInRight 0.28s cubic-bezier(0.22,1,0.36,1)'
    }}>
      {view === 'list' ? (
        <>
          {/* Header */}
          <div style={{
            padding: '56px 20px 16px',
            background: 'var(--bg-raised)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <button onClick={() => { onClose(); vibe(6) }} style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-primary)'
              }}>
                <ArrowLeft size={16} />
              </button>
              <span style={{ fontFamily: 'Lora, serif', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                Сообщения
              </span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--bg-card)', borderRadius: 12,
              border: '1px solid var(--border)', padding: '10px 14px'
            }}>
              <Search size={15} color="var(--text-muted)" />
              <input
                value={search}
                onChange={e => searchPeople(e.target.value)}
                placeholder="Найти человека..."
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  color: 'var(--text-primary)', fontSize: 15
                }}
              />
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {search.length >= 2 ? (
              <>
                <div style={{ padding: '8px 20px 4px', fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Результаты поиска
                </div>
                {searchResults.length === 0
                  ? <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Никого не найдено</div>
                  : searchResults.map(p => (
                    <button key={p.id} onClick={() => { setSearch(''); setSearchResults([]); openChat(p) }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                        padding: '12px 20px', background: 'none', border: 'none',
                        cursor: 'pointer', textAlign: 'left',
                        transition: 'background 0.15s'
                      }}
                      onPointerDown={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
                      onPointerUp={e => (e.currentTarget.style.background = 'none')}
                    >
                      <div style={{ width: 46, height: 46, borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-card)', border: '2px solid var(--border)', flexShrink: 0 }}>
                        {av(p)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>{p.display_name || p.username}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>@{p.username}</div>
                      </div>
                    </button>
                  ))
                }
              </>
            ) : conversations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 32px', color: 'var(--text-muted)' }}>
                <MessageCircle size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Нет сообщений
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                  Найди человека через поиск и начни общение
                </div>
              </div>
            ) : (
              conversations.map((conv, i) => (
                <button key={conv.partner.id}
                  onClick={() => openChat(conv.partner)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 20px', background: 'none', border: 'none',
                    cursor: 'pointer', textAlign: 'left',
                    borderBottom: '1px solid var(--border)',
                    animation: `fadeSlideUp 0.3s ease both`,
                    animationDelay: `${i * 0.05}s`
                  }}
                  onPointerDown={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
                  onPointerUp={e => (e.currentTarget.style.background = 'none')}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: 50, height: 50, borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-card)', border: '2px solid var(--border)' }}>
                      {av(conv.partner)}
                    </div>
                    {conv.unread > 0 && (
                      <div style={{
                        position: 'absolute', top: -2, right: -2,
                        width: 18, height: 18, borderRadius: '50%',
                        background: 'var(--accent)', color: '#fff',
                        fontSize: 10, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '2px solid var(--bg-base)'
                      }}>{conv.unread}</div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>
                        {conv.partner.display_name || conv.partner.username}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                        {conv.lastTime}
                      </span>
                    </div>
                    <div style={{
                      fontSize: 13, color: conv.unread > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
                      fontWeight: conv.unread > 0 ? 600 : 400,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {conv.lastMessage || 'Начните общение'}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      ) : (
        <>
          {/* Chat Header */}
          <div style={{
            padding: '52px 16px 12px',
            background: 'var(--bg-raised)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 12
          }}>
            <button onClick={() => { setView('list'); setPartner(null); setMessages([]); vibe(6) }}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-primary)', flexShrink: 0
              }}>
              <ArrowLeft size={16} />
            </button>
            {partner && (
              <>
                <div style={{ width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-card)', border: '2px solid var(--border)', flexShrink: 0 }}>
                  {av(partner)}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>
                    {partner.display_name || partner.username}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{partner.username}</div>
                </div>
              </>
            )}
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto',
            padding: '16px 16px 8px',
            display: 'flex', flexDirection: 'column', gap: 8
          }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', margin: 'auto', padding: 32 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>👋</div>
                <div style={{ fontSize: 14 }}>Начните общение</div>
              </div>
            )}
            {messages.map((msg, i) => {
              const isMine = msg.from_user_id === userId
              const showTime = i === 0 || (new Date(msg.created_at).getTime() - new Date(messages[i - 1].created_at).getTime()) > 300000
              return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                  {showTime && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px auto', textAlign: 'center' }}>
                      {timeAgo(msg.created_at)}
                    </div>
                  )}
                  <div style={{
                    maxWidth: '78%',
                    background: isMine
                      ? 'linear-gradient(135deg, var(--accent), var(--accent-warm))'
                      : 'var(--bg-card)',
                    color: isMine ? '#fff' : 'var(--text-primary)',
                    borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    padding: '10px 14px',
                    fontSize: 15, lineHeight: 1.5,
                    border: isMine ? 'none' : '1px solid var(--border)',
                    boxShadow: isMine ? '0 2px 12px rgba(176,125,74,0.3)' : '0 1px 4px rgba(0,0,0,0.1)',
                    animation: 'msgIn 0.25s cubic-bezier(0.22,1,0.36,1)',
                    wordBreak: 'break-word'
                  }}>
                    {msg.content}
                  </div>
                  {isMine && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, paddingRight: 4 }}>
                      {msg.is_read ? '✓✓' : '✓'}
                    </div>
                  )}
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* Emoji Panel */}
          {showEmoji && (
            <div style={{
              display: 'flex', gap: 8, padding: '10px 16px',
              background: 'var(--bg-raised)', borderTop: '1px solid var(--border)',
              flexShrink: 0, overflowX: 'auto'
            }}>
              {EMOJI.map(e => (
                <button key={e} onClick={() => addEmoji(e)}
                  style={{
                    fontSize: 24, background: 'none', border: 'none',
                    cursor: 'pointer', padding: '4px 6px', borderRadius: 8,
                    flexShrink: 0, transition: 'transform 0.15s'
                  }}
                  onPointerDown={e2 => (e2.currentTarget.style.transform = 'scale(1.3)')}
                  onPointerUp={e2 => (e2.currentTarget.style.transform = 'scale(1)')}
                >{e}</button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: `12px 16px calc(12px + env(safe-area-inset-bottom))`,
            background: 'var(--bg-raised)',
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 10
          }}>
            <button onClick={() => setShowEmoji(p => !p)}
              style={{
                width: 38, height: 38, borderRadius: '50%',
                background: showEmoji ? 'var(--accent)' : 'var(--bg-card)',
                border: '1px solid var(--border)',
                cursor: 'pointer', fontSize: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s', flexShrink: 0
              }}>😊</button>
            <input
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() } }}
              placeholder="Написать..."
              style={{
                flex: 1, padding: '10px 16px',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 24, color: 'var(--text-primary)',
                fontSize: 15, outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
            <button
              onClick={sendMsg}
              disabled={!text.trim() || sending}
              style={{
                width: 42, height: 42, borderRadius: '50%',
                background: text.trim() ? 'var(--accent)' : 'var(--bg-card)',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s', flexShrink: 0,
                transform: text.trim() ? 'scale(1)' : 'scale(0.9)',
                opacity: sending ? 0.6 : 1
              }}
            >
              <Send size={16} color={text.trim() ? '#fff' : 'var(--text-muted)'} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
