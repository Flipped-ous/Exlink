const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { installSerialIpc } = require('./serial.cjs');
let serial;
let quitReady = false;
let quitting = false;
app.whenReady().then(() => {
  const entry = path.join(__dirname, '..', 'dist', 'index.html');
  if (!fs.existsSync(entry)) {
    dialog.showErrorBox('EXLINK Studio', '请先运行 pnpm build，再运行 pnpm desktop。');
    app.quit(); return;
  }
  let Port;
  try { ({ SerialPort: Port } = require('serialport')); }
  catch (error) { console.error('Unable to load SerialPort:', error); }
  const win = new BrowserWindow({ width: 1440, height: 900, minWidth: 960, minHeight: 640,
    title: 'EXLINK Studio', icon: path.join(__dirname, '..', 'public', 'brand', 'exlink-ribbon-dark-v3.png'), backgroundColor: '#0f0e17', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.cjs') } });
  serial = installSerialIpc(ipcMain, () => win.isDestroyed() ? undefined : win.webContents, Port);
  win.webContents.on('render-process-gone', () => void serial.disconnect());
  win.webContents.on('did-start-navigation', event => {
    if (event.isMainFrame && !event.isSameDocument) void serial.disconnect();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.once('ready-to-show', () => { win.show(); win.focus(); });
  win.loadFile(entry);
});
app.on('before-quit', event => {
  if (!serial || quitReady) return;
  event.preventDefault();
  if (quitting) return;
  quitting = true;
  void serial.dispose()
    .catch(error => console.error('Unable to release serial connection:', error))
    .finally(() => {
      quitReady = true;
      app.quit();
    });
});
app.on('window-all-closed', () => app.quit());
