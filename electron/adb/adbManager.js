const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const os = require('os');

const execFileAsync = promisify(execFile);

// Candidate ADB binary locations (searched in order)
const ADB_CANDIDATES = [
  'adb',
  '/usr/local/bin/adb',
  '/opt/homebrew/bin/adb',
  '/usr/bin/adb',
  `${os.homedir()}/Library/Android/sdk/platform-tools/adb`,
  `${os.homedir()}/Android/Sdk/platform-tools/adb`,
];

let _adbPath = null;

async function resolveAdb() {
  if (_adbPath) return _adbPath;
  for (const candidate of ADB_CANDIDATES) {
    try {
      await execFileAsync(candidate, ['version'], { timeout: 3000 });
      _adbPath = candidate;
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

class AdbManager {
  async adbPath() {
    return resolveAdb();
  }

  async exec(args, options = {}) {
    const adb = await this.adbPath();
    if (!adb) return { success: false, error: 'adb not found. Install platform-tools and ensure adb is in PATH.' };
    try {
      const { stdout, stderr } = await execFileAsync(adb, args, {
        timeout: 12000,
        maxBuffer: 4 * 1024 * 1024,
        ...options,
      });
      return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
    } catch (err) {
      return { success: false, error: err.message, stdout: '', stderr: '' };
    }
  }

  async execDevice(deviceId, shellArgs) {
    return this.exec(['-s', deviceId, ...shellArgs]);
  }

  // ─── Device Listing ───────────────────────────────────────────────────────

  async getDevices() {
    const result = await this.exec(['devices', '-l']);
    if (!result.success) return [{ id: '__error__', state: 'error', model: result.error }];

    const lines = result.stdout.split('\n').slice(1);
    const devices = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('*')) continue;

      const parts = trimmed.split(/\s+/);
      const id = parts[0];
      const state = parts[1];
      if (!id || !state) continue;

      const attrs = {};
      for (let i = 2; i < parts.length; i++) {
        const colon = parts[i].indexOf(':');
        if (colon !== -1) {
          const key = parts[i].slice(0, colon);
          const value = parts[i].slice(colon + 1).replace(/_/g, ' ');
          attrs[key] = value;
        }
      }

      devices.push({
        id,
        state,
        model: attrs.model || 'Unknown Device',
        product: attrs.product || '',
        transportId: attrs.transport_id || '',
      });
    }

    return devices;
  }

  // ─── Device Info ──────────────────────────────────────────────────────────

  async getDeviceInfo(deviceId) {
    const [model, manufacturer, androidVer, sdkVer, resolution, serial] = await Promise.all([
      this.execDevice(deviceId, ['shell', 'getprop', 'ro.product.model']),
      this.execDevice(deviceId, ['shell', 'getprop', 'ro.product.manufacturer']),
      this.execDevice(deviceId, ['shell', 'getprop', 'ro.build.version.release']),
      this.execDevice(deviceId, ['shell', 'getprop', 'ro.build.version.sdk']),
      this.execDevice(deviceId, ['shell', 'wm', 'size']),
      this.execDevice(deviceId, ['shell', 'getprop', 'ro.serialno']),
    ]);

    const resMatch = (resolution.stdout || '').match(/(\d+x\d+)/);

    return {
      model: model.stdout || 'Unknown',
      manufacturer: manufacturer.stdout || 'Unknown',
      androidVersion: androidVer.stdout || 'Unknown',
      sdkVersion: sdkVer.stdout || 'Unknown',
      resolution: resMatch ? resMatch[1] : 'Unknown',
      serial: serial.stdout || deviceId,
    };
  }

  // ─── Input ────────────────────────────────────────────────────────────────

  async sendTap(deviceId, x, y) {
    return this.execDevice(deviceId, ['shell', 'input', 'tap', String(x), String(y)]);
  }

  async sendKey(deviceId, keycode) {
    return this.execDevice(deviceId, ['shell', 'input', 'keyevent', String(keycode)]);
  }

  async sendText(deviceId, text) {
    // Wrap in quotes and escape shell metacharacters
    const safe = text.replace(/[\\$`"]/g, (c) => `\\${c}`);
    return this.execDevice(deviceId, ['shell', `input text "${safe}"`]);
  }

  // ─── Server ───────────────────────────────────────────────────────────────

  async restartServer() {
    await this.exec(['kill-server']);
    await new Promise((r) => setTimeout(r, 1200));
    return this.exec(['start-server']);
  }

  // ─── File Transfer ────────────────────────────────────────────────────────

  async pushFile(deviceId, localPath, remotePath) {
    return this.exec(['-s', deviceId, 'push', localPath, remotePath], { timeout: 120000 });
  }

  async pullFile(deviceId, remotePath, localPath) {
    return this.exec(['-s', deviceId, 'pull', remotePath, localPath], { timeout: 120000 });
  }

  // ─── Wireless ─────────────────────────────────────────────────────────────

  async connectWireless(host, port = '5555') {
    return this.exec(['connect', `${host}:${port}`]);
  }
}

module.exports = { AdbManager };
