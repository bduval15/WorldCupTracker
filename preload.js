const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("worldCup", {
  fetchLive: (options = {}) => ipcRenderer.invoke("fetch-live-world-cup", options),
  fetchMatchSummary: (eventId, options = {}) => ipcRenderer.invoke("fetch-match-summary", eventId, options),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  getAppInfo: () => ipcRenderer.invoke("get-app-info"),
  setCompactMode: (compact) => ipcRenderer.invoke("set-compact-mode", Boolean(compact))
});
