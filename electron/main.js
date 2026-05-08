const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { AdbManager } = require('./adb/adbManager');
const { DeviceStatus } = require('./adb/deviceStatus');
const { ScrcpyManager } = require('./adb/scrcpyManager');

const adbManager = new AdbManager();
const deviceStatus = new DeviceStatus();
const scrcpyManager = new ScrcpyManager();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0d1117',
    titleBarStyle: 'hiddenInset',
    title: 'ADB Device Monitor',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../public/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  scrcpyManager.stopAll();
  if (process.platform !== 'darwin') app.quit();
});

// ─── IPC Handlers ────────────────────────────────────────────────────────────

ipcMain.handle('adb:getDevices', async () => {
  return await adbManager.getDevices();
});

ipcMain.handle('adb:getDeviceStatus', async (_event, deviceId) => {
  if (!isValidSerial(deviceId)) return { error: 'Invalid device ID' };
  return await deviceStatus.getFullStatus(deviceId);
});

ipcMain.handle('adb:getDeviceInfo', async (_event, deviceId) => {
  if (!isValidSerial(deviceId)) return { error: 'Invalid device ID' };
  return await adbManager.getDeviceInfo(deviceId);
});

ipcMain.handle('adb:getScreenshot', async (_event, deviceId) => {
  if (!isValidSerial(deviceId)) return { success: false, error: 'Invalid device ID' };
  return await scrcpyManager.getScreenshot(deviceId);
});

ipcMain.handle('adb:startStream', async (event, deviceId) => {
  if (!isValidSerial(deviceId)) return { success: false, error: 'Invalid device ID' };
  const sender = event.sender;
  const result = await scrcpyManager.startStream(deviceId, (frameData) => {
    if (!sender.isDestroyed()) sender.send('stream:frame', frameData);
  });
  return result;
});

ipcMain.handle('adb:stopStream', (_event, deviceId) => {
  if (!isValidSerial(deviceId)) return { success: false };
  scrcpyManager.stopStream(deviceId);
  return { success: true };
});

ipcMain.handle('adb:startScrcpy', async (_event, deviceId) => {
  if (!isValidSerial(deviceId)) return { success: false, message: 'Invalid device ID' };
  return await scrcpyManager.startScrcpy(deviceId);
});

ipcMain.handle('adb:stopScrcpy', async (_event, deviceId) => {
  if (!isValidSerial(deviceId)) return { success: false };
  return scrcpyManager.stopScrcpy(deviceId);
});

ipcMain.handle('adb:sendTap', async (_event, deviceId, x, y) => {
  if (!isValidSerial(deviceId)) return { success: false };
  const nx = Math.round(Number(x));
  const ny = Math.round(Number(y));
  if (!isFinite(nx) || !isFinite(ny)) return { success: false };
  return await adbManager.sendTap(deviceId, nx, ny);
});

ipcMain.handle('adb:sendKey', async (_event, deviceId, keycode) => {
  if (!isValidSerial(deviceId)) return { success: false };
  const code = Math.round(Number(keycode));
  if (!isFinite(code) || code < 0 || code > 999) return { success: false };
  return await adbManager.sendKey(deviceId, code);
});

ipcMain.handle('adb:sendText', async (_event, deviceId, text) => {
  if (!isValidSerial(deviceId)) return { success: false };
  if (typeof text !== 'string' || text.length > 500) return { success: false };
  return await adbManager.sendText(deviceId, text);
});

ipcMain.handle('adb:restartServer', async () => {
  return await adbManager.restartServer();
});

ipcMain.handle('adb:connectWireless', async (_event, host, port) => {
  // Validate IP/hostname
  if (typeof host !== 'string' || !/^[\w.\-]+$/.test(host)) return { success: false, error: 'Invalid host' };
  const p = parseInt(port, 10);
  if (!p || p < 1 || p > 65535) return { success: false, error: 'Invalid port' };
  return await adbManager.connectWireless(host, String(p));
});

ipcMain.handle('adb:pushFile', async (_event, deviceId, localPath, remotePath) => {
  if (!isValidSerial(deviceId)) return { success: false, error: 'Invalid device ID' };
  if (typeof remotePath !== 'string') return { success: false, error: 'Invalid path' };
  return await adbManager.pushFile(deviceId, localPath, remotePath);
});

ipcMain.handle('adb:pullFile', async (_event, deviceId, remotePath) => {
  if (!isValidSerial(deviceId)) return { success: false, error: 'Invalid device ID' };
  if (typeof remotePath !== 'string') return { success: false, error: 'Invalid path' };
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Pulled File',
    defaultPath: require('path').basename(remotePath),
  });
  if (result.canceled) return { success: false, message: 'Cancelled' };
  return await adbManager.pullFile(deviceId, remotePath, result.filePath);
});

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: 'Select File to Push',
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('adb:listFiles', async (_event, deviceId, remotePath) => {
  if (!isValidSerial(deviceId)) return { success: false, error: 'Invalid device ID' };
  if (typeof remotePath !== 'string' || !remotePath.startsWith('/') || remotePath.includes('..') || remotePath.length > 512)
    return { success: false, error: 'Invalid path' };
  const result = await adbManager.exec(['-s', deviceId, 'shell', 'ls', '-la', remotePath]);
  if (!result.success) return { success: false, error: result.error };
  const entries = parseFileList(result.stdout);
  if (entries.length === 0 && result.stdout.toLowerCase().includes('permission denied'))
    return { success: false, error: 'Permission denied — root access required for this path' };
  return { success: true, entries };
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse `adb shell ls -la` output into structured entry objects */
function parseFileList(output) {
  const entries = [];
  // Strip ANSI color codes (some devices output them)
  const clean = output.replace(/\x1B\[[0-9;]*m/g, '');
  for (const line of clean.split('\n')) {
    const trim = line.trim();
    if (!trim || trim.startsWith('total ')) continue;
    // Match: perms [links] owner group size date time name [-> symlink]
    const m = trim.match(
      /^([dlcbsp?-]\S{9,10})\s+(\d+\s+)?(\S+)\s+(\S+)\s+(\d+)\s+(\d{4}-\d{2}-\d{2})\s+([\d:]+)\s+(.+)$/
    );
    if (!m) continue;
    const [, rawPerms, , owner, group, size, date, time, nameFull] = m;
    const arrowIdx = nameFull.indexOf(' -> ');
    const name   = (arrowIdx >= 0 ? nameFull.slice(0, arrowIdx) : nameFull).trim();
    const symlink = arrowIdx >= 0 ? nameFull.slice(arrowIdx + 4).trim() : null;
    if (!name || name === '.' || name === '..') continue;
    const typeChar = rawPerms[0];
    const typeMap  = { d: 'dir', l: 'link', c: 'char', b: 'block', s: 'socket', p: 'pipe' };
    const type = typeMap[typeChar] || 'file';
    entries.push({
      name,
      type,
      perms: rawPerms.slice(0, 10),
      owner,
      group,
      size: parseInt(size, 10) || 0,
      date: `${date} ${time}`,
      symlink,
    });
  }
  return entries;
}

/** Validate ADB serial: alphanumeric, dash, colon, dot — covers USB serials, emulator-NNNN, and IP:port */
function isValidSerial(id) {
  return typeof id === 'string' && /^[\w.\-:]+$/.test(id) && id.length <= 64;
}
