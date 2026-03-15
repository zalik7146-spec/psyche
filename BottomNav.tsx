import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import {
  Bold, Italic, Underline as UIcon, Strikethrough, Code,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Quote, Minus, ChevronLeft,
  Star, Pin, Hash, BookOpen, ChevronDown, Check,
  Heading1, Heading2, Heading3,
  Superscript as SuperIcon, Subscript as SubIcon,
  Highlighter, Type, Undo2, Redo2, RemoveFormatting,
  Pilcrow, Trash2,
} from 'lucide-react';
import { Note, Book, Tag, NoteType, Template } from '../types';
import { createNote } from '../store';

interface Props {
  note?: Note;
  books: Book[];
  tags: Tag[];
  allNotes?: Note[];
  templates?: Template[];
  onSave: (note: Note) => void;
  onClose: () => void;
  onDelete?: (noteId: string) => void;
  onAddTag: (name: string) => Tag;
  onExportPDF?: (note: Note) => void;
  onCreateFlashcard?: (note: Note) => void;
  defaultBookId?: string;
  pendingTemplate?: Template | null;
  onTemplateClear?: () => void;
}

const NOTE_TYPES: Record<NoteType, { label: string; icon: string; color: string }> = {
  note:     { label: 'Заметка',  icon: '📝', color: 'var(--text-secondary)' },
  quote:    { label: 'Цитата',   icon: '❝',  color: '#d4914a' },
  insight:  { label: 'Инсайт',  icon: '💡', color: '#6a9e8a' },
  question: { label: 'Вопрос',  icon: '🔍', color: '#8a7a9a' },
  summary:  { label: 'Резюме',  icon: '📋', color: '#7a8a6a' },
  idea:     { label: 'Идея',    icon: '🌱', color: '#9a8a4a' },
  task:     { label: 'Задача',  icon: '✓',  color: '#6a7a9a' },
};

const HIGHLIGHT_COLORS = [
  { color: 'rgba(251,191,36,0.45)',  label: 'Жёлтый' },
  { color: 'rgba(134,239,172,0.38)', label: 'Зелёный' },
  { color: 'rgba(212,145,74,0.42)',  label: 'Янтарь' },
  { color: 'rgba(167,139,250,0.38)', label: 'Фиолет' },
  { color: 'rgba(248,113,113,0.38)', label: 'Красный' },
  { color: 'rgba(96,165,250,0.35)',  label: 'Синий' },
  { color: 'rgba(251,146,60,0.38)',  label: 'Оранж' },
  { color: 'rgba(244,114,182,0.35)', label: 'Розовый' },
];

const TEXT_COLORS = [
  { color: 'var(--text-primary)',   label: 'Стандарт' },
  { color: '#d4914a',               label: 'Янтарь' },
  { color: '#78c8a0',               label: 'Зелёный' },
  { color: '#a090c0',               label: 'Фиолет' },
  { color: '#e07070',               label: 'Красный' },
  { color: '#70a0d0',               label: 'Синий' },
  { color: '#d4b840',               label: 'Золото' },
  { color: '#c09080',               label: 'Медь' },
];

const QUOTE_COLORS = ['#d4914a', '#6a9e8a', '#8a7a9a', '#7a8a6a', '#9a8a4a', '#6a7a9a'];

type MenuType = 'type' | 'book' | 'highlight' | 'color' | null;

interface DropRect { top: number; left: number; width: number; bottom: number; }

