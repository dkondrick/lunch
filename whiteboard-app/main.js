const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  screen,
  desktopCapturer,
} = require('electron');
const fs   = require('fs').promises;
const path = require('path');

let mainWindow;
const isLinux = process.platform === 'linux';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    // Linux requires transparent set at creation time
    transparent: isLinux,
    frame: true,
    alwaysOnTop: false,
    backgroundColor: isLinux ? '#00000000' : '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── Overlay ──────────────────────────────────────────────────────────────────

ipcMain.handle('toggle-overlay', (event, enable) => {
  if (enable) {
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setIgnoreMouseEvents(false);
    if (!isLinux) mainWindow.setBackgroundColor('#00000000');
  } else {
    mainWindow.setAlwaysOnTop(false);
    if (!isLinux) mainWindow.setBackgroundColor('#ffffff');
  }
  return { ok: true };
});

ipcMain.handle('set-click-through', (event, enable) => {
  mainWindow.setIgnoreMouseEvents(enable, { forward: true });
  return { ok: true };
});

// ── Screenshot ────────────────────────────────────────────────────────────────

ipcMain.handle('screenshot', async () => {
  mainWindow.hide();
  await new Promise(r => setTimeout(r, 200));

  const primaryDisplay = screen.getPrimaryDisplay();
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: primaryDisplay.size,
  });

  mainWindow.show();

  if (!sources.length) return null;
  return sources[0].thumbnail.toDataURL();
});

// ── Import Image ──────────────────────────────────────────────────────────────

ipcMain.handle('import-image', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Image',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return null;

  const buf  = await fs.readFile(filePaths[0]);
  const ext  = path.extname(filePaths[0]).slice(1).toLowerCase();
  const mime = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  return `data:${mime};base64,${buf.toString('base64')}`;
});

// ── Exports ───────────────────────────────────────────────────────────────────

ipcMain.handle('export-png', async (event, dataURL) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save as PNG',
    defaultPath: 'whiteboard.png',
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  });
  if (canceled || !filePath) return { ok: false };
  const base64 = dataURL.replace(/^data:image\/png;base64,/, '');
  await fs.writeFile(filePath, Buffer.from(base64, 'base64'));
  return { ok: true, filePath };
});

ipcMain.handle('export-svg', async (event, svgString) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save as SVG',
    defaultPath: 'whiteboard.svg',
    filters: [{ name: 'SVG Image', extensions: ['svg'] }],
  });
  if (canceled || !filePath) return { ok: false };
  await fs.writeFile(filePath, svgString, 'utf8');
  return { ok: true, filePath };
});

ipcMain.handle('export-pdf', async (event, dataURI) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save as PDF',
    defaultPath: 'whiteboard.pdf',
    filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return { ok: false };
  const base64 = dataURI.replace(/^data:application\/pdf;base64,/, '');
  await fs.writeFile(filePath, Buffer.from(base64, 'base64'));
  return { ok: true, filePath };
});

ipcMain.handle('export-json', async (event, jsonString) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Whiteboard',
    defaultPath: 'whiteboard.json',
    filters: [{ name: 'Whiteboard JSON', extensions: ['json'] }],
  });
  if (canceled || !filePath) return { ok: false };
  await fs.writeFile(filePath, jsonString, 'utf8');
  return { ok: true, filePath };
});

ipcMain.handle('import-json', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Whiteboard',
    filters: [{ name: 'Whiteboard JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return null;
  return fs.readFile(filePaths[0], 'utf8');
});
