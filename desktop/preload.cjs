const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('exlinkSerial', {
  list: () => ipcRenderer.invoke('serial:list'),
  open: (id, options) => ipcRenderer.invoke('serial:open', id, options),
  close: id => ipcRenderer.invoke('serial:close', id),
  send: (id, bytes) => ipcRenderer.invoke('serial:send', id, bytes),
  onEvent: listener => {
    const forward = (_event, value) => listener(value);
    ipcRenderer.on('serial:event', forward);
    return () => ipcRenderer.removeListener('serial:event', forward);
  },
});