export default function NoteEditor({ note, books, tags, allNotes: _allNotes, templates: _templates, onSave, onClose, onDelete, onAddTag, onExportPDF, onCreateFlashcard: _onCreateFlashcard, defaultBookId, pendingTemplate, onTemplateClear }: Props) {
  const [title, setTitle]           = useState(note?.title || '');
  const [type, setType]             = useState<NoteType>(note?.type || 'note');
  const [bookId, setBookId]         = useState<string | undefined>(note?.bookId ?? defaultBookId);
  const [page, setPage]             = useState<string>(note?.page?.toString() || '');
  const [chapter, setChapter]       = useState(note?.chapter || '');
  const [quote, setQuote]           = useState(note?.quote || '');
  const [quoteColor, setQuoteColor] = useState(note?.quoteColor || '#d4914a');
  const [noteTags, setNoteTags]     = useState<string[]>(note?.tags || []);
  const [isPinned, setIsPinned]     = useState(note?.isPinned || false);
  const [isFavorite, setIsFavorite] = useState(note?.isFavorite || false);
  const [newTagName, setNewTagName] = useState('');
  const [saved, setSaved]           = useState(false);
  const [showMeta, setShowMeta]     = useState(false);

  const [openMenu, setOpenMenu] = useState<MenuType>(null);
  const [dropRect, setDropRect] = useState<DropRect | null>(null);

  const typeBtnRef      = useRef<HTMLButtonElement>(null);
  const bookBtnRef      = useRef<HTMLButtonElement>(null);
  const highlightBtnRef = useRef<HTMLButtonElement>(null);
  const colorBtnRef     = useRef<HTMLButtonElement>(null);
  const toolbarRef      = useRef<HTMLDivElement>(null);
  const saveTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Superscript,
      Subscript,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Начните писать…' }),
    ],
    content: note?.content || '',
    editorProps: { attributes: { class: 'tiptap-editor' } },
    onUpdate: () => triggerAutoSave(),
  });

  const countWords = useCallback((html: string) => {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return text ? text.split(' ').length : 0;
  }, []);

  const buildNote = useCallback((): Note => {
    const content = editor?.getHTML() || '';
    const base = note || createNote({});
    return {
      ...base,
      title: title.trim() || 'Без заголовка',
      type, content, bookId,
      page: page ? parseInt(page) : undefined,
      chapter: chapter.trim() || undefined,
      quote: quote.trim() || undefined,
      quoteColor, tags: noteTags, isPinned, isFavorite,
      wordCount: countWords(content),
      updatedAt: new Date().toISOString(),
    };
  }, [editor, note, title, type, bookId, page, chapter, quote, quoteColor, noteTags, isPinned, isFavorite, countWords]);

  const triggerAutoSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    }, 3000);
  }, []);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const handleSave = () => {
    const n = buildNote();
    const plain = n.content.replace(/<[^>]+>/g, '').trim();
    // Don't save completely empty new notes
    if (!note && !plain && n.title === 'Без заголовка') { onClose(); return; }
    onSave(n);
    onClose();
  };

  const handleClose = () => {
    // If it's a new note and empty — just close without saving
    const content = editor?.getHTML() || '';
    const plain = content.replace(/<[^>]+>/g, '').trim();
    if (!note && !plain && !title.trim()) { onClose(); return; }
    // Otherwise autosave
    if (note || plain || title.trim()) {
      const n = buildNote();
      onSave(n);
    }
    onClose();
  };

  const toggleTag = (tagId: string) => {
    setNoteTags(prev => prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]);
  };

  const handleNewTag = () => {
    const name = newTagName.trim();
    if (!name) return;
    const tag = onAddTag(name);
    setNoteTags(prev => [...prev, tag.id]);
    setNewTagName('');
  };

  const closeMenu = () => { setOpenMenu(null); setDropRect(null); };

  // Apply pending template when editor is ready
  useEffect(() => {
    if (!pendingTemplate || !editor) return;
    editor.commands.setContent(pendingTemplate.contentHtml);
    setType(pendingTemplate.type);
    if (onTemplateClear) onTemplateClear();
  }, [pendingTemplate, editor]); // eslint-disable-line

  // Открываем дропдаун — вычисляем позицию кнопки через getBoundingClientRect
  // Dropdown рендерится через портал поверх всего, ВЫШЕ кнопки
  const openDropdown = (which: MenuType, ref: React.RefObject<HTMLElement | null>) => {
    if (openMenu === which) { closeMenu(); return; }
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setDropRect({ top: r.top, left: r.left, width: r.width, bottom: r.bottom });
    setOpenMenu(which);
  };

  const typeMeta = NOTE_TYPES[type];
  const bookName = bookId ? (books.find(b => b.id === bookId)?.title || '') : '';

  // ── Toolbar button helper ─────────────────────────────────────────────
  const TB = ({
    onClick, active, title: tt, children, danger,
  }: {
    onClick: () => void; active?: boolean; title?: string;
    children: React.ReactNode; danger?: boolean;
  }) => (
    <button
      className={`tb-btn${active ? ' active' : ''}`}
      onClick={onClick}
      title={tt}
      onMouseDown={e => e.preventDefault()}
      style={danger ? { color: 'var(--red)' } : undefined}
    >
      {children}
    </button>
  );

  if (!editor) return null;

  // ── Dropdown portal — renders ABOVE the trigger button ────────────────
  const renderDropdown = () => {
    if (!openMenu || !dropRect) return null;

    const DROPDOWN_W = openMenu === 'book' ? 230 : 210;

    // Высота контента дропдауна
    const contentH =
      openMenu === 'type' ? (Object.keys(NOTE_TYPES).length * 44 + 36) :
      openMenu === 'book' ? Math.min(books.length * 40 + 80, 300) :
      openMenu === 'highlight' ? 180 :
      openMenu === 'color' ? 180 : 200;

    // Позиция: стараемся показать выше кнопки
    const spaceAbove = dropRect.top - 8;
    const spaceBelow = window.innerHeight - dropRect.bottom - 8;
    const showAbove  = spaceAbove >= contentH || spaceAbove >= spaceBelow;

    let top: number;
    if (showAbove) {
      top = Math.max(8, dropRect.top - contentH - 8);
    } else {
      top = dropRect.bottom + 6;
    }

    // Горизонтально — не выходим за правый край
    const leftRaw = dropRect.left;
    const left    = Math.min(leftRaw, window.innerWidth - DROPDOWN_W - 8);

    let inner: React.ReactNode = null;

    if (openMenu === 'type') {
      inner = (
        <div style={{ minWidth: 170 }}>
          <p style={{ margin: '0 0 6px 4px', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Тип записи
          </p>
          {(Object.keys(NOTE_TYPES) as NoteType[]).map(t => (
            <button key={t}
              onClick={() => { setType(t); closeMenu(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                width: '100%', padding: '10px 12px', borderRadius: 10,
                background: type === t ? 'var(--bg-active)' : 'none',
                border: 'none', cursor: 'pointer',
                color: NOTE_TYPES[t].color,
                fontSize: 13, fontFamily: 'Inter,sans-serif', textAlign: 'left',
                transition: 'background 0.12s',
              }}
            >
              <span style={{ fontSize: 16 }}>{NOTE_TYPES[t].icon}</span>
              {NOTE_TYPES[t].label}
              {type === t && <Check size={12} style={{ marginLeft: 'auto' }} />}
            </button>
          ))}
        </div>
      );
    }

    if (openMenu === 'book') {
      inner = (
        <div style={{ minWidth: 210, maxHeight: 280, overflowY: 'auto' }}>
          <p style={{ margin: '0 0 6px 4px', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Книга
          </p>
          <button
            onClick={() => { setBookId(undefined); closeMenu(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '9px 12px', borderRadius: 10,
              background: !bookId ? 'var(--bg-active)' : 'none',
              border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
              fontSize: 13, fontFamily: 'Inter,sans-serif', textAlign: 'left',
              transition: 'background 0.12s',
            }}
          >
            <span style={{ fontSize: 16 }}>📚</span>
            Без книги
            {!bookId && <Check size={12} style={{ marginLeft: 'auto' }} />}
          </button>
          {books.map(b => (
            <button key={b.id}
              onClick={() => { setBookId(b.id); closeMenu(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                padding: '9px 12px', borderRadius: 10,
                background: bookId === b.id ? 'var(--bg-active)' : 'none',
                border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
                fontSize: 13, fontFamily: 'Inter,sans-serif', textAlign: 'left',
                transition: 'background 0.12s',
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{b.coverEmoji}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {b.title}
              </span>
              {bookId === b.id && <Check size={12} style={{ flexShrink: 0 }} />}
            </button>
          ))}
        </div>
      );
    }

    if (openMenu === 'highlight') {
      inner = (
        <div style={{ width: 210 }}>
          <p style={{ margin: '0 0 10px 2px', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Выделение фоном
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {HIGHLIGHT_COLORS.map(h => (
              <div
                key={h.color}
                title={h.label}
                style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: h.color, cursor: 'pointer',
                  border: '2px solid var(--border-mid)',
                  transition: 'transform 0.1s, border-color 0.1s',
                }}
                onMouseEnter={e => { (e.target as HTMLElement).style.transform = 'scale(1.12)'; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.transform = 'scale(1)'; }}
                onMouseDown={e => {
                  e.preventDefault();
                  editor.chain().focus().setHighlight({ color: h.color }).run();
                  closeMenu();
                }}
              />
            ))}
          </div>
          <button
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetHighlight().run(); closeMenu(); }}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 9,
              background: 'var(--bg-active)', border: '1px solid var(--border-mid)',
              color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
              fontFamily: 'Inter,sans-serif',
            }}
          >
            Сбросить выделение
          </button>
        </div>
      );
    }

    if (openMenu === 'color') {
      inner = (
        <div style={{ width: 210 }}>
          <p style={{ margin: '0 0 10px 2px', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Цвет текста
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {TEXT_COLORS.map(tc => (
              <div
                key={tc.color}
                title={tc.label}
                style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: tc.color === 'var(--text-primary)' ? 'var(--text-primary)' : tc.color,
                  cursor: 'pointer',
                  border: '2px solid var(--border-mid)',
                  transition: 'transform 0.1s',
                }}
                onMouseEnter={e => { (e.target as HTMLElement).style.transform = 'scale(1.12)'; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.transform = 'scale(1)'; }}
                onMouseDown={e => {
                  e.preventDefault();
                  editor.chain().focus().setColor(tc.color).run();
                  closeMenu();
                }}
              />
            ))}
          </div>
          <button
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetColor().run(); closeMenu(); }}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 9,
              background: 'var(--bg-active)', border: '1px solid var(--border-mid)',
              color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
              fontFamily: 'Inter,sans-serif',
            }}
          >
            Сбросить цвет
          </button>
        </div>
      );
    }

    return createPortal(
      <>
        {/* Backdrop — closes menu on outside click */}
        <div
          onClick={closeMenu}
          style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            background: 'transparent',
          }}
        />
        {/* Dropdown panel */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top,
            left,
            zIndex: 9999,
            background: 'var(--bg-raised)',
            border: '1px solid var(--border-mid)',
            borderRadius: 16,
            padding: 12,
            boxShadow: '0 12px 48px rgba(0,0,0,0.7), 0 4px 16px rgba(0,0,0,0.4)',
            animation: 'scaleIn 0.15s cubic-bezier(0.22,1,0.36,1) both',
            maxHeight: '70vh',
            overflowY: 'auto',
          }}
        >
          {inner}
        </div>
      </>,
      document.body
    );
  };

  return (
    <>
      {renderDropdown()}

      <div
        style={{
          position: 'absolute', inset: 0, zIndex: 30,
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg-base)',
          animation: 'fadeIn 0.18s ease-out',
        }}
        onClick={closeMenu}
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <div style={{
          paddingTop: 'calc(env(safe-area-inset-top,0px) + 10px)',
          padding: 'calc(env(safe-area-inset-top,0px) + 10px) 12px 8px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-base)',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <button
            onClick={handleClose}
            style={{
              width: 38, height: 38, borderRadius: 11,
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0,
              transition: 'background 0.15s',
            }}
          >
            <ChevronLeft size={18} />
          </button>

          {/* Delete button — only for existing saved notes */}
          {note && onDelete && (
            <button
              onClick={() => {
                try { navigator.vibrate?.(18); } catch {}
                if (window.confirm('Удалить эту запись?')) onDelete(note.id);
              }}
              style={{
                width: 38, height: 38, borderRadius: 11,
                background: 'var(--bg-raised)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--red)', cursor: 'pointer', flexShrink: 0,
                transition: 'background 0.15s',
              }}
            >
              <Trash2 size={16} />
            </button>
          )}

          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Заголовок…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)',
              fontFamily: 'Lora, serif', minWidth: 0,
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            {saved && (
              <span style={{ fontSize: 11, color: 'var(--green)', fontFamily: 'Inter,sans-serif', marginRight: 4 }}>✓</span>
            )}
            <button
              onClick={() => setIsFavorite(v => !v)}
              style={{
                width: 34, height: 34, borderRadius: 9,
                background: 'none', border: 'none',
                color: isFavorite ? '#d4914a' : 'var(--text-muted)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'color 0.15s',
              }}
            >
              <Star size={17} fill={isFavorite ? '#d4914a' : 'none'} />
            </button>
            <button
              onClick={() => setIsPinned(v => !v)}
              style={{
                width: 34, height: 34, borderRadius: 9,
                background: 'none', border: 'none',
                color: isPinned ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'color 0.15s',
              }}
            >
              <Pin size={17} fill={isPinned ? 'var(--accent)' : 'none'} />
            </button>
            {onExportPDF && note && (
              <button
                onClick={() => { try { navigator.vibrate?.(8); } catch {} onExportPDF(note); }}
                title="Экспорт в PDF"
                style={{
                  width: 34, height: 34, borderRadius: 9,
                  background: 'none', border: 'none',
                  color: 'var(--text-muted)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'color 0.15s',
                  fontSize: 16,
                }}
              >
                📄
              </button>
            )}
            <button
              onClick={handleSave}
              style={{
                padding: '8px 14px', borderRadius: 11,
                background: 'var(--accent)', border: 'none',
                color: '#fff', fontWeight: 700, fontSize: 13,
                fontFamily: 'Inter,sans-serif', cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 12px rgba(212,145,74,0.35)',
              }}
            >
              Готово
            </button>
          </div>
        </div>

        {/* ── Meta strip ──────────────────────────────────────────── */}
        <div style={{
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          background: 'var(--bg-base)',
        }}>
          {/* Row: type picker + book picker + meta toggle */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Type picker */}
            <button
              ref={typeBtnRef}
              onClick={() => openDropdown('type', typeBtnRef)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 11px', borderRadius: 10,
                background: 'var(--bg-raised)', border: '1px solid var(--border-mid)',
                color: typeMeta.color, cursor: 'pointer',
                fontSize: 12, fontWeight: 600, fontFamily: 'Inter,sans-serif',
                flexShrink: 0, whiteSpace: 'nowrap',
                transition: 'background 0.15s',
              }}
            >
              <span style={{ fontSize: 14 }}>{typeMeta.icon}</span>
              {typeMeta.label}
              <ChevronDown size={11} />
            </button>

            {/* Book picker */}
            <button
              ref={bookBtnRef}
              onClick={() => openDropdown('book', bookBtnRef)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 11px', borderRadius: 10,
                background: 'var(--bg-raised)', border: '1px solid var(--border-mid)',
                color: bookId ? 'var(--text-secondary)' : 'var(--text-muted)',
                cursor: 'pointer', fontSize: 12, fontFamily: 'Inter,sans-serif',
                flex: 1, minWidth: 0, overflow: 'hidden',
                transition: 'background 0.15s',
              }}
            >
              <BookOpen size={11} style={{ flexShrink: 0 }} />
              <span style={{
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                flex: 1, textAlign: 'left',
              }}>
                {bookName || 'Книга…'}
              </span>
              <ChevronDown size={11} style={{ flexShrink: 0 }} />
            </button>

            {/* Meta toggle */}
            <button
              onClick={() => setShowMeta(v => !v)}
              style={{
                width: 34, height: 34, borderRadius: 10,
                background: showMeta ? 'var(--bg-active)' : 'var(--bg-raised)',
                border: `1px solid ${showMeta ? 'var(--accent-dim)' : 'var(--border)'}`,
                color: showMeta ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'all 0.15s',
              }}
            >
              <Hash size={14} />
            </button>
          </div>

          {/* Meta panel — страница, глава, цитата, теги */}
          {showMeta && (
            <div
              style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 9 }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input-base"
                  style={{ padding: '8px 12px', fontSize: 13, width: 90, flexShrink: 0 }}
                  type="number"
                  placeholder="Стр."
                  value={page}
                  onChange={e => setPage(e.target.value)}
                />
                <input
                  className="input-base"
                  style={{ padding: '8px 12px', fontSize: 13, flex: 1 }}
                  placeholder="Глава…"
                  value={chapter}
                  onChange={e => setChapter(e.target.value)}
                />
              </div>

              <div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter,sans-serif', flexShrink: 0 }}>
                    Цвет цитаты:
                  </span>
                  {QUOTE_COLORS.map(c => (
                    <div
                      key={c}
                      onClick={() => setQuoteColor(c)}
                      style={{
                        width: 18, height: 18, borderRadius: '50%', background: c,
                        cursor: 'pointer',
                        border: quoteColor === c ? '2.5px solid var(--text-primary)' : '2px solid transparent',
                        transition: 'border 0.15s, transform 0.1s',
                        transform: quoteColor === c ? 'scale(1.2)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
                <textarea
                  className="input-base"
                  style={{
                    padding: '10px 12px', fontSize: 13, resize: 'none', height: 72,
                    borderLeft: `3px solid ${quoteColor}`,
                  }}
                  placeholder="Цитата из книги…"
                  value={quote}
                  onChange={e => setQuote(e.target.value)}
                />
              </div>

              <div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {tags.map(t => {
                    const sel = noteTags.includes(t.id);
                    return (
                      <button key={t.id}
                        onClick={() => toggleTag(t.id)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '4px 10px', borderRadius: 99,
                          background: sel ? 'var(--bg-active)' : 'var(--bg-raised)',
                          border: `1px solid ${sel ? t.color : 'var(--border-mid)'}`,
                          color: sel ? t.color : 'var(--text-muted)',
                          fontSize: 12, fontFamily: 'Inter,sans-serif',
                          cursor: 'pointer', fontWeight: sel ? 600 : 400,
                          transition: 'all 0.15s',
                        }}
                      >
                        {sel && <Check size={10} />}
                        #{t.name}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    className="input-base"
                    style={{ padding: '8px 12px', fontSize: 12, flex: 1 }}
                    placeholder="Новый тег…"
                    value={newTagName}
                    onChange={e => setNewTagName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleNewTag()}
                  />
                  <button
                    onClick={handleNewTag}
                    style={{
                      padding: '8px 14px', borderRadius: 11,
                      background: 'var(--bg-raised)', border: '1px solid var(--border-mid)',
                      color: 'var(--accent)', cursor: 'pointer',
                      fontSize: 12, fontFamily: 'Inter,sans-serif', fontWeight: 600,
                      flexShrink: 0, transition: 'background 0.15s',
                    }}
                  >
                    + Тег
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════
            TOOLBAR — двухрядный, с overflow scroll
        ══════════════════════════════════════════════════════════ */}
        <div
          ref={toolbarRef}
          className="toolbar-wrap"
          onClick={e => e.stopPropagation()}
        >
          {/* ── Ряд 1: история + заголовки + базовое форматирование ── */}
          <div className="toolbar">
            <div className="toolbar-group">
              <TB onClick={() => editor.chain().focus().undo().run()} title="Отменить">
                <Undo2 size={14} />
              </TB>
              <TB onClick={() => editor.chain().focus().redo().run()} title="Повторить">
                <Redo2 size={14} />
              </TB>
            </div>

            <div className="toolbar-divider" />

            <div className="toolbar-group">
              <TB onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                active={editor.isActive('heading', { level: 1 })} title="H1">
                <Heading1 size={14} />
              </TB>
              <TB onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                active={editor.isActive('heading', { level: 2 })} title="H2">
                <Heading2 size={14} />
              </TB>
              <TB onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                active={editor.isActive('heading', { level: 3 })} title="H3">
                <Heading3 size={14} />
              </TB>
              <TB onClick={() => editor.chain().focus().setParagraph().run()}
                active={editor.isActive('paragraph')} title="Параграф">
                <Pilcrow size={14} />
              </TB>
            </div>

            <div className="toolbar-divider" />

            <div className="toolbar-group">
              <TB onClick={() => editor.chain().focus().toggleBold().run()}
                active={editor.isActive('bold')} title="Жирный">
                <Bold size={14} />
              </TB>
              <TB onClick={() => editor.chain().focus().toggleItalic().run()}
                active={editor.isActive('italic')} title="Курсив">
                <Italic size={14} />
              </TB>
              <TB onClick={() => editor.chain().focus().toggleUnderline().run()}
                active={editor.isActive('underline')} title="Подчёркнутый">
                <UIcon size={14} />
              </TB>
              <TB onClick={() => editor.chain().focus().toggleStrike().run()}
                active={editor.isActive('strike')} title="Зачёркнутый">
                <Strikethrough size={14} />
              </TB>
              <TB onClick={() => editor.chain().focus().toggleCode().run()}
                active={editor.isActive('code')} title="Код">
                <Code size={14} />
              </TB>
              <TB onClick={() => editor.chain().focus().toggleSuperscript().run()}
                active={editor.isActive('superscript')} title="Надстрочный">
                <SuperIcon size={14} />
              </TB>
              <TB onClick={() => editor.chain().focus().toggleSubscript().run()}
                active={editor.isActive('subscript')} title="Подстрочный">
                <SubIcon size={14} />
              </TB>
            </div>

            <div className="toolbar-divider" />

            <div className="toolbar-group">
              <TB onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
                title="Очистить форматирование" danger>
                <RemoveFormatting size={14} />
              </TB>
            </div>
          </div>

          {/* ── Ряд 2: цвета + выравнивание + списки + блоки ── */}
          <div className="toolbar">

            <div className="toolbar-group">
              <button
                ref={highlightBtnRef}
                className={`tb-btn${editor.isActive('highlight') ? ' active' : ''}`}
                onClick={() => openDropdown('highlight', highlightBtnRef)}
                onMouseDown={e => e.preventDefault()}
                title="Выделение фоном"
              >
                <Highlighter size={14} />
              </button>
              <button
                ref={colorBtnRef}
                className="tb-btn"
                onClick={() => openDropdown('color', colorBtnRef)}
                onMouseDown={e => e.preventDefault()}
                title="Цвет текста"
              >
                <Type size={14} />
              </button>
            </div>

            <div className="toolbar-divider" />

            <div className="toolbar-group">
              <TB onClick={() => editor.chain().focus().setTextAlign('left').run()}
                active={editor.isActive({ textAlign: 'left' })} title="По левому">
                <AlignLeft size={14} />
              </TB>
              <TB onClick={() => editor.chain().focus().setTextAlign('center').run()}
                active={editor.isActive({ textAlign: 'center' })} title="По центру">
                <AlignCenter size={14} />
              </TB>
              <TB onClick={() => editor.chain().focus().setTextAlign('right').run()}
                active={editor.isActive({ textAlign: 'right' })} title="По правому">
                <AlignRight size={14} />
              </TB>
              <TB onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                active={editor.isActive({ textAlign: 'justify' })} title="По ширине">
                <AlignJustify size={14} />
              </TB>
            </div>

            <div className="toolbar-divider" />

            <div className="toolbar-group">
              <TB onClick={() => editor.chain().focus().toggleBulletList().run()}
                active={editor.isActive('bulletList')} title="Маркированный список">
                <List size={14} />
              </TB>
              <TB onClick={() => editor.chain().focus().toggleOrderedList().run()}
                active={editor.isActive('orderedList')} title="Нумерованный список">
                <ListOrdered size={14} />
              </TB>
              <TB onClick={() => editor.chain().focus().toggleBlockquote().run()}
                active={editor.isActive('blockquote')} title="Блок цитаты">
                <Quote size={14} />
              </TB>
              <TB onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                active={editor.isActive('codeBlock')} title="Блок кода">
                <Code size={14} />
              </TB>
              <TB onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Разделитель">
                <Minus size={14} />
              </TB>
            </div>
          </div>
        </div>

        {/* ── Editor content ────────────────────────────────────── */}
        <div className="scroll-area" style={{ padding: '16px' }}>
          {quote && (
            <div style={{
              borderLeft: `3px solid ${quoteColor}`,
              padding: '10px 14px',
              margin: '0 0 14px',
              background: 'var(--bg-raised)',
              borderRadius: '0 10px 10px 0',
            }}>
              <p style={{
                margin: 0, fontSize: '0.93rem', lineHeight: 1.7,
                color: 'var(--text-secondary)', fontStyle: 'italic',
                fontFamily: 'Lora, serif',
              }}>
                «{quote}»
              </p>
            </div>
          )}

          <EditorContent editor={editor} />

          <div style={{
            marginTop: 24, paddingTop: 12,
            borderTop: '1px solid var(--border)',
            fontSize: 11, color: 'var(--text-muted)',
            fontFamily: 'Inter,sans-serif',
            display: 'flex', gap: 14, flexWrap: 'wrap',
          }}>
            <span>{countWords(editor.getHTML())} слов</span>
            <span>{editor.getHTML().replace(/<[^>]+>/g, '').length} симв.</span>
            {bookId && <span>📖 {bookName}{page ? ` · стр. ${page}` : ''}</span>}
            {type !== 'note' && <span>{typeMeta.icon} {typeMeta.label}</span>}
            {chapter && <span>📑 {chapter}</span>}
          </div>
        </div>
      </div>
    </>
  );
}
