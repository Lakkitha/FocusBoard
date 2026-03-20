const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  readStore: () => ipcRenderer.invoke("store:read"),
  writeStore: (data) => ipcRenderer.invoke("store:write", data),
  showNotification: (title, body) =>
    ipcRenderer.invoke("show-notification", { title, body }),
  platform: process.platform,
});
