const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  isSmoke: !!process.env.FVE_SMOKE,
  importMedia: () => ipcRenderer.invoke('media:import'),
  pickMedia: () => ipcRenderer.invoke('media:pick'),
  mediaExists: (file) => ipcRenderer.sendSync('media:exists', file),
  saveProject: (json) => ipcRenderer.invoke('project:save', json),
  openProject: () => ipcRenderer.invoke('project:open'),
  projectFs: (method, args) => ipcRenderer.invoke('projects:fs', method, args),
  exportVideo: (project) => ipcRenderer.invoke('export:start', project),
  cancelExport: () => ipcRenderer.invoke('export:cancel'),
  showInFolder: (file) => ipcRenderer.invoke('shell:show', file),
  waveform: (file) => ipcRenderer.invoke('media:waveform', file),
  onExportProgress: (cb) => {
    const handler = (_e, p) => cb(p);
    ipcRenderer.on('export:progress', handler);
    return () => ipcRenderer.removeListener('export:progress', handler);
  },
  onClosing: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('app:closing', handler);
    return () => ipcRenderer.removeListener('app:closing', handler);
  },
  readyToClose: () => ipcRenderer.send('app:ready-to-close'),
});
