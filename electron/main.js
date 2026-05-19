const { app, BrowserWindow } = require('electron');
const path = require('path');
const portfolioStore = require('./portfolioStore');

// Register all portfolio IPC handlers before any window opens
portfolioStore.register();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 860,
    minHeight: 560,
    backgroundColor: '#080D18',
    titleBarStyle: 'hiddenInset',
    title: 'Portfolio Manager',
    webPreferences: {
      preload: path.join(__dirname, 'manager-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../public/manager.html'));

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
  if (process.platform !== 'darwin') app.quit();
});
