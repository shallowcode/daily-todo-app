/* ================================================================
 * 每日待办 · 主进程 (Electron Main)
 * 职责：窗口创建 / 系统托盘 / 自启动 / 数据持久化 / IPC
 * ================================================================ */

const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = process.argv.includes('--dev');

/* ---------- 单实例锁 ---------- */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); process.exit(0); }

let mainWindow = null;
let tray = null;

/* ---------- 数据存储（简单 JSON 文件，避免外部依赖） ---------- */
const dataFile = path.join(app.getPath('userData'), 'data.json');
const DEFAULT_DATA = {
  tasks: {},                     // { 'YYYY-MM-DD': [{id, text, done, createdAt}] }
  settings: {
    alwaysOnTop: true,
    autoLaunch: false,
    themeMode: 'auto',           // 'auto' | 'light' | 'dark'
    dayStart: '06:00',
    nightStart: '19:00',
    windowX: null,
    windowY: null
  }
};

function readData() {
  try {
    if (!fs.existsSync(dataFile)) return structuredClone(DEFAULT_DATA);
    const raw = fs.readFileSync(dataFile, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      tasks: parsed.tasks || {},
      settings: { ...DEFAULT_DATA.settings, ...(parsed.settings || {}) }
    };
  } catch (e) {
    console.error('readData failed:', e);
    return structuredClone(DEFAULT_DATA);
  }
}

function writeData(data) {
  try {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('writeData failed:', e);
    return false;
  }
}

let cache = readData();

/* ---------- 窗口创建 ---------- */
function createWindow() {
  const { windowX, windowY, alwaysOnTop } = cache.settings;

  mainWindow = new BrowserWindow({
    width: 380,
    height: 600,
    minWidth: 340,
    minHeight: 480,
    x: windowX ?? undefined,
    y: windowY ?? undefined,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: false,
    alwaysOnTop: !!alwaysOnTop,
    show: false,
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (alwaysOnTop) {
    // 'screen-saver' 级别确保压制大多数窗口（含浏览器）
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  }

  mainWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('move', () => {
    if (!mainWindow) return;
    const [x, y] = mainWindow.getPosition();
    cache.settings.windowX = x;
    cache.settings.windowY = y;
    writeData(cache);
  });

  // 关闭按钮 → 隐藏到托盘，而非真正退出
  mainWindow.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // 外链使用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

/* ---------- 系统托盘 ---------- */
function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.ico');
  const fallback = path.join(__dirname, '..', 'assets', 'icon.png');
  let icon;
  try {
    icon = nativeImage.createFromPath(fs.existsSync(iconPath) ? iconPath : fallback);
    if (icon.isEmpty()) icon = nativeImage.createEmpty();
  } catch { icon = nativeImage.createEmpty(); }

  tray = new Tray(icon);
  tray.setToolTip('每日待办');

  const buildMenu = () => Menu.buildFromTemplate([
    { label: '显示窗口', click: showWindow },
    { type: 'separator' },
    {
      label: '始终置顶',
      type: 'checkbox',
      checked: cache.settings.alwaysOnTop,
      click: (item) => {
        cache.settings.alwaysOnTop = item.checked;
        writeData(cache);
        if (mainWindow) mainWindow.setAlwaysOnTop(item.checked, 'screen-saver');
        mainWindow?.webContents.send('settings:changed', cache.settings);
      }
    },
    {
      label: '开机自启',
      type: 'checkbox',
      checked: cache.settings.autoLaunch,
      click: (item) => setAutoLaunch(item.checked)
    },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuiting = true; app.quit(); } }
  ]);

  tray.setContextMenu(buildMenu());
  tray.on('click', showWindow);
  tray.on('double-click', showWindow);

  // 设置变化时刷新菜单
  ipcMain.on('settings:refresh-tray', () => tray.setContextMenu(buildMenu()));
}

function showWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

/* ---------- 自启动 ---------- */
function setAutoLaunch(enabled) {
  cache.settings.autoLaunch = enabled;
  writeData(cache);
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
    args: ['--hidden']
  });
  mainWindow?.webContents.send('settings:changed', cache.settings);
}

/* ---------- IPC 接口 ---------- */
ipcMain.handle('store:getAll', () => cache);

ipcMain.handle('store:setTasks', (_e, tasks) => {
  cache.tasks = tasks || {};
  return writeData(cache);
});

ipcMain.handle('store:setSettings', (_e, settings) => {
  cache.settings = { ...cache.settings, ...settings };
  writeData(cache);

  if (mainWindow) {
    mainWindow.setAlwaysOnTop(!!cache.settings.alwaysOnTop, 'screen-saver');
  }
  return cache.settings;
});

ipcMain.handle('app:setAutoLaunch', (_e, enabled) => {
  setAutoLaunch(!!enabled);
  return cache.settings.autoLaunch;
});

ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:hide',     () => mainWindow?.hide());
ipcMain.on('window:close',    () => { app.isQuiting = true; app.quit(); });

/* ---------- 应用生命周期 ---------- */
app.on('second-instance', showWindow);

app.whenReady().then(() => {
  createWindow();
  createTray();

  // 同步登录项实际状态（避免设置漂移）
  const loginSettings = app.getLoginItemSettings();
  if (loginSettings.openAtLogin !== cache.settings.autoLaunch) {
    cache.settings.autoLaunch = loginSettings.openAtLogin;
    writeData(cache);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else showWindow();
  });
});

app.on('window-all-closed', (e) => {
  // 阻止默认关闭，保留托盘
  if (process.platform !== 'darwin' && !app.isQuiting) e.preventDefault?.();
});

app.on('before-quit', () => { app.isQuiting = true; });
