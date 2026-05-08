import { useState } from 'react';

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color = 'var(--text)' }) {
  return (
    <div className="stat-card">
      <div className="stat-card-icon">{icon}</div>
      <div className="stat-card-body">
        <div className="stat-card-label">{label}</div>
        <div className="stat-card-value" style={{ color }}>{value ?? 'N/A'}</div>
        {sub && <div className="stat-card-sub">{sub}</div>}
      </div>
    </div>
  );
}

function BatteryBar({ level, charging }) {
  const color =
    level === null ? 'var(--text-muted)'
    : level > 60   ? 'var(--green)'
    : level > 25   ? 'var(--yellow)'
    :                'var(--red)';
  return (
    <div className="battery-bar-wrap">
      <div className="battery-bar-track">
        <div
          className={`battery-bar-fill ${charging ? 'charging-anim' : ''}`}
          style={{ width: `${level ?? 0}%`, background: color }}
        />
      </div>
      <span className="battery-pct" style={{ color }}>{level ?? '–'}%</span>
    </div>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="info-row">
      <span className="info-row-label">{label}</span>
      <span className={`info-row-value ${mono ? 'mono' : ''}`}>{value || 'N/A'}</span>
    </div>
  );
}

function LogsPane({ logs }) {
  return (
    <div className="logs-pane">
      {logs.length === 0
        ? <p className="logs-empty">No log entries yet.</p>
        : [...logs].reverse().map((entry, i) => (
            <div key={i} className="log-entry">
              <span className="log-time">{entry.time}</span>
              <span className="log-msg">{entry.msg}</span>
            </div>
          ))
      }
    </div>
  );
}

function FileTransferPane({ device }) {
  const [remote, setRemote] = useState('/sdcard/');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  const push = async () => {
    const local = await window.adbAPI.openFile();
    if (!local) return;
    setBusy(true);
    const res = await window.adbAPI.pushFile(device.id, local, remote);
    flash(res.success ? '✓ File pushed.' : `✗ ${res.error}`);
    setBusy(false);
  };

  const pull = async () => {
    if (!remote.trim()) return;
    setBusy(true);
    const res = await window.adbAPI.pullFile(device.id, remote);
    flash(res.success ? '✓ File pulled.' : `✗ ${res.error || res.message}`);
    setBusy(false);
  };

  return (
    <div className="file-transfer">
      <input
        className="input"
        type="text"
        placeholder="Remote path on device"
        value={remote}
        onChange={(e) => setRemote(e.target.value)}
      />
      <div className="file-transfer-btns">
        <button className="btn btn-ghost" onClick={push} disabled={busy}>↑ Push</button>
        <button className="btn btn-ghost" onClick={pull} disabled={busy}>↓ Pull</button>
      </div>
      {msg && <div className="form-status">{msg}</div>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StatusPanel({ device, deviceInfo, status, logs }) {
  const [tab, setTab] = useState('status');

  if (!device) {
    return (
      <aside className="panel panel-right empty-panel">
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <p>No device selected</p>
        </div>
      </aside>
    );
  }

  const batt = status?.battery ?? {};
  const battColor  = batt.level > 60 ? 'var(--green)' : batt.level > 25 ? 'var(--yellow)' : 'var(--red)';
  const tempColor  = batt.temperature > 45 ? 'var(--red)' : batt.temperature > 38 ? 'var(--yellow)' : 'var(--green)';

  return (
    <aside className="panel panel-right">
      <div className="panel-header">
        <span>Status</span>
        {status && <span className="live-badge">● LIVE</span>}
      </div>

      <div className="tab-bar">
        {['status', 'info', 'files', 'logs'].map((t) => (
          <button key={t} className={`tab ${tab === t ? 'tab-active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Status Tab ── */}
      {tab === 'status' && (
        <div className="tab-content">
          {/* Battery Overview */}
          <div className="battery-section">
            <div className="battery-header">
              <span>Battery</span>
              {batt.charging && (
                <span className="charging-tag">⚡ {batt.chargingType}</span>
              )}
            </div>
            <BatteryBar level={batt.level} charging={batt.charging} />
            {batt.chargingStatus && (
              <div className="battery-sub">{batt.chargingStatus} · {batt.voltage ?? ''}</div>
            )}
          </div>

          <div className="stat-grid">
            <StatCard icon="🔋" label="Battery" value={batt.level != null ? `${batt.level}%` : null} color={battColor} sub={batt.health ? `Health: ${batt.health}` : null} />
            <StatCard icon="🌡️" label="Temperature" value={batt.temperature ? `${batt.temperature} °C` : null} color={tempColor} sub={batt.temperature > 45 ? '⚠ Hot!' : null} />
            <StatCard icon="💡" label="Screen" value={status?.screenState ?? null} color={status?.screenState === 'ON' ? 'var(--green)' : 'var(--text-muted)'} />
            <StatCard icon="🔌" label="Power" value={batt.chargingType ?? null} color={batt.charging ? 'var(--yellow)' : 'var(--text-muted)'} />
            <StatCard icon="⏱️" label="Uptime" value={status?.uptime ?? null} color="var(--blue)" />
          </div>
        </div>
      )}

      {/* ── Info Tab ── */}
      {tab === 'info' && (
        <div className="tab-content info-tab">
          <InfoRow label="Model"        value={deviceInfo?.model} />
          <InfoRow label="Manufacturer" value={deviceInfo?.manufacturer} />
          <InfoRow label="Android"      value={deviceInfo?.androidVersion ? `Android ${deviceInfo.androidVersion}` : null} />
          <InfoRow label="SDK"          value={deviceInfo?.sdkVersion ? `API ${deviceInfo.sdkVersion}` : null} />
          <InfoRow label="Resolution"   value={deviceInfo?.resolution} />
          <InfoRow label="Serial"       value={deviceInfo?.serial || device.id} mono />
          <InfoRow label="State"        value={device.state} />
          <InfoRow label="Product"      value={device.product} />
        </div>
      )}

      {/* ── Files Tab ── */}
      {tab === 'files' && (
        <div className="tab-content">
          <p className="section-label" style={{ marginBottom: 8 }}>Transfer files via ADB</p>
          <FileTransferPane device={device} />
        </div>
      )}

      {/* ── Logs Tab ── */}
      {tab === 'logs' && (
        <div className="tab-content logs-tab">
          <LogsPane logs={logs} />
        </div>
      )}
    </aside>
  );
}
