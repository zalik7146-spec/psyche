import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Trash2, Check } from 'lucide-react';

const vibe = (ms = 8) => navigator.vibrate?.(ms);

interface Props {
  onSave: (text: string, audioUrl?: string) => void;
  onClose: () => void;
}

export default function VoiceNote({ onSave, onClose }: Props) {
  const [mode, setMode] = useState<'idle' | 'recording' | 'recorded' | 'playing'>('idle');
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playProgress, setPlayProgress] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<unknown>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    vibe(12);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(t => t.stop());
      };

      mr.start(100);
      setMode('recording');
      setDuration(0);

      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);

      // Speech recognition
      try {
        const w = window as unknown as Record<string, unknown>;
        const SpeechRec = (w['SpeechRecognition'] || w['webkitSpeechRecognition']) as (new () => {
          lang: string; continuous: boolean; interimResults: boolean;
          onresult: (e: { results: Array<Array<{ transcript: string }>> & { length: number } }) => void;
          start: () => void; stop: () => void;
        }) | undefined;
        if (SpeechRec) {
          const rec = new SpeechRec();
          recognitionRef.current = rec as unknown;
          rec.lang = 'ru-RU';
          rec.continuous = true;
          rec.interimResults = true;
          rec.onresult = (e) => {
            let text = '';
            for (let i = 0; i < e.results.length; i++) {
              text += e.results[i][0].transcript;
            }
            setTranscript(text);
          };
          rec.start();
        }
      } catch { /* ignore */ }
    } catch (err) {
      console.error('Mic error:', err);
      alert('Нет доступа к микрофону');
    }
  };

  const stopRecording = () => {
    vibe(8);
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    (recognitionRef.current as { stop?: () => void })?.stop?.();
    setMode('recorded');
  };

  const playAudio = () => {
    if (!audioUrl) return;
    vibe(6);
    if (mode === 'playing') {
      audioRef.current?.pause();
      setMode('recorded');
      return;
    }
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.play();
    setMode('playing');
    const interval = setInterval(() => {
      if (audio.duration) setPlayProgress(audio.currentTime / audio.duration * 100);
    }, 100);
    audio.onended = () => {
      setMode('recorded');
      setPlayProgress(0);
      clearInterval(interval);
    };
  };

  const reset = () => {
    vibe(6);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setTranscript('');
    setDuration(0);
    setPlayProgress(0);
    setMode('idle');
  };

  const handleSave = () => {
    vibe(12);
    const text = transcript || `[Голосовая заметка, ${formatDuration(duration)}]`;
    onSave(text, audioUrl || undefined);
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '100%', maxWidth: 430,
        background: 'var(--bg-raised)',
        borderRadius: '20px 20px 0 0',
        border: '1px solid var(--border)',
        padding: '24px 24px calc(32px + env(safe-area-inset-bottom))',
        animation: 'sheetSlideUp 0.35s cubic-bezier(0.22,1,0.36,1) both',
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 24px' }} />

        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Lora, serif', textAlign: 'center', marginBottom: 8 }}>
          Голосовая заметка
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 32 }}>
          Запись автоматически конвертируется в текст
        </p>

        {/* Визуализация */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {/* Кольцо */}
          <div style={{
            width: 100, height: 100, borderRadius: '50%',
            border: `3px solid ${mode === 'recording' ? 'var(--accent)' : 'var(--border)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            animation: mode === 'recording' ? 'pulse 1.5s ease infinite' : 'none',
            position: 'relative',
          }}>
            {mode === 'recording' && (
              <div style={{
                position: 'absolute', inset: -8, borderRadius: '50%',
                border: '2px solid var(--accent)',
                opacity: 0.3,
                animation: 'pulse 1.5s ease infinite 0.5s',
              }} />
            )}
            <div style={{ fontSize: 36 }}>
              {mode === 'idle' && '🎙️'}
              {mode === 'recording' && '🔴'}
              {mode === 'recorded' && '✅'}
              {mode === 'playing' && '▶️'}
            </div>
          </div>

          {/* Timer */}
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', letterSpacing: '-1px' }}>
            {formatDuration(duration)}
          </div>

          {mode === 'recording' && (
            <p style={{ fontSize: 12, color: 'var(--accent)', marginTop: 4 }}>Запись...</p>
          )}
        </div>

        {/* Прогресс воспроизведения */}
        {mode === 'playing' && (
          <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, marginBottom: 16 }}>
            <div style={{ height: '100%', width: `${playProgress}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.1s linear' }} />
          </div>
        )}

        {/* Транскрипция */}
        {transcript && (
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '12px 16px', marginBottom: 20,
            maxHeight: 120, overflowY: 'auto',
          }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, fontFamily: 'Inter, sans-serif' }}>
              {transcript}
            </p>
          </div>
        )}

        {/* Кнопки */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          {mode === 'idle' && (
            <>
              <button onClick={onClose} style={{
                flex: 1, padding: '14px', borderRadius: 14,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                color: 'var(--text-muted)', fontSize: 15, cursor: 'pointer',
              }}>
                Отмена
              </button>
              <button onClick={startRecording} style={{
                flex: 2, padding: '14px', borderRadius: 14,
                background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
                border: 'none', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <Mic size={18} /> Начать запись
              </button>
            </>
          )}

          {mode === 'recording' && (
            <button onClick={stopRecording} style={{
              flex: 1, padding: '14px', borderRadius: 14,
              background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
              border: 'none', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <Square size={18} fill="white" /> Остановить
            </button>
          )}

          {(mode === 'recorded' || mode === 'playing') && (
            <>
              <button onClick={reset} style={{
                width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#e74c3c', cursor: 'pointer',
              }}>
                <Trash2 size={18} />
              </button>
              <button onClick={playAudio} style={{
                flex: 1, padding: '14px', borderRadius: 14,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: 15, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                {mode === 'playing' ? <><Pause size={18} /> Пауза</> : <><Play size={18} /> Воспроизвести</>}
              </button>
              <button onClick={handleSave} style={{
                flex: 1, padding: '14px', borderRadius: 14,
                background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
                border: 'none', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <Check size={18} /> Сохранить
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
