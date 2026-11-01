import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  AlertCircle,
  ExternalLink,
  Send,
  ArrowRight,
  Volume2,
  VolumeX,
  Languages,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { AppLanguage, AppView } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { isInsideIframe } from '../utils/mobilePermissions';
import {
  startUnifiedSpeechRecognition,
  stopUnifiedSpeechRecognition,
  isWebSpeechSupported
} from '../utils/nativeSpeech';
import { hapticTap, hapticTransactionComplete, hapticWarning } from '../utils/haptics';

interface VoiceModalProps {
  language: AppLanguage;
  onClose: () => void;
  onNavigate: (view: AppView) => void;
  onLock: () => void;
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  language: initialLanguage,
  onClose,
  onNavigate,
  onLock
}) => {
  const [activeLang, setActiveLang] = useState<'ur' | 'en'>(initialLanguage);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState(
    activeLang === 'ur'
      ? 'بولنے کے لیے مائیک دبائیں یا کوئی بھی حکم بولیں'
      : 'Tap the mic to speak or choose a command below'
  );
  const [micDenied, setMicDenied] = useState(false);
  const [manualText, setManualText] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'sales' | 'production' | 'ledgers'>('all');

  // Real-time Web Audio API audio stream analyzer
  const [frequencyData, setFrequencyData] = useState<number[]>([10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const speechSessionRef = useRef<{ stop: () => void; isNative: boolean } | null>(null);
  const timeoutRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(true);
  const inIframe = isInsideIframe();
  const webSpeechSupported = isWebSpeechSupported();

  const sampleCommands = [
    {
      category: 'sales',
      label: 'Open Orders & Transactions',
      labelUrdu: 'تمام آرڈرز اور سیلز پرچی',
      aliases: ['orders', 'sales', 'transactions', 'parchi', 'bill', 'آرڈر', 'سیل', 'پرچی', 'بل', 'بیچنا'],
      action: () => onNavigate('transactions')
    },
    {
      category: 'sales',
      label: 'Open Gate Pass & Receipts',
      labelUrdu: 'گیٹ پاس اور آؤٹ ورڈ رسید',
      aliases: ['gate pass', 'gate', 'receipt', 'registry', 'گیٹ پاس', 'گیٹ', 'رسید', 'چالان'],
      action: () => onNavigate('transactions')
    },
    {
      category: 'production',
      label: 'Open Products Catalog',
      labelUrdu: 'پروڈکٹس اور راڈ کیٹلاگ',
      aliases: ['product', 'products', 'rod', 'fan rod', 'maal', 'samaan', 'پروڈکٹ', 'سامان', 'راڈ', 'نیا مال'],
      action: () => onNavigate('products')
    },
    {
      category: 'production',
      label: 'Check Stock Inventory',
      labelUrdu: 'گودام کا اسٹاک چیک کریں',
      aliases: ['stock', 'inventory', 'godam', 'maal kitna hai', 'اسٹاک', 'گودام', 'کتنا مال ہے'],
      action: () => onNavigate('stock')
    },
    {
      category: 'production',
      label: 'Check Raw Materials (Steel Pipe)',
      labelUrdu: 'خام مال کھاتہ (اسٹیل پائپ)',
      aliases: ['raw', 'raw material', 'pipe', 'steel', 'loha', 'kham maal', 'خام مال', 'پائپ', 'اسٹیل', 'لوہا'],
      action: () => onNavigate('raw_material')
    },
    {
      category: 'ledgers',
      label: 'Open Customer Ledgers (Factories)',
      labelUrdu: 'فیکٹریوں اور گاہکوں کا کھاتہ',
      aliases: ['factory', 'factories', 'customer', 'khata', 'al madina', 'royal star', 'گاہک', 'کھاتہ', 'فیکٹری'],
      action: () => onNavigate('factories')
    },
    {
      category: 'ledgers',
      label: 'Open Paint Ledger',
      labelUrdu: 'رنگ والا کھاتہ (پاؤڈر کوٹنگ)',
      aliases: ['paint', 'rang', 'coating', 'powder', 'painter', 'rashid', 'رنگ', 'پینٹ', 'پاؤڈر کوٹنگ'],
      action: () => onNavigate('paint_ledger')
    },
    {
      category: 'ledgers',
      label: 'Mark Labour Attendance',
      labelUrdu: 'مزدوروں کی حاضری اور مزدوری',
      aliases: ['labour', 'labor', 'hazri', 'attendance', 'mazdoor', 'rafiq', 'shabbir', 'مزدور', 'حاضری', 'مزدوری'],
      action: () => onNavigate('labour_ledger')
    },
    {
      category: 'ledgers',
      label: 'Open Overhead Expenses',
      labelUrdu: 'ورکشاپ کے روزانہ اخراجات',
      aliases: ['expense', 'expenses', 'kharcha', 'bill', 'bijli', 'اخراجات', 'خرچہ'],
      action: () => onNavigate('expenses')
    },
    {
      category: 'sales',
      label: 'Check Product Returns',
      labelUrdu: 'واپسی اور ری ورک مال',
      aliases: ['return', 'returns', 'wapsi', 'rework', 'خراب مال', 'واپسی'],
      action: () => onNavigate('returns')
    },
    {
      category: 'sales',
      label: 'Show Overview Dashboard',
      labelUrdu: 'مین ڈیش بورڈ خلاصہ',
      aliases: ['overview', 'dashboard', 'home', 'main', 'ڈیش بورڈ', 'ہوم', 'خلاصہ'],
      action: () => onNavigate('overview')
    },
    {
      category: 'ledgers',
      label: 'Open Backup & Cloud Vault',
      labelUrdu: 'ڈیٹا بیک اپ اور گوگل ڈرائیو',
      aliases: ['backup', 'drive', 'vault', 'save', 'بیک اپ', 'سیو'],
      action: () => onNavigate('backup')
    },
    {
      category: 'ledgers',
      label: 'Lock Terminal Screen',
      labelUrdu: 'ورکشاپ سسٹم لاک کریں',
      aliases: ['lock', 'band', 'exit', 'close', 'لاک', 'بند کریں', 'بند'],
      action: () => onLock()
    }
  ];

  // Text to speech audio reply confirmation
  const speakConfirmation = (text: string) => {
    if (!soundEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = activeLang === 'ur' ? 'ur-PK' : 'en-US';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (_) {}
  };

  // Start real live audio visualizer via AudioContext
  const startAudioVisualizer = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const renderFrame = () => {
        if (!isMountedRef.current || !analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        // Sample 10 frequency bars
        const bars: number[] = [];
        const step = Math.floor(bufferLength / 10) || 1;
        for (let i = 0; i < 10; i++) {
          const val = dataArray[i * step] || 0;
          bars.push(Math.max(6, Math.round((val / 255) * 32)));
        }
        setFrequencyData(bars);
        animFrameRef.current = requestAnimationFrame(renderFrame);
      };

      renderFrame();
    } catch (e) {
      console.warn('Audio visualizer init error:', e);
    }
  };

  const stopAudioVisualizer = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (_) {}
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setFrequencyData([6, 6, 6, 6, 6, 6, 6, 6, 6, 6]);
  };

  const stopListening = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    stopUnifiedSpeechRecognition();
    stopAudioVisualizer();

    if (speechSessionRef.current) {
      try {
        speechSessionRef.current.stop();
      } catch (_) {}
      speechSessionRef.current = null;
    }
    if (isMountedRef.current) {
      setIsListening(false);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopListening();
    };
  }, []);

  const handleCommandExec = (cmd: typeof sampleCommands[0]) => {
    stopListening();
    hapticTransactionComplete();
    const displayName = activeLang === 'ur' ? cmd.labelUrdu : cmd.label;
    setTranscript(displayName);
    setFeedback(`✓ ${activeLang === 'ur' ? 'حکم جاری:' : 'Command Executed:'} ${displayName}`);

    speakConfirmation(activeLang === 'ur' ? `${displayName} کھول رہے ہیں` : `Opening ${cmd.label}`);

    setTimeout(() => {
      cmd.action();
      onClose();
    }, 450);
  };

  const processVoiceCommand = (rawText: string) => {
    const text = rawText.toLowerCase().trim();
    if (!text) return;

    // Search for closest alias match in sample commands
    const matched = sampleCommands.find(cmd =>
      cmd.aliases.some(alias => text.includes(alias.toLowerCase()))
    );

    if (matched) {
      handleCommandExec(matched);
      return;
    }

    // Secondary heuristic checks
    if (text.includes('pass') || text.includes('gate') || text.includes('گیٹ')) {
      handleCommandExec(sampleCommands[1]);
    } else if (text.includes('order') || text.includes('sale') || text.includes('bech')) {
      handleCommandExec(sampleCommands[0]);
    } else if (text.includes('rod') || text.includes('item') || text.includes('mal')) {
      handleCommandExec(sampleCommands[2]);
    } else {
      hapticWarning();
      setFeedback(
        activeLang === 'ur'
          ? `پہچانا گیا: "${text}"۔ مماثل کمانڈ نیچے سے منتخب کریں۔`
          : `Heard: "${text}". No direct match. Select from quick actions below.`
      );
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim()) return;
    setTranscript(manualText.trim());
    processVoiceCommand(manualText.trim());
    setManualText('');
  };

  const startListening = async () => {
    stopListening();
    setMicDenied(false);
    setTranscript('');
    hapticTap();
    setFeedback(activeLang === 'ur' ? 'مائیکروفون فعال ہو رہا ہے...' : 'Starting microphone...');

    try {
      // Start audio visualizer in parallel
      startAudioVisualizer();

      const session = await startUnifiedSpeechRecognition(activeLang, {
        onState: (state) => {
          if (!isMountedRef.current) return;
          if (state === 'listening' || state === 'ready') {
            setIsListening(true);
            setFeedback(
              activeLang === 'ur'
                ? 'سن رہا ہے... بولیں! (مثلاً: آرڈر، اسٹاک، خام مال، گیٹ پاس)'
                : 'Listening... Speak your command now!'
            );
          } else if (state === 'processing') {
            setFeedback(activeLang === 'ur' ? 'تجزیہ ہو رہا ہے...' : 'Processing audio...');
          }
        },
        onResult: (text, isFinal) => {
          if (!isMountedRef.current) return;
          setTranscript(text);
          setFeedback(
            isFinal
              ? (activeLang === 'ur' ? 'حکم کا تجزیہ ہو رہا ہے...' : 'Processing command...')
              : (activeLang === 'ur' ? `سن رہا ہے: "${text}"...` : `Hearing: "${text}"...`)
          );
          if (isFinal) {
            stopListening();
            processVoiceCommand(text);
          }
        },
        onError: (err) => {
          if (!isMountedRef.current) return;
          stopListening();
          if (err === 'not-allowed' || err.includes('permission') || err.includes('denied')) {
            setMicDenied(true);
            setFeedback(
              activeLang === 'ur'
                ? 'مائیکروفون کی اجازت درکار ہے۔ براؤزر ایڈریس بار میں اجازت دیں۔'
                : 'Microphone permission needed. Please allow microphone in browser.'
            );
          } else {
            setFeedback(
              activeLang === 'ur'
                ? 'بولنے کے لیے دوبارہ مائیک دبائیں یا نیچے سے کمانڈ چنیں۔'
                : 'Tap mic to speak again or choose a command below.'
            );
          }
        }
      });

      speechSessionRef.current = session;
      setIsListening(true);

      // 15-second safety timer with visual clear
      timeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && isListening) {
          stopListening();
          setFeedback(
            activeLang === 'ur'
              ? 'وقت مکمل ہوا۔ دوبارہ بولنے کے لیے مائیک دبائیں۔'
              : 'Listening timed out. Tap mic to try again.'
          );
        }
      }, 15000);
    } catch (e: any) {
      console.warn('Voice mic start error:', e);
      setIsListening(false);
      stopAudioVisualizer();
      setFeedback(
        activeLang === 'ur'
          ? 'مائیکروفون شروع نہیں ہو سکا۔ نیچے دیا گیا مینو استعمال کریں۔'
          : 'Microphone not responding. You can use the quick commands below.'
      );
    }
  };

  const handleToggleMic = () => {
    if (isListening) {
      stopListening();
      setFeedback(activeLang === 'ur' ? 'مائیکروفون بند ہے۔ بولنے کے لیے ٹیپ کریں۔' : 'Mic stopped. Tap button to speak.');
    } else {
      startListening();
    }
  };

  const filteredCommands = sampleCommands.filter(c => {
    if (categoryFilter === 'all') return true;
    return c.category === categoryFilter;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 font-mono animate-in fade-in duration-150">
      <div className="w-full max-w-lg max-w-full overflow-x-hidden break-words bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col items-center text-center max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between w-full border-b border-[var(--steel-line)] pb-3 mb-3 font-sans">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles size={16} />
            </div>
            <div className="text-left">
              <h3 className="font-serif font-black text-sm sm:text-base text-[var(--text)]">
                {activeLang === 'ur' ? 'وائس مائیک اسسٹنٹ' : 'Voice Mic Assistant'}
              </h3>
              <p className="text-[10px] font-mono text-[var(--text-dim)]">
                Ceiling Fan Rod ERP Voice Engine · اردو / English
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Voice Response Mute Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-1.5 rounded-lg border transition cursor-pointer ${
                soundEnabled
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                  : 'bg-[var(--panel-raised)] border-[var(--steel-line)] text-zinc-500'
              }`}
              title={soundEnabled ? 'Voice reply enabled' : 'Voice reply muted'}
            >
              {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>

            {/* Language Switcher */}
            <div className="flex items-center bg-[var(--panel-raised)] p-0.5 rounded-lg border border-[var(--steel-line)] text-[10px] font-bold">
              <button
                type="button"
                onClick={() => {
                  stopListening();
                  setActiveLang('ur');
                }}
                className={`px-2 py-1 rounded transition cursor-pointer ${
                  activeLang === 'ur' ? 'bg-amber-500 text-black shadow-xs' : 'text-zinc-400 hover:text-white'
                }`}
              >
                اردو
              </button>
              <button
                type="button"
                onClick={() => {
                  stopListening();
                  setActiveLang('en');
                }}
                className={`px-2 py-1 rounded transition cursor-pointer ${
                  activeLang === 'en' ? 'bg-amber-500 text-black shadow-xs' : 'text-zinc-400 hover:text-white'
                }`}
              >
                EN
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                stopListening();
                onClose();
              }}
              className="p-1.5 rounded-lg border border-[var(--steel-line)] text-zinc-400 hover:text-white transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Animated Mic Button & Frequency Visualizer */}
        <div className="relative my-2 flex flex-col items-center justify-center">
          {/* Animated Pulsing Rings */}
          {isListening && (
            <>
              <div className="absolute w-28 h-28 rounded-full bg-amber-500/20 animate-ping pointer-events-none" />
              <div className="absolute w-36 h-36 rounded-full border border-amber-500/30 animate-pulse pointer-events-none" />
            </>
          )}

          <button
            type="button"
            onClick={handleToggleMic}
            title={isListening ? 'Click to stop listening' : 'Click to speak command'}
            className={`w-20 h-20 sm:w-22 sm:h-22 rounded-full flex items-center justify-center border-4 transition-all shadow-2xl relative z-10 cursor-pointer active:scale-95 touch-manipulation ${
              isListening
                ? 'bg-amber-500 text-black border-amber-400 scale-105 shadow-amber-500/40 animate-pulse'
                : 'bg-[var(--panel-raised)] border-amber-500/60 text-amber-400 hover:border-amber-400 hover:scale-105'
            }`}
          >
            {isListening ? <Mic size={38} className="animate-bounce" /> : <MicOff size={34} />}
          </button>

          <span className="text-[11px] font-bold text-amber-400 mt-2 font-mono">
            {isListening
              ? (activeLang === 'ur' ? '● مائیک سن رہا ہے... بولیں' : '● Recording... Speak now')
              : (activeLang === 'ur' ? 'بولنے کے لیے مائیک دبائیں' : 'Tap to speak voice command')}
          </span>
        </div>

        {/* Real-Time Live Frequency Waveform Visualizer */}
        <div className="flex items-center justify-center gap-1.5 h-8 my-1 w-full max-w-xs">
          {frequencyData.map((val, idx) => (
            <div
              key={idx}
              className={`w-2 rounded-full transition-all duration-75 ${
                isListening ? 'bg-amber-400 shadow-xs' : 'bg-zinc-700'
              }`}
              style={{ height: `${val}px` }}
            />
          ))}
        </div>

        {/* Status / Feedback Box */}
        <p className="text-xs text-[var(--yellow)] font-bold my-1 min-h-[1.5rem] px-3 leading-relaxed">
          {feedback}
        </p>

        {/* Live Recognized Transcript */}
        {transcript && (
          <div className="w-full my-1.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-sans text-sm font-semibold italic text-center animate-in fade-in">
            "{transcript}"
          </div>
        )}

        {/* Microphone Permission Warning if denied */}
        {micDenied && (
          <div className="w-full my-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 text-left space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertCircle size={14} className="text-red-400 shrink-0" />
              <span>{activeLang === 'ur' ? 'مائیکروفون کی اجازت درکار ہے' : 'Microphone Permission Blocked'}</span>
            </div>
            <p className="text-[11px] text-red-300/80 leading-relaxed">
              {activeLang === 'ur'
                ? 'براؤزر ایڈریس بار کے بائیں جانب تالے (🔒) پر کلک کریں اور Microphone کو "Allow" کریں۔'
                : 'Click the lock (🔒) icon in your browser address bar and set Microphone to "Allow".'}
            </p>
            {inIframe && (
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 underline pt-1"
              >
                <span>{activeLang === 'ur' ? 'نئی ونڈو میں براہ راست کھولیں' : 'Open in New Window for Direct Mic Access'}</span>
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        )}

        {/* Manual Command Typing Fallback */}
        <form onSubmit={handleManualSubmit} className="w-full my-2 flex gap-1.5">
          <input
            type="text"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder={
              activeLang === 'ur'
                ? 'یا لکھیں: آرڈر، اسٹاک، گیٹ پاس، خام مال، رنگ...'
                : "Or type command: e.g. 'gate pass', 'orders', 'stock'..."
            }
            className="flex-1 px-3 py-2 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] text-xs text-[var(--text)] placeholder-[var(--text-dim)] focus:border-amber-400 outline-none font-mono"
          />
          <button
            type="submit"
            className="px-3.5 py-2 rounded-xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition flex items-center justify-center cursor-pointer"
          >
            <Send size={13} />
          </button>
        </form>

        {/* Quick Voice Command Navigation Chips */}
        <div className="w-full text-left mt-2 border-t border-[var(--steel-line)] pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase text-zinc-400 font-bold">
              {activeLang === 'ur' ? 'فوری ورکشاپ احکامات:' : 'Quick Voice Commands:'}
            </span>
            
            {/* Category tabs */}
            <div className="flex items-center gap-1 text-[10px]">
              {(['all', 'sales', 'production', 'ledgers'] as const).map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-1.5 py-0.5 rounded capitalize transition cursor-pointer ${
                    categoryFilter === cat ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            {filteredCommands.map(cmd => (
              <div
                key={cmd.label}
                onClick={() => handleCommandExec(cmd)}
                className="p-2 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-amber-400/80 cursor-pointer text-xs flex items-center justify-between transition group active:scale-[0.99]"
              >
                <span className="font-semibold text-[var(--text)] group-hover:text-amber-400 flex items-center gap-1.5">
                  <ArrowRight size={11} className="text-zinc-500 group-hover:text-amber-400 shrink-0" />
                  <span>{cmd.label}</span>
                </span>
                <span className="font-urdu text-xs text-zinc-400 group-hover:text-amber-300">{cmd.labelUrdu}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
