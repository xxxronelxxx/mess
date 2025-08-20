const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  selectFile: () => ipcRenderer.invoke('select-file'),
  selectFiles: () => ipcRenderer.invoke('select-files'),
  saveFile: (options) => ipcRenderer.invoke('save-file', options),
  
  // Dialogs
  showError: (title, content) => ipcRenderer.invoke('show-error', title, content),
  showInfo: (title, content) => ipcRenderer.invoke('show-info', title, content),
  showConfirm: (title, content) => ipcRenderer.invoke('show-confirm', title, content),
  
  // App info
  getAppVersion: () => process.versions.electron,
  getPlatform: () => process.platform
});