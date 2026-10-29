import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Note, Book } from '../types';
import { X, Info, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface Props {
  notes: Note[];
  books: Book[];
  onOpenNote: (note: Note) => void;
  onBack: () => void;
}

interface GNode {
  id: string;
  label: string;
  type: 'note' | 'book' | 'tag';
  color: string;
  r: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number;
  fy?: number;
  data?: Note | Book;
}

interface GLink { source: string; target: string; }

// Поле color хранит вид узла: книга, тема или тип записи
const KIND = { book: 'book', tag: 'tag' } as const;
type NodeStyle = 'filled' | 'outline' | 'dot' | 'bold' | 'dashed';
const STYLE_OF = (kind: string): NodeStyle =>
  kind === 'book' ? 'filled' : kind === 'tag' ? 'dashed' : kind === 'quote' ? 'dot' : kind === 'insight' ? 'bold' : 'outline';

// Цвета берём из темы: canvas не понимает CSS-переменные
const themeColors = () => {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    ink: v('--text-primary', '#1B1A17'),
    paper: v('--bg-card', '#F9F6EF'),
    muted: v('--text-muted', '#6B655B'),
    line: v('--border-mid', '#C4BBAA'),
    label: v('--text-secondary', '#3E3B35'),
  };
};

const TYPE_NAME: Record<string, string> = {
  note: 'Заметка', quote: 'Цитата', insight: 'Инсайт', question: 'Вопрос',
  summary: 'Конспект', idea: 'Идея', task: 'Задача',
};

function buildGraph(notes: Note[], books: Book[]): { nodes: GNode[]; links: GLink[] } {
  const nodes: GNode[] = [];
  const links: GLink[] = [];
  const ids = new Set<string>();

  books.forEach((book, i) => {
    const angle = (i / Math.max(books.length, 1)) * Math.PI * 2;
    nodes.push({
      id: `book_${book.id}`, label: book.title.slice(0, 16),
      type: 'book', color: KIND.book, r: 14,
      x: 200 + Math.cos(angle) * 120, y: 200 + Math.sin(angle) * 120,
      vx: 0, vy: 0, data: book,
    });
    ids.add(`book_${book.id}`);
  });

  const tagCount = new Map<string, number>();
  notes.forEach(n => n.tags?.forEach(t => tagCount.set(t, (tagCount.get(t) || 0) + 1)));
  tagCount.forEach((count, tag) => {
    if (count < 1) return;
    const id = `tag_${tag}`;
    nodes.push({
      id, label: `#${tag}`, type: 'tag', color: KIND.tag,
      r: 7 + Math.min(count * 2, 8),
      x: 200 + (Math.random() - 0.5) * 300,
      y: 200 + (Math.random() - 0.5) * 300,
      vx: 0, vy: 0,
    });
    ids.add(id);
  });

  notes.forEach((note, i) => {
    const angle = (i / Math.max(notes.length, 1)) * Math.PI * 2;
    const id = `note_${note.id}`;
    nodes.push({
      id, label: (note.title || 'Без названия').slice(0, 18),
      type: 'note', color: note.type || 'note',
      r: note.isFavorite ? 11 : 8,
      x: 200 + Math.cos(angle) * 180, y: 200 + Math.sin(angle) * 180,
      vx: 0, vy: 0, data: note,
    });
    ids.add(id);
    if (note.bookId && ids.has(`book_${note.bookId}`))
      links.push({ source: id, target: `book_${note.bookId}` });
    note.tags?.forEach(tag => {
      if (ids.has(`tag_${tag}`)) links.push({ source: id, target: `tag_${tag}` });
    });
    note.linkedNoteIds?.forEach(lid => {
      if (ids.has(`note_${lid}`)) links.push({ source: id, target: `note_${lid}` });
    });
  });

  return { nodes, links };
}

