import { useState } from 'react';

const STATE_META = {
  device:       { label: 'Connected',    color: 'var(--green)',  icon: '●' },
  unauthorized: { label: 'Unauthorized', color: 'var(--yellow)', icon: '◐' },
  offline:      { label: 'Offline',      color: 'var(--red)',    icon: '○' },
  error:        { label: 'Error',        color: 'var(--red)',    icon: '✕' },
};

export default function DeviceList({ devices, selectedDevice, onSelect }) {
  return (
    <aside className="panel panel-left">
      <div className="panel-header">
        <span>Devices</span>
        <span className="badge">{devices.length}</span>
      </div>

      <div className="device-list">
        {devices.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📵</div>
            <p>No devices detected</p>
            <small>Connect a device with USB debugging enabled, or pair wirelessly below.</small>
          </div>
        ) : (
          devices.map((device) => {
            const meta = STATE_META[device.state] || { label: device.state, color: 'var(--text-muted)', icon: '?' };
            const active = selectedDevice?.id === device.id;
            return (
              <button
                key={device.id}
                className={`device-item ${active ? 'device-item--active' : ''}`}
                onClick={() => onSelect(device)}
              >
                <div className="device-item-icon">📱</div>
                <div className="device-item-info">
                  <div className="device-item-model">{device.model}</div>
                  <div className="device-item-id">{device.id}</div>
                  <div className="device-item-state" style={{ color: meta.color }}>
                    <span>{meta.icon}</span>&ensp;{meta.label}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="wireless-section">
        <div className="section-label">Wireless Connect</div>
        <WirelessForm />
      </div>
    </aside>
  );
}

function WirelessForm() {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('5555');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    if (!host.trim()) return;
    setBusy(true);
    setStatus('');
    const result = await window.adbAPI.connectWireless(host.trim(), port.trim() || '5555');
    setStatus(result.success ? (result.stdout || 'Connected') : (result.error || 'Failed'));
    setBusy(false);
    setTimeout(() => setStatus(''), 4000);
  };

  return (
    <div className="wireless-form">
      <input
        className="input"
        type="text"
        placeholder="IP Address (e.g. 192.168.1.5)"
        value={host}
        onChange={(e) => setHost(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && connect()}
      />
      <div className="wireless-row">
        <input
          className="input port-input"
          type="text"
          placeholder="Port"
          value={port}
          onChange={(e) => setPort(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && connect()}
        />
        <button className="btn btn-primary" onClick={connect} disabled={busy}>
          {busy ? '…' : 'Connect'}
        </button>
      </div>
      {status && <div className="form-status">{status}</div>}
    </div>
  );
}
