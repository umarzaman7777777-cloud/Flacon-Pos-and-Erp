import { Browser } from '@capacitor/browser';
import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativeAppOpenerPlugin {
  openApp(options: { url: string; targetApp?: 'sheets' | 'drive' | 'auto' }): Promise<void>;
}

const NativeAppOpener = registerPlugin<NativeAppOpenerPlugin>('NativeAppOpener');

/**
 * Universal external URL launcher.
 * Directly launches native Google Sheets or Google Drive app on Android without asking or chooser prompts.
 * Gracefully falls back to system browser if native app is not installed.
 */
export async function openExternalUrl(
  url: string | null | undefined,
  targetApp?: 'sheets' | 'drive' | 'auto'
): Promise<void> {
  if (!url) return;

  const resolvedApp = targetApp || (
    url.includes('docs.google.com/spreadsheets') ? 'sheets' :
    url.includes('drive.google.com') ? 'drive' : 'auto'
  );

  if (Capacitor.isNativePlatform()) {
    try {
      await NativeAppOpener.openApp({ url, targetApp: resolvedApp });
      return;
    } catch (pluginErr) {
      console.warn('[openExternalUrl] NativeAppOpener error, attempting Browser.open:', pluginErr);
      try {
        await Browser.open({ url, windowName: '_system' });
        return;
      } catch (browserErr) {
        console.warn('[openExternalUrl] Browser.open error:', browserErr);
      }
    }
  }

  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
