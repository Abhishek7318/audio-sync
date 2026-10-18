const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  openDirectory: (options) => ipcRenderer.invoke('dialog:openDirectory', options),
  showSaveDialog: (options) => ipcRenderer.invoke('dialog:showSaveDialog', options),
  openPath: (path) => ipcRenderer.invoke('shell:openPath', path),
  showItemInFolder: (path) => ipcRenderer.invoke('shell:showItemInFolder', path),
  getMachineId: () => ipcRenderer.invoke('system:getMachineId'),
  getDeviceName: () => ipcRenderer.invoke('system:getDeviceName'),
  saveAuthSession: (session) => ipcRenderer.invoke('system:saveAuthSession', session),
  getAuthSession: () => ipcRenderer.invoke('system:getAuthSession'),
  clearAuthSession: () => ipcRenderer.invoke('system:clearAuthSession'),
  platform: process.platform,
});
