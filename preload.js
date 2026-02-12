const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  onSwaggerSpec: (callback) => ipcRenderer.on('swagger-spec', (event, spec) => callback(spec))
});