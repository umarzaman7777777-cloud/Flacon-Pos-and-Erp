import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { registerPwaServiceWorker } from './utils/pwaRegister';
import './index.css';

// Filter non-fatal preview environment warnings and offline notices from cluttering the dev console counter
if (typeof window !== 'undefined') {
  const isIgnorableNoise = (args: any[]) => {
    const text = args
      .map(a => {
        if (typeof a === 'string') return a;
        if (a instanceof Error) return `${a.message} ${a.stack || ''}`;
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(' ')
      .toLowerCase();

    return (
      text.includes('[pwa]') ||
      text.includes('service worker') ||
      text.includes('capacitor') ||
      text.includes('biometric') ||
      text.includes('webauthn') ||
      text.includes('localnotifications') ||
      text.includes('[syncengine]') ||
      text.includes('firestore connection') ||
      text.includes('[persistentstorage]') ||
      text.includes('native') ||
      text.includes('indexeddb') ||
      text.includes('deep link') ||
      text.includes('appstatechange') ||
      text.includes('sheets.googleapis.com') ||
      text.includes('googleapis.com/drive') ||
      text.includes('auth_unknown_gmail_trace') ||
      text.includes('google sheets not authenticated') ||
      text.includes('unauthenticated') ||
      text.includes('status of 401') ||
      text.includes('status of 400') ||
      text.includes('defaultprops') ||
      text.includes('failed to fetch') ||
      text.includes('auth/popup-closed-by-user') ||
      text.includes('auth_timeout_rescue') ||
      text.includes('origin_mismatch')
    );
  };

  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (isIgnorableNoise(args)) return;
    originalWarn(...args);
  };

  const originalError = console.error;
  console.error = (...args: any[]) => {
    if (isIgnorableNoise(args)) return;
    originalError(...args);
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = String(reason?.message || reason?.error || reason || '').toLowerCase();
    if (
      msg.includes('sheets.googleapis.com') ||
      msg.includes('googleapis.com/drive') ||
      msg.includes('401') ||
      msg.includes('unauthenticated') ||
      msg.includes('auth/popup-closed-by-user') ||
      msg.includes('service worker')
    ) {
      event.preventDefault();
    }
  });
}

// Initialize PWA Service Worker for Offline Capabilities & Installability
registerPwaServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
