import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabase'
import { ArrowLeft, Send, Smile, Search, MessageCircle } from 'lucide-react'

interface Message {
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
  display_name: string
  avatar: string | null
}

interface Conversation {
  partner: Profile
  lastMessage: string
  lastTime: string
  unread: number
}

interface Props {
  userId: string
  initialPartnerId?: string
  onClose: () => void
}

const EMOJIS = ['❤️','🔥','💡','😊','🙏','📚','✨','🧠']

const timeAgo = (iso: string) => {
  const d = new Date(iso), now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (diff < 60) return 'сейчас'
  if (diff < 3600) return `${Math.floor(diff/60)}м`
  if (diff < 86400) return `${Math.floor(diff/3600)}ч`
  if (diff < 172800) return 'вчера'
  return d.toLocaleDateString('ru', {day:'2-digit',month:'2-digit'})
}

const formatTime = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleTimeString('ru', {hour:'2-digit',minute:'2-digit'})
}

const Avatar = ({ profile, size = 44 }: { profile: Profile, size?: number }) => {
  const colors = ['#b8945a','#8a6a3a','#6b8a6a','#6a7a8a','#8a6a7a']
  const color = colors[(profile.username?.charCodeAt(0) || 0) % colors.length]
  if (profile.avatar && profile.avatar.length < 10) {
    return <div style={{width:size,height:size,borderRadius:'50%',background:color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.4,flexShrink:0}}>{profile.avatar}</div>
  }
  if (profile.avatar && profile.avatar.startsWith('data:')) {
    return <img src={profile.avatar} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',flexShrink:0}} alt="" />
  }
  return (
    <div style={{width:size,height:size,borderRadius:'50%',background:`linear-gradient(135deg, ${color}, ${color}99)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.4,fontWeight:700,color:'#fff',flexShrink:0}}>
      {(profile.display_name || profile.username || '?')[0].toUpperCase()}
    </div>
  )
}

export default function MessagesView({ userId, initialPartnerId, onClose }: Props) {
  const [view, setView] = useState<'list'|'chat'>('list')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [partner, setPartner] = useState<Profile | null>(null)
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [showEmoji, setShowEmoji] = useState(false)
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load conversations
  const loadConversations = useCallback(async () => {
    setLoading(true)
    try {
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
        .order('created_at', { ascending: false })

      if (!msgs) { setLoading(false); return }

      const partnerIds = [...new Set(msgs.map(m =>
        m.from_user_id === userId ? m.to_user_id : m.from_user_id
      ))]

      if (partnerIds.length === 0) { setLoading(false); return }

      const { data: profiles } = await supabase
        .from('social_profiles')
        .select('id,username,display_name,avatar')
        .in('id', partnerIds)

      const profileMap: Record<string, Profile> = {}
      profiles?.forEach(p => { profileMap[p.id] = p })

      const convMap: Record<string, Conversation> = {}
      msgs.forEach(m => {
        const pid = m.from_user_id === userId ? m.to_user_id : m.from_user_id
        if (!convMap[pid] && profileMap[pid]) {
          convMap[pid] = {
            partner: profileMap[pid],
            lastMessage: m.content,
            lastTime: timeAgo(m.created_at),
            unread: (!m.is_read && m.to_user_id === userId) ? 1 : 0
          }
        } else if (convMap[pid] && !m.is_read && m.to_user_id === userId) {
          convMap[pid].unread++
        }
      })

      setConversations(Object.values(convMap))
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [userId])

  useEffect(() => { loadConversations() }, [loadConversations])

  // Open chat with initial partner
  useEffect(() => {
    if (initialPartnerId) {
      supabase.from('social_profiles')
        .select('id,username,display_name,avatar')
        .eq('id', initialPartnerId)
        .single()
        .then(({ data }) => { if (data) openChat(data) })
    }
  }, [initialPartnerId])

  const openChat = useCallback(async (p: Profile) => {
    setPartner(p)
    setView('chat')
    setMessages([])

    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(from_user_id.eq.${userId},to_user_id.eq.${p.id}),and(from_user_id.eq.${p.id},to_user_id.eq.${userId})`)
      .order('created_at', { ascending: true })

    setMessages(data || [])

    // Mark as read
    await supabase.from('messages')
      .update({ is_read: true })
      .eq('to_user_id', userId)
      .eq('from_user_id', p.id)

    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    setTimeout(() => inputRef.current?.focus(), 300)

    // Realtime
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = supabase
      .channel(`chat_${userId}_${p.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `to_user_id=eq.${userId}`
      }, payload => {
        const msg = payload.new as Message
        if (msg.from_user_id === p.id) {
          setMessages(prev => [...prev, msg])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
          supabase.from('messages').update({ is_read: true }).eq('id', msg.id)
        }
      })
      .subscribe()
  }, [userId])

  const sendMessage = useCallback(async () => {
    if (!text.trim() || !partner || sending) return
    setSending(true)
    const content = text.trim()
    setText('')
    setShowEmoji(false)

    const optimistic: Message = {
      id: `tmp_${Date.now()}`,
      from_user_id: userId,
      to_user_id: partner.id,
      content,
      is_read: false,
      created_at: new Date().toISOString()
    }
    setMessages(prev => [...prev, optimistic])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    const { data, error } = await supabase.from('messages').insert({
      from_user_id: userId,
      to_user_id: partner.id,
      content,
      is_read: false
    }).select().single()

    if (error) {
      console.error('Send error:', error)
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setText(content)
    } else if (data) {
      setMessages(prev => prev.map(m => m.id === optimistic.id ? data : m))
    }
    setSending(false)
    inputRef.current?.focus()
  }, [text, partner, userId, sending])

  const searchPeople = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return }
    const { data } = await supabase
      .from('social_profiles')
      .select('id,username,display_name,avatar')
      .neq('id', userId)
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(8)
    setSearchResults(data || [])
  }, [userId])

  useEffect(() => {
    const t = setTimeout(() => searchPeople(search), 400)
    return () => clearTimeout(t)
  }, [search, searchPeople])

  useEffect(() => {
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [])

  // Group messages by date
  const groupedMessages = messages.reduce((acc, msg) => {
    const date = new Date(msg.created_at).toLocaleDateString('ru', {day:'2-digit',month:'long'})
    if (!acc[date]) acc[date] = []
    acc[date].push(msg)
    return acc
  }, {} as Record<string, Message[]>)

  // CHAT VIEW
  if (view === 'chat' && partner) return (
    <div style={{position:'fixed',inset:0,zIndex:200,display:'flex',flexDirection:'column',background:'var(--bg-base)'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',paddingTop:'calc(12px + env(safe-area-inset-top))',background:'var(--bg-card)',borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <button onClick={() => { setView('list'); loadConversations() }} style={{width:36,height:36,borderRadius:10,background:'var(--bg-raised)',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-primary)',cursor:'pointer',flexShrink:0}}>
          <ArrowLeft size={18}/>
        </button>
        <Avatar profile={partner} size={40}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:600,color:'var(--text-primary)',fontSize:15,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
            {partner.display_name || partner.username}
          </div>
          <div style={{fontSize:12,color:'var(--accent)',marginTop:1}}>@{partner.username}</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{flex:1,overflowY:'auto',padding:'16px',display:'flex',flexDirection:'column',gap:4}}>
        {Object.entries(groupedMessages).map(([date, msgs]) => (
          <div key={date}>
            <div style={{textAlign:'center',margin:'12px 0',position:'relative'}}>
              <span style={{fontSize:11,color:'var(--text-muted)',background:'var(--bg-base)',padding:'2px 10px',borderRadius:10,border:'1px solid var(--border)'}}>
                {date}
              </span>
            </div>
            {msgs.map((msg, i) => {
              const isMine = msg.from_user_id === userId
              const isFirst = i === 0 || msgs[i-1]?.from_user_id !== msg.from_user_id
              return (
                <div key={msg.id} style={{display:'flex',justifyContent:isMine?'flex-end':'flex-start',marginBottom:2,marginTop:isFirst?8:2,animation:'msgPop 0.2s ease'}}>
                  {!isMine && isFirst && <div style={{width:28,marginRight:6,flexShrink:0}}><Avatar profile={partner} size={28}/></div>}
                  {!isMine && !isFirst && <div style={{width:34,flexShrink:0}}/>}
                  <div style={{maxWidth:'72%'}}>
                    <div style={{
                      padding:'10px 14px',
                      borderRadius:isMine?'18px 18px 4px 18px':'18px 18px 18px 4px',
                      background:isMine?'linear-gradient(135deg, #c49a6c, #8a6a3a)':'var(--bg-card)',
                      border:isMine?'none':'1px solid var(--border)',
                      color:isMine?'#fff':'var(--text-primary)',
                      fontSize:15,lineHeight:1.5,wordBreak:'break-word',
                      boxShadow:isMine?'0 2px 12px rgba(180,130,70,0.3)':'0 1px 4px rgba(0,0,0,0.1)'
                    }}>
                      {msg.content}
                    </div>
                    <div style={{fontSize:11,color:'var(--text-muted)',marginTop:3,textAlign:isMine?'right':'left',paddingInline:4}}>
                      {formatTime(msg.created_at)}
                      {isMine && <span style={{marginLeft:4}}>{msg.is_read ? '✓✓' : '✓'}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        {messages.length === 0 && (
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,opacity:0.5}}>
            <MessageCircle size={48} color="var(--accent)"/>
            <div style={{color:'var(--text-muted)',fontSize:14,textAlign:'center'}}>Начните диалог с {partner.display_name || partner.username}</div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Emoji panel */}
      {showEmoji && (
        <div style={{display:'flex',gap:8,padding:'8px 16px',background:'var(--bg-card)',borderTop:'1px solid var(--border)',flexWrap:'wrap',animation:'fadeSlideUp 0.2s ease'}}>
          {EMOJIS.map(e => (
            <button key={e} onClick={() => setText(t => t+e)} style={{fontSize:24,background:'none',border:'none',cursor:'pointer',padding:'4px',borderRadius:8,transition:'transform 0.15s'}} onPointerDown={el => (el.currentTarget.style.transform='scale(1.4)')} onPointerUp={el => (el.currentTarget.style.transform='scale(1)')}>
              {e}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{padding:'12px 16px',paddingBottom:'calc(12px + env(safe-area-inset-bottom))',background:'var(--bg-card)',borderTop:'1px solid var(--border)',display:'flex',gap:10,alignItems:'flex-end',flexShrink:0}}>
        <button onClick={() => setShowEmoji(v => !v)} style={{width:38,height:38,borderRadius:10,background:'var(--bg-raised)',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',color:showEmoji?'var(--accent)':'var(--text-muted)',cursor:'pointer',flexShrink:0,transition:'color 0.2s'}}>
          <Smile size={18}/>
        </button>
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }}}
          placeholder="Сообщение..."
          rows={1}
          style={{flex:1,background:'var(--bg-raised)',border:'1px solid var(--border)',borderRadius:14,padding:'10px 14px',color:'var(--text-primary)',fontSize:15,resize:'none',outline:'none',fontFamily:'inherit',lineHeight:1.5,maxHeight:100,overflowY:'auto',transition:'border-color 0.2s'}}
          onFocus={e => e.target.style.borderColor='var(--accent)'}
          onBlur={e => e.target.style.borderColor='var(--border)'}
        />
        <button
          onClick={sendMessage}
          disabled={!text.trim() || sending}
          style={{width:42,height:42,borderRadius:12,background:text.trim()?'linear-gradient(135deg, #c49a6c, #8a6a3a)':'var(--bg-raised)',border:text.trim()?'none':'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',color:text.trim()?'#fff':'var(--text-muted)',cursor:text.trim()?'pointer':'default',flexShrink:0,transition:'all 0.2s',transform:text.trim()?'scale(1)':'scale(0.95)'}}
        >
          <Send size={18}/>
        </button>
      </div>
    </div>
  )

  // LIST VIEW
  return (
    <div style={{position:'fixed',inset:0,zIndex:200,display:'flex',flexDirection:'column',background:'var(--bg-base)'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',paddingTop:'calc(12px + env(safe-area-inset-top))',background:'var(--bg-card)',borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <button onClick={onClose} style={{width:36,height:36,borderRadius:10,background:'var(--bg-raised)',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-primary)',cursor:'pointer'}}>
          <ArrowLeft size={18}/>
        </button>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:18,color:'var(--text-primary)'}}>Сообщения</div>
          <div style={{fontSize:12,color:'var(--text-muted)'}}>Личные диалоги</div>
        </div>
      </div>

      {/* Search */}
      <div style={{padding:'12px 16px',background:'var(--bg-card)',borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10,background:'var(--bg-raised)',border:'1px solid var(--border)',borderRadius:12,padding:'8px 14px'}}>
          <Search size={16} color="var(--text-muted)"/>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Найти человека..."
            style={{flex:1,background:'none',border:'none',outline:'none',color:'var(--text-primary)',fontSize:15,fontFamily:'inherit'}}
          />
        </div>
      </div>

      {/* Search results */}
      {searchResults.length > 0 && (
        <div style={{background:'var(--bg-card)',borderBottom:'1px solid var(--border)',flexShrink:0}}>
          <div style={{padding:'8px 16px 4px',fontSize:12,color:'var(--text-muted)',fontWeight:600,textTransform:'uppercase',letterSpacing:0.5}}>Найдено</div>
          {searchResults.map(p => (
            <button key={p.id} onClick={() => { setSearch(''); setSearchResults([]); openChat(p) }} style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'10px 16px',background:'none',border:'none',cursor:'pointer',textAlign:'left',transition:'background 0.15s'}} onPointerEnter={e => e.currentTarget.style.background='var(--bg-raised)'} onPointerLeave={e => e.currentTarget.style.background='none'}>
              <Avatar profile={p} size={40}/>
              <div>
                <div style={{fontWeight:600,color:'var(--text-primary)',fontSize:14}}>{p.display_name || p.username}</div>
                <div style={{fontSize:12,color:'var(--text-muted)'}}>@{p.username}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Conversations */}
      <div style={{flex:1,overflowY:'auto'}}>
        {loading ? (
          <div style={{padding:32,textAlign:'center',color:'var(--text-muted)'}}>
            <div style={{fontSize:24,marginBottom:8}}>💬</div>
            <div style={{fontSize:14}}>Загрузка...</div>
          </div>
        ) : conversations.length === 0 ? (
          <div style={{padding:48,textAlign:'center',color:'var(--text-muted)',display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
            <MessageCircle size={48} color="var(--accent)" strokeWidth={1.5}/>
            <div style={{fontSize:16,fontWeight:600,color:'var(--text-secondary)'}}>Нет диалогов</div>
            <div style={{fontSize:14,lineHeight:1.6}}>Найдите человека через поиск выше и начните общение</div>
          </div>
        ) : (
          conversations.map((conv, i) => (
            <button
              key={conv.partner.id}
              onClick={() => openChat(conv.partner)}
              style={{width:'100%',display:'flex',alignItems:'center',gap:14,padding:'14px 16px',background:'none',border:'none',borderBottom:'1px solid var(--border)',cursor:'pointer',textAlign:'left',transition:'background 0.15s',animation:`fadeSlideUp 0.3s ease ${i*0.05}s both`}}
              onPointerEnter={e => e.currentTarget.style.background='var(--bg-raised)'}
              onPointerLeave={e => e.currentTarget.style.background='none'}
            >
              <div style={{position:'relative',flexShrink:0}}>
                <Avatar profile={conv.partner} size={48}/>
                {conv.unread > 0 && (
                  <div style={{position:'absolute',top:-2,right:-2,minWidth:18,height:18,borderRadius:9,background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'#fff',padding:'0 4px'}}>
                    {conv.unread}
                  </div>
                )}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                  <div style={{fontWeight:600,color:'var(--text-primary)',fontSize:15,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:'70%'}}>
                    {conv.partner.display_name || conv.partner.username}
                  </div>
                  <div style={{fontSize:12,color:'var(--text-muted)',flexShrink:0}}>{conv.lastTime}</div>
                </div>
                <div style={{fontSize:13,color:conv.unread>0?'var(--text-secondary)':'var(--text-muted)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontWeight:conv.unread>0?600:400}}>
                  {conv.lastMessage}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
