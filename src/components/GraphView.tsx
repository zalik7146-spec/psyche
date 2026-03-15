import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Note, Book } from '../types';
import { X, Info, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface Props {
  notes: Note[];
  books: Book[];
  onOpenNote: (note: Note) => void;
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

const TYPE_COLORS: Record<string, string> = {
  note: '#c8a882', quote: '#d4a84e', insight: '#72b472',
  question: '#7a8ab4', summary: '#b47a7a', idea: '#a47ab4',
  task: '#7ab4a4', book: '#d4914a', tag: '#8c7660',
};

function buildGraph(notes: Note[], books: Book[]): { nodes: GNode[]; links: GLink[] } {
  const nodes: GNode[] = [];
  const links: GLink[] = [];
  const ids = new Set<string>();

  books.forEach((book, i) => {
    const angle = (i / Math.max(books.length, 1)) * Math.PI * 2;
    nodes.push({
      id: `book_${book.id}`, label: book.title.slice(0, 16),
      type: 'book', color: TYPE_COLORS.book, r: 14,
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
      id, label: `#${tag}`, type: 'tag', color: TYPE_COLORS.tag,
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
      type: 'note', color: TYPE_COLORS[note.type] || TYPE_COLORS.note,
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

export default function GraphView({ notes, books, onOpenNote }: Props) {
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
      ctx.scale(devicePixelRatio, devicePixelRatio);
    };
    resize();

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
        ctx.strokeStyle = 'rgba(80,65,45,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Nodes
      ns.forEach(n => {
        // Outer ring
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `${n.color}22`;
        ctx.fill();
        ctx.strokeStyle = n.color;
        ctx.lineWidth = n.type === 'book' ? 2.5 : 1.5;
        ctx.stroke();
        // Inner dot
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.fill();
        // Label
        ctx.fillStyle = 'rgba(200,168,130,0.85)';
        ctx.font = `${n.type === 'book' ? 9.5 : 8.5}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(n.label, n.x, n.y + n.r + 11);
      });

      ctx.restore();
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
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
      <div style={{ padding: '16px 16px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <h2 style={{ fontFamily: 'Lora, serif', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Граф связей
        </h2>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0' }}>
          {nodes.length} узлов · {links.length} связей
        </p>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 10, padding: '8px 16px', borderBottom: '1px solid var(--border)', overflowX: 'auto', flexShrink: 0 }}>
        {[
          { color: TYPE_COLORS.book, label: 'Книги' },
          { color: TYPE_COLORS.note, label: 'Заметки' },
          { color: TYPE_COLORS.insight, label: 'Инсайты' },
          { color: TYPE_COLORS.quote, label: 'Цитаты' },
          { color: TYPE_COLORS.tag, label: 'Теги' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Hint */}
      {hint && (
        <div style={{
          margin: '8px 16px 0', padding: '8px 12px',
          background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 12,
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
          animation: 'fadeIn 0.3s ease',
        }}>
          <Info size={13} color="var(--accent)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', lineHeight: 1.4, flex: 1 }}>
            Тяни узлы · Щипок для зума · Нажми для открытия
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
            <div style={{ fontSize: 48 }}>🕸️</div>
            <div style={{ fontSize: 15, color: 'var(--text-secondary)' }}>Граф пуст</div>
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
                width: 36, height: 36, borderRadius: 10,
                background: 'var(--bg-raised)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-secondary)', cursor: 'pointer',
                boxShadow: 'var(--shadow)',
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
          borderRadius: 18, padding: '16px',
          boxShadow: 'var(--shadow-lg)', zIndex: 200,
          animation: 'sheetSlideUp 0.25s cubic-bezier(0.34,1.2,0.64,1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: `${selected.color}22`, border: `1.5px solid ${selected.color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
            }}>
              {selected.type === 'book' ? '📚' : selected.type === 'tag' ? '🏷️' : '📝'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'Lora, serif', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                {selected.type === 'book'
                  ? (selected.data as Book).title
                  : (selected.data as Note).title || 'Без названия'}
              </div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'var(--text-muted)' }}>
                {selected.type === 'book'
                  ? (selected.data as Book).author
                  : `${(selected.data as Note).type} · ${new Date((selected.data as Note).createdAt).toLocaleDateString('ru-RU')}`}
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
                background: 'linear-gradient(135deg, var(--accent), var(--accent-soft))',
                border: 'none', borderRadius: 12,
                color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >Открыть запись →</button>
          )}
        </div>
      )}
    </div>
  );
}
