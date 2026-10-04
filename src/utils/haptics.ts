import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// Global configuration states
let hapticsEnabled = true;
let hapticAudioEnabled = true;

export function configureHaptics(options: { enabled?: boolean; audio?: boolean }) {
  if (options.enabled !== undefined) hapticsEnabled = options.enabled;
  if (options.audio !== undefined) hapticAudioEnabled = options.audio;
}

export function getHapticConfig() {
  return { enabled: hapticsEnabled, audio: hapticAudioEnabled };
}

// AudioContext synthesizer for complementary industrial POS physical feedback
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

// Synthesize low-latency micro-sounds to complement mechanical motor vibration
function playTactileAudio(type: 'click' | 'cart' | 'success' | 'threshold' | 'refresh' | 'pop') {
  if (!hapticAudioEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (type === 'click' || type === 'pop') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(type === 'pop' ? 880 : 1200, now);
      osc.frequency.exponentialRampToValueAtTime(type === 'pop' ? 440 : 400, now + 0.025);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.026);
    } else if (type === 'cart') {
      // Crisp 2-tone confirmation blip (880Hz -> 1320Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(660, now);
      osc1.frequency.setValueAtTime(990, now + 0.035);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.08);
    } else if (type === 'threshold') {
      // Detent tick when pull-to-refresh crosses target line
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(740, now);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.035);
    } else if (type === 'refresh') {
      // Rising refresh chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.09); // G5
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } else if (type === 'success') {
      // Rich 3-note POS cash confirmation chord (C5 - E5 - G5)
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.045);
        gain.gain.setValueAtTime(0.14, now + idx * 0.045);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.045 + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.045);
        osc.stop(now + idx * 0.045 + 0.13);
      });
    }
  } catch {
    // Ignore audio synthesis errors in restricted policies
  }
}

// Safe Web vibration fallback
function webVibrate(pattern: number | number[]) {
  if (!hapticsEnabled) return;
  try {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Gracefully handle browser restrictions
  }
}

/**
 * Haptic: Add item to cart
 * Firm medium impact pulse providing instant tactile acknowledgement in noisy workshop / factory
 */
export async function hapticAddToCart() {
  playTactileAudio('cart');
  if (!hapticsEnabled) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    webVibrate(32);
  }
}

/**
 * Haptic: Transaction / POS order completion
 * Rich dual-pulse success pattern confirming payment recorded or invoice issued
 */
export async function hapticTransactionComplete() {
  playTactileAudio('success');
  if (!hapticsEnabled) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    webVibrate([45, 65, 95]);
  }
}

/**
 * Haptic: Pull-to-refresh detent threshold reached
 * Crisp light impact notifying user that releasing now will trigger refresh
 */
export async function hapticPullThreshold() {
  playTactileAudio('threshold');
  if (!hapticsEnabled) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    webVibrate(22);
  }
}

/**
 * Haptic: Pull-to-refresh completed & fresh data loaded
 * High-satisfaction success pulse
 */
export async function hapticPullComplete() {
  playTactileAudio('refresh');
  if (!hapticsEnabled) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    webVibrate([30, 40, 60]);
  }
}

/**
 * Haptic: Cart quantity increment/decrement (+ / -)
 * Fast selection tick
 */
export async function hapticQuantityChange() {
  playTactileAudio('click');
  if (!hapticsEnabled) return;
  try {
    await Haptics.selectionChanged();
  } catch {
    webVibrate(15);
  }
}

/**
 * Haptic: General primary button tap or keypad stroke
 */
export async function hapticTap() {
  playTactileAudio('click');
  if (!hapticsEnabled) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    webVibrate(12);
  }
}

/**
 * Haptic: Warning notification (e.g. out of stock or low inventory alert)
 */
export async function hapticWarning() {
  if (!hapticsEnabled) return;
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch {
    webVibrate([40, 50, 40]);
  }
}

/**
 * Haptic: Error or destructive action (e.g. deleting transaction, clearing cart)
 */
export async function hapticError() {
  if (!hapticsEnabled) return;
  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch {
    webVibrate([60, 50, 60, 50, 80]);
  }
}

/**
 * Check if haptic hardware or vibration is supported
 */
export function isHapticSupported(): boolean {
  return (
    (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') ||
    (typeof window !== 'undefined' && 'Capacitor' in window)
  );
}

/**
 * Universal Haptic Trigger
 */
export async function triggerHaptic(type: 'success' | 'click' | 'warning' | 'error' | 'cart' = 'click') {
  if (type === 'success') {
    return hapticTransactionComplete();
  } else if (type === 'cart') {
    return hapticAddToCart();
  } else if (type === 'error' || type === 'warning') {
    return hapticError();
  } else {
    return hapticTap();
  }
}
