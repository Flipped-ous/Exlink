const { app, BrowserWindow, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
let mainWindow;
app.whenReady().then(() => {
  const entry = path.join(__dirname, '..', 'dist', 'index.html');
  if (!fs.existsSync(entry)) {
    dialog.showErrorBox('EXLINK Studio', '请先运行 pnpm build，再运行 pnpm desktop。');
    app.quit(); return;
  }
  const win = mainWindow = new BrowserWindow({ width: 1440, height: 900, minWidth: 960, minHeight: 640,
    title: 'EXLINK Studio', icon: path.join(__dirname, '..', 'public', 'brand', 'exlink-ribbon-dark-v3.png'), backgroundColor: '#0f0e17', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.once('ready-to-show', () => { win.show(); win.focus(); });
  win.loadFile(entry);
});
app.on('window-all-closed', () => app.quit());
