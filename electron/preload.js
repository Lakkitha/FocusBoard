const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  readStore: () => ipcRenderer.invoke('store:read'),
  writeStore: (data) => ipcRenderer.invoke('store:write', data),
  platform: process.platform,
})
