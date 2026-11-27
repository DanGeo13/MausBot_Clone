const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("helper", {
  look: () => ipcRenderer.send("look"),
  ask: (question) => ipcRenderer.send("ask", question),
  saveKey: (key) => ipcRenderer.send("save-key", key),
  on: (channel, fn) => ipcRenderer.on(channel, (_e, ...args) => fn(...args)),
});
