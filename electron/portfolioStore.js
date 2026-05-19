const fs = require('fs');
const path = require('path');
const https = require('https');
const { app, ipcMain, dialog, safeStorage } = require('electron');

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

/* ── GitHub token storage (encrypted via OS keychain) ── */
function tokenPath() {
  return path.join(app.getPath('userData'), 'gh-token.enc');
}

function readToken() {
  try {
    const buf = fs.readFileSync(tokenPath());
    return safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(buf)
      : buf.toString('utf8');
  } catch {
    return null;
  }
}

function writeToken(token) {
  const buf = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(token)
    : Buffer.from(token, 'utf8');
  fs.writeFileSync(tokenPath(), buf);
}

/* ── GitHub API helper ───────────────────────────────── */
function githubRequest(method, apiPath, token, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: 'api.github.com',
        path: apiPath,
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'Portfolio-Manager/1.0',
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, body: data }); }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}



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

  ipcMain.handle('portfolio:getToken', () => (readToken() ? '••••••••' : null));

  ipcMain.handle('portfolio:setToken', (_event, token) => {
    writeToken(token.trim());
    return { success: true };
  });

  ipcMain.handle('portfolio:publishToGitHub', async () => {
    const token = readToken();
    if (!token) return { success: false, error: 'No GitHub token. Open Settings and add one.' };

    const projects = readProjects();
    const fileContent = JSON.stringify(projects, null, 2) + '\n';
    const encoded = Buffer.from(fileContent).toString('base64');

    // 1. Get current SHA so GitHub lets us overwrite the file
    const getRes = await githubRequest(
      'GET',
      '/repos/ztcxzc/portfolio/contents/src/data/projects.json',
      token,
      null
    );
    if (getRes.status !== 200) {
      return { success: false, error: `GitHub GET failed (${getRes.status}): ${getRes.body.message || ''}` };
    }

    const sha = getRes.body.sha;

    // 2. Push updated file
    const putRes = await githubRequest(
      'PUT',
      '/repos/ztcxzc/portfolio/contents/src/data/projects.json',
      token,
      {
        message: `Update projects via Portfolio Manager (${new Date().toISOString().slice(0, 10)})`,
        content: encoded,
        sha,
      }
    );

    if (putRes.status === 200 || putRes.status === 201) {
      return { success: true };
    }
    return { success: false, error: `GitHub PUT failed (${putRes.status}): ${putRes.body.message || ''}` };
  });
}

module.exports = { register };
