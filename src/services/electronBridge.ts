export interface ElectronDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles' | 'createDirectory'>;
}

declare global {
  interface Window {
    electronAPI?: {
      openFile: (options: ElectronDialogOptions) => Promise<{ canceled: boolean; filePaths: string[] }>;
      openDirectory: (options: ElectronDialogOptions) => Promise<{ canceled: boolean; filePaths: string[] }>;
      showSaveDialog: (options: any) => Promise<{ canceled: boolean; filePath?: string }>;
      openPath: (path: string) => Promise<string>;
      showItemInFolder: (path: string) => Promise<boolean>;
      getMachineId?: () => Promise<string>;
      getDeviceName?: () => Promise<string>;
      saveAuthSession?: (session: any) => Promise<{ success: boolean; error?: string }>;
      getAuthSession?: () => Promise<any>;
      clearAuthSession?: () => Promise<{ success: boolean; error?: string }>;
      platform: string;
    };
  }
}

export const electronBridge = {
  isElectron: (): boolean => {
    return typeof window !== 'undefined' && !!window.electronAPI;
  },

  selectAudioFile: async (): Promise<string | null> => {
    if (window.electronAPI) {
      const res = await window.electronAPI.openFile({
        title: 'Select Narration Audio File',
        filters: [
          { name: 'Audio Files', extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });
      if (!res.canceled && res.filePaths.length > 0) {
        return res.filePaths[0];
      }
      return null;
    }
    // Fallback: browser input prompt or file drag-drop
    return null;
  },

  selectDirectory: async (title = 'Select Folder'): Promise<string | null> => {
    if (window.electronAPI) {
      const res = await window.electronAPI.openDirectory({
        title,
        properties: ['openDirectory', 'createDirectory']
      });
      if (!res.canceled && res.filePaths.length > 0) {
        return res.filePaths[0];
      }
      return null;
    }
    return null;
  },

  openFolder: async (path: string) => {
    if (window.electronAPI) {
      await window.electronAPI.openPath(path);
    }
  },

  revealInFinder: async (path: string) => {
    if (window.electronAPI) {
      await window.electronAPI.showItemInFolder(path);
    }
  },

  getMachineId: async (): Promise<string> => {
    if (window.electronAPI?.getMachineId) {
      try {
        return await window.electronAPI.getMachineId();
      } catch (e) {
        console.warn('Failed to get native machine ID, falling back to local ID:', e);
      }
    }
    let localId = localStorage.getItem('storyreel_device_machine_id');
    if (!localId) {
      localId = 'web_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('storyreel_device_machine_id', localId);
    }
    return localId;
  },

  getDeviceName: async (): Promise<string> => {
    if (window.electronAPI?.getDeviceName) {
      try {
        return await window.electronAPI.getDeviceName();
      } catch (e) {
        // fallback
      }
    }
    return navigator.userAgent.includes('Mac') ? 'MacBook' : 'Personal Computer';
  },

  saveAuthSession: async (session: any): Promise<boolean> => {
    if (window.electronAPI?.saveAuthSession) {
      try {
        const res = await window.electronAPI.saveAuthSession(session);
        return !!res?.success;
      } catch (e) {
        console.warn('Failed to save auth session to disk:', e);
      }
    }
    return false;
  },

  getAuthSession: async (): Promise<any | null> => {
    if (window.electronAPI?.getAuthSession) {
      try {
        return await window.electronAPI.getAuthSession();
      } catch (e) {
        console.warn('Failed to read auth session from disk:', e);
      }
    }
    return null;
  },

  clearAuthSession: async (): Promise<boolean> => {
    if (window.electronAPI?.clearAuthSession) {
      try {
        const res = await window.electronAPI.clearAuthSession();
        return !!res?.success;
      } catch (e) {
        console.warn('Failed to clear auth session from disk:', e);
      }
    }
    return false;
  }
};
