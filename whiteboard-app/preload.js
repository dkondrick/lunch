const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  toggleOverlay:  (enable)     => ipcRenderer.invoke('toggle-overlay', enable),
  setClickThrough:(enable)     => ipcRenderer.invoke('set-click-through', enable),
  screenshot:     ()           => ipcRenderer.invoke('screenshot'),
  importImage:    ()           => ipcRenderer.invoke('import-image'),
  exportPng:      (dataURL)    => ipcRenderer.invoke('export-png', dataURL),
  exportSvg:      (svgString)  => ipcRenderer.invoke('export-svg', svgString),
  exportPdf:      (dataURI)    => ipcRenderer.invoke('export-pdf', dataURI),
  exportJson:     (jsonString) => ipcRenderer.invoke('export-json', jsonString),
  importJson:     ()           => ipcRenderer.invoke('import-json'),
});
