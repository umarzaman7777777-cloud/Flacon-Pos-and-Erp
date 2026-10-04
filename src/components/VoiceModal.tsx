import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Sparkles, AlertCircle, ExternalLink, Send, ArrowRight } from 'lucide-react';
import { AppLanguage, AppView } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { isInsideIframe } from '../utils/mobilePermissions';
import {
  startUnifiedSpeechRecognition,
  stopUnifiedSpeechRecognition
} from '../utils/nativeSpeech';

interface VoiceModalProps {
  language: AppLanguage;
  onClose: () => void;
  onNavigate: (view: AppView) => void;
  onQuickAddProduct?: (name: string, qty: number) => void;
  onLock: () => void;
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  language,
  onClose,
  onNavigate,
  onLock
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState(
    language === 'ur'
      ? 'بولنے کے لیے مائیک دبائیں یا نیچے دیے گئے احکامات چنیں'
      : 'Tap microphone to speak or pick a command below'
  );
  const [audioLevel, setAudioLevel] = useState(0);
  const [micDenied, setMicDenied] = useState(false);
  const [manualText, setManualText] = useState('');
  const inIframe = isInsideIframe();

  const speechSessionRef = useRef<{ stop: () => void; isNative: boolean } | null>(null);
  const timeoutRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(true);

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  const sampleCommands = [
    { label: 'Show Overview', labelUrdu: 'ڈیش بورڈ دکھائیں', action: () => onNavigate('overview') },
    { label: 'Open Products Catalog', labelUrdu: 'پروڈکٹس کھولیں', action: () => onNavigate('products') },
    { label: 'Check Raw Materials', labelUrdu: 'خام مال کا کھاتہ', action: () => onNavigate('raw_material') },
    { label: 'Open Paint Ledger', labelUrdu: 'رنگ والا کھاتہ', action: () => onNavigate('paint_ledger') },
    { label: 'Mark Labour Attendance', labelUrdu: 'مزدوروں کی حاضری', action: () => onNavigate('labour_ledger') },
    { label: 'Check Stock Inventory', labelUrdu: 'اسٹاک چیک کریں', action: () => onNavigate('stock') },
    { label: 'Open Inquiries / Notifications', labelUrdu: 'نوٹیفکیشن اور انکوائری', action: () => onNavigate('notifications') },
    { label: 'Lock Workspace', labelUrdu: 'سسٹم لاک کریں', action: () => onLock() }
  ];

  const stopListening = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    stopUnifiedSpeechRecognition();
    if (speechSessionRef.current) {
      try {
        speechSessionRef.current.stop();
      } catch (_) {}
      speechSessionRef.current = null;
    }
    if (isMountedRef.current) {
      setIsListening(false);
      setAudioLevel(0);
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
    setTranscript(language === 'ur' ? cmd.labelUrdu : cmd.label);
    setFeedback(`✓ ${language === 'ur' ? 'حکم جاری کیا گیا:' : 'Command executed:'} ${cmd.label}`);
    setTimeout(() => {
      cmd.action();
      onClose();
    }, 380);
  };

