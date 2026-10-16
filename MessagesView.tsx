import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, Search, Send, Trash2, Smile, Check, CheckCheck, Pencil, X, MessageCircle } from 'lucide-react'
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
  edited?: boolean
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

const EMOJIS = ['👍','❤️','😊','🔥','💡','📚','✨','🙏']

const fmtTime = (d: string) => {
  const now = new Date(), dt = new Date(d)
  const diff = (now.getTime() - dt.getTime()) / 1000
  if (diff < 60) return 'сейчас'
  if (diff < 3600) return `${Math.floor(diff/60)}м`
  if (diff < 86400) return `${Math.floor(diff/3600)}ч`
  if (diff < 172800) return 'вчера'
  return dt.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'})
}

const fmtDate = (d: string) => {
  const dt = new Date(d), now = new Date()
  const diff = (now.getTime() - dt.getTime()) / 86400000
  if (diff < 1) return 'Сегодня'
  if (diff < 2) return 'Вчера'
  return dt.toLocaleDateString('ru-RU',{day:'2-digit',month:'long'})
}

const Avatar = ({ p, size=44 }: { p: Profile; size?: number }) => (
  <div style={{
    width:size, height:size, borderRadius:'50%', flexShrink:0,
    background:'linear-gradient(135deg,var(--accent),#5a3e2a)',
    display:'flex', alignItems:'center', justifyContent:'center',
    color:'#fff', fontWeight:700, fontSize:size*0.38,
    overflow:'hidden', border:'2px solid var(--border)'
  }}>
    {p.avatar?.startsWith('http')
      ? <img src={p.avatar} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" />
      : p.avatar || (p.display_name||p.username||'?')[0].toUpperCase()
    }
  </div>
)

