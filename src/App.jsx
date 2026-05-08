import { useState, useEffect, useCallback, useRef } from 'react';
import TopBar from './components/TopBar';
import DeviceList from './components/DeviceList';
import ScreenMirror from './components/ScreenMirror';

export default function App() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [screenshot, setScreenshot] = useState(null);
  const [isMirroring, setIsMirroring] = useState(false);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [logs, setLogs] = useState([]);
  const [enlarged, setEnlarged] = useState(false);

  const selectedRef = useRef(selectedDevice);
  useEffect(() => { selectedRef.current = selectedDevice; }, [selectedDevice]);

  const addLog = useCallback((msg) => {
    setLogs((prev) => [...prev.slice(-99), { time: new Date().toLocaleTimeString(), msg }]);
  }, []);

  // ─── Device Polling (every 3 s) ──────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      setIsLoadingDevices(true);
      try {
        const devs = await window.adbAPI.getDevices();
        if (cancelled) return;
        setDevices(devs);
        // Deselect if device disappeared
        const current = selectedRef.current;
        if (current && !devs.find((d) => d.id === current.id)) {
          setSelectedDevice(null);
          setDeviceStatus(null);
          setScreenshot(null);
          setIsMirroring(false);
          addLog(`Device ${current.id} disconnected.`);
        }
      } finally {
        if (!cancelled) setIsLoadingDevices(false);
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [addLog]);

  // ─── Status Polling (every 5 s) ──────────────────────────────────────────

  useEffect(() => {
    const id = selectedDevice?.id;
    if (!id || selectedDevice?.state !== 'device') return;

    let cancelled = false;

    const poll = async () => {
      const status = await window.adbAPI.getDeviceStatus(id);
      if (!cancelled) setDeviceStatus(status);
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [selectedDevice?.id, selectedDevice?.state]);

  // ─── Live stream (push-based from main process) ─────────────────────────

  useEffect(() => {
    const id = selectedDevice?.id;
    if (!isMirroring || !id) return;

    window.adbAPI.onStreamFrame((data) => setScreenshot(data));
    window.adbAPI.startStream(id).then((result) => {
      if (result.success) addLog(`Stream started (${result.mode}).`);
      else addLog(`Stream error: ${result.error || 'unknown'}`);
    });

    return () => {
      window.adbAPI.stopStream(id);
      window.adbAPI.offStreamFrame();
    };
  }, [isMirroring, selectedDevice?.id, addLog]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleSelectDevice = useCallback(async (device) => {
    setSelectedDevice(device);
    setDeviceStatus(null);
    setScreenshot(null);
    setIsMirroring(false);
    setDeviceInfo(null);

    if (device?.state === 'device') {
      const info = await window.adbAPI.getDeviceInfo(device.id);
      setDeviceInfo(info);
      addLog(`Selected: ${info.manufacturer} ${info.model} (${device.id})`);
    }
  }, [addLog]);

  const handleRefresh = useCallback(async () => {
    setIsLoadingDevices(true);
    const devs = await window.adbAPI.getDevices();
    setDevices(devs);
    setIsLoadingDevices(false);
    addLog('Device list refreshed.');
  }, [addLog]);

  const handleRestartAdb = useCallback(async () => {
    addLog('Restarting ADB server…');
    const result = await window.adbAPI.restartServer();
    addLog(result.success ? 'ADB server restarted successfully.' : `ADB restart failed: ${result.error}`);
  }, [addLog]);

  const handleToggleMirroring = useCallback(() => {
    setIsMirroring((prev) => {
      if (!prev) addLog('Screen monitoring started.');
      else { setScreenshot(null); addLog('Screen monitoring stopped.'); }
      return !prev;
    });
  }, [addLog]);

  const handleToggleEnlarged = useCallback(() => {
    setEnlarged((prev) => !prev);
  }, []);

  const handleLaunchScrcpy = useCallback(async () => {
    if (!selectedDevice) return;
    const result = await window.adbAPI.startScrcpy(selectedDevice.id);
    addLog(result.success ? `scrcpy launched (PID ${result.pid}).` : `scrcpy: ${result.message}`);
  }, [selectedDevice, addLog]);

  const handleTap = useCallback(async (x, y) => {
    if (!selectedDevice) return;
    await window.adbAPI.sendTap(selectedDevice.id, x, y);
  }, [selectedDevice]);

  const handleKey = useCallback(async (keycode) => {
    if (!selectedDevice) return;
    await window.adbAPI.sendKey(selectedDevice.id, keycode);
  }, [selectedDevice]);

  const handleSendText = useCallback(async (text) => {
    if (!selectedDevice) return;
    await window.adbAPI.sendText(selectedDevice.id, text);
  }, [selectedDevice]);

  return (
    <div className="app">
      <TopBar
        deviceCount={devices.filter((d) => d.state === 'device').length}
        totalCount={devices.length}
        isLoading={isLoadingDevices}
        onRefresh={handleRefresh}
        onRestartAdb={handleRestartAdb}
      />
      <div className="main-layout">
        <DeviceList
          devices={devices}
          selectedDevice={selectedDevice}
          onSelect={handleSelectDevice}
        />
        <ScreenMirror
          device={selectedDevice}
          deviceInfo={deviceInfo}
          screenshot={screenshot}
          isMirroring={isMirroring}
          enlarged={enlarged}
          onToggleMirroring={handleToggleMirroring}
          onToggleEnlarged={handleToggleEnlarged}
          onLaunchScrcpy={handleLaunchScrcpy}
          onTap={handleTap}
          onKey={handleKey}
          onSendText={handleSendText}
        />
      </div>
    </div>
  );
}
