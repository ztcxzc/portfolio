import { useRef, useEffect, useCallback, useState } from 'react';

function fmtBytes(bytes) {
  if (!bytes) return '—';
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB';
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(0) + ' MB';
  return (bytes / 1e3).toFixed(0) + ' KB';
}

// Android keycodes for common actions
const KEY_MAP = {
  Backspace:  67,
  Enter:      66,
  Escape:     111,
  ArrowLeft:  21,
  ArrowRight: 22,
  ArrowUp:    19,
  ArrowDown:  20,
  Delete:     67,
  Tab:        61,
};

const QUICK_KEYS = [
  { label: '◁',  title: 'Back',    code: 4   },
  { label: '○',  title: 'Home',    code: 3   },
  { label: '□',  title: 'Recents', code: 187 },
  { label: '⏻',  title: 'Power',   code: 26  },
  { label: '🔊', title: 'Vol +',   code: 24  },
  { label: '🔉', title: 'Vol −',   code: 25  },
  { label: '🔇', title: 'Mute',    code: 164 },
];

export default function ScreenMirror({
  device,
  deviceInfo,
  screenshot,
  isMirroring,
  enlarged,
  onToggleMirroring,
  onToggleEnlarged,
  onLaunchScrcpy,
  onTap,
  onKey,
  onSendText,
}) {
  const canvasRef = useRef(null);
  const enlargedCanvasRef = useRef(null);
  const imgRef = useRef(new Image());
  const [text, setText] = useState('');
  const [fps, setFps] = useState(0);
  const [cursorPos, setCursorPos] = useState(null);
  const letterboxRef = useRef({ ox: 0, oy: 0, sw: 1, sh: 1 });
  const [activeTab, setActiveTab] = useState('status');
  const [liveStatus, setLiveStatus] = useState(null);

  // ── File browser state
  const [filePath, setFilePath] = useState('/');
  const [fileEntries, setFileEntries] = useState(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState(null);

  // Device physical resolution (for coordinate mapping)
  const deviceRes = useRef({ w: 1080, h: 1920 });
  useEffect(() => {
    if (deviceInfo?.resolution) {
      const [w, h] = deviceInfo.resolution.split('x').map(Number);
      if (w > 0 && h > 0) deviceRes.current = { w, h };
    }
  }, [deviceInfo]);

  // FPS counter
  const fpsRef = useRef({ count: 0, last: Date.now() });
  useEffect(() => {
    if (!screenshot) return;
    fpsRef.current.count += 1;
    const now = Date.now();
    const elapsed = now - fpsRef.current.last;
    if (elapsed >= 1000) {
      setFps(Math.round((fpsRef.current.count * 1000) / elapsed));
      fpsRef.current = { count: 0, last: now };
    }
  }, [screenshot]);

  // Draw screenshot on canvas — letterbox to preserve aspect ratio
  useEffect(() => {
    if (!screenshot) return;
    const canvas = enlarged ? enlargedCanvasRef.current : canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = imgRef.current;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
      const ox = (canvas.width  - img.width  * scale) / 2;
      const oy = (canvas.height - img.height * scale) / 2;
      const sw = img.width  * scale;
      const sh = img.height * scale;
      letterboxRef.current = { ox, oy, sw, sh };
      ctx.drawImage(img, ox, oy, sw, sh);
    };
    img.src = screenshot;
  }, [screenshot, enlarged]);

  // Keyboard forwarding
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && enlarged) {
      onToggleEnlarged?.();
      return;
    }
    const code = KEY_MAP[e.key];
    if (code !== undefined) {
      e.preventDefault();
      onKey?.(code);
    }
  }, [onKey, enlarged, onToggleEnlarged]);

  // Click → ADB tap
  const handleCanvasClick = useCallback((e) => {
    if (!isMirroring) return;
    const canvas = enlarged ? enlargedCanvasRef.current : canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    // Convert CSS px → canvas-pixel space
    const cx = (e.clientX - rect.left) * canvas.width  / rect.width;
    const cy = (e.clientY - rect.top)  * canvas.height / rect.height;
    // Subtract letterbox offset, clamp to image area
    const { ox, oy, sw, sh } = letterboxRef.current;
    const ix = Math.max(0, Math.min(sw, cx - ox));
    const iy = Math.max(0, Math.min(sh, cy - oy));
    // Map to device coordinates
    const dx = Math.round(ix * deviceRes.current.w / sw);
    const dy = Math.round(iy * deviceRes.current.h / sh);
    onTap?.(dx, dy);
  }, [isMirroring, enlarged, onTap]);

  const sendText = useCallback(async () => {
    if (!text.trim()) return;
    await onSendText?.(text);
    setText('');
  }, [text, onSendText]);

  const handleMouseMove = useCallback((e) => {
    if (!isMirroring) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, [isMirroring]);

  const handleMouseLeave = useCallback(() => setCursorPos(null), []);

  // ── File browser helpers
  const fileIcon = (entry) => {
    if (entry.type === 'dir')    return '📁';
    if (entry.type === 'link')   return '🔗';
    if (entry.type === 'char' || entry.type === 'block') return '⚙️';
    if (entry.type === 'socket') return '🔌';
    if (entry.type === 'pipe')   return '⏩';
    const ext = entry.name.split('.').pop().toLowerCase();
    if (['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext)) return '🖼️';
    if (['mp4','mkv','avi','mov','webm','3gp'].includes(ext))        return '🎬';
    if (['mp3','aac','ogg','wav','flac','m4a'].includes(ext))        return '🎵';
    if (['apk','xapk'].includes(ext))                                return '📦';
    if (['zip','tar','gz','bz2','7z','rar'].includes(ext))           return '🗜️';
    if (['txt','log','md'].includes(ext))                            return '📝';
    if (['json','xml','yaml','yml','html','css','js','py'].includes(ext)) return '📄';
    return '📄';
  };

  const navigateFile = (name) => {
    const base = filePath === '/' ? '' : filePath;
    setFilePath(base + '/' + name);
  };

  const fileGoUp = () => {
    const parent = filePath.lastIndexOf('/') > 0
      ? filePath.substring(0, filePath.lastIndexOf('/'))
      : '/';
    setFilePath(parent);
  };

  const fileBreadcrumbs = filePath === '/' ? [] : filePath.split('/').filter(Boolean);

  const pullFileEntry = async (name) => {
    const base = filePath === '/' ? '' : filePath;
    await window.adbAPI.pullFile(device.id, base + '/' + name);
  };

  // Live status polling
  useEffect(() => {
    if (!device || device.state !== 'device' || activeTab !== 'status') return;
    let cancelled = false;
    const fetchStatus = async () => {
      const result = await window.adbAPI.getDeviceStatus(device.id);
      if (!cancelled) setLiveStatus(result);
    };
    fetchStatus();
    const id = setInterval(fetchStatus, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [device, activeTab]);

  // ── Reset file browser when device changes
  useEffect(() => {
    setFilePath('/');
    setFileEntries(null);
    setFileError(null);
  }, [device?.id]);

  // ── Load file listing when Files tab is active or path changes
  useEffect(() => {
    if (activeTab !== 'files' || !device || device.state !== 'device') return;
    let cancelled = false;
    setFileLoading(true);
    setFileError(null);
    window.adbAPI.listFiles(device.id, filePath).then(r => {
      if (cancelled) return;
      setFileLoading(false);
      if (r.success) setFileEntries(r.entries);
      else setFileError(r.error || 'Failed to list directory');
    });
    return () => { cancelled = true; };
  }, [device, activeTab, filePath]);



  // ─── Empty states ─────────────────────────────────────────────────────────

  if (!device) {
    return (
      <main className="panel panel-center empty-panel">
        <div className="empty-state">
          <div className="empty-icon large">🖥️</div>
          <p>Select a device to begin</p>
          <small>Choose a connected device from the left panel.</small>
        </div>
      </main>
    );
  }

  if (device.state !== 'device') {
    const hints = {
      unauthorized: 'Tap "Allow USB Debugging" on your device screen.',
      offline:      'Try reconnecting the USB cable or restarting ADB.',
    };
    return (
      <main className="panel panel-center empty-panel">
        <div className="empty-state">
          <div className="empty-icon large">⚠️</div>
          <p>Device not ready — <strong>{device.state}</strong></p>
          {hints[device.state] && <small>{hints[device.state]}</small>}
        </div>
      </main>
    );
  }

  // ── Enlarged overlay (2560 × 1600 canvas) ────────────────────────────────
  const enlargedOverlay = enlarged && (
    <div className="enlarge-overlay" onClick={(e) => { if (e.target === e.currentTarget) onToggleEnlarged(); }}>
      <div className="enlarge-toolbar">
        <div className="mirror-title">
          <span>Screen Mirror</span>
          <span className="device-badge">{deviceInfo?.model || device.id}</span>
          {isMirroring && <span className="fps-badge">{fps} fps</span>}
          <span className="res-badge">2560 × 1600</span>
        </div>
        <div className="mirror-header-actions">
          <button className="btn btn-ghost" onClick={onLaunchScrcpy} title="Launch full scrcpy window">
            🚀 scrcpy
          </button>
          <button className="btn btn-ghost btn-active" onClick={onToggleEnlarged} title="Exit enlarged view (Esc)">
            ✕ Close
          </button>
        </div>
      </div>
      <div className="enlarge-canvas-wrap"
        style={isMirroring ? { cursor: 'none' } : undefined}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <canvas
          ref={enlargedCanvasRef}
          width={2560}
          height={1600}
          className={`enlarge-canvas ${isMirroring ? 'canvas-active' : 'canvas-idle'}`}
          onClick={handleCanvasClick}
          title={isMirroring ? 'Click to tap on device' : 'Start monitoring to interact'}
        />
        {cursorPos && isMirroring && (
          <div className="cursor-dot" style={{ left: cursorPos.x, top: cursorPos.y }} />
        )}
        {!isMirroring && (
          <div className="screen-placeholder" onClick={onToggleMirroring}>
            <span className="play-btn">▶</span>
            <span>Click to start monitoring</span>
          </div>
        )}
        {isMirroring && !screenshot && (
          <div className="screen-loading">
            <span className="spinner" />
            <span>Capturing…</span>
          </div>
        )}
      </div>
      <div className="enlarge-controls">
        <div className="quick-keys">
          {QUICK_KEYS.map(({ label, title, code }) => (
            <button key={code} className="key-btn" title={title} onClick={() => onKey?.(code)}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <main className="panel panel-center" tabIndex={0} onKeyDown={handleKeyDown}>
      {enlargedOverlay}

      {/* ── Header ── */}
      <div className="panel-header">
        <div className="mirror-title">
          <span>Screen Mirror</span>
          <span className="device-badge">{deviceInfo?.model || device.id}</span>
          {isMirroring && <span className="fps-badge">{fps} fps</span>}
        </div>
        <div className="mirror-header-actions">
          <button className="btn btn-ghost" onClick={onLaunchScrcpy} title="Launch full scrcpy window">
            🚀 scrcpy
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="content-tabs-bar">
        <div className="content-tabs-left">
          <span className="content-tabs-title">STATUS</span>
          <span className="live-badge">● LIVE</span>
        </div>
        <div className="content-tabs-nav">
          {['status', 'info', 'files', 'logs'].map(tab => (
            <button
              key={tab}
              className={`tab-btn ${activeTab === tab ? 'tab-active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Status Tab ── */}
      {activeTab === 'status' && (
        <div className="live-status-panel">

          {/* ── Battery ── */}
          <div className="stat-section">
            <div className="stat-section-hdr">
              <span>Battery</span>
              <span className="charging-type-badge">⚡ {(liveStatus?.battery?.chargingType || 'NONE').toUpperCase()}</span>
            </div>
            <div className="battery-bar-track">
              <div className="battery-bar-fill" style={{
                width: `${liveStatus?.battery?.level ?? 0}%`,
                background: (liveStatus?.battery?.level ?? 100) < 20 ? '#ff3b30'
                  : (liveStatus?.battery?.level ?? 100) < 50 ? '#ff9f0a' : '#34c759',
              }} />
              <span className="battery-bar-pct">
                {liveStatus?.battery?.level != null ? `${liveStatus.battery.level}%` : '—'}
              </span>
            </div>
            <div className="stat-mini-grid">
              <div className="stat-mini-item"><span className="smi-label">Status</span><span className="smi-value">{liveStatus?.battery?.chargingStatus || '—'}</span></div>
              <div className="stat-mini-item"><span className="smi-label">Voltage</span><span className="smi-value">{liveStatus?.battery?.voltage || '—'}</span></div>
              <div className="stat-mini-item"><span className="smi-label">Temperature</span><span className="smi-value sc-orange">{liveStatus?.battery?.temperature != null ? `${liveStatus.battery.temperature} °C` : '—'}</span></div>
              <div className="stat-mini-item"><span className="smi-label">Health</span><span className="smi-value sc-green">{liveStatus?.battery?.health || '—'}</span></div>
            </div>
          </div>

          {/* ── System ── */}
          <div className="stat-section">
            <div className="stat-section-hdr"><span>System</span></div>
            <div className="stat-bar-row">
              <span className="stat-bar-label">RAM</span>
              <div className="battery-bar-track stat-bar-track-flex">
                <div className="battery-bar-fill" style={{
                  width: `${liveStatus?.memory?.usedPct ?? 0}%`,
                  background: (liveStatus?.memory?.usedPct ?? 0) > 80 ? '#ff3b30'
                    : (liveStatus?.memory?.usedPct ?? 0) > 60 ? '#ff9f0a' : '#3b82f6',
                }} />
                <span className="battery-bar-pct">{liveStatus?.memory?.usedPct != null ? `${liveStatus.memory.usedPct}%` : '—'}</span>
              </div>
              <span className="stat-bar-sub">{liveStatus?.memory ? `${fmtBytes(liveStatus.memory.used)} / ${fmtBytes(liveStatus.memory.total)}` : '—'}</span>
            </div>
            <div className="stat-bar-row">
              <span className="stat-bar-label">Storage</span>
              <div className="battery-bar-track stat-bar-track-flex">
                <div className="battery-bar-fill" style={{
                  width: `${liveStatus?.storage?.usedPct ?? 0}%`,
                  background: (liveStatus?.storage?.usedPct ?? 0) > 80 ? '#ff3b30'
                    : (liveStatus?.storage?.usedPct ?? 0) > 60 ? '#ff9f0a' : '#8b5cf6',
                }} />
                <span className="battery-bar-pct">{liveStatus?.storage?.usedPct != null ? `${liveStatus.storage.usedPct}%` : '—'}</span>
              </div>
              <span className="stat-bar-sub">{liveStatus?.storage ? `${fmtBytes(liveStatus.storage.used)} / ${fmtBytes(liveStatus.storage.total)}` : '—'}</span>
            </div>
            <div className="stat-mini-grid">
              <div className="stat-mini-item stat-mini-full">
                <span className="smi-label">CPU Load (1m / 5m / 15m)</span>
                <span className="smi-value">{liveStatus?.cpuLoad ? `${liveStatus.cpuLoad.load1} · ${liveStatus.cpuLoad.load5} · ${liveStatus.cpuLoad.load15}` : '—'}</span>
              </div>
              <div className="stat-mini-item"><span className="smi-label">CPU Arch</span><span className="smi-value">{liveStatus?.cpuArch || '—'}</span></div>
              <div className="stat-mini-item"><span className="smi-label">CPU Freq</span><span className="smi-value">{liveStatus?.cpuFreq || '—'}</span></div>
              <div className="stat-mini-item"><span className="smi-label">CPU Temp</span><span className="smi-value sc-orange">{liveStatus?.thermalTemp != null ? `${liveStatus.thermalTemp} °C` : '—'}</span></div>
              <div className="stat-mini-item stat-mini-full"><span className="smi-label">Kernel</span><span className="smi-value smi-truncate">{liveStatus?.kernelVersion || '—'}</span></div>
            </div>
          </div>

          {/* ── Connectivity ── */}
          <div className="stat-section">
            <div className="stat-section-hdr"><span>Connectivity</span></div>
            <div className="stat-mini-grid">
              <div className="stat-mini-item stat-mini-full">
                <span className="smi-label">WiFi Network</span>
                <span className="smi-value sc-blue">{liveStatus?.wifiInfo?.ssid || (liveStatus?.wifiInfo?.ip ? 'Connected' : 'Not connected')}</span>
              </div>
              <div className="stat-mini-item"><span className="smi-label">WiFi IP</span><span className="smi-value">{liveStatus?.wifiInfo?.ip || '—'}</span></div>
              <div className="stat-mini-item"><span className="smi-label">Signal</span>
                <span className={`smi-value ${
                  liveStatus?.wifiInfo?.signal === 'Excellent' ? 'sc-green' :
                  liveStatus?.wifiInfo?.signal === 'Good' ? 'sc-green' :
                  liveStatus?.wifiInfo?.signal === 'Fair' ? 'sc-orange' :
                  liveStatus?.wifiInfo?.signal === 'Weak' ? 'sc-red' : ''
                }`}>
                  {liveStatus?.wifiInfo?.rssi != null
                    ? `${liveStatus.wifiInfo.rssi} dBm (${liveStatus.wifiInfo.signal})`
                    : '—'}
                </span>
              </div>
              <div className="stat-mini-item"><span className="smi-label">Link Speed</span><span className="smi-value">{liveStatus?.wifiInfo?.linkSpeed != null ? `${liveStatus.wifiInfo.linkSpeed} Mbps` : '—'}</span></div>
              <div className="stat-mini-item"><span className="smi-label">Frequency</span><span className="smi-value">{liveStatus?.wifiInfo?.frequency != null ? `${(liveStatus.wifiInfo.frequency / 1000).toFixed(1)} GHz` : '—'}</span></div>
              <div className="stat-mini-item"><span className="smi-label">Net RX / TX</span><span className="smi-value">
                {liveStatus?.netTraffic
                  ? `${fmtBytes(liveStatus.netTraffic.rxBytes)} / ${fmtBytes(liveStatus.netTraffic.txBytes)}`
                  : '—'}
              </span></div>
              <div className="stat-mini-item"><span className="smi-label">Bluetooth</span>
                <span className={`smi-value ${liveStatus?.bluetooth === 'ON' ? 'sc-blue' : 'sc-red'}`}>
                  {liveStatus?.bluetooth || '—'}
                </span>
              </div>
              <div className="stat-mini-item"><span className="smi-label">Mobile Data</span>
                <span className={`smi-value ${liveStatus?.mobileData === 'ON' ? 'sc-green' : liveStatus?.mobileData === 'OFF' ? 'sc-red' : ''}`}>
                  {liveStatus?.mobileData || '—'}
                </span>
              </div>
              <div className="stat-mini-item"><span className="smi-label">Airplane Mode</span>
                <span className={`smi-value ${liveStatus?.airplaneMode === 'ON' ? 'sc-orange' : 'sc-green'}`}>
                  {liveStatus?.airplaneMode || '—'}
                </span>
              </div>
              <div className="stat-mini-item"><span className="smi-label">GPS</span><span className="smi-value">{liveStatus?.gpsMode || '—'}</span></div>
            </div>
          </div>

          {/* ── Display ── */}
          <div className="stat-section">
            <div className="stat-section-hdr"><span>Display</span></div>
            <div className="stat-bar-row">
              <span className="stat-bar-label">Brightness</span>
              <div className="battery-bar-track stat-bar-track-flex">
                <div className="battery-bar-fill" style={{ width: `${liveStatus?.brightness?.pct ?? 0}%`, background: '#ffd60a' }} />
                <span className="battery-bar-pct">{liveStatus?.brightness?.pct != null ? `${liveStatus.brightness.pct}%` : '—'}</span>
              </div>
            </div>
            <div className="stat-mini-grid">
              <div className="stat-mini-item">
                <span className="smi-label">Screen</span>
                <span className={`smi-value ${liveStatus?.screenState === 'ON' ? 'sc-green' : liveStatus?.screenState === 'OFF' ? 'sc-red' : ''}`}>
                  {liveStatus?.screenState || '—'}
                </span>
              </div>
              <div className="stat-mini-item"><span className="smi-label">Density</span><span className="smi-value">{liveStatus?.density != null ? `${liveStatus.density} DPI` : '—'}</span></div>
              <div className="stat-mini-item"><span className="smi-label">Sleep Timeout</span><span className="smi-value">{liveStatus?.screenTimeout || '—'}</span></div>
              <div className="stat-mini-item"><span className="smi-label">Auto-Rotate</span>
                <span className={`smi-value ${liveStatus?.autoRotate === 'ON' ? 'sc-green' : liveStatus?.autoRotate === 'OFF' ? 'sc-red' : ''}`}>
                  {liveStatus?.autoRotate || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* ── Settings ── */}
          <div className="stat-section">
            <div className="stat-section-hdr"><span>Settings</span></div>
            <div className="stat-mini-grid">
              <div className="stat-mini-item"><span className="smi-label">Do Not Disturb</span><span className="smi-value">{liveStatus?.dnd || '—'}</span></div>
              <div className="stat-mini-item"><span className="smi-label">Ringer Mode</span><span className="smi-value">{liveStatus?.ringerMode || '—'}</span></div>
              <div className="stat-mini-item"><span className="smi-label">Language</span><span className="smi-value">{liveStatus?.locale || '—'}</span></div>
              <div className="stat-mini-item"><span className="smi-label">Timezone</span><span className="smi-value smi-truncate">{liveStatus?.timezone || '—'}</span></div>
              <div className="stat-mini-item stat-mini-full"><span className="smi-label">USB State</span><span className="smi-value">{liveStatus?.usbState || '—'}</span></div>
            </div>
          </div>

          {/* ── Activity ── */}
          <div className="stat-section">
            <div className="stat-section-hdr"><span>Activity</span></div>
            <div className="stat-mini-grid">
              <div className="stat-mini-item"><span className="smi-label">Uptime</span><span className="smi-value sc-blue">{liveStatus?.uptime || '—'}</span></div>
              <div className="stat-mini-item stat-mini-full">
                <span className="smi-label">Foreground App</span>
                <span className="smi-value smi-truncate">{liveStatus?.focusedApp || '—'}</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── Info Tab ── */}
      {activeTab === 'info' && (
        <div className="device-status-panel">
          <div className="status-row"><span className="status-label">Model</span><span className="status-value">{deviceInfo?.model || '—'}</span></div>
          <div className="status-row"><span className="status-label">Manufacturer</span><span className="status-value">{deviceInfo?.manufacturer || '—'}</span></div>
          <div className="status-row"><span className="status-label">Android Version</span><span className="status-value">{deviceInfo?.androidVersion ? `Android ${deviceInfo.androidVersion}` : '—'}</span></div>
          <div className="status-row"><span className="status-label">SDK Version</span><span className="status-value">{deviceInfo?.sdkVersion || '—'}</span></div>
          <div className="status-row"><span className="status-label">Resolution</span><span className="status-value">{deviceInfo?.resolution || '—'}</span></div>
          <div className="status-row"><span className="status-label">Serial</span><span className="status-value">{deviceInfo?.serial || device.id}</span></div>
          <div className="status-row"><span className="status-label">Device ID</span><span className="status-value">{device.id}</span></div>
          <div className="status-row"><span className="status-label">State</span><span className="status-value status-state">{device.state}</span></div>
        </div>
      )}

      {/* ── Files Tab ── */}
      {activeTab === 'files' && (
        <div className="file-browser">

          {/* Path bar / breadcrumbs */}
          <div className="file-path-bar">
            <button className="file-crumb" onClick={() => setFilePath('/')}>/</button>
            {fileBreadcrumbs.map((seg, i) => {
              const p = '/' + fileBreadcrumbs.slice(0, i + 1).join('/');
              return (
                <span key={p} style={{ display: 'flex', alignItems: 'center' }}>
                  <span className="file-crumb-sep">/</span>
                  <button className="file-crumb" onClick={() => setFilePath(p)}>{seg}</button>
                </span>
              );
            })}
            {filePath !== '/' && (
              <button className="file-up-btn" onClick={fileGoUp}>↑ Up</button>
            )}
          </div>

          {/* Content */}
          {fileLoading ? (
            <div className="file-msg">Loading…</div>
          ) : fileError ? (
            <div className="file-msg file-msg-error">🔒 {fileError}</div>
          ) : (
            <div className="file-list">
              {/* Header */}
              <div className="file-row file-row-hdr">
                <span />
                <span>Name</span>
                <span>Size</span>
                <span>Permissions</span>
                <span>Owner</span>
                <span>Modified</span>
                <span />
              </div>

              {/* Entries — dirs first */}
              {[...(fileEntries || [])].sort((a, b) => {
                if (a.type === 'dir' && b.type !== 'dir') return -1;
                if (a.type !== 'dir' && b.type === 'dir') return 1;
                return a.name.localeCompare(b.name);
              }).map(entry => (
                <div
                  key={entry.name}
                  className={`file-row ${entry.type !== 'file' ? 'file-row-nav' : ''}`}
                  onClick={() => (entry.type === 'dir' || entry.type === 'link') && navigateFile(entry.name)}
                >
                  <span className="fr-icon">{fileIcon(entry)}</span>
                  <span className="fr-name" title={entry.name + (entry.symlink ? ' → ' + entry.symlink : '')}>
                    {entry.name}
                    {entry.symlink && <span className="fr-sym"> → {entry.symlink}</span>}
                  </span>
                  <span className="fr-size">{entry.type === 'dir' ? '—' : fmtBytes(entry.size)}</span>
                  <span className="fr-perms">{entry.perms}</span>
                  <span className="fr-owner">{entry.owner}</span>
                  <span className="fr-date">{entry.date}</span>
                  <span className="fr-actions">
                    {entry.type === 'file' && (
                      <button
                        className="fr-pull-btn"
                        title="Pull to Mac"
                        onClick={e => { e.stopPropagation(); pullFileEntry(entry.name); }}
                      >↓ Pull</button>
                    )}
                  </span>
                </div>
              ))}

              {fileEntries?.length === 0 && (
                <div className="file-msg">Empty directory</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Logs placeholder ── */}
      {activeTab === 'logs' && (
        <div className="tab-placeholder">
          <span>📋</span>
          <p>Coming soon</p>
        </div>
      )}

      {/* ── Controls ── */}}
      <div className="device-controls">
        <div className="quick-keys">
          {QUICK_KEYS.map(({ label, title, code }) => (
            <button key={code} className="key-btn" title={title} onClick={() => onKey?.(code)}>
              {label}
            </button>
          ))}
        </div>
        <div className="text-row">
          <input
            className="input"
            type="text"
            placeholder="Type text to send to device…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendText()}
          />
          <button className="btn btn-primary" onClick={sendText}>Send</button>
        </div>
      </div>
    </main>
  );
}
