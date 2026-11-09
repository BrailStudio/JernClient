const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('jern', {
  call: (c, a) => ipcRenderer.invoke(c, a),
  on: (c, f) => ipcRenderer.on(c, (_, d) => f(d))
});
