// Main process: window, fullscreen, Widevine DRM (castLabs Electron), permissions.
const { app, BrowserWindow, ipcMain, session, shell, powerSaveBlocker } = require('electron');
const path = require('path');

// `components` only exists in the castLabs "wvcus" Electron build (Widevine CDM).
let components = null;
try { ({ components } = require('electron')); } catch (_) {}

// Streaming sites sniff the UA; present as plain desktop Chrome.
const chromeUA = () =>
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('enable-features', 'OverlayScrollbar');

let win;

function toggleFullscreen(force) {
  if (!win) return;
  const next = typeof force === 'boolean' ? force : !win.isFullScreen();
  win.setFullScreen(next);
  win.setMenuBarVisibility(false);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: '#000000',
    show: false,
    title: 'Tesla Screen Sim',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      webviewTag: true,
      sandbox: false,
    },
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  if (process.argv.includes('--fullscreen')) win.once('ready-to-show', () => win.setFullScreen(true));
  win.once('ready-to-show', () => win.show());
  win.on('enter-full-screen', () => win.webContents.send('fullscreen-changed', true));
  win.on('leave-full-screen', () => win.webContents.send('fullscreen-changed', false));
}

function configureSession(ses) {
  ses.setUserAgent(chromeUA());
  ses.setPermissionRequestHandler((_wc, permission, cb) => {
    // camera (backup-camera view), mic, fullscreen, DRM key access, notifications, location
    cb(['media', 'fullscreen', 'notifications', 'geolocation', 'clipboard-read',
        'clipboard-sanitized-write', 'pointerLock', 'mediaKeySystem', 'protected-media-identifier']
      .includes(permission));
  });
}

app.userAgentFallback = chromeUA();

app.on('web-contents-created', (_e, wc) => {
  // F11 / Esc must work even when a streaming <webview> has focus.
  wc.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { event.preventDefault(); toggleFullscreen(); }
  });
  if (wc.getType() === 'webview') {
    // Keep popups (Netflix/Disney+ login, OAuth) inside the same webview.
    wc.setWindowOpenHandler(({ url }) => { wc.loadURL(url); return { action: 'deny' }; });
  }
});

ipcMain.handle('fullscreen:toggle', (_e, force) => { toggleFullscreen(force); return win.isFullScreen(); });
ipcMain.handle('fullscreen:get', () => (win ? win.isFullScreen() : false));
ipcMain.handle('app:quit', () => app.quit());
ipcMain.handle('app:drm', () => ({ widevine: !!components, chrome: process.versions.chrome, electron: process.versions.electron }));
ipcMain.handle('app:openExternal', (_e, url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); });

app.whenReady().then(async () => {
  if (components) {
    try { await components.whenReady(); console.log('Widevine ready:', components.status()); }
    catch (err) { console.error('Widevine failed to initialise', err); }
  }
  // A desk display must not dim or sleep while it is running.
  powerSaveBlocker.start('prevent-display-sleep');
  configureSession(session.defaultSession);
  configureSession(session.fromPartition('persist:streaming'));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
