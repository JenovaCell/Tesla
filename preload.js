const { contextBridge, ipcRenderer, webFrame } = require('electron');

// Disable page-level pinch zoom: the sim must behave like a fixed in-car display.
try { webFrame.setVisualZoomLevelLimits(1, 1); } catch (_) {}

contextBridge.exposeInMainWorld('host', {
  toggleFullscreen: (force) => ipcRenderer.invoke('fullscreen:toggle', force),
  isFullscreen: () => ipcRenderer.invoke('fullscreen:get'),
  onFullscreen: (cb) => ipcRenderer.on('fullscreen-changed', (_e, v) => cb(v)),
  quit: () => ipcRenderer.invoke('app:quit'),
  info: () => ipcRenderer.invoke('app:drm'),
  openExternal: (u) => ipcRenderer.invoke('app:openExternal', u),
});
