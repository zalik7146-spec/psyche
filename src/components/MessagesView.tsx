import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, Search, Send, Trash2, Smile, X, Pencil, Check } from 'lucide-react'
import { supabase } from '../supabase'

interface Props {
  userId: string
  initialPartnerId?: string | null
  onBack: () => void
}

interface Msg {
  id: string
  from_user_id: string
  to_user_id: string
  content: string
  is_read: boolean
  created_at: string
}

interface Profile {
  id: string
  username: string
  display_name: string | null
  avatar: string | null
}

interface Conv {
  partner: Profile
  lastMsg: string
  lastTime: string
  unread: number
}

const EMOJIS = ['👍', '❤️', '😊', '🔥', '💡', '📚', '✨', '🙏']

const fmt = (d: string) => {
  const now = new Date()
  const dt = new Date(d)
  const diff = (now.getTime() - dt.getTime()) / 1000
  if (diff < 60) return 'сейчас'
  if (diff < 3600) return `${Math.floor(diff / 60)}м`
  if (diff < 86400) return `${Math.floor(diff / 3600)}ч`
  if (diff < 172800) return 'вчера'
  return dt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

const Avatar = ({ p, size = 44 }: { p: Profile; size?: number }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--accent), #6b5a3e)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: 700, fontSize: size * 0.4, flexShrink: 0
  }}>
    {p.avatar || (p.display_name || p.username || '?')[0].toUpperCase()}
  </div>
)

