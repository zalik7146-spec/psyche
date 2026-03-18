import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ArrowLeft, Search, Send, Trash2, Check, CheckCheck,
  Pencil, X, MessageCircle, Mic, Paperclip, Smile,
  Reply, MoreVertical, Phone, Video,
} from 'lucide-react'
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

interface ReplyTo {
  id: string
  content: string
  senderName: string
}

// ── Helpers ────────────────────────────────────────────────────────────────
const QUICK_REACTIONS = ['👍', '❤️', '😊', '🔥', '💡', '📚', '🙏', '✨']

const fmtTime = (d: string) => {
  const now = new Date(), dt = new Date(d)
  const diff = (now.getTime() - dt.getTime()) / 1000
  if (diff < 60) return 'сейчас'
  if (diff < 3600) return `${Math.floor(diff / 60)}м`
  if (diff < 86400) return dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  if (diff < 172800) return 'вчера'
  return dt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

const fmtMsgTime = (d: string) =>
  new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

const fmtDate = (d: string) => {
  const dt = new Date(d), now = new Date()
  const diff = (now.getTime() - dt.getTime()) / 86400000
  if (diff < 1) return 'Сегодня'
  if (diff < 2) return 'Вчера'
  return dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

// ── Avatar ─────────────────────────────────────────────────────────────────
function Avatar({ p, size = 44 }: { p: Profile; size?: number }) {
  const name = p.display_name || p.username || '?'
  const colors = ['#d4914a', '#6a9e8a', '#8a7a9a', '#7a8a6a', '#9a8a4a', '#6a7a9a']
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: p.avatar?.startsWith('data:') || p.avatar?.startsWith('http')
        ? 'transparent'
        : `linear-gradient(135deg, ${color}, ${color}99)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.38,
      overflow: 'hidden', position: 'relative',
      fontFamily: 'Inter, sans-serif',
    }}>
      {p.avatar?.startsWith('data:') || p.avatar?.startsWith('http')
        ? <img src={p.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
        : p.avatar || name[0].toUpperCase()
      }
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function MessagesView({ userId, initialPartnerId, onBack }: Props) {
  const [view, setView] = useState<'list' | 'chat'>('list')
  const [convs, setConvs] = useState<Conv[]>([])
  const [partner, setPartner] = useState<Profile | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [found, setFound] = useState<Profile[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [menuMsgId, setMenuMsgId] = useState<string | null>(null)
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [swipedConv, setSwipedConv] = useState<string | null>(null)
  const [deletingConv, setDeletingConv] = useState<string | null>(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [typingIndicator, setTypingIndicator] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const touchStartX = useRef(0)
  const touchConvId = useRef<string | null>(null)

  // ── Load conversations ──────────────────────────────────────────────────
  const loadConvs = useCallback(async () => {
    setLoading(true)
    try {
      const { data: sent } = await supabase.from('messages').select('*').eq('from_user_id', userId).order('created_at', { ascending: false })
      const { data: received } = await supabase.from('messages').select('*').eq('to_user_id', userId).order('created_at', { ascending: false })
      const allMsgs = [...(sent || []), ...(received || [])]
      if (!allMsgs.length) { setLoading(false); return }

      const pids = new Set<string>()
      allMsgs.forEach((m: Msg) => pids.add(m.from_user_id === userId ? m.to_user_id : m.from_user_id))

      const { data: profiles } = await supabase.from('social_profiles').select('id,username,display_name,avatar').in('id', Array.from(pids))
      const pm = new Map<string, Profile>()
      profiles?.forEach((p: Profile) => pm.set(p.id, p))

      const cm = new Map<string, Conv>()
      const sorted = allMsgs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      sorted.forEach((m: Msg) => {
        const pid = m.from_user_id === userId ? m.to_user_id : m.from_user_id
        if (!cm.has(pid)) {
          const p = pm.get(pid)
          if (p) cm.set(pid, { partner: p, lastMsg: m.content, lastTime: m.created_at, unread: m.to_user_id === userId && !m.is_read ? 1 : 0 })
        } else if (m.to_user_id === userId && !m.is_read) { cm.get(pid)!.unread++ }
      })
      setConvs(Array.from(cm.values()))
    } catch (e) { console.error('loadConvs error:', e) }
    setLoading(false)
  }, [userId])

  useEffect(() => { loadConvs() }, [loadConvs])

  // ── Initial partner ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!initialPartnerId) return
    supabase.from('social_profiles').select('id,username,display_name,avatar').eq('id', initialPartnerId).single().then(({ data }) => { if (data) openChat(data as Profile) })
  }, [initialPartnerId]) // eslint-disable-line

  // ── Open chat ───────────────────────────────────────────────────────────
  const openChat = useCallback(async (p: Profile) => {
    setPartner(p); setView('chat'); setMenuMsgId(null); setEditingId(null); setText(''); setShowEmoji(false); setReplyTo(null)
    const { data: sent } = await supabase.from('messages').select('*').eq('from_user_id', userId).eq('to_user_id', p.id).order('created_at', { ascending: true })
    const { data: received } = await supabase.from('messages').select('*').eq('from_user_id', p.id).eq('to_user_id', userId).order('created_at', { ascending: true })
    const all = [...(sent || []), ...(received || [])].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    setMsgs(all as Msg[])
    await supabase.from('messages').update({ is_read: true }).eq('to_user_id', userId).eq('from_user_id', p.id).eq('is_read', false)
    setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'instant' as ScrollBehavior }), 80)
    setTimeout(() => inputRef.current?.focus(), 350)

    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = supabase.channel(`chat_${[userId, p.id].sort().join('_')}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, ({ new: m }) => {
        const msg = m as Msg
        if ((msg.from_user_id === p.id && msg.to_user_id === userId) || (msg.from_user_id === userId && msg.to_user_id === p.id)) {
          setMsgs(prev => { if (prev.find(x => x.id === msg.id)) return prev; return [...prev, msg] })
          setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50)
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, ({ old: m }) => { setMsgs(prev => prev.filter(x => x.id !== (m as Msg).id)) })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, ({ new: m }) => { setMsgs(prev => prev.map(x => x.id === (m as Msg).id ? m as Msg : x)) })
      .subscribe()
  }, [userId])

  // ── Search ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (search.trim().length < 1) { setFound([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('social_profiles').select('id,username,display_name,avatar').neq('id', userId).or(`username.ilike.%${search}%,display_name.ilike.%${search}%`).limit(8)
      setFound((data as Profile[]) || [])
    }, 350)
    return () => clearTimeout(t)
  }, [search, userId])

  // ── Send ────────────────────────────────────────────────────────────────
  const send = async () => {
    if (!text.trim() || !partner || sending) return
    setSending(true)
    const content = replyTo ? `↩ ${replyTo.senderName}: "${replyTo.content.slice(0, 50)}"\n${text.trim()}` : text.trim()
    setText(''); setShowEmoji(false); setReplyTo(null)

    const optimistic: Msg = { id: `tmp_${Date.now()}`, from_user_id: userId, to_user_id: partner.id, content, is_read: false, created_at: new Date().toISOString() }
    setMsgs(prev => [...prev, optimistic])
    setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50)

    const { data, error } = await supabase.from('messages').insert({ from_user_id: userId, to_user_id: partner.id, content }).select().single()
    if (error) { setMsgs(prev => prev.filter(m => m.id !== optimistic.id)) }
    else { setMsgs(prev => prev.map(m => m.id === optimistic.id ? data as Msg : m)); loadConvs() }
    setSending(false)
    inputRef.current?.focus()
  }

  const deleteMsg = async (id: string) => {
    setMenuMsgId(null)
    setMsgs(prev => prev.filter(m => m.id !== id))
    const { error } = await supabase.from('messages').delete().eq('id', id).eq('from_user_id', userId)
    if (error && partner) openChat(partner)
  }

  const saveEdit = async () => {
    if (!editingId || !editText.trim()) return
    const content = editText.trim()
    setMsgs(prev => prev.map(m => m.id === editingId ? { ...m, content, edited: true } : m))
    setEditingId(null)
    await supabase.from('messages').update({ content }).eq('id', editingId).eq('from_user_id', userId)
  }

  const deleteConv = async (partnerId: string) => {
    setDeletingConv(partnerId); setSwipedConv(null)
    await supabase.from('messages').delete().eq('from_user_id', userId).eq('to_user_id', partnerId)
    await supabase.from('messages').delete().eq('from_user_id', partnerId).eq('to_user_id', userId)
    setConvs(prev => prev.filter(c => c.partner.id !== partnerId))
    setDeletingConv(null)
  }

  const backToList = () => {
    setView('list'); setPartner(null); setMsgs([])
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
    loadConvs()
  }

  // ── Long press ──────────────────────────────────────────────────────────
  const onPressStart = (m: Msg) => {
    lpTimer.current = setTimeout(() => { navigator.vibrate?.(20); setMenuMsgId(m.id) }, 450)
  }
  const onPressEnd = () => { if (lpTimer.current) clearTimeout(lpTimer.current) }

  // ── Swipe conversation ──────────────────────────────────────────────────
  const onTouchStart = (id: string, e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; touchConvId.current = id }
  const onTouchMove = (e: React.TouchEvent) => {
    const dx = touchStartX.current - e.touches[0].clientX
    if (dx > 50 && touchConvId.current) setSwipedConv(touchConvId.current)
    else if (dx < -20) setSwipedConv(null)
  }
  const onTouchEnd = () => { touchConvId.current = null }

  // ── Group messages by date ──────────────────────────────────────────────
  const grouped: { date: string; msgs: Msg[] }[] = []
  msgs.forEach(m => {
    const d = fmtDate(m.created_at)
    const last = grouped[grouped.length - 1]
    if (last?.date === d) last.msgs.push(m)
    else grouped.push({ date: d, msgs: [m] })
  })

  // ── Keyboard send ───────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-base)', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>

      {/* ╔══════════════════════════════════╗ */}
      {/* ║  LIST VIEW                       ║ */}
      {/* ╚══════════════════════════════════╝ */}
      {view === 'list' && (
        <>
          {/* Header */}
          <div style={{
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
            paddingTop: 'env(safe-area-inset-top, 0px)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
              <button
                onClick={onBack}
                style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: 'var(--bg-raised)', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--text-primary)', flexShrink: 0,
                }}
              >
                <ArrowLeft size={20} />
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Lora, serif', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                  Сообщения
                </div>
                {convs.length > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', marginTop: 2 }}>
                    {convs.length} диалог{convs.length === 1 ? '' : convs.length < 5 ? 'а' : 'ов'}
                  </div>
                )}
              </div>
            </div>

            {/* Search */}
            <div style={{ padding: '0 16px 14px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'var(--bg-raised)', borderRadius: 14,
                padding: '10px 14px', border: '1px solid var(--border)',
              }}>
                <Search size={16} color="var(--text-muted)" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Найти пользователя..."
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'Inter, sans-serif' }}
                />
                {search && (
                  <button onClick={() => { setSearch(''); setFound([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Search results */}
          {found.length > 0 && (
            <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0, maxHeight: 240, overflowY: 'auto' }}>
              <div style={{ padding: '8px 16px 4px', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
                Пользователи
              </div>
              {found.map(p => (
                <div
                  key={p.id}
                  onClick={() => { setSearch(''); setFound([]); openChat(p) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 16px', cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    transition: 'background 0.1s',
                  }}
                >
                  <Avatar p={p} size={40} />
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14, fontFamily: 'Inter, sans-serif' }}>
                      {p.display_name || p.username}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
                      @{p.username}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Conversations list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                <div style={{ color: 'var(--text-muted)', fontSize: 14, fontFamily: 'Inter, sans-serif' }}>Загружаем...</div>
              </div>
            ) : convs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '72px 32px' }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: 'var(--bg-raised)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px', fontSize: 36,
                }}>
                  💬
                </div>
                <div style={{ fontFamily: 'Lora, serif', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                  Нет сообщений
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 14, fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>
                  Найдите читателя через поиск и начните разговор
                </div>
              </div>
            ) : (
              convs.map((c, i) => (
                <div
                  key={c.partner.id}
                  style={{ position: 'relative', overflow: 'hidden', animation: `fadeSlideUp 0.28s ease ${i * 0.04}s both` }}
                  onTouchStart={e => onTouchStart(c.partner.id, e)}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                >
                  {/* Row */}
                  <div
                    onClick={() => { if (swipedConv === c.partner.id) { setSwipedConv(null); return } openChat(c.partner) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      transform: swipedConv === c.partner.id ? 'translateX(-88px)' : 'translateX(0)',
                      transition: 'transform 0.28s cubic-bezier(0.22,1,0.36,1)',
                      background: 'var(--bg-base)',
                    }}
                  >
                    {/* Avatar with unread dot */}
                    <div style={{ position: 'relative' }}>
                      <Avatar p={c.partner} size={50} />
                      {c.unread > 0 && (
                        <div style={{
                          position: 'absolute', bottom: -2, right: -2,
                          width: 20, height: 20, borderRadius: '50%',
                          background: 'var(--accent)',
                          border: '2px solid var(--bg-base)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 700, color: '#fff',
                          fontFamily: 'Inter, sans-serif',
                        }}>
                          {c.unread > 9 ? '9+' : c.unread}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                        <span style={{
                          fontWeight: c.unread > 0 ? 700 : 600,
                          color: 'var(--text-primary)', fontSize: 15,
                          fontFamily: 'Inter, sans-serif',
                        }}>
                          {c.partner.display_name || c.partner.username}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'Inter, sans-serif', flexShrink: 0 }}>
                          {fmtTime(c.lastTime)}
                        </span>
                      </div>
                      <div style={{
                        color: c.unread > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
                        fontSize: 13, fontFamily: 'Inter, sans-serif',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontWeight: c.unread > 0 ? 500 : 400,
                      }}>
                        {c.lastMsg.replace(/\n/g, ' ').slice(0, 60)}
                      </div>
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => { if (confirm(`Удалить переписку?`)) deleteConv(c.partner.id); else setSwipedConv(null) }}
                    style={{
                      position: 'absolute', right: 0, top: 0, bottom: 0,
                      width: 88, background: 'var(--red)',
                      border: 'none', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 4, color: '#fff', opacity: deletingConv === c.partner.id ? 0.5 : 1,
                    }}
                  >
                    <Trash2 size={18} />
                    <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>Удалить</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ╔══════════════════════════════════╗ */}
      {/* ║  CHAT VIEW                       ║ */}
      {/* ╚══════════════════════════════════╝ */}
      {view === 'chat' && partner && (
        <>
          {/* ── Chat Header ────────────────────────────────────────── */}
          <div style={{
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
            paddingTop: 'env(safe-area-inset-top, 0px)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px' }}>
              <button
                onClick={backToList}
                style={{
                  width: 36, height: 36, borderRadius: '50%', background: 'none',
                  border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--accent)', flexShrink: 0,
                }}
              >
                <ArrowLeft size={22} />
              </button>

              {/* Partner info - clickable */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer' }}>
                <div style={{ position: 'relative' }}>
                  <Avatar p={partner} size={40} />
                  {/* Online indicator */}
                  <div style={{
                    position: 'absolute', bottom: 1, right: 1,
                    width: 10, height: 10, borderRadius: '50%',
                    background: 'var(--green)',
                    border: '2px solid var(--bg-card)',
                  }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15, fontFamily: 'Inter, sans-serif' }}>
                    {partner.display_name || partner.username}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--green)', fontFamily: 'Inter, sans-serif' }}>
                    в сети
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 4 }}>
                <button style={{ width: 36, height: 36, borderRadius: '50%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Phone size={18} />
                </button>
                <button style={{ width: 36, height: 36, borderRadius: '50%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Video size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* ── Messages ──────────────────────────────────────────── */}
          <div
            ref={scrollRef}
            onClick={() => setMenuMsgId(null)}
            style={{
              flex: 1, overflowY: 'auto',
              padding: '12px 12px 8px',
              display: 'flex', flexDirection: 'column', gap: 2,
              backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(212,145,74,0.03) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(106,158,138,0.03) 0%, transparent 50%)',
            }}
          >
            {msgs.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, opacity: 0.6 }}>
                <div style={{ fontSize: 48 }}>👋</div>
                <div style={{ fontSize: 14, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
                  Начните разговор
                </div>
              </div>
            ) : (
              grouped.map(group => (
                <div key={group.date}>
                  {/* Date separator */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '8px 0',
                  }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    <div style={{
                      fontSize: 11, color: 'var(--text-muted)',
                      fontFamily: 'Inter, sans-serif', fontWeight: 500,
                      padding: '3px 10px', background: 'var(--bg-raised)',
                      borderRadius: 10, border: '1px solid var(--border)',
                      whiteSpace: 'nowrap',
                    }}>
                      {group.date}
                    </div>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  </div>

                  {group.msgs.map((m, mi) => {
                    const isMine = m.from_user_id === userId
                    const isFirst = mi === 0 || group.msgs[mi - 1].from_user_id !== m.from_user_id
                    const isLast = mi === group.msgs.length - 1 || group.msgs[mi + 1].from_user_id !== m.from_user_id
                    const isReply = m.content.startsWith('↩ ')
                    const lines = isReply ? m.content.split('\n') : null
                    const replyLine = isReply && lines ? lines[0] : null
                    const mainText = isReply && lines ? lines.slice(1).join('\n') : m.content

                    return (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          justifyContent: isMine ? 'flex-end' : 'flex-start',
                          marginBottom: isLast ? 6 : 2,
                          paddingLeft: isMine ? 48 : 0,
                          paddingRight: isMine ? 0 : 48,
                          animation: m.id.startsWith('tmp_') ? 'msgPop 0.2s ease both' : 'none',
                        }}
                      >
                        {/* Reaction/menu overlay */}
                        {menuMsgId === m.id && (
                          <div
                            style={{
                              position: 'fixed', inset: 0, zIndex: 100,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: 'rgba(0,0,0,0.5)',
                            }}
                            onClick={() => setMenuMsgId(null)}
                          >
                            <div
                              onClick={e => e.stopPropagation()}
                              style={{
                                background: 'var(--bg-raised)',
                                borderRadius: 20,
                                padding: '12px',
                                display: 'flex', flexDirection: 'column', gap: 8,
                                border: '1px solid var(--border-mid)',
                                boxShadow: 'var(--shadow-lg)',
                                minWidth: 200,
                                animation: 'scaleInBounce 0.3s cubic-bezier(0.34,1.4,0.64,1) both',
                              }}
                            >
                              {/* Quick reactions */}
                              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '4px 0' }}>
                                {QUICK_REACTIONS.map(r => (
                                  <button
                                    key={r}
                                    onClick={() => setMenuMsgId(null)}
                                    style={{
                                      width: 36, height: 36, borderRadius: '50%',
                                      background: 'var(--bg-hover)',
                                      border: '1px solid var(--border)',
                                      fontSize: 18, cursor: 'pointer',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      transition: 'transform 0.1s',
                                    }}
                                  >
                                    {r}
                                  </button>
                                ))}
                              </div>

                              <div style={{ height: 1, background: 'var(--border)' }} />

                              {/* Actions */}
                              <button
                                onClick={() => { setReplyTo({ id: m.id, content: m.content, senderName: isMine ? 'Вы' : (partner.display_name || partner.username) }); setMenuMsgId(null) }}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'Inter, sans-serif', width: '100%', textAlign: 'left' }}
                              >
                                <Reply size={16} color="var(--text-secondary)" /> Ответить
                              </button>

                              {isMine && (
                                <>
                                  <button
                                    onClick={() => { setEditingId(m.id); setEditText(m.content); setMenuMsgId(null) }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'Inter, sans-serif', width: '100%', textAlign: 'left' }}
                                  >
                                    <Pencil size={16} color="var(--text-secondary)" /> Редактировать
                                  </button>
                                  <button
                                    onClick={() => deleteMsg(m.id)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 14, fontFamily: 'Inter, sans-serif', width: '100%', textAlign: 'left' }}
                                  >
                                    <Trash2 size={16} /> Удалить
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Avatar for received messages */}
                        {!isMine && isFirst && (
                          <div style={{ flexShrink: 0, marginRight: 6, alignSelf: 'flex-end', marginBottom: 2 }}>
                            <Avatar p={partner} size={28} />
                          </div>
                        )}
                        {!isMine && !isFirst && <div style={{ width: 34, flexShrink: 0 }} />}

                        {/* Bubble */}
                        <div
                          onPointerDown={() => onPressStart(m)}
                          onPointerUp={onPressEnd}
                          onPointerLeave={onPressEnd}
                          onContextMenu={e => { e.preventDefault(); if (isMine) { navigator.vibrate?.(20); setMenuMsgId(m.id) } }}
                          style={{
                            maxWidth: '78%',
                            padding: '9px 13px 7px',
                            borderRadius: isMine
                              ? `18px 18px ${isLast ? '4px' : '18px'} 18px`
                              : `18px 18px 18px ${isLast ? '4px' : '18px'}`,
                            background: isMine
                              ? 'linear-gradient(135deg, var(--accent), #a06830)'
                              : 'var(--bg-raised)',
                            border: isMine ? 'none' : '1px solid var(--border)',
                            cursor: 'pointer',
                            userSelect: 'none',
                            WebkitUserSelect: 'none',
                            boxShadow: isMine ? '0 2px 8px rgba(212,145,74,0.25)' : '0 1px 4px rgba(0,0,0,0.15)',
                          }}
                        >
                          {/* Editing */}
                          {editingId === m.id ? (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <input
                                value={editText}
                                onChange={e => setEditText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && saveEdit()}
                                autoFocus
                                style={{
                                  background: 'rgba(255,255,255,0.15)',
                                  border: '1px solid rgba(255,255,255,0.3)',
                                  borderRadius: 8, padding: '4px 8px',
                                  color: '#fff', fontSize: 14, outline: 'none',
                                  fontFamily: 'Inter, sans-serif', flex: 1,
                                }}
                              />
                              <button onClick={saveEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 0, display: 'flex' }}>
                                <Check size={16} />
                              </button>
                              <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', padding: 0, display: 'flex' }}>
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <>
                              {/* Reply preview */}
                              {isReply && replyLine && (
                                <div style={{
                                  borderLeft: '3px solid rgba(255,255,255,0.5)',
                                  paddingLeft: 8, marginBottom: 6,
                                  fontSize: 12,
                                  color: isMine ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)',
                                  fontFamily: 'Inter, sans-serif',
                                  display: '-webkit-box', WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                }}>
                                  {replyLine.replace('↩ ', '')}
                                </div>
                              )}

                              {/* Message text */}
                              <div style={{
                                fontSize: 14, lineHeight: 1.55,
                                color: isMine ? '#fff' : 'var(--text-primary)',
                                fontFamily: 'Inter, sans-serif',
                                wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                              }}>
                                {mainText}
                              </div>

                              {/* Footer: time + status */}
                              <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                                gap: 4, marginTop: 3,
                              }}>
                                {m.edited && (
                                  <span style={{ fontSize: 10, color: isMine ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
                                    ред.
                                  </span>
                                )}
                                <span style={{ fontSize: 10, color: isMine ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
                                  {fmtMsgTime(m.created_at)}
                                </span>
                                {isMine && (
                                  m.is_read
                                    ? <CheckCheck size={13} color="rgba(255,255,255,0.9)" />
                                    : <Check size={13} color="rgba(255,255,255,0.6)" />
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))
            )}

            {/* Typing indicator */}
            {typingIndicator && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <Avatar p={partner} size={28} />
                <div style={{
                  padding: '10px 14px', borderRadius: '18px 18px 18px 4px',
                  background: 'var(--bg-raised)', border: '1px solid var(--border)',
                  display: 'flex', gap: 4, alignItems: 'center',
                }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: 'var(--text-muted)',
                      animation: `pulse-soft 1.2s ease ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Input Area ────────────────────────────────────────── */}
          <div style={{
            background: 'var(--bg-card)',
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}>
            {/* Reply preview */}
            {replyTo && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 16px', borderBottom: '1px solid var(--border)',
                background: 'var(--bg-raised)',
              }}>
                <div style={{ width: 3, height: 36, borderRadius: 2, background: 'var(--accent)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
                    {replyTo.senderName}
                  </div>
                  <div style={{
                    fontSize: 12, color: 'var(--text-muted)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontFamily: 'Inter, sans-serif',
                  }}>
                    {replyTo.content}
                  </div>
                </div>
                <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Emoji panel */}
            {showEmoji && (
              <div style={{
                display: 'flex', gap: 4, flexWrap: 'wrap',
                padding: '10px 14px', borderBottom: '1px solid var(--border)',
                background: 'var(--bg-raised)',
                animation: 'slideDown 0.2s ease both',
              }}>
                {['😊','😂','❤️','🔥','💡','📚','✨','🙏','👍','🎯','🧠','💭','🌱','📖','✦','🪶'].map(e => (
                  <button
                    key={e}
                    onClick={() => { setText(prev => prev + e) }}
                    style={{
                      width: 36, height: 36, fontSize: 20, background: 'none',
                      border: 'none', cursor: 'pointer', borderRadius: 8,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'transform 0.1s',
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}

            {/* Main input row */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '10px 12px' }}>
              {/* Emoji button */}
              <button
                onClick={() => setShowEmoji(v => !v)}
                style={{
                  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                  background: showEmoji ? 'var(--accent-glow)' : 'var(--bg-raised)',
                  border: `1px solid ${showEmoji ? 'var(--accent-dim)' : 'var(--border)'}`,
                  cursor: 'pointer', color: showEmoji ? 'var(--accent)' : 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Smile size={18} />
              </button>

              {/* Text input */}
              <div style={{ flex: 1, position: 'relative' }}>
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={e => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
                  onKeyDown={handleKeyDown}
                  placeholder="Сообщение..."
                  rows={1}
                  style={{
                    width: '100%', background: 'var(--bg-raised)',
                    border: '1px solid var(--border)', borderRadius: 20,
                    padding: '9px 14px', color: 'var(--text-primary)',
                    fontSize: 14, fontFamily: 'Inter, sans-serif',
                    outline: 'none', resize: 'none', lineHeight: 1.5,
                    maxHeight: 120, overflowY: 'auto',
                    boxSizing: 'border-box', display: 'block',
                    transition: 'border-color 0.15s',
                  }}
                />
              </div>

              {/* Send / Mic button */}
              <button
                onClick={text.trim() ? send : undefined}
                style={{
                  width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                  background: text.trim()
                    ? 'linear-gradient(135deg, var(--accent), #8a5220)'
                    : 'var(--bg-raised)',
                  border: `1px solid ${text.trim() ? 'transparent' : 'var(--border)'}`,
                  cursor: 'pointer',
                  color: text.trim() ? '#fff' : 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s cubic-bezier(0.34,1.1,0.64,1)',
                  transform: text.trim() ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: text.trim() ? '0 2px 12px rgba(212,145,74,0.35)' : 'none',
                }}
              >
                {text.trim()
                  ? <Send size={18} style={{ transform: 'translateX(1px)' }} />
                  : <Mic size={18} />
                }
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
