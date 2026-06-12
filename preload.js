const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("worldCup", {
  fetchLive: () => ipcRenderer.invoke("fetch-live-world-cup"),
  fetchMatchSummary: (eventId) => ipcRenderer.invoke("fetch-match-summary", eventId),
  openExternal: (url) => ipcRenderer.invoke("open-external", url)
});
