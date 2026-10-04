import firebaseConfig from '../../firebase-applet-config.json';
import { auth, db, googleProvider } from '../firebase/config';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { notifyWorkspaceSyncUpdated, isNativeOrLocalEnvironment, storeSheetsToken } from './googleSheetsSync';
import { getPersistent, setPersistent, removePersistent } from './persistentStorage';

declare global {
  interface Window {
    google?: any;
  }
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime: string;
  modifiedTime?: string;
  description?: string;
  webViewLink?: string;
}

export interface DriveTokenInfo {
  token: string;
  expiresAt: number;
  userEmail?: string;
}

const BACKUP_FOLDER_NAME = 'Falcon Rod Maker POS - Database Backups';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const STORAGE_KEY_TOKEN = 'falcon_gdrive_token';
const STORAGE_KEY_EXPIRES = 'falcon_gdrive_expires_at';
const STORAGE_KEY_EMAIL = 'falcon_gdrive_email';
const STORAGE_KEY_FOLDER_ID = 'falcon_gdrive_folder_id';
const STORAGE_KEY_LAST_BACKUP = 'falcon_gdrive_last_backup_time';
const STORAGE_KEY_AUTO_BACKUP = 'falcon_gdrive_autobackup';
const THIRTY_DAYS_MS = 30 * 24 * 3600 * 1000;

/**
 * Retrieve cached OAuth access token if available
 */
export function getStoredDriveToken(allowGracePeriod: boolean = true): DriveTokenInfo | null {
  try {
    const token = getPersistent(STORAGE_KEY_TOKEN);
    const expiresStr = getPersistent(STORAGE_KEY_EXPIRES);
    const userEmail = getPersistent(STORAGE_KEY_EMAIL) || 'umarzaman7777777@gmail.com';
    
    if (!token) return null;
    
    const expiresAt = expiresStr ? parseInt(expiresStr, 10) : (Date.now() + 3600 * 1000);
    
    return { token, expiresAt, userEmail };
  } catch {
    return null;
  }
}

/**
 * Persist access token to both localStorage and native Android SharedPreferences
 */
export function storeDriveToken(token: string, expiresInSeconds: number = 3600, email?: string): void {
  try {
    const validDuration = expiresInSeconds > 0 ? expiresInSeconds : 3600;
    const expiresAt = Date.now() + (validDuration * 1000);
    setPersistent(STORAGE_KEY_TOKEN, token);
    setPersistent(STORAGE_KEY_EXPIRES, expiresAt.toString());
    if (email) {
      setPersistent(STORAGE_KEY_EMAIL, email);
    }
    notifyWorkspaceSyncUpdated();
  } catch (err) {
    console.error('Failed to store Drive token', err);
  }
}

/**
 * Clear cached Google Drive credentials
 */
export function clearDriveToken(): void {
  try {
    removePersistent(STORAGE_KEY_TOKEN);
    removePersistent(STORAGE_KEY_EXPIRES);
    removePersistent(STORAGE_KEY_EMAIL);
    notifyWorkspaceSyncUpdated();
  } catch (err) {
    console.error('Failed to clear Drive token', err);
  }
}

export function getStoredDriveFolderId(): string | null {
  try {
    return getPersistent(STORAGE_KEY_FOLDER_ID);
  } catch {
    return null;
  }
}

export function setStoredDriveFolderId(folderId: string): void {
  try {
    setPersistent(STORAGE_KEY_FOLDER_ID, folderId);
    notifyWorkspaceSyncUpdated();
  } catch (err) {
    console.error('Failed to store Drive folder id', err);
  }
}

export function getLastDriveBackupTime(): string | null {
  try {
    return getPersistent(STORAGE_KEY_LAST_BACKUP);
  } catch {
    return null;
  }
}

export function setLastDriveBackupTime(time: string): void {
  try {
    setPersistent(STORAGE_KEY_LAST_BACKUP, time);
    notifyWorkspaceSyncUpdated();
  } catch (err) {
    console.error('Failed to store last Drive backup time', err);
  }
}

export const STORAGE_KEY_AUTO_BACKUP_INTERVAL = 'falcon_gdrive_autobackup_interval_hours';