export default function GraphView({ notes, books, onOpenNote, onBack }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const animRef   = useRef<number>(0);
  const nodesRef  = useRef<GNode[]>([]);
  const linksRef  = useRef<GLink[]>([]);
  const scaleRef  = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const dragRef   = useRef<{ node: GNode | null; startX: number; startY: number; panStart: { x: number; y: number } | null }>({
    node: null, startX: 0, startY: 0, panStart: null,
  });

  const [selected, setSelected]  = useState<GNode | null>(null);
  const [hint, setHint]           = useState(true);

  const { nodes, links } = useMemo(() => buildGraph(notes, books), [notes, books]);

  // Init refs
  useEffect(() => {
    nodesRef.current = nodes.map(n => ({ ...n }));
    linksRef.current = links;
    scaleRef.current = 1;
    const W = wrapRef.current?.clientWidth  || 380;
    const H = wrapRef.current?.clientHeight || 400;
    offsetRef.current = { x: W / 2 - 200, y: H / 2 - 200 };
  }, [nodes, links]);

  // Force simulation + draw on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const W = wrapRef.current?.clientWidth  || 380;
      const H = wrapRef.current?.clientHeight || 400;
      canvas.width  = W * devicePixelRatio;
      canvas.height = H * devicePixelRatio;
      canvas.style.width  = `${W}px`;
      canvas.style.height = `${H}px`;
      // setTransform, а не scale: при повороте экрана масштаб не накапливается
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const tick = () => {
      const ns = nodesRef.current;
      const ls = linksRef.current;
      const W = canvas.width  / devicePixelRatio;
      const H = canvas.height / devicePixelRatio;

      // Forces
      const alpha = 0.06;
      ns.forEach(n => {
        if (n.fx !== undefined) { n.x = n.fx; n.y = n.fy!; return; }
        // Repulsion
        ns.forEach(m => {
          if (m.id === n.id) return;
          const dx = n.x - m.x, dy = n.y - m.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 2200 / (dist * dist);
          n.vx += (dx / dist) * force * alpha;
          n.vy += (dy / dist) * force * alpha;
        });
        // Center gravity
        n.vx += (W / 2 - n.x) * 0.004;
        n.vy += (H / 2 - n.y) * 0.004;
      });

      // Links (spring)
      ls.forEach(l => {
        const s = ns.find(n => n.id === l.source);
        const t = ns.find(n => n.id === l.target);
        if (!s || !t) return;
        const dx = t.x - s.x, dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const target = s.type === 'book' || t.type === 'book' ? 100 : 70;
        const force = (dist - target) * 0.03;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (!s.fx) { s.vx += fx; s.vy += fy; }
        if (!t.fx) { t.vx -= fx; t.vy -= fy; }
      });

      ns.forEach(n => {
        if (n.fx !== undefined) return;
        n.vx *= 0.78; n.vy *= 0.78;
        n.x += n.vx; n.y += n.vy;
        n.x = Math.max(n.r + 4, Math.min(W - n.r - 4, n.x));
        n.y = Math.max(n.r + 4, Math.min(H - n.r - 4, n.y));
      });

      // Draw
      const c = themeColors();
      ctx.save();
      ctx.clearRect(0, 0, W, H);
      ctx.translate(offsetRef.current.x, offsetRef.current.y);
      ctx.scale(scaleRef.current, scaleRef.current);

      // Links
      ls.forEach(l => {
        const s = ns.find(n => n.id === l.source);
        const t = ns.find(n => n.id === l.target);
        if (!s || !t) return;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = c.line;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      });

      // Nodes
      ns.forEach(n => {
        const style = STYLE_OF(n.color);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.setLineDash(style === 'dashed' ? [2.5, 2.5] : []);
        if (style === 'filled') {
          ctx.fillStyle = c.ink;
          ctx.fill();
        } else {
          if (style !== 'dashed') { ctx.fillStyle = c.paper; ctx.fill(); }
          ctx.strokeStyle = style === 'dashed' ? c.muted : c.ink;
          ctx.lineWidth = style === 'bold' ? 2.4 : 1.2;
          ctx.stroke();
        }
        ctx.setLineDash([]);
        if (style === 'dot') {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r * 0.35, 0, Math.PI * 2);
          ctx.fillStyle = c.ink;
          ctx.fill();
        }
        ctx.fillStyle = n.type === 'tag' ? c.muted : c.label;
        ctx.font = `${n.type === 'book' ? 10 : 9}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(n.label, n.x, n.y + n.r + 12);
      });

      ctx.restore();
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener('resize', resize); };
  }, []);

  // Canvas → world coords
  const toWorld = useCallback((cx: number, cy: number) => ({
    x: (cx - offsetRef.current.x) / scaleRef.current,
    y: (cy - offsetRef.current.y) / scaleRef.current,
  }), []);

  const hitTest = useCallback((wx: number, wy: number) =>
    nodesRef.current.find(n => Math.hypot(n.x - wx, n.y - wy) < n.r + 6) || null,
  []);

  // Pointer events
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const w  = toWorld(cx, cy);
    const hit = hitTest(w.x, w.y);
    if (hit) {
      dragRef.current = { node: hit, startX: cx, startY: cy, panStart: null };
      hit.fx = hit.x; hit.fy = hit.y;
      try { navigator.vibrate?.(6); } catch {}
    } else {
      dragRef.current = { node: null, startX: cx, startY: cy, panStart: { ...offsetRef.current } };
    }
  }, [toWorld, hitTest]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    if (d.node) {
      const w = toWorld(cx, cy);
      d.node.fx = w.x; d.node.fy = w.y;
      d.node.x  = w.x; d.node.y  = w.y;
    } else if (d.panStart) {
      offsetRef.current = {
        x: d.panStart.x + (cx - d.startX),
        y: d.panStart.y + (cy - d.startY),
      };
    }
  }, [toWorld]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const moved = Math.hypot(cx - d.startX, cy - d.startY);
    if (d.node) {
      if (moved < 5) setSelected(d.node);
      d.node.fx = undefined; d.node.fy = undefined;
    }
    dragRef.current = { node: null, startX: 0, startY: 0, panStart: null };
  }, []);

  // Pinch zoom
  const lastPinch = useRef(0);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinch.current = Math.hypot(dx, dy);
    }
  }, []);
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (lastPinch.current > 0) {
        const ratio = dist / lastPinch.current;
        scaleRef.current = Math.max(0.3, Math.min(4, scaleRef.current * ratio));
      }
      lastPinch.current = dist;
    }
  }, []);

  const zoom = (dir: 1 | -1) => {
    scaleRef.current = Math.max(0.3, Math.min(4, scaleRef.current * (dir > 0 ? 1.25 : 0.8)));
  };
  const resetView = () => {
    scaleRef.current = 1;
    const W = wrapRef.current?.clientWidth  || 380;
    const H = wrapRef.current?.clientHeight || 400;
    offsetRef.current = { x: W / 2 - 200, y: H / 2 - 200 };
  };

  const isEmpty = nodes.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: 'env(safe-area-inset-top) 8px 0', minHeight: 56, borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
        <button aria-label="Назад" onClick={onBack}
          style={{ background: 'none', border: 'none', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-primary)', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 400, color: 'var(--text-primary)', margin: 0 }}>
            Граф связей
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            {nodes.length} узлов · {links.length} связей
          </p>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 10, padding: '8px 16px', borderBottom: '1px solid var(--border)', overflowX: 'auto', flexShrink: 0 }}>
        {([
          ['filled', 'Книги'], ['outline', 'Записи'], ['bold', 'Инсайты'], ['dot', 'Цитаты'], ['dashed', 'Темы'],
        ] as [NodeStyle, string][]).map(([style, name]) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span aria-hidden="true" style={{
              width: 10, height: 10, borderRadius: '50%', boxSizing: 'border-box', position: 'relative',
              background: style === 'filled' ? 'var(--text-primary)' : style === 'dashed' ? 'none' : 'var(--bg-card)',
              border: style === 'filled' ? 'none' : `${style === 'bold' ? 2 : 1}px ${style === 'dashed' ? 'dashed' : 'solid'} ${style === 'dashed' ? 'var(--text-muted)' : 'var(--text-primary)'}`,
            }}>
              {style === 'dot' && <span style={{ position: 'absolute', inset: 2, borderRadius: '50%', background: 'var(--text-primary)' }} />}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{name}</span>
          </div>
        ))}
      </div>

      {/* Hint */}
      {hint && (
        <div style={{
          margin: '8px 16px 0', padding: '8px 12px',
          borderLeft: '1px solid var(--text-primary)',
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
          animation: 'fadeIn var(--dur-quick) var(--ease-calm)',
        }}>
          <Info size={13} strokeWidth={1.5} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', lineHeight: 1.4, flex: 1 }}>
            Тяните узлы, сводите пальцы для зума, нажмите, чтобы открыть
          </span>
          <button onClick={() => setHint(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
            <X size={13} />
          </button>
        </div>
      )}

      {/* Canvas */}
      <div ref={wrapRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', touchAction: 'none' }}>
        {isEmpty ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ fontSize: 22, fontFamily: 'var(--font-serif)', color: 'var(--text-primary)' }}>Граф пуст</div>
            <div style={{ fontSize: 13, textAlign: 'center', maxWidth: 240, lineHeight: 1.6 }}>
              Создай записи и книги — они появятся здесь как связанные узлы
            </div>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', cursor: 'grab', display: 'block' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
          />
        )}

        {/* Zoom controls */}
        {!isEmpty && (
          <div style={{
            position: 'absolute', right: 12, bottom: 12,
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {[
              { icon: <ZoomIn size={16} />, fn: () => zoom(1) },
              { icon: <ZoomOut size={16} />, fn: () => zoom(-1) },
              { icon: <Maximize2 size={16} />, fn: resetView },
            ].map((b, i) => (
              <button key={i} onClick={b.fn} style={{
                width: 40, height: 40, borderRadius: 0,
                background: 'var(--bg-card)', border: '1px solid var(--border-mid)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-primary)', cursor: 'pointer',
              }}>{b.icon}</button>
            ))}
          </div>
        )}
      </div>

      {/* Selected node panel */}
      {selected && selected.data && (
        <div style={{
          position: 'fixed', bottom: 72, left: '50%', transform: 'translateX(-50%)',
          width: 'min(calc(100vw - 32px), 398px)',
          background: 'var(--bg-card)', border: '1px solid var(--border-mid)',
          borderRadius: 2, padding: '16px',
          boxShadow: 'var(--shadow-lg)', zIndex: 200,
          animation: 'calmFeed var(--dur-screen) var(--ease-calm) both',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 2,
              background: STYLE_OF(selected.color) === 'filled' ? 'var(--text-primary)' : 'var(--bg-card)',
              color: STYLE_OF(selected.color) === 'filled' ? 'var(--bg-card)' : 'var(--text-primary)',
              border: '1px solid var(--text-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
              fontFamily: 'var(--font-serif)',
            }}>
              {((selected.type === 'book' ? (selected.data as Book).title : (selected.data as Note).title) || '·')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 400, color: 'var(--text-primary)', marginBottom: 4 }}>
                {selected.type === 'book'
                  ? (selected.data as Book).title
                  : (selected.data as Note).title || 'Без названия'}
              </div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'var(--text-muted)' }}>
                {selected.type === 'book'
                  ? (selected.data as Book).author
                  : `${TYPE_NAME[(selected.data as Note).type] || 'Заметка'} · ${new Date((selected.data as Note).createdAt).toLocaleDateString('ru-RU')}`}
              </div>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
              <X size={16} />
            </button>
          </div>
          {selected.type === 'note' && (
            <button
              onClick={() => { onOpenNote(selected.data as Note); setSelected(null); }}
              style={{
                marginTop: 12, width: '100%', padding: '10px 16px',
                background: 'var(--accent)',
                border: 'none', borderRadius: 0,
                color: 'var(--on-accent)', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              }}
            >Открыть запись</button>
          )}
        </div>
      )}
    </div>
  );
}
