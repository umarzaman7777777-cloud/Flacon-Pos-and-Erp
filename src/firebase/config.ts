import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDocFromServer,
  setLogLevel
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Suppress internal Firestore connection warnings from triggering unhandled warnings
try {
  setLogLevel('silent');
} catch (_) {
  // Ignore in case setLogLevel is unavailable
}

const app = initializeApp(firebaseConfig);
/* CRITICAL: The app will break without specifying firestoreDatabaseId */
export const db = initializeFirestore(
  app,
  {
    experimentalAutoDetectLongPolling: true,
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  },
  (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-falconrodmakerpo-4ec08e17-6c91-4aca-b59a-d747b503ca3a'
);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
  login_hint: 'umarzaman7777777@gmail.com'
});
// Explicitly include Google Workspace scopes for Drive Backups and Google Sheets
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  
  // Gracefully handle expected offline or network disconnection without throwing fatal exceptions
  if (
    errMsg.toLowerCase().includes('unavailable') ||
    errMsg.toLowerCase().includes('client is offline') ||
    errMsg.toLowerCase().includes('could not reach cloud firestore') ||
    errMsg.toLowerCase().includes('backend didn\'t respond')
  ) {
    console.info(`[Firestore Offline Cache] ${operationType} on ${path || 'database'}: Client operating with local persistence.`);
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(timeoutMs = 4000): Promise<boolean> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection check timed out')), timeoutMs)
    );
    await Promise.race([
      getDocFromServer(doc(db, 'test', 'connection')),
      timeoutPromise
    ]);
    return true;
  } catch (error) {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes('offline') ||
        msg.includes('unavailable') ||
        msg.includes('timed out') ||
        msg.includes('failed to get document') ||
        msg.includes('could not reach') ||
        msg.includes('backend didn\'t respond')
      ) {
        // Handled: Offline storage active
        return false;
      } else {
        console.warn("Firestore connection check:", error.message);
      }
    }
    return false;
  }
}