export default function MessagesView({ userId, initialPartnerId, onBack }: Props) {
  const [view, setView] = useState<'list'|'chat'>('list')
  const [convs, setConvs] = useState<Conv[]>([])
  const [partner, setPartner] = useState<Profile|null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [found, setFound] = useState<Profile[]>([])
  const [showEmoji, setShowEmoji] = useState(false)
  const [editingId, setEditingId] = useState<string|null>(null)
  const [editText, setEditText] = useState('')
  const [menuMsgId, setMenuMsgId] = useState<string|null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [swipedConv, setSwipedConv] = useState<string|null>(null)
  const [deletingConv, setDeletingConv] = useState<string|null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const lpTimer = useRef<ReturnType<typeof setTimeout>|null>(null)
  const touchStartX = useRef(0)
  const touchConvId = useRef<string|null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel>|null>(null)

  // ── Load conversations ────────────────────────────
  const loadConvs = useCallback(async () => {
    setLoading(true)
    try {
      // Get all messages for this user
      const { data: sent } = await supabase
        .from('messages')
        .select('*')
        .eq('from_user_id', userId)
        .order('created_at', { ascending: false })

      const { data: received } = await supabase
        .from('messages')
        .select('*')
        .eq('to_user_id', userId)
        .order('created_at', { ascending: false })

      const allMsgs = [...(sent||[]), ...(received||[])]
      if (!allMsgs.length) { setLoading(false); return }

      // Get unique partner IDs
      const pids = new Set<string>()
      allMsgs.forEach((m: Msg) => {
        pids.add(m.from_user_id === userId ? m.to_user_id : m.from_user_id)
      })

      const { data: profiles } = await supabase
        .from('social_profiles')
        .select('id,username,display_name,avatar')
        .in('id', Array.from(pids))

      const pm = new Map<string, Profile>()
      profiles?.forEach((p: Profile) => pm.set(p.id, p))

      // Build conversations map - latest message per partner
      const cm = new Map<string, Conv>()
      const sorted = allMsgs.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      
      sorted.forEach((m: Msg) => {
        const pid = m.from_user_id === userId ? m.to_user_id : m.from_user_id
        if (!cm.has(pid)) {
          const p = pm.get(pid)
          if (p) cm.set(pid, {
            partner: p,
            lastMsg: m.content,
            lastTime: m.created_at,
            unread: m.to_user_id === userId && !m.is_read ? 1 : 0
          })
        } else if (m.to_user_id === userId && !m.is_read) {
          cm.get(pid)!.unread++
        }
      })

      setConvs(Array.from(cm.values()))
    } catch(e) {
      console.error('loadConvs error:', e)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { loadConvs() }, [loadConvs])

  // ── Initial partner ──────────────────────────────
  useEffect(() => {
    if (!initialPartnerId) return
    supabase.from('social_profiles')
      .select('id,username,display_name,avatar')
      .eq('id', initialPartnerId).single()
      .then(({ data }) => { if (data) openChat(data as Profile) })
  }, [initialPartnerId])

  // ── Open chat ────────────────────────────────────
  const openChat = useCallback(async (p: Profile) => {
    setPartner(p)
    setView('chat')
    setMenuMsgId(null)
    setEditingId(null)
    setText('')
    setShowEmoji(false)

    // Load messages between two users - two separate queries
    const { data: sent } = await supabase.from('messages').select('*')
      .eq('from_user_id', userId).eq('to_user_id', p.id)
      .order('created_at', { ascending: true })

    const { data: received } = await supabase.from('messages').select('*')
      .eq('from_user_id', p.id).eq('to_user_id', userId)
      .order('created_at', { ascending: true })

    const all = [...(sent||[]), ...(received||[])]
      .sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    setMsgs(all as Msg[])

    // Mark as read
    await supabase.from('messages')
      .update({ is_read: true })
      .eq('to_user_id', userId)
      .eq('from_user_id', p.id)
      .eq('is_read', false)

    setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 100)
    setTimeout(() => inputRef.current?.focus(), 300)

    // Realtime
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = supabase.channel(`chat_${[userId, p.id].sort().join('_')}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, ({ new: m }) => {
        const msg = m as Msg
        if ((msg.from_user_id === p.id && msg.to_user_id === userId) ||
            (msg.from_user_id === userId && msg.to_user_id === p.id)) {
          setMsgs(prev => {
            if (prev.find(x => x.id === msg.id)) return prev
            return [...prev, msg]
          })
          setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50)
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, ({ old: m }) => {
        setMsgs(prev => prev.filter(x => x.id !== (m as Msg).id))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, ({ new: m }) => {
        setMsgs(prev => prev.map(x => x.id === (m as Msg).id ? m as Msg : x))
      })
      .subscribe()
  }, [userId])

  // ── Search people ───────────────────────────────
  useEffect(() => {
    if (search.trim().length < 1) { setFound([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('social_profiles')
        .select('id,username,display_name,avatar')
        .neq('id', userId)
        .or(`username.ilike.%${search}%,display_name.ilike.%${search}%`)
        .limit(8)
      setFound((data as Profile[]) || [])
    }, 350)
    return () => clearTimeout(t)
  }, [search, userId])

  // ── Send ────────────────────────────────────────
  const send = async () => {
    if (!text.trim() || !partner || sending) return
    setSending(true)
    const content = text.trim()
    setText('')
    setShowEmoji(false)

    const optimistic: Msg = {
      id: `tmp_${Date.now()}`,
      from_user_id: userId,
      to_user_id: partner.id,
      content, is_read: false,
      created_at: new Date().toISOString()
    }
    setMsgs(prev => [...prev, optimistic])
    setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50)

    const { data, error } = await supabase.from('messages')
      .insert({ from_user_id: userId, to_user_id: partner.id, content })
      .select().single()

    if (error) {
      console.error('send error:', error)
      setMsgs(prev => prev.filter(m => m.id !== optimistic.id))
    } else {
      setMsgs(prev => prev.map(m => m.id === optimistic.id ? data as Msg : m))
      loadConvs()
    }
    setSending(false)
    inputRef.current?.focus()
  }

  // ── Delete single message ────────────────────────
  const deleteMsg = async (id: string) => {
    setMenuMsgId(null)
    // Remove from UI immediately
    setMsgs(prev => prev.filter(m => m.id !== id))
    const { error } = await supabase.from('messages')
      .delete()
      .eq('id', id)
      .eq('from_user_id', userId)
    if (error) {
      console.error('deleteMsg error:', error)
      // Reload if error
      if (partner) openChat(partner)
    }
  }

  // ── Edit message ─────────────────────────────────
  const startEdit = (m: Msg) => {
    setMenuMsgId(null)
    setEditingId(m.id)
    setEditText(m.content)
  }

  const saveEdit = async () => {
    if (!editingId || !editText.trim()) return
    const content = editText.trim()
    setMsgs(prev => prev.map(m => m.id === editingId ? { ...m, content, edited: true } : m))
    setEditingId(null)
    const { error } = await supabase.from('messages')
      .update({ content })
      .eq('id', editingId)
      .eq('from_user_id', userId)
    if (error) console.error('saveEdit error:', error)
  }

  // ── Delete conversation ──────────────────────────
  const deleteConv = async (partnerId: string) => {
    setDeletingConv(partnerId)
    setSwipedConv(null)

    try {
      // Delete messages sent by me to partner
      const { error: e1 } = await supabase.from('messages')
        .delete()
        .eq('from_user_id', userId)
        .eq('to_user_id', partnerId)

      if (e1) console.error('deleteConv e1:', e1)

      // Delete messages sent by partner to me
      const { error: e2 } = await supabase.from('messages')
        .delete()
        .eq('from_user_id', partnerId)
        .eq('to_user_id', userId)

      if (e2) console.error('deleteConv e2:', e2)

      // Remove from UI
      setConvs(prev => prev.filter(c => c.partner.id !== partnerId))
    } catch(e) {
      console.error('deleteConv error:', e)
    }
    setDeletingConv(null)
  }

  // ── Long press ───────────────────────────────────
  const onPressStart = (m: Msg) => {
    if (m.from_user_id !== userId) return
    lpTimer.current = setTimeout(() => {
      navigator.vibrate?.(15)
      setMenuMsgId(m.id)
    }, 400)
  }
  const onPressEnd = () => {
    if (lpTimer.current) clearTimeout(lpTimer.current)
  }

  // ── Swipe conversation ───────────────────────────
  const onTouchStart = (id: string, e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchConvId.current = id
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const dx = touchStartX.current - e.touches[0].clientX
    if (dx > 50 && touchConvId.current) {
      setSwipedConv(touchConvId.current)
    } else if (dx < -20) {
      setSwipedConv(null)
    }
  }
  const onTouchEnd = () => { touchConvId.current = null }

  // ── Group by date ────────────────────────────────
  const grouped: { date: string; msgs: Msg[] }[] = []
  msgs.forEach(m => {
    const d = fmtDate(m.created_at)
    const last = grouped[grouped.length-1]
    if (last?.date === d) last.msgs.push(m)
    else grouped.push({ date: d, msgs: [m] })
  })

  // ── Back from chat ───────────────────────────────
  const backToList = () => {
    setView('list')
    setPartner(null)
    setMsgs([])
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    loadConvs()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg-base)',
      zIndex: 2000,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px',
            paddingTop: 'calc(12px + env(safe-area-inset-top))',
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <button onClick={onBack} style={{
              background: 'var(--bg-raised)', border: 'none',
              borderRadius: 12, padding: 10, cursor: 'pointer',
              color: 'var(--text-primary)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <ArrowLeft size={20} />
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Lora,serif', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                Сообщения
              </div>
            </div>
          </div>

          {/* Search */}
          <div style={{ padding: '12px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-raised)', borderRadius: 14, padding: '10px 14px', border: '1px solid var(--border)' }}>
              <Search size={16} color="var(--text-muted)" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Найти человека..."
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 15, fontFamily: 'Inter,sans-serif' }}
              />
            </div>
          </div>

          {/* Search results */}
          {found.length > 0 && (
            <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              {found.map(p => (
                <div key={p.id} onClick={() => { setSearch(''); setFound([]); openChat(p) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                  <Avatar p={p} size={40} />
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>{p.display_name || p.username}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>@{p.username}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Conversations */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Загрузка...</div>
            ) : convs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <MessageCircle size={48} color="var(--text-muted)" style={{ marginBottom: 12, opacity: 0.4 }} />
                <div style={{ color: 'var(--text-muted)', fontSize: 15 }}>Нет сообщений</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>Найдите человека выше</div>
              </div>
            ) : (
              convs.map((c, i) => (
                <div key={c.partner.id}
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    animation: `fadeSlideUp 0.3s ease ${i*0.05}s both`,
                  }}
                  onTouchStart={e => onTouchStart(c.partner.id, e)}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                >
                  {/* Main row */}
                  <div
                    onClick={() => { if (swipedConv === c.partner.id) { setSwipedConv(null); return } openChat(c.partner) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '14px 16px',
                      background: 'var(--bg-card)',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      transform: swipedConv === c.partner.id ? 'translateX(-88px)' : 'translateX(0)',
                      transition: 'transform 0.28s cubic-bezier(0.22,1,0.36,1)',
                      willChange: 'transform',
                    }}
                  >
                    <Avatar p={c.partner} size={48} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>
                          {c.partner.display_name || c.partner.username}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{fmtTime(c.lastTime)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                          {c.lastMsg}
                        </span>
                        {c.unread > 0 && (
                          <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '2px 7px', flexShrink: 0 }}>
                            {c.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Delete button revealed on swipe */}
                  <button
                    onClick={() => {
                      if (confirm(`Удалить переписку с ${c.partner.display_name || c.partner.username}?`)) {
                        deleteConv(c.partner.id)
                      } else {
                        setSwipedConv(null)
                      }
                    }}
                    style={{
                      position: 'absolute', right: 0, top: 0, bottom: 0,
                      width: 88,
                      background: 'linear-gradient(135deg,#c0392b,#a93226)',
                      border: 'none', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      gap: 4, color: '#fff',
                      opacity: deletingConv === c.partner.id ? 0.5 : 1,
                    }}
                  >
                    <Trash2 size={20} />
                    <span style={{ fontSize: 11, fontWeight: 600 }}>Удалить</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ── CHAT VIEW ── */}
      {view === 'chat' && partner && (
        <>
          {/* Chat Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px',
            paddingTop: 'calc(12px + env(safe-area-inset-top))',
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <button onClick={backToList} style={{
              background: 'var(--bg-raised)', border: 'none',
              borderRadius: 12, padding: 10, cursor: 'pointer',
              color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ArrowLeft size={20} />
            </button>
            <Avatar p={partner} size={38} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 16 }}>
                {partner.display_name || partner.username}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>@{partner.username}</div>
            </div>
            <button
              onClick={() => {
                if (confirm('Удалить всю переписку?')) deleteConv(partner.id).then(backToList)
              }}
              style={{
                background: 'var(--bg-raised)', border: 'none',
                borderRadius: 12, padding: 10, cursor: 'pointer',
                color: '#e74c3c', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Trash2 size={18} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {grouped.map(g => (
              <div key={g.date}>
                {/* Date separator */}
                <div style={{ textAlign: 'center', margin: '12px 0 8px', position: 'relative' }}>
                  <span style={{
                    background: 'var(--bg-raised)', color: 'var(--text-muted)',
                    fontSize: 12, padding: '4px 12px', borderRadius: 20,
                    border: '1px solid var(--border)',
                  }}>{g.date}</span>
                </div>

                {g.msgs.map(m => {
                  const mine = m.from_user_id === userId
                  return (
                    <div key={m.id}
                      style={{
                        display: 'flex',
                        justifyContent: mine ? 'flex-end' : 'flex-start',
                        marginBottom: 6,
                        animation: 'msgPop 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                      }}
                      onPointerDown={() => onPressStart(m)}
                      onPointerUp={onPressEnd}
                      onPointerLeave={onPressEnd}
                    >
                      {!mine && (
                        <div style={{ marginRight: 8, alignSelf: 'flex-end' }}>
                          <Avatar p={partner} size={28} />
                        </div>
                      )}

                      {editingId === m.id ? (
                        <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <input
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit() }}
                            autoFocus
                            style={{
                              background: 'var(--bg-raised)', border: '1px solid var(--accent)',
                              borderRadius: 12, padding: '8px 12px',
                              color: 'var(--text-primary)', fontSize: 15,
                              fontFamily: 'Inter,sans-serif', outline: 'none',
                            }}
                          />
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button onClick={() => setEditingId(null)} style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13 }}>
                              Отмена
                            </button>
                            <button onClick={saveEdit} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 600 }}>
                              Сохранить
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ position: 'relative' }}>
                          <div style={{
                            maxWidth: 280,
                            padding: '10px 14px',
                            borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                            background: mine
                              ? 'linear-gradient(135deg,#c49a6c,#8a5c30)'
                              : 'var(--bg-raised)',
                            color: mine ? '#fff' : 'var(--text-primary)',
                            fontSize: 15, lineHeight: 1.55,
                            boxShadow: mine
                              ? '0 2px 12px rgba(180,130,80,0.3)'
                              : '0 1px 6px rgba(0,0,0,0.15)',
                            border: mine ? 'none' : '1px solid var(--border)',
                            wordBreak: 'break-word',
                            cursor: mine ? 'pointer' : 'default',
                          }}>
                            {m.content}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 4 }}>
                              {m.edited && <span style={{ fontSize: 10, opacity: 0.7 }}>ред.</span>}
                              <span style={{ fontSize: 10, opacity: 0.7 }}>{fmtTime(m.created_at)}</span>
                              {mine && (
                                m.is_read
                                  ? <CheckCheck size={12} style={{ opacity: 0.9 }} />
                                  : <Check size={12} style={{ opacity: 0.7 }} />
                              )}
                            </div>
                          </div>

                          {/* Context menu */}
                          {menuMsgId === m.id && (
                            <>
                              <div onClick={() => setMenuMsgId(null)} style={{ position: 'fixed', inset: 0, zIndex: 100 }} />
                              <div style={{
                                position: 'absolute',
                                bottom: '100%',
                                right: mine ? 0 : 'auto',
                                left: mine ? 'auto' : 0,
                                marginBottom: 6,
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border)',
                                borderRadius: 14,
                                overflow: 'hidden',
                                zIndex: 101,
                                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                                animation: 'menuPop 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                                minWidth: 160,
                              }}>
                                <button onClick={() => startEdit(m)} style={{
                                  display: 'flex', alignItems: 'center', gap: 10,
                                  width: '100%', padding: '12px 16px',
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  color: 'var(--text-primary)', fontSize: 14,
                                  borderBottom: '1px solid var(--border)',
                                }}>
                                  <Pencil size={15} /> Изменить
                                </button>
                                <button onClick={() => deleteMsg(m.id)} style={{
                                  display: 'flex', alignItems: 'center', gap: 10,
                                  width: '100%', padding: '12px 16px',
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  color: '#e74c3c', fontSize: 14,
                                }}>
                                  <Trash2 size={15} /> Удалить
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Emoji panel */}
          {showEmoji && (
            <div style={{
              display: 'flex', gap: 8, padding: '10px 16px',
              background: 'var(--bg-card)',
              borderTop: '1px solid var(--border)',
              flexShrink: 0,
              animation: 'sheetSlideUp 0.2s ease',
            }}>
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setText(t => t+e)} style={{
                  background: 'var(--bg-raised)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: 8, fontSize: 20, cursor: 'pointer',
                  transition: 'transform 0.15s',
                }}>
                  {e}
                </button>
              ))}
              <button onClick={() => setShowEmoji(false)} style={{
                marginLeft: 'auto', background: 'none', border: 'none',
                color: 'var(--text-muted)', cursor: 'pointer',
              }}>
                <X size={18} />
              </button>
            </div>
          )}

          {/* Input area */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px',
            paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
            background: 'var(--bg-card)',
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <button onClick={() => setShowEmoji(s => !s)} style={{
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 10, cursor: 'pointer',
              color: showEmoji ? 'var(--accent)' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'color 0.2s',
            }}>
              <Smile size={20} />
            </button>

            <input
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Сообщение..."
              style={{
                flex: 1,
                background: 'var(--bg-raised)',
                border: '1px solid var(--border)',
                borderRadius: 22,
                padding: '10px 16px',
                color: 'var(--text-primary)',
                fontSize: 15,
                fontFamily: 'Inter,sans-serif',
                outline: 'none',
              }}
            />

            <button
              onClick={send}
              disabled={!text.trim() || sending}
              style={{
                width: 44, height: 44, borderRadius: '50%',
                background: text.trim()
                  ? 'linear-gradient(135deg,var(--accent),#8a5c30)'
                  : 'var(--bg-raised)',
                border: '1px solid var(--border)',
                cursor: text.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: text.trim() ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                transform: text.trim() ? 'scale(1.05)' : 'scale(1)',
                flexShrink: 0,
              }}
            >
              <Send size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
