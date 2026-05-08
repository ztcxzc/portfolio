const { spawn, execFile } = require('child_process');
const { promisify } = require('util');
const os = require('os');

const execFileAsync = promisify(execFile);

const SCRCPY_CANDIDATES = [
  'scrcpy',
  '/usr/local/bin/scrcpy',
  '/opt/homebrew/bin/scrcpy',
];

const FFMPEG_CANDIDATES = [
  'ffmpeg',
  '/usr/local/bin/ffmpeg',
  '/opt/homebrew/bin/ffmpeg',
];

let _scrcpyPath = null;

async function resolveScrcpy() {
  if (_scrcpyPath) return _scrcpyPath;
  for (const candidate of SCRCPY_CANDIDATES) {
    try {
      await execFileAsync(candidate, ['--version'], { timeout: 3000 });
      _scrcpyPath = candidate;
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

let _adbPath = null;

async function resolveAdb() {
  if (_adbPath) return _adbPath;
  const candidates = [
    'adb',
    '/usr/local/bin/adb',
    '/opt/homebrew/bin/adb',
    `${os.homedir()}/Library/Android/sdk/platform-tools/adb`,
  ];
  for (const candidate of candidates) {
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

let _ffmpegResolved = false;
let _ffmpegPath = null;

async function resolveFFmpeg() {
  if (_ffmpegResolved) return _ffmpegPath;
  // Try system ffmpeg first
  for (const candidate of FFMPEG_CANDIDATES) {
    try {
      await execFileAsync(candidate, ['-version'], { timeout: 3000 });
      _ffmpegPath = candidate;
      break;
    } catch {
      continue;
    }
  }
  // Fall back to bundled ffmpeg-static binary
  if (!_ffmpegPath) {
    try {
      let bundled = require('ffmpeg-static');
      // In a packaged Electron app the binary lives in app.asar.unpacked
      bundled = bundled.replace('app.asar' + require('path').sep, 'app.asar.unpacked' + require('path').sep);
      await execFileAsync(bundled, ['-version'], { timeout: 3000 });
      _ffmpegPath = bundled;
    } catch {}
  }
  _ffmpegResolved = true;
  return _ffmpegPath;
}

class ScrcpyManager {
  constructor() {
    this._processes = new Map(); // deviceId → scrcpy window process
    this._streams   = new Map(); // deviceId → stream state
  }

  // ─── Single PNG screenshot (fallback / on-demand) ─────────────────────────

  getScreenshot(deviceId) {
    return new Promise(async (resolve) => {
      const adb = await resolveAdb();
      if (!adb) {
        resolve({ success: false, error: 'adb not found' });
        return;
      }

      const chunks = [];
      let done = false;

      const finish = (result) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(result);
      };

      const proc = spawn(adb, ['-s', deviceId, 'exec-out', 'screencap', '-p'], {
        stdio: ['ignore', 'pipe', 'ignore'],
      });

      proc.stdout.on('data', (chunk) => chunks.push(chunk));
      proc.on('error', (err) => finish({ success: false, error: err.message }));
      proc.on('close', () => {
        const buf = Buffer.concat(chunks);
        if (buf.length < 8 || buf[0] !== 0x89 || buf[1] !== 0x50) {
          finish({ success: false, error: 'Invalid PNG response' });
          return;
        }
        finish({ success: true, data: `data:image/png;base64,${buf.toString('base64')}` });
      });

      const timer = setTimeout(() => {
        proc.kill();
        finish({ success: false, error: 'Screenshot timed out' });
      }, 8000);
    });
  }

  // ─── Live stream ──────────────────────────────────────────────────────────

  async startStream(deviceId, onFrame) {
    this.stopStream(deviceId); // stop any existing stream first

    const adb = await resolveAdb();
    if (!adb) return { success: false, mode: null, error: 'adb not found' };

    const ffmpeg = await resolveFFmpeg();
    if (ffmpeg) {
      return this._startFfmpegStream(deviceId, adb, ffmpeg, onFrame);
    }
    return this._startScreencapStream(deviceId, adb, onFrame);
  }

  /**
   * High-performance path: Python bridge (mjpeg_bridge.py) manages the
   * adb → ffmpeg OS-level pipe and emits MJPEG frames on stdout.
   *
   * Why Python: ffmpeg's AVIO output buffer only flushes when ~512KB accumulates
   * OR when it exits cleanly. With a live screenrecord stream it never exits,
   * so every Node.js pipe approach stalls for ~25s. Python's subprocess.Popen
   * with stdin=adb.stdout creates a true OS-level pipe (same as shell), and
   * read1() issues one raw os.read() per call — no buffering, frames arrive
   * as soon as ffmpeg decodes them.
   */
  _startFfmpegStream(deviceId, adb, ffmpeg, onFrame) {
    const path = require('path');
    const state = { active: true, proc: null };

    const bridgePath = path.join(__dirname, 'mjpeg_bridge.py');

    const proc = spawn('python3', [bridgePath, adb, ffmpeg, deviceId], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    // Parse concatenated JPEG frames (FF D8 … FF D9) from bridge stdout
    let buf = Buffer.alloc(0);
    proc.stdout.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);

      while (buf.length > 3) {
        // Find SOI (FF D8)
        let soi = -1;
        for (let i = 0; i < buf.length - 1; i++) {
          if (buf[i] === 0xFF && buf[i + 1] === 0xD8) { soi = i; break; }
        }
        if (soi === -1) { buf = Buffer.alloc(0); break; }
        if (soi > 0) buf = buf.slice(soi);

        // Find EOI (FF D9)
        let eoi = -1;
        for (let i = 2; i < buf.length - 1; i++) {
          if (buf[i] === 0xFF && buf[i + 1] === 0xD9) { eoi = i + 2; break; }
        }
        if (eoi === -1) break; // incomplete frame — wait for more data

        const frame = buf.slice(0, eoi);
        buf = buf.slice(eoi);
        if (state.active) onFrame(`data:image/jpeg;base64,${frame.toString('base64')}`);
      }

      // Safety valve
      if (buf.length > 8 * 1024 * 1024) buf = Buffer.alloc(0);
    });

    proc.on('error', () => {});
    proc.on('close', () => {});

    state.proc = proc;
    this._streams.set(deviceId, state);
    return { success: true, mode: 'ffmpeg' };
  }

  /**
   * Fallback: continuous screencap loop with no fixed delay.
   * Limited by screencap speed (~3–5 fps on most devices).
   */
  _startScreencapStream(deviceId, adb, onFrame) {
    const state = { active: true };

    const loop = async () => {
      if (!state.active) return;
      const result = await this.getScreenshot(deviceId);
      if (!state.active) return;
      if (result.success) onFrame(result.data);
      setImmediate(loop);
    };

    loop();
    this._streams.set(deviceId, state);
    return { success: true, mode: 'screencap' };
  }

  stopStream(deviceId) {
    const state = this._streams.get(deviceId);
    if (!state) return;
    state.active = false;
    try { state.proc?.kill(); } catch {}
    try { state.rec?.kill(); } catch {}
    try { state.dec?.kill(); } catch {}
    this._streams.delete(deviceId);
  }

  // ─── scrcpy (full interactive mirror in its own window) ──────────────────

  async startScrcpy(deviceId) {
    if (this._processes.has(deviceId)) {
      return { success: false, message: 'scrcpy is already running for this device' };
    }

    const scrcpy = await resolveScrcpy();
    if (!scrcpy) {
      return {
        success: false,
        message: 'scrcpy not found.\nInstall it with: brew install scrcpy',
      };
    }

    const args = [
      '-s', deviceId,
      '--max-size', '1600',
      '--video-bit-rate', '6M',
      '--max-fps', '60',
      '--video-codec=h264',
      '--no-audio',
      '--video-buffer=0',
      '--render-driver=metal',
    ];

    const proc = spawn(scrcpy, args, { detached: false, stdio: 'ignore' });

    proc.on('error', () => this._processes.delete(deviceId));
    proc.on('close', () => this._processes.delete(deviceId));

    this._processes.set(deviceId, proc);
    return { success: true, message: 'scrcpy launched', pid: proc.pid };
  }

  stopScrcpy(deviceId) {
    const proc = this._processes.get(deviceId);
    if (proc) {
      proc.kill();
      this._processes.delete(deviceId);
      return { success: true };
    }
    return { success: false, message: 'No active scrcpy session' };
  }

  stopAll() {
    for (const id of [...this._streams.keys()]) this.stopStream(id);
    for (const proc of this._processes.values()) {
      try { proc.kill(); } catch {}
    }
    this._processes.clear();
  }

  isRunning(deviceId) {
    return this._processes.has(deviceId);
  }
}

module.exports = { ScrcpyManager };
