import { registerPlugin, Capacitor } from '@capacitor/core';

export interface NativeFileSaverPlugin {
  saveFile(options: {
    fileName: string;
    base64Data: string;
    mimeType: string;
  }): Promise<{ success: boolean; uri?: string; path?: string; message?: string }>;
  shareFile(options: {
    fileName: string;
    base64Data: string;
    mimeType: string;
  }): Promise<{ success: boolean }>;
}

export const NativeFileSaver = registerPlugin<NativeFileSaverPlugin>('NativeFileSaver');

export async function saveFileNatively(options: {
  fileName: string;
  base64Data: string;
  mimeType: string;
}): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await NativeFileSaver.saveFile(options);
    return !!(res && res.success);
  } catch (err) {
    console.warn('NativeFileSaver saveFile error:', err);
    return false;
  }
}

export async function shareFileNatively(options: {
  fileName: string;
  base64Data: string;
  mimeType: string;
}): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await NativeFileSaver.shareFile(options);
    return !!(res && res.success);
  } catch (err) {
    console.warn('NativeFileSaver shareFile error:', err);
    return false;
  }
}