  const processVoiceCommand = (rawText: string) => {
    const text = rawText.toLowerCase().trim();
    if (!text) return;

    if (text.includes('product') || text.includes('سامان') || text.includes('مال') || text.includes('پروڈکٹ') || text.includes('item')) {
      setFeedback(`✓ ${language === 'ur' ? 'پروڈکٹس کھول رہے ہیں...' : 'Opening Products...'}`);
      setTimeout(() => { onNavigate('products'); onClose(); }, 400);
    } else if (text.includes('paint') || text.includes('رنگ') || text.includes('پینٹ') || text.includes('color')) {
      setFeedback(`✓ ${language === 'ur' ? 'رنگ کھاتہ کھول رہے ہیں...' : 'Opening Paint Ledger...'}`);
      setTimeout(() => { onNavigate('paint_ledger'); onClose(); }, 400);
    } else if (text.includes('labour') || text.includes('labor') || text.includes('مزدور') || text.includes('حاضری') || text.includes('مزدوری')) {
      setFeedback(`✓ ${language === 'ur' ? 'مزدوروں کی حاضری کھول رہے ہیں...' : 'Opening Labour Attendance...'}`);
      setTimeout(() => { onNavigate('labour_ledger'); onClose(); }, 400);
    } else if (text.includes('raw') || text.includes('material') || text.includes('خام') || text.includes('اسٹیل') || text.includes('فائبر')) {
      setFeedback(`✓ ${language === 'ur' ? 'خام مال کھول رہے ہیں...' : 'Opening Raw Materials...'}`);
      setTimeout(() => { onNavigate('raw_material'); onClose(); }, 400);
    } else if (text.includes('stock') || text.includes('inventory') || text.includes('اسٹاک') || text.includes('گودام')) {
      setFeedback(`✓ ${language === 'ur' ? 'اسٹاک انوینٹری کھول رہے ہیں...' : 'Opening Stock Inventory...'}`);
      setTimeout(() => { onNavigate('stock'); onClose(); }, 400);
    } else if (text.includes('lock') || text.includes('بند') || text.includes('لاک')) {
      setFeedback(`✓ ${language === 'ur' ? 'سسٹم لاک کیا جا رہا ہے...' : 'Locking Terminal...'}`);
      setTimeout(() => { onLock(); onClose(); }, 400);
    } else if (text.includes('overview') || text.includes('dashboard') || text.includes('ہوم') || text.includes('ڈیش بورڈ') || text.includes('خلاصہ')) {
      setFeedback(`✓ ${language === 'ur' ? 'ڈیش بورڈ کھول رہے ہیں...' : 'Opening Overview Dashboard...'}`);
      setTimeout(() => { onNavigate('overview'); onClose(); }, 400);
    } else if (text.includes('inquiry') || text.includes('notification') || text.includes('انکوائری') || text.includes('نوٹیفکیشن')) {
      setFeedback(`✓ ${language === 'ur' ? 'نوٹیفکیشن کھول رہے ہیں...' : 'Opening Notifications...'}`);
      setTimeout(() => { onNavigate('notifications'); onClose(); }, 400);
    } else {
      setFeedback(
        language === 'ur'
          ? `پہچانا گیا: "${text}"۔ مماثل کمانڈ نیچے سے منتخب کریں۔`
          : `Heard: "${text}". No matching direct command, please tap a quick action below.`
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
    setFeedback(language === 'ur' ? 'مائیکروفون شروع ہو رہا ہے...' : 'Initializing microphone...');

    try {
      const session = await startUnifiedSpeechRecognition(language, {
        onState: (state) => {
          if (!isMountedRef.current) return;
          if (state === 'listening' || state === 'ready') {
            setIsListening(true);
            setFeedback(language === 'ur' ? 'سن رہا ہے... بولیں!' : 'Listening... Speak your command now!');
          } else if (state === 'processing') {
            setFeedback(language === 'ur' ? 'تجزیہ ہو رہا ہے...' : 'Processing audio...');
          }
        },
        onRms: (level) => {
          if (!isMountedRef.current) return;
          setAudioLevel(level);
        },
        onResult: (text, isFinal) => {
          if (!isMountedRef.current) return;
          setTranscript(text);
          setFeedback(
            isFinal
              ? (language === 'ur' ? 'تجزیہ ہو رہا ہے...' : 'Processing command...')
              : (language === 'ur' ? `سن رہا ہے: "${text}"...` : `Hearing: "${text}"...`)
          );
          if (isFinal) {
            stopListening();
            processVoiceCommand(text);
          }
        },
        onError: (err) => {
          if (!isMountedRef.current) return;
          stopListening();
          if (err === 'not-allowed' || err.includes('permission')) {
            setMicDenied(true);
            setFeedback(
              language === 'ur'
                ? 'مائیکروفون کی اجازت درکار ہے۔ براہ کرم اجازت دیں یا نیچے سے کمانڈ چنیں۔'
                : 'Microphone permission needed. Please allow microphone access or choose a command below.'
            );
          } else if (err === 'no-speech') {
            setFeedback(
              language === 'ur'
                ? 'کوئی آواز نہیں سنی گئی۔ دوبارہ بولنے کے لیے مائیک دبائیں۔'
                : 'No speech heard. Tap mic to speak again or tap a command below.'
            );
          } else {
            setFeedback(
              language === 'ur'
                ? 'مائیکروفون مکمل ہوا۔ نیچے دیے گئے احکامات سے منتخب کریں۔'
                : 'Voice recognition finished. You can also pick a command below.'
            );
          }
        }
      });

      speechSessionRef.current = session;
      setIsListening(true);

      // 12-second safety timeout so mic NEVER hangs or gets stuck
      timeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && isListening) {
          stopListening();
          setFeedback(
            language === 'ur'
              ? 'وقت ختم ہو گیا۔ دوبارہ بولنے کے لیے مائیک دبائیں۔'
              : 'Listening timed out. Tap mic to speak again.'
          );
        }
      }, 12000);
    } catch (e: any) {
      console.warn('Speech recognition start error:', e);
      setIsListening(false);
      setFeedback(
        language === 'ur'
          ? 'مائیکروفون دستیاب نہیں ہے۔ نیچے دیے گئے احکامات استعمال کریں۔'
          : 'Microphone not available on this device. You can type or pick a command below.'
      );
    }
  };

  const handleToggleMic = () => {
    if (isListening) {
      stopListening();
      setFeedback(language === 'ur' ? 'مائیکروفون بند ہے۔ بولنے کے لیے مائیک دبائیں۔' : 'Mic stopped. Tap mic button to speak.');
    } else {
      startListening();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 font-mono">
      <div className="w-full max-w-md bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
        {/* Header */}
        <div className="flex items-center justify-between w-full border-b border-[var(--steel-line)] pb-3 mb-4 font-sans">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-[var(--yellow)]" />
            <h3 className="font-serif font-bold text-base text-[var(--text)]">
              {language === 'ur' ? 'وائس کمانڈ اسسٹنٹ (اردو اور انگلش)' : 'Voice Assistant (Urdu & English)'}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              stopListening();
              onClose();
            }}
            className="p-1 rounded-lg border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)] transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Animated Mic Button & Live Pulse Ring */}
        <div className="relative mb-3 flex items-center justify-center">
          {isListening && (
            <>
              <div
                className="absolute rounded-full bg-amber-500/20 animate-ping"
                style={{
                  width: `${84 + Math.round((audioLevel / 100) * 40)}px`,
                  height: `${84 + Math.round((audioLevel / 100) * 40)}px`
                }}
              />
              <div
                className="absolute rounded-full border border-red-500/40"
                style={{
                  width: `${96 + Math.round((audioLevel / 100) * 25)}px`,
                  height: `${96 + Math.round((audioLevel / 100) * 25)}px`
                }}
              />
            </>
          )}

          <button
            type="button"
            onClick={handleToggleMic}
            title={isListening ? 'Tap to stop listening' : 'Tap to speak'}
            className={`w-20 h-20 rounded-full flex items-center justify-center border-4 transition-all shadow-xl relative z-10 cursor-pointer ${
              isListening
                ? 'bg-red-500/20 border-red-500 text-red-500 scale-105'
                : 'bg-[var(--panel-raised)] border-[var(--yellow)] text-[var(--yellow)] hover:scale-105 active:scale-95'
            }`}
          >
            {isListening ? <Mic size={36} className="animate-pulse" /> : <MicOff size={36} />}
          </button>
        </div>

        {/* Real-time Live Audio Waveform Feed Back */}
        {isListening && (
          <div className="flex items-center justify-center gap-1.5 h-6 mb-2">
            {[0.4, 0.8, 1.2, 0.9, 0.5, 1.1, 0.7].map((factor, idx) => {
              const h = Math.max(4, Math.round((audioLevel / 100) * 24 * factor) + (isListening ? 6 : 0));
              return (
                <div
                  key={idx}
                  className="w-1.5 rounded-full bg-amber-400 transition-all duration-75"
                  style={{ height: `${h}px` }}
                />
              );
            })}
          </div>
        )}

        {/* Live Feedback Text */}
        <p className="text-xs text-[var(--yellow)] font-bold mb-1 min-h-[1.25rem] px-2 leading-relaxed">
          {feedback}
        </p>

        {/* Real-time Live Transcript */}
        {transcript && (
          <div className="w-full my-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-sans text-sm font-semibold italic text-center animate-fade-in">
            "{transcript}"
          </div>
        )}

        {/* Mic Permission Guidance */}
        {micDenied && (
          <div className="w-full mt-2 mb-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 text-left space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertCircle size={14} className="text-red-400 shrink-0" />
              <span>{language === 'ur' ? 'مائیکروفون کی اجازت درکار ہے' : 'Microphone Access Restricted'}</span>
            </div>
            <p className="text-[11px] text-red-300/80">
              {language === 'ur'
                ? 'براؤزر کے ایڈریس بار میں تالے (🔒) کے آئیکن پر ٹیپ کریں اور Microphone کو Allow کریں۔'
                : 'Tap the Lock (🔒) icon beside the URL in your browser address bar and set Microphone to "Allow".'}
            </p>
            {inIframe && (
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 underline pt-1"
              >
                <span>{language === 'ur' ? 'نئے ٹیب میں کھول کر مائیک آزمائیں' : 'Open in Direct Tab'}</span>
                <ExternalLink size={11} />
              </a>
            )}
          </div>
        )}

        {/* Direct Text Input Fallback (Works everywhere even without speech hardware) */}
        <form onSubmit={handleManualSubmit} className="w-full mt-2 flex gap-1.5">
          <input
            type="text"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder={language === 'ur' ? 'یا کمانڈ ٹائپ کریں (مثلاً: مال، اسٹاک، رنگ)...' : "Or type command: e.g. 'products', 'stock'..."}
            className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] text-xs text-[var(--text)] placeholder-[var(--text-dim)] focus:border-[var(--yellow)] outline-none"
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-[var(--yellow)] text-xs transition flex items-center justify-center cursor-pointer"
          >
            <Send size={13} />
          </button>
        </form>

        {/* Quick Voice Command Chips */}
        <div className="w-full text-left mt-3">
          <div className="text-[10px] uppercase text-[var(--text-dim)] mb-1.5 font-bold flex items-center justify-between">
            <span>{language === 'ur' ? 'فوری احکامات:' : 'Quick Voice Actions:'}</span>
            <span className="text-[10px] text-[var(--text-dim)] lowercase">tap to execute</span>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
            {sampleCommands.map(cmd => (
              <div
                key={cmd.label}
                onClick={() => handleCommandExec(cmd)}
                className="p-2 rounded-lg bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] cursor-pointer text-xs flex items-center justify-between transition group"
              >
                <span className="font-semibold text-[var(--text)] group-hover:text-[var(--yellow)] flex items-center gap-1.5">
                  <ArrowRight size={11} className="text-[var(--text-dim)] group-hover:text-[var(--yellow)]" />
                  {cmd.label}
                </span>
                <span className="font-urdu text-xs text-[var(--text-dim)]">{cmd.labelUrdu}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
