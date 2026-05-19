const fs = require('fs');
const path = require('path');
const { app, ipcMain, dialog } = require('electron');

// In dev mode write directly into the source tree so webpack hot-reloads the website.
// In packaged mode store in userData and allow exporting to any location.
function resolveDataPath() {
  if (app.isPackaged) {
    const dest = path.join(app.getPath('userData'), 'projects.json');
    if (!fs.existsSync(dest)) {
      const seed = path.join(process.resourcesPath, 'projects.json');
      if (fs.existsSync(seed)) fs.copyFileSync(seed, dest);
    }
    return dest;
  }
  return path.join(__dirname, '../src/data/projects.json');
}

let DATA_PATH;

function readProjects() {
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function writeProjects(projects) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(projects, null, 2) + '\n', 'utf8');
}

function register() {
  DATA_PATH = resolveDataPath();

  ipcMain.handle('portfolio:getProjects', () => readProjects());

  ipcMain.handle('portfolio:saveProject', (_event, project) => {
    const projects = readProjects();
    const idx = projects.findIndex((p) => p.id === project.id);
    if (idx >= 0) {
      projects[idx] = project;
    } else {
      projects.push(project);
    }
    writeProjects(projects);
    return { success: true };
  });

  ipcMain.handle('portfolio:deleteProject', (_event, id) => {
    const updated = readProjects().filter((p) => p.id !== id);
    writeProjects(updated);
    return { success: true };
  });

  ipcMain.handle('portfolio:getDataPath', () => DATA_PATH);

  ipcMain.handle('portfolio:exportProjects', async (event) => {
    const win = require('electron').BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Export projects.json',
      defaultPath: 'projects.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { success: false };
    fs.writeFileSync(filePath, JSON.stringify(readProjects(), null, 2) + '\n', 'utf8');
    return { success: true, filePath };
  });
}

module.exports = { register };
