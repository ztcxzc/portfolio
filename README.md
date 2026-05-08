<h1 align="center">
  <img src="https://img.shields.io/badge/platform-macOS-black?style=flat-square&logo=apple" />
  <img src="https://img.shields.io/badge/built%20with-Electron-47848F?style=flat-square&logo=electron" />
  <img src="https://img.shields.io/badge/UI-React%2018-61DAFB?style=flat-square&logo=react" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" />
  <br/><br/>
  ADB Device Monitor
</h1>

<p align="center">
  A polished macOS desktop app for managing, monitoring, and mirroring Android devices over ADB — no Android Studio required.
</p>

<p align="center">
  Built with <strong>Electron + React</strong>, it gives you a real-time window into everything happening on your Android device: live system metrics, a full filesystem browser, screen mirroring, and direct device control — all from a single native app.
</p>

---

## What It Does

### Live Status Dashboard — 27 real-time metrics, auto-refreshing every 3 s

| Section | Metrics |
|---|---|
| **Battery** | Level (bar), charging status, voltage, temperature, health, charge type (USB / AC / Wireless) |
| **System** | RAM usage (bar), Storage usage (bar), CPU load average (1m/5m/15m), CPU architecture, current CPU frequency, CPU thermal temperature, kernel version |
| **Connectivity** | WiFi SSID, IP address, RSSI signal strength (dBm + quality label), link speed (Mbps), frequency band (2.4/5 GHz), total RX/TX bytes, Bluetooth on/off, Mobile data on/off, Airplane mode, GPS mode |
| **Display** | Brightness (bar), screen on/off, pixel density (DPI), sleep timeout, auto-rotate |
| **Settings** | Do Not Disturb mode, Ringer mode (Silent/Vibrate/Normal), language/locale, timezone, USB connection state |
| **Activity** | Uptime, foreground app package name |

### File Browser — Full Android Filesystem

- Browse the **entire Android filesystem** starting from `/`, including hidden system directories
- Navigate with **clickable breadcrumb path bar**
- All file types shown — regular files, directories, symlinks, device nodes, sockets, pipes
- Columns: name, size, permissions (`-rwxr-xr-x`), owner, modified date
- Directories listed first, files sorted alphabetically
- Smart file-type icons (images, video, audio, APK, archive, etc.)
- **↓ Pull** any file directly to your Mac via a native save dialog
- Permission-denied paths (e.g. `/data/data` without root) show a clear 🔒 error

### Screen Mirroring

- **Live stream** via Python bridge → screenrecord H.264 → ffmpeg → MJPEG frames at ~2 fps, displayed on a canvas
- **Click to tap** — click anywhere on the mirrored screen to send a real tap to the device (coordinates auto-mapped to device resolution)
- **🚀 scrcpy launch** — one-click launch of a full-speed interactive scrcpy window (requires `brew install scrcpy`)

### Device Controls

- **Navigation bar**: Back, Home, Recents, Power, Volume Up/Down, Mute
- **Text input**: Type and send any text string directly to the focused app on the device
- **Keyboard passthrough** while the canvas is focused

### Device Management

- Auto-detects all connected USB + wireless ADB devices, refreshes every 3 s
- Displays model, manufacturer, Android version, SDK, resolution, serial
- **Wireless ADB**: connect to IP:port without a cable
- **Push files** to any path on the device via native file picker

---

## Screenshots

> *Select a device from the left panel — the center panel shows the live status dashboard, screen mirror, and file browser in tabs.*

---

## Requirements

| Dependency | Version | Notes |
|---|---|---|
| macOS | 12+ | Primary platform |
| Node.js | 18+ | Build and run |
| ADB | any | Via Android Studio or Homebrew |
| ffmpeg | any | `/usr/local/bin/ffmpeg` for live streaming |
| scrcpy | any | Optional — for full-speed interactive mirror |
| Python 3 | 3.8+ | Used by the MJPEG bridge for streaming |

**Install ADB (macOS):**
```bash
brew install android-platform-tools
```

**Install ffmpeg:**
```bash
brew install ffmpeg
```

**Install scrcpy (optional):**
```bash
brew install scrcpy
```

**Enable USB Debugging on your device:**  
Settings → Developer Options → USB Debugging → ON

---

## Getting Started

```bash
# 1. Clone the repo
git clone https://github.com/ztcxzc/adb-device-monitor.git
cd adb-device-monitor

# 2. Install dependencies
npm install

# 3. Build and launch
npm start
```

**Development mode** (auto-reloads on file changes):
```bash
npm run dev
```

**Build a distributable .dmg:**
```bash
npm run dist
```

---

## Project Structure

```
adb device monitor/
├── electron/
│   ├── main.js                ← Main process — IPC handlers, file parser
│   ├── preload.js             ← contextBridge API exposed to renderer
│   └── adb/
│       ├── adbManager.js      ← Device listing, tap/key/text, push/pull, wireless
│       ├── deviceStatus.js    ← 27-metric live status collector (27 parallel ADB queries)
│       ├── scrcpyManager.js   ← Screen streaming + scrcpy launcher
│       └── mjpeg_bridge.py    ← Python bridge: ADB H.264 → ffmpeg → MJPEG frames
├── src/
│   ├── index.jsx              ← React entry point
│   ├── App.jsx                ← Root state, polling, IPC wiring
│   ├── components/
│   │   ├── TopBar.jsx         ← Connection status, wireless connect
│   │   ├── DeviceList.jsx     ← Left panel — device list + wireless form
│   │   └── ScreenMirror.jsx   ← Center panel — status/mirror/files/logs tabs
│   └── styles/
│       └── main.css           ← Full dark-mode UI
├── public/
│   └── index.html
├── package.json
├── webpack.config.js
└── .babelrc
```

