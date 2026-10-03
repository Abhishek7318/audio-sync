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
  }
};
