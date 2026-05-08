export default function TopBar({ deviceCount, totalCount, isLoading, onRefresh, onRestartAdb }) {
  return (
    <header className="top-bar">
      <div className="top-bar-brand">
        <span className="brand-logo">⬡</span>
        <span className="brand-name">ADB Device Monitor</span>
      </div>

      <div className="top-bar-status">
        <span className={`connection-pill ${deviceCount > 0 ? 'pill-green' : 'pill-gray'}`}>
          <span className={`pulse-dot ${deviceCount > 0 ? 'dot-green' : 'dot-gray'}`} />
          {deviceCount} / {totalCount} online
        </span>
      </div>

      <div className="top-bar-actions">
        <button
          className="btn btn-ghost"
          onClick={onRefresh}
          disabled={isLoading}
          title="Refresh device list"
        >
          <span className={isLoading ? 'spin' : ''}>↻</span>
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
        <button
          className="btn btn-ghost btn-warn"
          onClick={onRestartAdb}
          title="Kill and restart ADB server"
        >
          ⟲ Restart ADB
        </button>
      </div>
    </header>
  );
}