---

## How the Streaming Works

Live screen mirroring uses a Python bridge (`mjpeg_bridge.py`) to work around a Node.js limitation with OS-level file-descriptor piping:

1. Python spawns `adb exec-out screenrecord --output-format=h264` 
2. Python spawns `ffmpeg` with `stdin=adb.stdout` (true OS-level pipe)
3. ffmpeg decodes H.264 → emits MJPEG frames on stdout
4. Python reads frames and writes them to Node.js via its own stdout
5. Node.js splits the MJPEG stream by boundary markers and emits frames to the Electron renderer via IPC

---

## Tech Stack

- **Electron 28** — desktop shell, IPC, native dialogs
- **React 18** — UI
- **webpack 5 + Babel** — bundler
- **ADB** — all device communication
- **ffmpeg** — H.264 → MJPEG transcoding for live stream
- **Python 3** — streaming bridge (stdlib only, no pip packages needed)
- **electron-builder** — packages to `.dmg`

---

## License

MIT — free to use, modify, and distribute.


---

## Features

| Feature | Details |
|---|---|
| Device detection | Auto-refreshes every 3 s via `adb devices -l` |
| Live status | Battery %, temperature, charging type, screen state, uptime |
| Screen mirror | Screenshot-based monitor (~1 fps) + launch full **scrcpy** window |
| Device control | Tap, key events, text input forwarded via ADB |
| File transfer | Push / pull files via native file dialogs |
| Wireless ADB | Connect to IP:port directly from the UI |

---

## Requirements

- **macOS 12+** (also runs on Linux / Windows with minor path adjustments)
- **Node.js 18+** and **npm**
- **ADB** — install via Android Studio's platform-tools, or:

```bash
# macOS (Homebrew)
brew install android-platform-tools
```

- **scrcpy** (optional, for full interactive mirroring):

```bash
brew install scrcpy
```

- An Android device with **USB Debugging** enabled  
  *(Settings → Developer Options → USB Debugging)*

---

## Installation

```bash
cd "adb device monitor"

npm install
```

---

## Running

### Production build + launch

```bash
npm start
```

### Development (hot-reload webpack + Electron)

```bash
npm run dev
```

The renderer rebuilds on every file change. Electron launches once `public/dist/bundle.js` exists.

---

## Project Structure

```
adb device monitor/
├── electron/
│   ├── main.js            ← Electron main process, IPC handlers
│   ├── preload.js         ← contextBridge API exposed to renderer
│   └── adb/
│       ├── adbManager.js  ← Device list, tap/key/text, file transfer, wireless
│       ├── deviceStatus.js← Battery, temperature, screen state, uptime
│       └── scrcpyManager.js← PNG screenshots + scrcpy subprocess
├── src/
│   ├── index.jsx          ← React entry point
│   ├── App.jsx            ← Root component, state & polling
│   ├── components/
│   │   ├── TopBar.jsx
│   │   ├── DeviceList.jsx
│   │   ├── ScreenMirror.jsx
│   │   └── StatusPanel.jsx
│   └── styles/
│       └── main.css
├── public/
│   └── index.html         ← Electron loads this
├── package.json
├── webpack.config.js
└── .babelrc
```

---

## Screen Mirroring

Two modes are available:

### Mode 1 — Screenshot Monitor (built-in, ~1 fps)

Click **▶ Monitor** in the center panel.  
The app captures frames via `adb exec-out screencap -p` and renders them on a canvas.  
Click anywhere on the canvas to send a tap to the device.

### Mode 2 — scrcpy (recommended, full framerate)

Click **🚀 scrcpy** to open a full interactive scrcpy window.  
Requires `scrcpy` installed (`brew install scrcpy`).  
If scrcpy is not found the app shows a helpful error message instead of crashing.

---

## Controls

| Action | How |
|---|---|
| Tap on device | Click on the canvas while monitoring |
| Back / Home / Recents | Quick-key buttons below the canvas |
| Power / Volume | Quick-key buttons below the canvas |
| Text input | Type in the text field → Send |
| Keyboard events | Focus the center panel and press arrow keys, Backspace, Enter, Esc |

---

## Building a distributable

```bash
npm run dist
```

Produces a `.dmg` on macOS (configured in `package.json` under `"build"`).

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `adb not found` | Install platform-tools and add to `PATH`, or install via Homebrew |
| Device shows "unauthorized" | Tap **Allow** on the USB debugging prompt on your phone |
| Screenshots are blank | Ensure USB debugging is active and the device is unlocked |
| scrcpy window doesn't open | Run `brew install scrcpy` or check that `scrcpy` is in `PATH` |
| Wireless connect fails | Run `adb tcpip 5555` on the device first (via USB), then disconnect and connect wirelessly |
