import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Note, Book } from '../types';
import {
  ChevronLeft, Share2, Globe, Lock, Copy,
  BookOpen, Eye, Plus, Check, Trash2, Link,
  ExternalLink, X, ChevronDown,
} from 'lucide-react';

interface SharedConspect {
  id: string;
  bookId: string;
  noteIds: string[];
  title: string;
  description: string;
  isPublic: boolean;
  shareCode: string;
  createdAt: string;
  views: number;
}

interface Props {
  notes: Note[];
  books: Book[];
  onBack: () => void;
  onExportBookPDF: (bookId: string) => void;
}

type Mode = 'home' | 'create' | 'view';

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function loadConspects(): SharedConspect[] {
  try { return JSON.parse(localStorage.getItem('psyche_conspects') || '[]'); }
  catch { return []; }
}

function saveConspects(list: SharedConspect[]) {
  localStorage.setItem('psyche_conspects', JSON.stringify(list));
}

const vibe = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };

export default function PublicShareView({ notes, books, onBack, onExportBookPDF }: Props) {
  const [mode, setMode] = useState<Mode>('home');
  const [conspects, setConspects] = useState<SharedConspect[]>(loadConspects);
  const [viewing, setViewing] = useState<SharedConspect | null>(null);
  const [copied, setCopied] = useState('');
  const [showBookSheet, setShowBookSheet] = useState(false);
  const [showExportSheet, setShowExportSheet] = useState(false);

  // Create form
  const [selBook, setSelBook] = useState('');
  const [selNotes, setSelNotes] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const bookNotes = (bookId: string) => notes.filter(n => n.bookId === bookId);

  const handleCreate = () => {
    if (!selBook || !title.trim()) return;
    const conspect: SharedConspect = {
      id: crypto.randomUUID(),
      bookId: selBook,
      noteIds: selNotes,
      title: title.trim(),
      description: desc.trim(),
      isPublic,
      shareCode: generateCode(),
      createdAt: new Date().toISOString(),
      views: 0,
    };
    const updated = [conspect, ...conspects];
    setConspects(updated);
    saveConspects(updated);
    setSelBook(''); setSelNotes([]); setTitle(''); setDesc('');
    vibe(20);
    setMode('home');
  };

  const handleDelete = (id: string) => {
    const updated = conspects.filter(c => c.id !== id);
    setConspects(updated);
    saveConspects(updated);
    vibe(10);
  };

  const handleCopy = (code: string) => {
    const url = `${window.location.origin}?share=${code}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(code);
    vibe(8);
    setTimeout(() => setCopied(''), 2000);
  };

  const toggleNote = (id: string) => {
    setSelNotes(prev => prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]);
  };

  // ── BOOK PICKER SHEET ─────────────────────────────────────────────────────
  const BookPickerSheet = showBookSheet && createPortal(
    <>
      <div onClick={() => setShowBookSheet(false)} style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.65)', animation: 'fadeIn 0.18s ease',
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(100vw, 430px)',
        background: 'var(--bg-card)',
        borderRadius: '24px 24px 0 0',
        border: '1px solid var(--border-mid)',
        borderBottom: 'none',
        zIndex: 501,
        animation: 'sheetSlideUp 0.32s cubic-bezier(0.22,1,0.36,1)',
        maxHeight: '70vh',
        display: 'flex', flexDirection: 'column',
        paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 16px)',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, marginBottom: 2, flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--border-mid)' }} />
        </div>
        {/* Header */}
        <div style={{
          padding: '10px 16px 12px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>
            Выберите книгу
          </span>
          <button onClick={() => setShowBookSheet(false)} style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'var(--bg-raised)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-muted)',
          }}><X size={15} /></button>
        </div>
        {/* Books list */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {books.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📚</div>
              <p style={{ color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontSize: 14 }}>
                Нет книг в библиотеке
              </p>
            </div>
          ) : books.map((b, i) => {
            const cnt = notes.filter(n => n.bookId === b.id).length;
            const isSelected = selBook === b.id;
            return (
              <button key={b.id} onClick={() => {
                vibe(8); setSelBook(b.id); setSelNotes([]); setShowBookSheet(false);
              }} style={{
                width: '100%', padding: '14px 16px',
                background: isSelected ? 'var(--bg-active)' : 'transparent',
                border: 'none',
                borderBottom: i < books.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
                textAlign: 'left',
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14, background: b.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, flexShrink: 0,
                  border: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                }}>{b.coverEmoji}</div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{
                    fontSize: 15, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif',
                    fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{b.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', marginTop: 2 }}>
                    {b.author} · {cnt} записей
                  </div>
                </div>
                {isSelected && (
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Check size={14} color="#fff" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>,
    document.body
  );

  // ── EXPORT BOOK SHEET ────────────────────────────────────────────────────
  const ExportBookSheet = showExportSheet && createPortal(
    <>
      <div onClick={() => setShowExportSheet(false)} style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.65)', animation: 'fadeIn 0.18s ease',
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(100vw, 430px)',
        background: 'var(--bg-card)',
        borderRadius: '24px 24px 0 0',
        border: '1px solid var(--border-mid)',
        borderBottom: 'none',
        zIndex: 501,
        animation: 'sheetSlideUp 0.32s cubic-bezier(0.22,1,0.36,1)',
        maxHeight: '70vh',
        display: 'flex', flexDirection: 'column',
        paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 16px)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, marginBottom: 2, flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--border-mid)' }} />
        </div>
        <div style={{
          padding: '10px 16px 12px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>
            Экспорт книги в PDF
          </span>
          <button onClick={() => setShowExportSheet(false)} style={{
            width: 30, height: 30, borderRadius: 8, background: 'var(--bg-raised)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-muted)',
          }}><X size={15} /></button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {books.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📚</div>
              <p style={{ color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontSize: 14 }}>
                Нет книг для экспорта
              </p>
            </div>
          ) : books.map((book, i) => {
            const cnt = notes.filter(n => n.bookId === book.id).length;
            return (
              <button key={book.id} onClick={() => { vibe(8); onExportBookPDF(book.id); setShowExportSheet(false); }}
                style={{
                  width: '100%', padding: '14px 16px', background: 'transparent', border: 'none',
                  borderBottom: i < books.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left',
                }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14, background: book.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, flexShrink: 0,
                }}>{book.coverEmoji}</div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{
                    fontSize: 15, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif',
                    fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{book.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', marginTop: 2 }}>
                    {book.author} · {cnt} записей
                  </div>
                </div>
                <div style={{
                  padding: '6px 10px', borderRadius: 8,
                  background: 'var(--accent-glow)', border: '1px solid var(--accent-dim)',
                  color: 'var(--accent)', fontSize: 11, fontFamily: 'Inter, sans-serif', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                }}>
                  <ExternalLink size={12} /> PDF
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>,
    document.body
  );

  // ── HOME ──────────────────────────────────────────────────────────────────
  if (mode === 'home') return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {BookPickerSheet}
      {ExportBookSheet}

      <div style={{
        padding: 'calc(env(safe-area-inset-top,0px) + 12px) 16px 12px',
        display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <button onClick={() => { vibe(6); onBack(); }} style={{
          width: 38, height: 38, borderRadius: 12,
          background: 'var(--bg-raised)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-secondary)', cursor: 'pointer',
        }}><ChevronLeft size={18} /></button>
        <div>
          <div style={{ fontFamily: 'Lora, serif', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            Конспекты
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
            Экспорт и публичный доступ
          </div>
        </div>
        <button onClick={() => { vibe(6); setMode('create'); }} style={{
          marginLeft: 'auto', width: 38, height: 38, borderRadius: 12,
          background: 'var(--accent)', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', cursor: 'pointer',
        }}><Plus size={18} /></button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Export to PDF — big button */}
        <button onClick={() => { vibe(8); setShowExportSheet(true); }}
          style={{
            width: '100%', padding: '18px 20px',
            background: 'linear-gradient(135deg, var(--bg-raised), var(--bg-card))',
            border: '1px solid var(--border)',
            borderRadius: 20, cursor: 'pointer', textAlign: 'left',
            display: 'flex', alignItems: 'center', gap: 16,
            animation: 'fadeSlideUp 0.35s ease',
          }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: 'var(--accent-glow)', border: '1px solid var(--accent-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <BookOpen size={24} color="var(--accent)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>
              Экспорт книги в PDF
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', marginTop: 3 }}>
              Все записи по книге — в красивый документ
            </div>
            <div style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'Inter, sans-serif', marginTop: 4, fontWeight: 600 }}>
              {books.length} книг доступно →
            </div>
          </div>
        </button>

        {/* My conspects */}
        <div style={{ animation: 'fadeSlideUp 0.35s ease 0.07s both' }}>
          <div style={{
            fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif',
            marginBottom: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            Мои конспекты {conspects.length > 0 && `(${conspects.length})`}
          </div>

          {conspects.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {conspects.map((c, i) => {
                const book = books.find(b => b.id === c.bookId);
                return (
                  <div key={c.id} style={{
                    borderRadius: 18, background: 'var(--bg-raised)',
                    border: '1px solid var(--border)', overflow: 'hidden',
                    animation: `fadeSlideUp 0.3s ease ${i * 0.05}s both`,
                  }}>
                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: 12,
                          background: book?.color || 'var(--bg-active)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 22, flexShrink: 0,
                        }}>{book?.coverEmoji || '📚'}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 15, fontWeight: 700, color: 'var(--text-primary)',
                            fontFamily: 'Lora, serif', marginBottom: 2,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>{c.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
                            {book?.title || 'Книга удалена'}
                          </div>
                        </div>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
                          borderRadius: 99,
                          background: c.isPublic ? 'rgba(106,158,138,0.12)' : 'var(--bg-active)',
                          border: `1px solid ${c.isPublic ? '#6a9e8a44' : 'var(--border)'}`,
                          fontSize: 11, color: c.isPublic ? '#6a9e8a' : 'var(--text-muted)', flexShrink: 0,
                        }}>
                          {c.isPublic ? <Globe size={10} /> : <Lock size={10} />}
                          <span>{c.isPublic ? 'Публ.' : 'Привр.'}</span>
                        </div>
                      </div>

                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif',
                        marginBottom: 12,
                      }}>
                        <Eye size={11} /><span>{c.views} просм.</span>
                        <span>·</span>
                        <span>{c.noteIds.length} записей</span>
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handleCopy(c.shareCode)} style={{
                          flex: 1, padding: '10px', borderRadius: 12,
                          background: copied === c.shareCode ? 'rgba(106,158,138,0.15)' : 'var(--bg-active)',
                          border: `1px solid ${copied === c.shareCode ? '#6a9e8a44' : 'var(--border)'}`,
                          color: copied === c.shareCode ? '#6a9e8a' : 'var(--text-secondary)',
                          cursor: 'pointer', fontSize: 13, fontFamily: 'Inter, sans-serif',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          fontWeight: 600,
                        }}>
                          {copied === c.shareCode ? <Check size={13} /> : <Copy size={13} />}
                          {copied === c.shareCode ? 'Скопировано!' : 'Ссылка'}
                        </button>
                        <button onClick={() => { vibe(6); setViewing(c); setMode('view'); }} style={{
                          padding: '10px 14px', borderRadius: 12,
                          background: 'var(--bg-active)', border: '1px solid var(--border)',
                          color: 'var(--text-secondary)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}><Eye size={15} /></button>
                        <button onClick={() => handleDelete(c.id)} style={{
                          padding: '10px 14px', borderRadius: 12,
                          background: 'rgba(224,112,112,0.1)', border: '1px solid rgba(224,112,112,0.2)',
                          color: '#e07070', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}><Trash2 size={15} /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{
              textAlign: 'center', padding: '36px 20px',
              background: 'var(--bg-raised)', borderRadius: 20,
              border: '1px dashed var(--border)',
            }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>🌐</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Lora, serif', marginBottom: 6 }}>
                Нет конспектов
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20, fontFamily: 'Inter, sans-serif' }}>
                Создайте публичный конспект — поделитесь своими мыслями
              </div>
              <button onClick={() => { vibe(8); setMode('create'); }} style={{
                padding: '11px 24px', borderRadius: 12,
                background: 'linear-gradient(135deg, var(--accent), var(--accent-warm))',
                border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}>Создать конспект</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ── VIEW conspect ─────────────────────────────────────────────────────────
  if (mode === 'view' && viewing) {
    const book = books.find(b => b.id === viewing.bookId);
    const conspNotes = notes.filter(n => viewing.noteIds.includes(n.id));
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{
          padding: 'calc(env(safe-area-inset-top,0px) + 12px) 16px 12px',
          display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <button onClick={() => { vibe(6); setMode('home'); setViewing(null); }} style={{
            width: 38, height: 38, borderRadius: 12,
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-secondary)', cursor: 'pointer',
          }}><ChevronLeft size={18} /></button>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{
              fontFamily: 'Lora, serif', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{viewing.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>{book?.title}</div>
          </div>
          <button onClick={() => handleCopy(viewing.shareCode)} style={{
            width: 38, height: 38, borderRadius: 12,
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: copied === viewing.shareCode ? '#6a9e8a' : 'var(--text-secondary)', cursor: 'pointer',
          }}>
            {copied === viewing.shareCode ? <Check size={16} /> : <Share2 size={16} />}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            padding: '12px 16px', borderRadius: 14,
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Link size={14} color="var(--accent)" />
            <div style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {window.location.origin}?share={viewing.shareCode}
            </div>
            <button onClick={() => handleCopy(viewing.shareCode)} style={{
              padding: '6px 12px', borderRadius: 8, background: 'var(--accent)', border: 'none',
              color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}>{copied === viewing.shareCode ? '✓' : 'Копировать'}</button>
          </div>

          {conspNotes.length > 0 ? conspNotes.map((note, i) => (
            <div key={note.id} style={{
              borderRadius: 16, background: 'var(--bg-raised)', border: '1px solid var(--border)', padding: '16px',
              animation: `fadeSlideUp 0.3s ease ${i * 0.04}s both`,
            }}>
              {note.quote && (
                <div style={{
                  padding: '10px 12px', borderRadius: 10, marginBottom: 10,
                  background: 'rgba(212,145,74,0.08)', borderLeft: '3px solid var(--accent)',
                  fontSize: 14, fontFamily: 'Lora, serif', color: 'var(--text-secondary)',
                  lineHeight: 1.6, fontStyle: 'italic',
                }}>"{note.quote}"</div>
              )}
              {note.title && (
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Lora, serif', marginBottom: 8 }}>
                  {note.title}
                </div>
              )}
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}
                dangerouslySetInnerHTML={{ __html: note.content }} />
              {note.tags?.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  {note.tags.map(t => (
                    <span key={t} style={{
                      padding: '3px 8px', borderRadius: 99,
                      background: 'var(--bg-active)', border: '1px solid var(--border)',
                      fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif',
                    }}>#{t}</span>
                  ))}
                </div>
              )}
            </div>
          )) : (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontSize: 14 }}>
              Нет записей в этом конспекте
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── CREATE ────────────────────────────────────────────────────────────────
  const availNotes = selBook ? bookNotes(selBook) : [];
  const selectedBookObj = books.find(b => b.id === selBook);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {BookPickerSheet}

      <div style={{
        padding: 'calc(env(safe-area-inset-top,0px) + 12px) 16px 12px',
        display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <button onClick={() => { vibe(6); setMode('home'); }} style={{
          width: 38, height: 38, borderRadius: 12,
          background: 'var(--bg-raised)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-secondary)', cursor: 'pointer',
        }}><ChevronLeft size={18} /></button>
        <div style={{ fontFamily: 'Lora, serif', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
          Новый конспект
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Book picker — большая кнопка */}
        <div style={{ animation: 'fadeSlideUp 0.35s ease' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Книга *
          </div>
          <button onClick={() => { vibe(6); setShowBookSheet(true); }} style={{
            width: '100%', padding: selectedBookObj ? '12px 16px' : '18px 16px',
            background: 'var(--bg-raised)', border: `1px solid ${selBook ? 'var(--accent-dim)' : 'var(--border)'}`,
            borderRadius: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
            textAlign: 'left',
          }}>
            {selectedBookObj ? (
              <>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, background: selectedBookObj.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, flexShrink: 0,
                }}>{selectedBookObj.coverEmoji}</div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: 15, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedBookObj.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', marginTop: 2 }}>
                    {selectedBookObj.author}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, background: 'var(--bg-active)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <BookOpen size={20} color="var(--text-muted)" />
                </div>
                <span style={{ fontSize: 15, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
                  Выбрать книгу...
                </span>
              </>
            )}
            <ChevronDown size={18} color="var(--text-muted)" style={{ marginLeft: 'auto', flexShrink: 0 }} />
          </button>
        </div>

        {/* Title */}
        <div style={{ animation: 'fadeSlideUp 0.35s ease 0.04s both' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Мысли *
          </div>
          <div style={{ borderRadius: 16, background: 'var(--bg-raised)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Мои главные мысли из книги..."
              style={{
                width: '100%', padding: '16px', background: 'transparent',
                border: 'none', outline: 'none', color: 'var(--text-primary)',
                fontSize: 16, fontFamily: 'Lora, serif', boxSizing: 'border-box',
              }} />
          </div>
        </div>

        {/* Description */}
        <div style={{ animation: 'fadeSlideUp 0.35s ease 0.08s both' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Описание
          </div>
          <div style={{ borderRadius: 16, background: 'var(--bg-raised)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <textarea value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Краткое описание конспекта..."
              style={{
                width: '100%', minHeight: 100, padding: '16px', background: 'transparent',
                border: 'none', outline: 'none', color: 'var(--text-primary)',
                fontSize: 14, fontFamily: 'Inter, sans-serif', lineHeight: 1.7,
                resize: 'none', boxSizing: 'border-box',
              }} />
          </div>
        </div>

        {/* Visibility toggle */}
        <div style={{
          borderRadius: 16, background: 'var(--bg-raised)', border: '1px solid var(--border)',
          padding: '14px 16px', animation: 'fadeSlideUp 0.35s ease 0.12s both',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {isPublic ? <Globe size={18} color="#6a9e8a" /> : <Lock size={18} color="var(--text-muted)" />}
              <div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
                  {isPublic ? 'Публичный' : 'Приватный'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
                  {isPublic ? 'Доступен по ссылке' : 'Только для вас'}
                </div>
              </div>
            </div>
            <button onClick={() => { vibe(6); setIsPublic(!isPublic); }} style={{
              width: 50, height: 28, borderRadius: 14,
              background: isPublic ? '#6a9e8a' : 'var(--bg-active)',
              border: '1px solid var(--border)', cursor: 'pointer', position: 'relative',
              transition: 'background 0.2s ease', flexShrink: 0,
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 3, transition: 'left 0.2s ease',
                left: isPublic ? 26 : 4,
              }} />
            </button>
          </div>
        </div>

        {/* Notes selector */}
        {selBook && availNotes.length > 0 && (
          <div style={{ animation: 'fadeSlideUp 0.35s ease 0.16s both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Записи ({selNotes.length}/{availNotes.length})
              </div>
              <button onClick={() => {
                vibe(6);
                setSelNotes(selNotes.length === availNotes.length ? [] : availNotes.map(n => n.id));
              }} style={{
                fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none',
                cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600,
              }}>
                {selNotes.length === availNotes.length ? 'Сбросить' : 'Выбрать все'}
              </button>
            </div>
            <div style={{ borderRadius: 16, background: 'var(--bg-raised)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              {availNotes.map((note, i) => (
                <button key={note.id} onClick={() => { vibe(6); toggleNote(note.id); }}
                  style={{
                    width: '100%', padding: '14px 16px', background: selNotes.includes(note.id) ? 'var(--bg-active)' : 'transparent',
                    border: 'none', borderBottom: i < availNotes.length - 1 ? '1px solid var(--border)' : 'none',
                    display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left',
                  }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    background: selNotes.includes(note.id) ? 'var(--accent)' : 'var(--bg-active)',
                    border: `1px solid ${selNotes.includes(note.id) ? 'var(--accent)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}>
                    {selNotes.includes(note.id) && <Check size={13} color="#fff" />}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {note.title || 'Без названия'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', marginTop: 2 }}>
                      {note.type} · {new Date(note.createdAt).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Create button */}
        <button onClick={handleCreate} disabled={!selBook || !title.trim()}
          style={{
            width: '100%', padding: '17px', borderRadius: 16, border: 'none',
            background: selBook && title.trim()
              ? 'linear-gradient(135deg, var(--accent), var(--accent-warm))'
              : 'var(--bg-raised)',
            color: selBook && title.trim() ? '#fff' : 'var(--text-muted)',
            fontSize: 16, fontWeight: 700,
            cursor: selBook && title.trim() ? 'pointer' : 'not-allowed',
            fontFamily: 'Inter, sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            animation: 'fadeSlideUp 0.35s ease 0.2s both',
            transition: 'all 0.2s ease',
          }}>
          <Share2 size={18} /> Создать конспект
        </button>

        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}