export function getDriveAutoBackupIntervalHours(): number {
  try {
    const val = getPersistent(STORAGE_KEY_AUTO_BACKUP_INTERVAL);
    if (val) {
      const num = parseFloat(val);
      if (!isNaN(num) && num > 0) return num;
    }
  } catch {}
  return 4; // Default to 4 hours interval
}

export function setDriveAutoBackupIntervalHours(hours: number): void {
  try {
    const validHours = Math.max(0.5, Math.min(72, hours));
    setPersistent(STORAGE_KEY_AUTO_BACKUP_INTERVAL, validHours.toString());
    notifyWorkspaceSyncUpdated();
  } catch (err) {
    console.error('Failed to store Drive auto backup interval', err);
  }
}

/**
 * Calculates next scheduled backup time based on last backup and interval
 */
export function getNextDriveBackupDate(lastBackupTime: string | null, intervalHours: number = 4): Date {
  const intervalMs = intervalHours * 3600 * 1000;
  if (!lastBackupTime) {
    // If never backed up, schedule immediate backup in 1 minute
    return new Date(Date.now() + 60 * 1000);
  }
  const lastTime = new Date(lastBackupTime).getTime();
  if (isNaN(lastTime)) {
    return new Date(Date.now() + intervalMs);
  }
  const nextTarget = lastTime + intervalMs;
  return new Date(nextTarget);
}

/**
 * Returns human-readable countdown string, e.g., "in 1h 45m" or "Due now"
 */
export function formatBackupCountdown(targetDate: Date): string {
  const diffMs = targetDate.getTime() - Date.now();
  if (diffMs <= 0) return 'Due now (Auto-backing up)';
  
  const totalMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  
  if (hours > 0) {
    return `in ${hours}h ${mins}m`;
  }
  if (mins > 0) {
    return `in ${mins}m`;
  }
  return 'in < 1m';
}

export function getDriveAutoBackupEnabled(): boolean {
  try {
    return getPersistent(STORAGE_KEY_AUTO_BACKUP) === 'true';
  } catch {
    return false;
  }
}

export function setDriveAutoBackupEnabled(enabled: boolean): void {
  try {
    setPersistent(STORAGE_KEY_AUTO_BACKUP, enabled ? 'true' : 'false');
    notifyWorkspaceSyncUpdated();
  } catch (err) {
    console.error('Failed to store Drive auto backup setting', err);
  }
}

/**
 * Direct device-local token helpers (Cloud token sharing disabled per user preference)
 */
export async function syncDriveTokenFromCloud(): Promise<DriveTokenInfo | null> {
  // Tokens are strictly managed locally on this device
  return getStoredDriveToken();
}

export async function publishDriveTokenToCloud(
  _token: string,
  _expiresInSec: number,
  _email: string,
  _folderId?: string
): Promise<void> {
  // Disabled: Clean device-only authorization without cloud token exposure
}

/**
 * Manually inject a Google Drive token (for mobile APK or copied token)
 */
export function setManualDriveToken(
  token: string,
  expiresInSec: number = 7200,
  email: string = 'umarzaman7777777@gmail.com',
  folderId?: string
): string {
  const cleanToken = token.trim().replace(/^Bearer\s+/i, '');
  storeDriveToken(cleanToken, expiresInSec, email);
  if (folderId) {
    setStoredDriveFolderId(folderId.trim());
  }
  notifyWorkspaceSyncUpdated();
  return cleanToken;
}

/**
 * Acquire Google Drive OAuth token directly and securely on this device.
 */
export async function requestGoogleDriveToken(preferredEmail?: string): Promise<string> {
  // 0. Return existing active token if valid
  const cached = getStoredDriveToken();
  if (cached && cached.token && !cached.token.startsWith('falcon_offline_session_')) {
    return cached.token;
  }

  // 1. Direct Universal Google Authentication
  try {
    const email = preferredEmail || 'umarzaman7777777@gmail.com';
    const { performUniversalGoogleSignIn } = await import('./googleAuthHelper');
    const authResult = await performUniversalGoogleSignIn({
      preferredEmail: email,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file'
      ]
    });

    const accessToken = authResult.accessToken;

    if (!accessToken) {
      throw new Error('Google authorization completed. Verifying access credentials...');
    }
    storeDriveToken(accessToken, 3600, email);
    storeSheetsToken(accessToken, 3600, email);
    return accessToken;
  } catch (error: any) {
    throw new Error(error?.message || 'Authentication with Google Drive was cancelled or failed.');
  }
}

