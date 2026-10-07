import { Browser } from '@capacitor/browser';
import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativeAppOpenerPlugin {
  openApp(options: { url: string; targetApp?: 'sheets' | 'drive' | 'whatsapp' | 'auto' }): Promise<void>;
}

const NativeAppOpener = registerPlugin<NativeAppOpenerPlugin>('NativeAppOpener');

export function toDirectWhatsAppScheme(rawUrl: string): string {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('whatsapp://')) return rawUrl;
  try {
    const urlObj = new URL(rawUrl);
    const searchParams = urlObj.searchParams;
    let phone = searchParams.get('phone') || '';
    const text = searchParams.get('text') || '';

    // If wa.me/<phoneNumber>
    const pathnamePhone = urlObj.pathname.replace(/^\//, '').trim();
    if (!phone && pathnamePhone && /^[0-9+]+$/.test(pathnamePhone)) {
      phone = pathnamePhone;
    }

    const queryParts: string[] = [];
    if (phone) queryParts.push(`phone=${encodeURIComponent(phone)}`);
    if (text) queryParts.push(`text=${encodeURIComponent(text)}`);

    return `whatsapp://send?${queryParts.join('&')}`;
  } catch {
    return rawUrl.replace(/^https?:\/\/(api\.whatsapp\.com\/send|wa\.me)\/?([^?]*)\??/, (_m, _host, phone) => {
      return phone ? `whatsapp://send?phone=${phone}&` : 'whatsapp://send?';
    });
  }
}

/**
 * Universal external URL launcher.
 * Directly launches native WhatsApp, Google Sheets, or Google Drive apps on Android without asking or chooser prompts.
 * Gracefully falls back to system browser if native app is not installed.
 */
export async function openExternalUrl(
  url: string | null | undefined,
  targetApp?: 'sheets' | 'drive' | 'whatsapp' | 'auto'
): Promise<void> {
  if (!url) return;

  const isWhatsApp =
    targetApp === 'whatsapp' ||
    url.startsWith('whatsapp://') ||
    url.includes('api.whatsapp.com') ||
    url.includes('wa.me');

  const resolvedApp: 'sheets' | 'drive' | 'whatsapp' | 'auto' =
    targetApp || (
      url.includes('docs.google.com/spreadsheets') ? 'sheets' :
      url.includes('drive.google.com') ? 'drive' :
      isWhatsApp ? 'whatsapp' : 'auto'
    );

  const effectiveUrl = isWhatsApp ? toDirectWhatsAppScheme(url) : url;

  if (Capacitor.isNativePlatform()) {
    try {
      await NativeAppOpener.openApp({ url: effectiveUrl, targetApp: resolvedApp });
      return;
    } catch (pluginErr) {
      console.warn('[openExternalUrl] NativeAppOpener error, attempting Browser.open:', pluginErr);
      if (!isWhatsApp) {
        try {
          await Browser.open({ url: effectiveUrl, windowName: '_system' });
          return;
        } catch (browserErr) {
          console.warn('[openExternalUrl] Browser.open error:', browserErr);
        }
      }
    }
  }

  if (typeof window !== 'undefined') {
    if (isWhatsApp) {
      // In mobile web/PWA and WebView, direct whatsapp:// scheme opens the native WhatsApp app directly
      // without opening an intermediate web page, chooser, or empty window!
      try {
        window.location.href = effectiveUrl;
        return;
      } catch (_) {
        window.location.assign(effectiveUrl);
        return;
      }
    } else {
      window.open(effectiveUrl, '_blank', 'noopener,noreferrer');
    }
  }
}
