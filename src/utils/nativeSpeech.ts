import { registerPlugin, Capacitor } from '@capacitor/core';

export interface NativeSpeechResult {
  transcript: string;
  isFinal: boolean;
  error?: string;
}

export interface NativeSpeechRecognizerPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  startListening(options: { language: string }): Promise<NativeSpeechResult>;
  stopListening(): Promise<void>;
  addListener(
    eventName: 'speechResult',
    listenerFunc: (data: { transcript: string; isFinal: boolean }) => void
  ): Promise<any>;
  addListener(
    eventName: 'speechRms',
    listenerFunc: (data: { level: number }) => void
  ): Promise<any>;
  addListener(
    eventName: 'speechState',
    listenerFunc: (data: { status: 'ready' | 'listening' | 'processing' }) => void
  ): Promise<any>;
  addListener(
    eventName: 'speechError',
    listenerFunc: (data: { error: number; message: string }) => void
  ): Promise<any>;
  removeAllListeners(): Promise<void>;
}

const NativeSpeechRecognizer = registerPlugin<NativeSpeechRecognizerPlugin>('NativeSpeechRecognizer');

export async function isNativeSpeechSupported(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await NativeSpeechRecognizer.isAvailable();
    return !!res.available;
  } catch (_) {
    return false;
  }
}

export function isWebSpeechSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export interface UnifiedSpeechListener {
  onResult: (transcript: string, isFinal: boolean) => void;
  onRms?: (level: number) => void;
  onState?: (status: 'ready' | 'listening' | 'processing') => void;
  onError?: (err: string) => void;
}

let activeSpeechStopFn: (() => void) | null = null;

export async function startUnifiedSpeechRecognition(
  language: 'ur' | 'en' | string,
  listeners: UnifiedSpeechListener
): Promise<{ stop: () => void; isNative: boolean }> {
  // Always cancel any existing session
  stopUnifiedSpeechRecognition();

  const isNative = await isNativeSpeechSupported();
  const langCode = language === 'ur' || language === 'ur-PK' ? 'ur-PK' : (language === 'en-PK' ? 'en-PK' : 'en-US');

  if (isNative) {
    // 1. Native Android SpeechRecognizer Plugin
    try {
      await NativeSpeechRecognizer.removeAllListeners();

      const resultListener = await NativeSpeechRecognizer.addListener('speechResult', data => {
        listeners.onResult(data.transcript, data.isFinal);
      });

      const rmsListener = await NativeSpeechRecognizer.addListener('speechRms', data => {
        if (listeners.onRms) listeners.onRms(data.level);
      });

      const stateListener = await NativeSpeechRecognizer.addListener('speechState', data => {
        if (listeners.onState) listeners.onState(data.status);
      });

      const errorListener = await NativeSpeechRecognizer.addListener('speechError', data => {
        if (listeners.onError) listeners.onError(data.message);
      });

      let stopped = false;
      const stopFn = () => {
        if (stopped) return;
        stopped = true;
        try {
          NativeSpeechRecognizer.stopListening().catch(() => {});
          resultListener.remove();
          rmsListener.remove();
          stateListener.remove();
          errorListener.remove();
        } catch (_) {}
      };

      activeSpeechStopFn = stopFn;

      NativeSpeechRecognizer.startListening({ language: langCode })
        .then(res => {
          if (res.transcript) {
            listeners.onResult(res.transcript, true);
          }
        })
        .catch(err => {
          if (listeners.onError) listeners.onError(err.message || 'Speech recognition failed');
        });

      return { stop: stopFn, isNative: true };
    } catch (e: any) {
      console.warn('Native speech recognition fallback error:', e);
    }
  }

  // 2. Web Speech API (Chrome / Safari / Edge / Android Web)
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    throw new Error('Speech recognition not supported on this browser/environment');
  }

  let stopped = false;
  let recognition: any = null;

  try {
    recognition = new SpeechRecognition();
    recognition.lang = langCode;
    recognition.continuous = true; // Continuous listening so small pauses don't cut off speech
    recognition.interimResults = true;
    recognition.maxAlternatives = 2;

    recognition.onstart = () => {
      if (stopped) return;
      if (listeners.onState) listeners.onState('listening');
    };

    recognition.onspeechstart = () => {
      if (stopped) return;
      if (listeners.onState) listeners.onState('listening');
    };

    recognition.onaudiostart = () => {
      if (stopped) return;
      if (listeners.onRms) listeners.onRms(60);
    };

    recognition.onresult = (event: any) => {
      if (stopped) return;
      let interim = '';
      let final = '';
      for (let i = 0; i < event.results.length; ++i) {
        const res = event.results[i];
        if (res.isFinal) {
          final += res[0].transcript;
        } else {
          interim += res[0].transcript;
        }
      }
      const current = (final || interim).trim();
      if (current) {
        listeners.onResult(current, Boolean(final));
        if (listeners.onRms) {
          listeners.onRms(Math.min(95, 40 + Math.floor(Math.random() * 45)));
        }
      }
    };

    recognition.onerror = (e: any) => {
      if (stopped) return;
      const err = e.error || 'speech_error';
      // If error is just 'no-speech' or 'aborted', do not crash; keep listening if not stopped
      if (err === 'no-speech') {
        if (listeners.onRms) listeners.onRms(10);
        return;
      }
      if (listeners.onError) listeners.onError(err);
    };

    recognition.onend = () => {
      if (stopped) return;
      // If continuous listening ended unexpectedly, gracefully restart unless user stopped
      try {
        if (!stopped && recognition) {
          recognition.start();
        }
      } catch (_) {
        if (listeners.onState) listeners.onState('processing');
      }
    };

    recognition.start();
  } catch (err: any) {
    if (listeners.onError) listeners.onError(err.message || 'Microphone activation failed');
  }

  const stopFn = () => {
    if (stopped) return;
    stopped = true;
    try {
      if (recognition) {
        recognition.stop();
        recognition.abort();
      }
    } catch (_) {}
  };

  activeSpeechStopFn = stopFn;
  return { stop: stopFn, isNative: false };
}

export function stopUnifiedSpeechRecognition() {
  if (activeSpeechStopFn) {
    try {
      activeSpeechStopFn();
    } catch (_) {}
    activeSpeechStopFn = null;
  }
}
