import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, Search, Send, Trash2, Smile, X, Check, Pencil } from 'lucide-react'
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
  const dt = new Date(d)
  const now = new Date()
  const diff = (now.getTime() - dt.getTime()) / 86400000
  if (diff < 1) return 'Сегодня'
  if (diff < 2) return 'Вчера'
  return dt.toLocaleDateString('ru-RU',{day:'2-digit',month:'long'})
}

const Av = ({ p, size=44 }: { p: Profile; size?: number }) => (
  <div style={{
    width:size, height:size, borderRadius:'50%', flexShrink:0,
    background:'linear-gradient(135deg,var(--accent),#5a3e2a)',
    display:'flex', alignItems:'center', justifyContent:'center',
    color:'#fff', fontWeight:700, fontSize:size*0.38,
    overflow:'hidden', border:'2px solid var(--border)'
  }}>
    {p.avatar?.startsWith('http')
      ? <img src={p.avatar} style={{width:'100%',height:'100%',objectFit:'cover'}} />
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const lpTimer = useRef<ReturnType<typeof setTimeout>|null>(null)
  const touchX = useRef(0)
  const touchConvId = useRef<string|null>(null)
  const [swipedConv, setSwipedConv] = useState<string|null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel>|null>(null)

  // ── Load conversations ────────────────────────────────────────
  const loadConvs = useCallback(async () => {
    setLoading(true)
    const { data: allMsgs, error } = await supabase
      .from('messages')
      .select('*')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    if (error) { console.error('loadConvs:', error); setLoading(false); return }
    if (!allMsgs?.length) { setLoading(false); return }

    const pids = new Set<string>()
    allMsgs.forEach((m: Msg) => pids.add(m.from_user_id === userId ? m.to_user_id : m.from_user_id))

    const { data: profiles } = await supabase
      .from('social_profiles')
      .select('id,username,display_name,avatar')
      .in('id', Array.from(pids))

    const pm = new Map<string, Profile>()
    profiles?.forEach((p: Profile) => pm.set(p.id, p))

    const cm = new Map<string, Conv>()
    allMsgs.forEach((m: Msg) => {
      const pid = m.from_user_id === userId ? m.to_user_id : m.from_user_id
      if (!cm.has(pid)) {
        const p = pm.get(pid)
        if (p) cm.set(pid, { partner: p, lastMsg: m.content, lastTime: m.created_at, unread: m.to_user_id === userId && !m.is_read ? 1 : 0 })
      } else if (m.to_user_id === userId && !m.is_read) {
        cm.get(pid)!.unread++
      }
    })
    setConvs(Array.from(cm.values()))
    setLoading(false)
  }, [userId])

  useEffect(() => { loadConvs() }, [loadConvs])

  // ── Initial partner ───────────────────────────────────────────
  useEffect(() => {
    if (!initialPartnerId) return
    supabase.from('social_profiles')
      .select('id,username,display_name,avatar')
      .eq('id', initialPartnerId).single()
      .then(({ data }) => { if (data) openChat(data as Profile) })
  }, [initialPartnerId])

  // ── Open chat ────────────────────────────────────────────────
  const openChat = useCallback(async (p: Profile) => {
    setPartner(p); setView('chat')
    setMenuMsgId(null); setEditingId(null); setText(''); setShowEmoji(false)

    const { data, error } = await supabase.from('messages').select('*')
      .or(`and(from_user_id.eq.${userId},to_user_id.eq.${p.id}),and(from_user_id.eq.${p.id},to_user_id.eq.${userId})`)
      .order('created_at', { ascending: true })

    if (error) console.error('openChat:', error)
    setMsgs((data as Msg[]) || [])

    // Mark as read
    await supabase.from('messages')
      .update({ is_read: true })
      .eq('to_user_id', userId).eq('from_user_id', p.id).eq('is_read', false)

    setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 100)
    setTimeout(() => inputRef.current?.focus(), 300)

    // Realtime
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = supabase.channel(`chat_${userId}_${p.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, ({ new: m }) => {
        const msg = m as Msg
        if ((msg.from_user_id === p.id && msg.to_user_id === userId) ||
            (msg.from_user_id === userId && msg.to_user_id === p.id)) {
          setMsgs(prev => [...prev, msg])
          setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50)
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, ({ new: m }) => {
        setMsgs(prev => prev.map(x => x.id === (m as Msg).id ? m as Msg : x))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, ({ old: m }) => {
        setMsgs(prev => prev.filter(x => x.id !== (m as { id: string }).id))
      })
      .subscribe()
  }, [userId])

  // ── Search people ─────────────────────────────────────────────
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

  // ── Send message ──────────────────────────────────────────────
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
      console.error('send:', error)
      setMsgs(prev => prev.filter(m => m.id !== optimistic.id))
    } else {
      setMsgs(prev => prev.map(m => m.id === optimistic.id ? data as Msg : m))
    }
    setSending(false)
    inputRef.current?.focus()
  }

  // ── Delete single message ─────────────────────────────────────
  const deleteMsg = async (id: string) => {
    setMenuMsgId(null)
    setMsgs(prev => prev.filter(m => m.id !== id))
    const { error } = await supabase.from('messages').delete().eq('id', id).eq('from_user_id', userId)
    if (error) { console.error('deleteMsg:', error); loadConvs() }
  }

  // ── Edit message ──────────────────────────────────────────────
  const startEdit = (m: Msg) => {
    setMenuMsgId(null); setEditingId(m.id); setEditText(m.content)
  }
  const saveEdit = async () => {
    if (!editingId || !editText.trim()) return
    const content = editText.trim()
    setMsgs(prev => prev.map(m => m.id === editingId ? { ...m, content, edited: true } : m))
    setEditingId(null)
    await supabase.from('messages').update({ content }).eq('id', editingId).eq('from_user_id', userId)
  }

  // ── Delete conversation ───────────────────────────────────────
  const deleteConv = async (partnerId: string) => {
    setSwipedConv(null)
    if (!confirm('Удалить всю переписку?')) return
    const { error } = await supabase.from('messages').delete()
      .or(`and(from_user_id.eq.${userId},to_user_id.eq.${partnerId}),and(from_user_id.eq.${partnerId},to_user_id.eq.${userId})`)
    if (error) { console.error('deleteConv:', error); return }
    setConvs(prev => prev.filter(c => c.partner.id !== partnerId))
  }

  // ── Long press for message menu ───────────────────────────────
  const onMsgPressStart = (m: Msg) => {
    if (m.from_user_id !== userId) return
    lpTimer.current = setTimeout(() => {
      navigator.vibrate?.(15)
      setMenuMsgId(m.id)
    }, 450)
  }
  const onMsgPressEnd = () => { if (lpTimer.current) clearTimeout(lpTimer.current) }

  // ── Conversation swipe ────────────────────────────────────────
  const onConvTouchStart = (id: string, e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX
    touchConvId.current = id
  }
  const onConvTouchMove = (e: React.TouchEvent) => {
    const dx = touchX.current - e.touches[0].clientX
    if (dx > 40 && touchConvId.current) setSwipedConv(touchConvId.current)
    else if (dx < -10) setSwipedConv(null)
  }
  const onConvTouchEnd = () => { touchConvId.current = null }

  // ── Group messages by date ────────────────────────────────────
  const grouped: { date: string; msgs: Msg[] }[] = []
  msgs.forEach(m => {
    const d = fmtDate(m.created_at)
    const last = grouped[grouped.length - 1]
    if (last?.date === d) last.msgs.push(m)
    else grouped.push({ date: d, msgs: [m] })
  })

  // ── Styles ────────────────────────────────────────────────────
  const s = {
    overlay: {
      position: 'fixed' as const, inset: 0,
      background: 'var(--bg-base)', zIndex: 2000,
      display: 'flex', flexDirection: 'column' as const,
    },
    header: {
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px',
      paddingTop: 'calc(12px + env(safe-area-inset-top))',
      background: 'var(--bg-card)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
    },
    backBtn: {
      background: 'var(--bg-raised)', border: 'none',
      borderRadius: 12, padding: 10, cursor: 'pointer',
      color: 'var(--text-primary)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      transition: 'transform 0.15s',
    },
    searchBox: {
      flex: 1, background: 'var(--bg-raised)',
      border: '1px solid var(--border)', borderRadius: 12,
      padding: '10px 14px', color: 'var(--text-primary)',
      fontSize: 15, outline: 'none', fontFamily: 'Inter,sans-serif',
    },
    convRow: (swiped: boolean) => ({
      display: 'flex', alignItems: 'center',
      padding: '12px 16px', gap: 12, cursor: 'pointer',
      background: 'var(--bg-card)',
      borderBottom: '1px solid var(--border)',
      position: 'relative' as const, overflow: 'hidden',
      transition: 'background 0.15s',
      transform: swiped ? 'translateX(-80px)' : 'translateX(0)',
      transition2: 'transform 0.28s cubic-bezier(0.22,1,0.36,1)',
    }),
    delBtn: {
      position: 'absolute' as const, right: 0, top: 0, bottom: 0,
      width: 80, background: '#c0392b',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', border: 'none',
    },
    bubble: (mine: boolean) => ({
      maxWidth: '72%',
      padding: '10px 14px',
      borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
      background: mine
        ? 'linear-gradient(135deg,#c49a6c,#8a5c30)'
        : 'var(--bg-raised)',
      color: mine ? '#fff' : 'var(--text-primary)',
      fontSize: 15, lineHeight: 1.5,
      boxShadow: mine
        ? '0 2px 12px rgba(180,130,80,0.25)'
        : '0 1px 4px rgba(0,0,0,0.12)',
      animation: 'msgPop 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      cursor: 'pointer',
      wordBreak: 'break-word' as const,
    }),
    input: {
      flex: 1, background: 'var(--bg-raised)',
      border: '1px solid var(--border)', borderRadius: 22,
      padding: '11px 16px', color: 'var(--text-primary)',
      fontSize: 15, outline: 'none', fontFamily: 'Inter,sans-serif',
    } as React.CSSProperties,
    sendBtn: (active: boolean) => ({
      width: 44, height: 44, borderRadius: '50%', border: 'none',
      background: active ? 'linear-gradient(135deg,var(--accent),#8a5c30)' : 'var(--bg-raised)',
      color: active ? '#fff' : 'var(--text-muted)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: active ? 'pointer' : 'default',
      transition: 'all 0.2s', flexShrink: 0,
      transform: active ? 'scale(1)' : 'scale(0.9)',
    }),
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER — LIST
  // ══════════════════════════════════════════════════════════════
  if (view === 'list') return (
    <div style={s.overlay}>
      {/* Header */}
      <div style={s.header}>
        <button style={s.backBtn} onClick={onBack}><ArrowLeft size={20}/></button>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
          <input
            placeholder="Найти человека..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...s.searchBox, paddingLeft: 36, width: '100%', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* Search results */}
      {found.length > 0 && (
        <div style={{ background:'var(--bg-card)', borderBottom:'1px solid var(--border)' }}>
          {found.map((p, i) => (
            <div key={p.id} onClick={() => { setSearch(''); setFound([]); openChat(p) }}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
                borderBottom: i < found.length-1 ? '1px solid var(--border)' : 'none',
                cursor:'pointer', animation:`fadeSlideUp 0.25s ease ${i*0.05}s both` }}>
              <Av p={p} size={40}/>
              <div>
                <div style={{ fontWeight:600, color:'var(--text-primary)', fontSize:15 }}>{p.display_name||p.username}</div>
                <div style={{ color:'var(--text-muted)', fontSize:13 }}>@{p.username}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Conversations */}
      <div style={{ flex:1, overflowY:'auto', WebkitOverflowScrolling:'touch' }}>
        {loading ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>Загрузка...</div>
        ) : convs.length === 0 ? (
          <div style={{ padding:60, textAlign:'center' }}>
            <div style={{ fontSize:48, marginBottom:16 }}>💬</div>
            <div style={{ color:'var(--text-secondary)', fontSize:16, fontWeight:600 }}>Нет сообщений</div>
            <div style={{ color:'var(--text-muted)', fontSize:14, marginTop:8 }}>Найди человека выше и напиши первым</div>
          </div>
        ) : convs.map((c, i) => (
          <div key={c.partner.id} style={{ position:'relative', overflow:'hidden' }}
            onTouchStart={e => onConvTouchStart(c.partner.id, e)}
            onTouchMove={onConvTouchMove}
            onTouchEnd={onConvTouchEnd}>
            <div
              onClick={() => swipedConv === c.partner.id ? setSwipedConv(null) : openChat(c.partner)}
              style={{
                display:'flex', alignItems:'center', gap:12,
                padding:'12px 16px',
                background: swipedConv === c.partner.id ? 'var(--bg-raised)' : 'var(--bg-card)',
                borderBottom:'1px solid var(--border)',
                transform: swipedConv === c.partner.id ? 'translateX(-80px)' : 'translateX(0)',
                transition: 'transform 0.28s cubic-bezier(0.22,1,0.36,1)',
                animation: `fadeSlideUp 0.3s ease ${i*0.06}s both`,
                cursor:'pointer',
              }}>
              <Av p={c.partner}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                  <span style={{ fontWeight:600, color:'var(--text-primary)', fontSize:15 }}>{c.partner.display_name||c.partner.username}</span>
                  <span style={{ color:'var(--text-muted)', fontSize:12 }}>{fmtTime(c.lastTime)}</span>
                </div>
                <div style={{ color:'var(--text-secondary)', fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.lastMsg}</div>
              </div>
              {c.unread > 0 && (
                <div style={{ minWidth:22, height:22, borderRadius:11,
                  background:'var(--accent)', color:'#fff',
                  fontSize:12, fontWeight:700, display:'flex',
                  alignItems:'center', justifyContent:'center', padding:'0 6px' }}>{c.unread}</div>
              )}
            </div>
            {/* Delete button revealed by swipe */}
            <button onClick={() => deleteConv(c.partner.id)}
              style={{ position:'absolute', right:0, top:0, bottom:0, width:80,
                background:'#c0392b', border:'none', cursor:'pointer',
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4,
                color:'#fff', fontSize:12, fontWeight:600,
                transition:'opacity 0.2s',
                opacity: swipedConv === c.partner.id ? 1 : 0,
                pointerEvents: swipedConv === c.partner.id ? 'auto' : 'none',
              }}>
              <Trash2 size={18}/>
              <span>Удалить</span>
            </button>
          </div>
        ))}
      </div>

      {/* Bottom safe area */}
      <div style={{ height:'env(safe-area-inset-bottom)', background:'var(--bg-card)', flexShrink:0 }}/>
    </div>
  )

  // ══════════════════════════════════════════════════════════════
  // RENDER — CHAT
  // ══════════════════════════════════════════════════════════════
  return (
    <div style={s.overlay}>
      {/* Chat Header */}
      <div style={{ ...s.header, justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button style={s.backBtn} onClick={() => { setView('list'); setPartner(null); loadConvs() }}>
            <ArrowLeft size={20}/>
          </button>
          {partner && <Av p={partner} size={38}/>}
          <div>
            <div style={{ fontWeight:700, color:'var(--text-primary)', fontSize:16 }}>
              {partner?.display_name || partner?.username}
            </div>
            <div style={{ color:'var(--accent)', fontSize:12 }}>@{partner?.username}</div>
          </div>
        </div>
        <button onClick={() => partner && deleteConv(partner.id)}
          style={{ background:'var(--bg-raised)', border:'none', borderRadius:10,
            padding:10, cursor:'pointer', color:'var(--text-muted)',
            display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Trash2 size={18}/>
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex:1, overflowY:'auto', padding:'16px 12px',
        WebkitOverflowScrolling:'touch', display:'flex', flexDirection:'column', gap:4 }}>
        {grouped.map(group => (
          <div key={group.date}>
            {/* Date separator */}
            <div style={{ textAlign:'center', margin:'12px 0', position:'relative' }}>
              <span style={{ background:'var(--bg-raised)', color:'var(--text-muted)',
                fontSize:12, padding:'4px 12px', borderRadius:10, position:'relative', zIndex:1 }}>
                {group.date}
              </span>
            </div>
            {group.msgs.map(m => {
              const mine = m.from_user_id === userId
              return (
                <div key={m.id} style={{ display:'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom:4 }}>
                  <div>
                    {editingId === m.id ? (
                      <div style={{ display:'flex', gap:8, alignItems:'center', maxWidth:260 }}>
                        <input value={editText} onChange={e => setEditText(e.target.value)}
                          autoFocus onKeyDown={e => { if(e.key==='Enter') saveEdit(); if(e.key==='Escape') setEditingId(null) }}
                          style={{ ...s.input, flex:1, padding:'8px 12px', fontSize:14 }}/>
                        <button onClick={saveEdit} style={{ background:'var(--accent)', border:'none', borderRadius:8, padding:8, cursor:'pointer', color:'#fff' }}><Check size={14}/></button>
                        <button onClick={() => setEditingId(null)} style={{ background:'var(--bg-raised)', border:'none', borderRadius:8, padding:8, cursor:'pointer', color:'var(--text-muted)' }}><X size={14}/></button>
                      </div>
                    ) : (
                      <div
                        onMouseDown={() => onMsgPressStart(m)}
                        onMouseUp={onMsgPressEnd}
                        onTouchStart={() => onMsgPressStart(m)}
                        onTouchEnd={onMsgPressEnd}
                        style={s.bubble(mine)}>
                        <div>{m.content}</div>
                        <div style={{ display:'flex', gap:6, alignItems:'center', justifyContent:'flex-end', marginTop:4 }}>
                          {m.edited && <span style={{ fontSize:11, opacity:0.6 }}>ред.</span>}
                          <span style={{ fontSize:11, opacity:0.6 }}>{fmtTime(m.created_at)}</span>
                          {mine && <Check size={12} style={{ opacity:0.7 }}/>}
                        </div>
                      </div>
                    )}
                    {/* Context menu */}
                    {menuMsgId === m.id && mine && (
                      <div style={{ position:'absolute', zIndex:100,
                        background:'var(--bg-card)', border:'1px solid var(--border)',
                        borderRadius:14, overflow:'hidden', boxShadow:'0 8px 30px rgba(0,0,0,0.3)',
                        animation:'menuPop 0.2s cubic-bezier(0.34,1.56,0.64,1)' }}>
                        <button onClick={() => startEdit(m)} style={{ display:'flex', alignItems:'center', gap:10,
                          padding:'12px 20px', background:'none', border:'none', width:'100%',
                          color:'var(--text-primary)', cursor:'pointer', fontSize:15 }}>
                          <Pencil size={16}/> Изменить
                        </button>
                        <div style={{ height:1, background:'var(--border)' }}/>
                        <button onClick={() => deleteMsg(m.id)} style={{ display:'flex', alignItems:'center', gap:10,
                          padding:'12px 20px', background:'none', border:'none', width:'100%',
                          color:'#e74c3c', cursor:'pointer', fontSize:15 }}>
                          <Trash2 size={16}/> Удалить
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        {msgs.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text-muted)' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>👋</div>
            <div style={{ fontSize:16 }}>Начни разговор!</div>
          </div>
        )}
      </div>

      {/* Context menu backdrop */}
      {menuMsgId && (
        <div onClick={() => setMenuMsgId(null)}
          style={{ position:'fixed', inset:0, zIndex:99 }}/>
      )}

      {/* Emoji panel */}
      {showEmoji && (
        <div style={{ display:'flex', gap:8, padding:'10px 16px',
          background:'var(--bg-card)', borderTop:'1px solid var(--border)',
          flexWrap:'wrap', animation:'fadeSlideUp 0.2s ease' }}>
          {EMOJIS.map(e => (
            <button key={e} onClick={() => { setText(t => t+e); setShowEmoji(false) }}
              style={{ fontSize:24, background:'none', border:'none', cursor:'pointer',
                padding:6, borderRadius:8, transition:'transform 0.15s' }}
              onMouseDown={ev => (ev.currentTarget.style.transform='scale(1.4)')}
              onMouseUp={ev => (ev.currentTarget.style.transform='scale(1)')}>
              {e}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
        paddingBottom:'calc(10px + env(safe-area-inset-bottom))',
        background:'var(--bg-card)', borderTop:'1px solid var(--border)', flexShrink:0 }}>
        <button onClick={() => setShowEmoji(v => !v)}
          style={{ background:'var(--bg-raised)', border:'none', borderRadius:10,
            padding:10, cursor:'pointer', color:'var(--text-muted)',
            display:'flex', alignItems:'center', justifyContent:'center',
            transition:'transform 0.15s' }}>
          <Smile size={20}/>
        </button>
        <input
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Сообщение..."
          style={s.input}
        />
        <button onClick={send} disabled={!text.trim() || sending} style={s.sendBtn(!!text.trim() && !sending)}>
          <Send size={18}/>
        </button>
      </div>
    </div>
  )
}