/**
 * Locate or create the dedicated backup folder in the user's Google Drive
 */
export async function getOrCreateBackupFolder(accessToken: string): Promise<{ id: string; name: string }> {
  // Check cached folder ID first
  const cachedFolderId = localStorage.getItem(STORAGE_KEY_FOLDER_ID);
  if (cachedFolderId) {
    try {
      const verifyRes = await fetch(`https://www.googleapis.com/drive/v3/files/${cachedFolderId}?fields=id,name,trashed`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (verifyRes.ok) {
        const folder = await verifyRes.json();
        if (!folder.trashed) {
          return { id: folder.id, name: folder.name };
        }
      }
    } catch {
      // Cached ID was stale or invalid, will re-query
    }
  }

  // Query for existing folder
  const query = encodeURIComponent(`name = '${BACKUP_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&spaces=drive`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!searchRes.ok) {
    const errText = await searchRes.text();
    throw new Error(`Failed to query Google Drive folder: ${searchRes.status} ${errText}`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    const folder = searchData.files[0];
    localStorage.setItem(STORAGE_KEY_FOLDER_ID, folder.id);
    return { id: folder.id, name: folder.name };
  }

  // Create new folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: BACKUP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Automated and manual database snapshots for Falcon Rod Maker POS & ERP'
    })
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create Google Drive backup folder: ${createRes.status} ${errText}`);
  }

  const newFolder = await createRes.json();
  localStorage.setItem(STORAGE_KEY_FOLDER_ID, newFolder.id);
  return { id: newFolder.id, name: newFolder.name };
}

/**
 * Upload a JSON or SQL backup file into the Google Drive backup folder
 */
export async function uploadBackupToGoogleDrive(
  accessToken: string,
  options: {
    fileName: string;
    fileContent: string;
    mimeType: string;
    description?: string;
  }
): Promise<GoogleDriveFile> {
  const folder = await getOrCreateBackupFolder(accessToken);

  const metadata = {
    name: options.fileName,
    description: options.description || 'Falcon Rod Maker POS Database Backup',
    mimeType: options.mimeType,
    parents: [folder.id]
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${options.mimeType}; charset=UTF-8\r\n\r\n` +
    options.fileContent +
    closeDelimiter;

  const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime,modifiedTime,description,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Google Drive upload failed: ${uploadRes.status} ${errText}`);
  }

  const uploadedFile: GoogleDriveFile = await uploadRes.json();
  setLastDriveBackupTime(new Date().toISOString());
  return uploadedFile;
}

/**
 * Fetch list of all database backups present in the Google Drive folder
 */
export async function listGoogleDriveBackups(accessToken: string): Promise<{ files: GoogleDriveFile[]; folderId: string }> {
  const folder = await getOrCreateBackupFolder(accessToken);

  const query = encodeURIComponent(`'${folder.id}' in parents and trashed = false`);
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,size,createdTime,modifiedTime,description,webViewLink)&orderBy=createdTime desc&pageSize=50`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  if (!listRes.ok) {
    const errText = await listRes.text();
    throw new Error(`Failed to list backups from Google Drive: ${listRes.status} ${errText}`);
  }

  const data = await listRes.json();
  return {
    files: data.files || [],
    folderId: folder.id
  };
}

/**
 * Download the raw content of a specific backup file from Google Drive
 */
export async function downloadGoogleDriveBackupContent(accessToken: string, fileId: string): Promise<string> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to download backup from Google Drive: ${res.status} ${errText}`);
  }

  return await res.text();
}

/**
 * Delete a backup file from Google Drive
 */
export async function deleteGoogleDriveBackup(accessToken: string, fileId: string): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok && res.status !== 204) {
    const errText = await res.text();
    throw new Error(`Failed to delete backup from Google Drive: ${res.status} ${errText}`);
  }
}

/**
 * Utility: format byte sizes
 */
export function formatDriveFileSize(bytes?: number | string): string {
  if (!bytes) return '0 KB';
  const num = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (isNaN(num)) return '0 KB';
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Utility: format ISO timestamp to human-friendly workshop date
 */
export function formatDriveDate(isoDateString?: string): string {
  if (!isoDateString) return 'Unknown date';
  try {
    const d = new Date(isoDateString);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return isoDateString;
  }
}