export default function MessagesView({ userId, initialPartnerId, onBack }: Props) {
  const [view, setView] = useState<'list' | 'chat'>('list')
  const [convs, setConvs] = useState<Conv[]>([])
  const [partner, setPartner] = useState<Profile | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [showEmoji, setShowEmoji] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [menuMsgId, setMenuMsgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load conversations
  const loadConvs = useCallback(async () => {
    setLoading(true)
    const { data: allMsgs } = await supabase
      .from('messages')
      .select('*')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    if (!allMsgs || allMsgs.length === 0) { setLoading(false); return }

    const partnerIds = new Set<string>()
    allMsgs.forEach((m: Msg) => {
      partnerIds.add(m.from_user_id === userId ? m.to_user_id : m.from_user_id)
    })

    const { data: profiles } = await supabase
      .from('social_profiles')
      .select('id,username,display_name,avatar')
      .in('id', Array.from(partnerIds))

    const profileMap = new Map<string, Profile>()
    profiles?.forEach((p: Profile) => profileMap.set(p.id, p))

    const convMap = new Map<string, Conv>()
    allMsgs.forEach((m: Msg) => {
      const pid = m.from_user_id === userId ? m.to_user_id : m.from_user_id
      if (!convMap.has(pid)) {
        const p = profileMap.get(pid)
        if (p) {
          convMap.set(pid, {
            partner: p,
            lastMsg: m.content,
            lastTime: m.created_at,
            unread: m.to_user_id === userId && !m.is_read ? 1 : 0
          })
        }
      } else if (m.to_user_id === userId && !m.is_read) {
        const c = convMap.get(pid)!
        c.unread++
      }
    })

    setConvs(Array.from(convMap.values()))
    setLoading(false)
  }, [userId])

  useEffect(() => { loadConvs() }, [loadConvs])

  // Initial partner
  useEffect(() => {
    if (initialPartnerId) {
      supabase.from('social_profiles')
        .select('id,username,display_name,avatar')
        .eq('id', initialPartnerId)
        .single()
        .then(({ data }) => {
          if (data) { setPartner(data as Profile); setView('chat') }
        })
    }
  }, [initialPartnerId])

  // Load chat messages
  const loadChat = useCallback(async (p: Profile) => {
    setPartner(p)
    setView('chat')
    setMenuMsgId(null)
    setEditingId(null)

    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(from_user_id.eq.${userId},to_user_id.eq.${p.id}),and(from_user_id.eq.${p.id},to_user_id.eq.${userId})`)
      .order('created_at', { ascending: true })

    setMsgs(data as Msg[] || [])

    // Mark as read
    await supabase.from('messages')
      .update({ is_read: true })
      .eq('from_user_id', p.id)
      .eq('to_user_id', userId)
      .eq('is_read', false)

    setTimeout(() => scrollRef.current?.scrollTo({ top: 999999 }), 100)
    setTimeout(() => inputRef.current?.focus(), 200)
  }, [userId])

  // Realtime
  useEffect(() => {
    if (view !== 'chat' || !partner) return
    const ch = supabase.channel(`dm-${userId}-${partner.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `to_user_id=eq.${userId}`
      }, (payload) => {
        const m = payload.new as Msg
        if (m.from_user_id === partner.id) {
          setMsgs(prev => [...prev, m])
          supabase.from('messages').update({ is_read: true }).eq('id', m.id)
          setTimeout(() => scrollRef.current?.scrollTo({ top: 999999, behavior: 'smooth' }), 50)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [view, partner, userId])

  // Search people
  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('social_profiles')
        .select('id,username,display_name,avatar')
        .or(`username.ilike.%${search}%,display_name.ilike.%${search}%`)
        .neq('id', userId)
        .limit(10)
      setSearchResults(data as Profile[] || [])
    }, 400)
    return () => clearTimeout(t)
  }, [search, userId])

  // Send message
  const send = useCallback(async () => {
    if (!text.trim() || !partner) return
    const content = text.trim()
    setText('')
    setShowEmoji(false)

    const optimistic: Msg = {
      id: `temp-${Date.now()}`,
      from_user_id: userId,
      to_user_id: partner.id,
      content,
      is_read: false,
      created_at: new Date().toISOString()
    }
    setMsgs(prev => [...prev, optimistic])
    setTimeout(() => scrollRef.current?.scrollTo({ top: 999999, behavior: 'smooth' }), 50)

    const { data } = await supabase
      .from('messages')
      .insert({ from_user_id: userId, to_user_id: partner.id, content })
      .select()
      .single()

    if (data) {
      setMsgs(prev => prev.map(m => m.id === optimistic.id ? data as Msg : m))
    }
  }, [text, partner, userId])

  // Delete message
  const deleteMsg = useCallback(async (id: string) => {
    setMsgs(prev => prev.filter(m => m.id !== id))
    setMenuMsgId(null)
    await supabase.from('messages').delete().eq('id', id).eq('from_user_id', userId)
  }, [userId])

  // Edit message
  const saveEdit = useCallback(async (id: string) => {
    if (!editText.trim()) return
    setMsgs(prev => prev.map(m => m.id === id ? { ...m, content: editText.trim() } : m))
    setEditingId(null)
    setEditText('')
    setMenuMsgId(null)
    await supabase.from('messages').update({ content: editText.trim() }).eq('id', id).eq('from_user_id', userId)
  }, [editText, userId])

  // Delete entire conversation
  const deleteConv = useCallback(async () => {
    if (!partner || !confirm('Удалить всю переписку?')) return
    await supabase.from('messages').delete()
      .or(`and(from_user_id.eq.${userId},to_user_id.eq.${partner.id}),and(from_user_id.eq.${partner.id},to_user_id.eq.${userId})`)
    setMsgs([])
    setView('list')
    setPartner(null)
    loadConvs()
  }, [partner, userId, loadConvs])

  // Long press handler
  const onPointerDown = useCallback((msgId: string, isMine: boolean) => {
    if (!isMine) return
    longPressTimer.current = setTimeout(() => {
      setMenuMsgId(msgId)
      if (navigator.vibrate) navigator.vibrate(15)
    }, 500)
  }, [])

  const onPointerUp = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
  }, [])

  // Date separator
  const dateLabel = (d: string) => {
    const dt = new Date(d)
    const now = new Date()
    if (dt.toDateString() === now.toDateString()) return 'Сегодня'
    const y = new Date(now.getTime() - 86400000)
    if (dt.toDateString() === y.toDateString()) return 'Вчера'
    return dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  }

  // ─── CHAT VIEW ─────────────────────────────
  if (view === 'chat' && partner) {
    let lastDate = ''
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'var(--bg-base)',
        display: 'flex', flexDirection: 'column',
        maxWidth: 430, margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px',
          paddingTop: 'calc(12px + env(safe-area-inset-top))',
          background: 'var(--bg-raised)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0
        }}>
          <button onClick={() => { setView('list'); setPartner(null); loadConvs() }}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', padding: 4, cursor: 'pointer' }}>
            <ArrowLeft size={22} />
          </button>
          <Avatar p={partner} size={38} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>
              {partner.display_name || partner.username}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{partner.username}</div>
          </div>
          <button onClick={deleteConv}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: 8, cursor: 'pointer' }}>
            <Trash2 size={18} />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{
          flex: 1, overflowY: 'auto', padding: '12px 16px',
          display: 'flex', flexDirection: 'column', gap: 4
        }}>
          {msgs.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
              Начните диалог!
            </div>
          )}
          {msgs.map((m, i) => {
            const isMine = m.from_user_id === userId
            const d = dateLabel(m.created_at)
            let showDate = false
            if (d !== lastDate) { lastDate = d; showDate = true }
            const time = new Date(m.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

            return (
              <div key={m.id}>
                {showDate && (
                  <div style={{
                    textAlign: 'center', padding: '12px 0 8px', fontSize: 12,
                    color: 'var(--text-muted)', fontWeight: 600
                  }}>{d}</div>
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: isMine ? 'flex-end' : 'flex-start',
                    padding: '2px 0',
                    animation: `fadeSlideUp 0.3s ease ${Math.min(i * 0.02, 0.5)}s both`,
                    position: 'relative'
                  }}
                  onPointerDown={() => onPointerDown(m.id, isMine)}
                  onPointerUp={onPointerUp}
                  onPointerLeave={onPointerUp}
                >
                  <div style={{
                    maxWidth: '78%',
                    padding: editingId === m.id ? '8px 10px' : '10px 14px',
                    borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: isMine
                      ? 'linear-gradient(135deg, var(--accent), #7a5a2e)'
                      : 'var(--bg-raised)',
                    border: isMine ? 'none' : '1px solid var(--border)',
                    color: isMine ? '#fff' : 'var(--text-primary)',
                    position: 'relative',
                    transition: 'transform 0.15s ease',
                    cursor: isMine ? 'pointer' : 'default'
                  }}>
                    {editingId === m.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <input
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          style={{
                            background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)',
                            borderRadius: 8, padding: '6px 10px', color: '#fff',
                            fontSize: 14, width: '100%', outline: 'none'
                          }}
                          autoFocus
                          onKeyDown={e => e.key === 'Enter' && saveEdit(m.id)}
                        />
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button onClick={() => { setEditingId(null); setMenuMsgId(null) }}
                            style={{ background: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: 6, padding: '4px 8px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <X size={14} /> Отмена
                          </button>
                          <button onClick={() => saveEdit(m.id)}
                            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, padding: '4px 8px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Check size={14} /> Сохр.
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: 15, lineHeight: 1.45, wordBreak: 'break-word' }}>
                          {m.content}
                        </div>
                        <div style={{
                          fontSize: 11, marginTop: 4, textAlign: 'right',
                          opacity: 0.6, display: 'flex', alignItems: 'center',
                          justifyContent: 'flex-end', gap: 4
                        }}>
                          {time}
                          {isMine && <span>{m.is_read ? '✓✓' : '✓'}</span>}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Context menu */}
                  {menuMsgId === m.id && editingId !== m.id && (
                    <div style={{
                      position: 'absolute',
                      [isMine ? 'right' : 'left']: 0,
                      bottom: '100%', marginBottom: 4,
                      background: 'var(--bg-raised)',
                      border: '1px solid var(--border)',
                      borderRadius: 12, padding: 4,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                      zIndex: 10, display: 'flex', flexDirection: 'column', gap: 2,
                      animation: 'fadeSlideUp 0.2s ease',
                      minWidth: 140
                    }}>
                      <button onClick={() => { setEditingId(m.id); setEditText(m.content) }}
                        style={{
                          background: 'none', border: 'none', color: 'var(--text-primary)',
                          padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                          fontSize: 14, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10
                        }}>
                        <Pencil size={15} /> Редактировать
                      </button>
                      <button onClick={() => deleteMsg(m.id)}
                        style={{
                          background: 'none', border: 'none', color: '#e85d5d',
                          padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                          fontSize: 14, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10
                        }}>
                        <Trash2 size={15} /> Удалить
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Close context menu on tap outside */}
        {menuMsgId && (
          <div onClick={() => setMenuMsgId(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 5 }} />
        )}

        {/* Emoji panel */}
        {showEmoji && (
          <div style={{
            padding: '8px 16px', display: 'flex', gap: 8, justifyContent: 'center',
            background: 'var(--bg-raised)', borderTop: '1px solid var(--border)',
            animation: 'fadeSlideUp 0.2s ease'
          }}>
            {EMOJIS.map(e => (
              <button key={e} onClick={() => { setText(prev => prev + e); setShowEmoji(false) }}
                style={{
                  background: 'none', border: 'none', fontSize: 24, cursor: 'pointer',
                  padding: 4, transition: 'transform 0.15s',
                  borderRadius: 8
                }}
                onPointerDown={ev => (ev.currentTarget.style.transform = 'scale(1.4)')}
                onPointerUp={ev => (ev.currentTarget.style.transform = 'scale(1)')}
              >{e}</button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px',
          paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
          background: 'var(--bg-raised)',
          borderTop: '1px solid var(--border)',
          flexShrink: 0
        }}>
          <button onClick={() => setShowEmoji(!showEmoji)}
            style={{
              background: 'none', border: 'none', fontSize: 22, cursor: 'pointer',
              padding: 4, color: showEmoji ? 'var(--accent)' : 'var(--text-muted)'
            }}>
            <Smile size={22} />
          </button>
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Сообщение..."
            style={{
              flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 20, padding: '10px 16px', color: 'var(--text-primary)',
              fontSize: 15, outline: 'none'
            }}
          />
          <button onClick={send}
            disabled={!text.trim()}
            style={{
              background: text.trim() ? 'var(--accent)' : 'var(--bg-card)',
              border: 'none', borderRadius: '50%',
              width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: text.trim() ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              color: text.trim() ? '#fff' : 'var(--text-muted)'
            }}>
            <Send size={18} />
          </button>
        </div>
      </div>
    )
  }

  // ─── CONVERSATIONS LIST ─────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 20px 12px', flexShrink: 0
      }}>
        <button onClick={onBack}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', padding: 4, cursor: 'pointer' }}>
          <ArrowLeft size={22} />
        </button>
        <h2 style={{ flex: 1, margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
          Сообщения
        </h2>
      </div>

      {/* Search */}
      <div style={{ padding: '0 20px 12px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '0 12px'
        }}>
          <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Найти человека..."
            style={{
              flex: 1, background: 'none', border: 'none', padding: '12px 0',
              color: 'var(--text-primary)', fontSize: 14, outline: 'none'
            }}
          />
          {search && (
            <button onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: 4, cursor: 'pointer' }}>
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Search results */}
      {searchResults.length > 0 && (
        <div style={{ padding: '0 20px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>
            Результаты поиска
          </div>
          {searchResults.map(p => (
            <button key={p.id} onClick={() => { loadChat(p); setSearch(''); setSearchResults([]) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '10px 14px', cursor: 'pointer',
                width: '100%', textAlign: 'left'
              }}>
              <Avatar p={p} size={38} />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>
                  {p.display_name || p.username}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{p.username}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Conversations */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Загрузка...</div>
        ) : convs.length === 0 && !search ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Нет сообщений</div>
            <div>Найдите собеседника через поиск</div>
          </div>
        ) : (
          convs.map((c, i) => (
            <button key={c.partner.id} onClick={() => loadChat(c.partner)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 14, padding: '14px 16px', cursor: 'pointer',
                marginBottom: 8, textAlign: 'left',
                animation: `fadeSlideUp 0.3s ease ${i * 0.05}s both`,
                transition: 'transform 0.15s ease'
              }}
              onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.98)')}
              onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
              onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
              <Avatar p={c.partner} size={48} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>
                    {c.partner.display_name || c.partner.username}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{fmt(c.lastTime)}</span>
                </div>
                <div style={{
                  fontSize: 13, color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}>
                  {c.lastMsg}
                </div>
              </div>
              {c.unread > 0 && (
                <div style={{
                  background: 'var(--accent)', color: '#fff', borderRadius: '50%',
                  width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, flexShrink: 0
                }}>{c.unread}</div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
