const { AdbManager } = require('./adbManager');

const adb = new AdbManager();

class DeviceStatus {
  // ─── Battery ──────────────────────────────────────────────────────────────

  parseBattery(output) {
    const info = {
      level: null,
      temperature: null,
      charging: false,
      chargingStatus: 'Unknown',
      chargingType: 'None',
      voltage: null,
      health: null,
    };

    const STATUS_MAP = { '2': 'Charging', '3': 'Discharging', '4': 'Not charging', '5': 'Full' };
    const HEALTH_MAP = { '2': 'Good', '3': 'Overheat', '4': 'Dead', '5': 'Over Voltage', '6': 'Failure', '7': 'Cold' };
    const PLUG_MAP   = { '1': 'AC', '2': 'USB', '4': 'Wireless' };

    for (const line of output.split('\n')) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();

      switch (key) {
        case 'level':
          info.level = parseInt(val, 10);
          break;
        case 'temperature':
          info.temperature = (parseInt(val, 10) / 10).toFixed(1);
          break;
        case 'status':
          info.charging = val === '2' || val === '5';
          info.chargingStatus = STATUS_MAP[val] || 'Unknown';
          break;
        case 'plugged':
          info.chargingType = PLUG_MAP[val] || 'None';
          break;
        case 'voltage':
          info.voltage = `${(parseInt(val, 10) / 1000).toFixed(2)} V`;
          break;
        case 'health':
          info.health = HEALTH_MAP[val] || 'Unknown';
          break;
      }
    }

    return info;
  }

  // ─── Screen State ─────────────────────────────────────────────────────────

  parseScreenState(output) {
    const wakeMatch = output.match(/mWakefulness\s*=\s*(\w+)/);
    if (wakeMatch) return wakeMatch[1] === 'Awake' ? 'ON' : 'OFF';

    const holdMatch = output.match(/mHoldingDisplaySuspendBlocker\s*=\s*(\w+)/);
    if (holdMatch) return holdMatch[1] === 'true' ? 'ON' : 'OFF';

    return 'Unknown';
  }

  // ─── Uptime ───────────────────────────────────────────────────────────────

  parseUptime(output) {
    // "up 2:34" or "up  1 day, 3:45"
    const match = output.match(/up\s+(.+?),\s+\d+ user/);
    if (match) return match[1].trim();
    // Fallback: grab everything after "up"
    const simple = output.match(/up\s+([\d: ]+)/);
    return simple ? simple[1].trim() : output.slice(0, 40).trim();
  }

  // ─── Memory ──────────────────────────────────────────────────────────────

  parseMemory(output) {
    const get = (key) => {
      const m = output.match(new RegExp(`^${key}:\\s+(\\d+)\\s*kB`, 'm'));
      return m ? parseInt(m[1], 10) * 1024 : null;
    };
    const total     = get('MemTotal');
    const available = get('MemAvailable') || get('MemFree');
    if (!total) return null;
    const used = total - (available || 0);
    return { total, available, used, usedPct: Math.round((used / total) * 100) };
  }

  // ─── Storage ─────────────────────────────────────────────────────────────

  parseStorage(output) {
    const lines = output.trim().split('\n');
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5 && parts[0].startsWith('/')) {
        const toBytes = (s) => {
          const m = s.match(/^(\d+)([KMG]?)$/i);
          if (!m) return null;
          const n = parseInt(m[1], 10);
          const mult = { '': 1024, 'K': 1024, 'M': 1024 * 1024, 'G': 1024 * 1024 * 1024 }[m[2].toUpperCase()] || 1024;
          return n * mult;
        };
        const total = toBytes(parts[1]);
        const used  = toBytes(parts[2]);
        if (!total || total === 0) continue;
        const pctStr = (parts[4] || '').replace('%', '');
        const usedPct = parseInt(pctStr, 10);
        return {
          total,
          used,
          free: total - used,
          usedPct: isNaN(usedPct) ? Math.round((used / total) * 100) : usedPct,
        };
      }
    }
    return null;
  }

  // ─── WiFi Info ────────────────────────────────────────────────────────────

  parseWifiInfo(output) {
    const ssidM   = output.match(/SSID:\s*(.+)/);
    const rssiM   = output.match(/RSSI:\s*(-\d+)/);
    const linkM   = output.match(/Link speed:\s*([\d.]+)\s*Mbps/i) || output.match(/linkSpeed\s+([\d.]+)/i);
    const freqM   = output.match(/Frequency:\s*([\d.]+)\s*MHz/i) || output.match(/frequency\s+([\d.]+)/i);
    const macM    = output.match(/(?:BSSID|bssid):\s*([0-9a-f:]{17})/i);
    const ipM     = output.match(/IP address:\s*([\d.]+)/);

    const rssi = rssiM ? parseInt(rssiM[1], 10) : null;
    let signal = null;
    if (rssi !== null) {
      if (rssi >= -50)      signal = 'Excellent';
      else if (rssi >= -60) signal = 'Good';
      else if (rssi >= -70) signal = 'Fair';
      else                  signal = 'Weak';
    }

    return {
      ssid:      ssidM  ? ssidM[1].replace(/^"|"$/g, '').trim() : null,
      rssi,
      signal,
      linkSpeed: linkM  ? parseFloat(linkM[1])  : null,
      frequency: freqM  ? parseFloat(freqM[1])  : null,
      bssid:     macM   ? macM[1]               : null,
      ip:        ipM    ? ipM[1]                : null,
    };
  }

  // ─── Network Traffic ─────────────────────────────────────────────────────

  parseNetTraffic(output) {
    for (const line of output.split('\n')) {
      if (!line.includes('wlan0')) continue;
      const parts = line.trim().split(/\s+/);
      // format: iface: rx_bytes rx_packets ... tx_bytes tx_packets
      if (parts.length >= 10) {
        return {
          rxBytes: parseInt(parts[1], 10) || 0,
          txBytes: parseInt(parts[9], 10) || 0,
        };
      }
    }
    return null;
  }

  // ─── Thermal ─────────────────────────────────────────────────────────────

  parseThermal(output) {
    const temp = parseInt(output.trim(), 10);
    if (isNaN(temp)) return null;
    // kernel reports in milli-Celsius if > 1000, or Celsius directly
    return temp > 1000 ? (temp / 1000).toFixed(1) : temp.toFixed(1);
  }

  // ─── DND mode ────────────────────────────────────────────────────────────

  parseDND(output) {
    const MAP = { '0': 'Off', '1': 'Priority', '2': 'Total Silence', '3': 'Alarms Only' };
    return MAP[output.trim()] || 'Off';
  }

  // ─── Ringer mode ─────────────────────────────────────────────────────────

  parseRinger(output) {
    const MAP = { '0': 'Silent', '1': 'Vibrate', '2': 'Normal' };
    return MAP[output.trim()] || null;
  }

  // ─── CPU Freq ────────────────────────────────────────────────────────────

  parseCpuFreq(output) {
    const hz = parseInt(output.trim(), 10);
    if (isNaN(hz)) return null;
    return (hz / 1000) >= 1000 ? `${(hz / 1e6).toFixed(2)} GHz` : `${(hz / 1000).toFixed(0)} MHz`;
  }

  // ─── CPU Load ────────────────────────────────────────────────────────────

  parseCpuLoad(output) {
    const parts = output.trim().split(/\s+/);
    return {
      load1:  parseFloat(parts[0]) || 0,
      load5:  parseFloat(parts[1]) || 0,
      load15: parseFloat(parts[2]) || 0,
    };
  }

  // ─── Brightness ──────────────────────────────────────────────────────────

  parseBrightness(output) {
    const val = parseInt(output.trim(), 10);
    if (isNaN(val)) return null;
    return { raw: val, pct: Math.round((val / 255) * 100) };
  }

  // ─── Screen Timeout ──────────────────────────────────────────────────────

  parseScreenTimeout(output) {
    const ms = parseInt(output.trim(), 10);
    if (isNaN(ms) || ms <= 0) return null;
    if (ms < 60000)   return `${ms / 1000}s`;
    if (ms < 3600000) return `${ms / 60000} min`;
    return `${(ms / 3600000).toFixed(1)} h`;
  }

  // ─── Focused App ─────────────────────────────────────────────────────────

  parseFocusedApp(output) {
    const m = output.match(/mCurrentFocus=Window\{[^}]+\s+([\w.]+)\//);
    return m ? m[1] : null;
  }

  // ─── Display Density ─────────────────────────────────────────────────────

  parseDensity(output) {
    const m = output.match(/Physical density:\s*(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }

  // ─── WiFi IP ─────────────────────────────────────────────────────────────

  parseWifiIp(output) {
    const m = output.match(/inet\s+([\d.]+)\/\d+/);
    return m ? m[1] : null;
  }

  // ─── Full Status ──────────────────────────────────────────────────────────

  async getFullStatus(deviceId) {
    const [
      battRes, powerRes, uptimeRes,
      memRes, dfRes, loadRes, archRes,
      brightnessRes, timeoutRes, focusRes,
      densityRes, wifiIpRes,
      wifiInfoRes, netTrafficRes, thermalRes,
      btRes, airplaneRes, mobileDataRes,
      gpsRes, dndRes, ringerRes, cpuFreqRes,
      kernelRes, localeRes, tzRes, usbRes,
      autoRotateRes,
    ] = await Promise.all([
      adb.execDevice(deviceId, ['shell', 'dumpsys', 'battery']),
      adb.execDevice(deviceId, ['shell', 'dumpsys', 'power']),
      adb.execDevice(deviceId, ['shell', 'uptime']),
      adb.execDevice(deviceId, ['shell', 'cat', '/proc/meminfo']),
      adb.execDevice(deviceId, ['shell', 'df', '/data']),
      adb.execDevice(deviceId, ['shell', 'cat', '/proc/loadavg']),
      adb.execDevice(deviceId, ['shell', 'getprop', 'ro.product.cpu.abi']),
      adb.execDevice(deviceId, ['shell', 'settings', 'get', 'system', 'screen_brightness']),
      adb.execDevice(deviceId, ['shell', 'settings', 'get', 'system', 'screen_off_timeout']),
      adb.execDevice(deviceId, ['shell', "dumpsys window windows 2>/dev/null | grep -m1 mCurrentFocus"]),
      adb.execDevice(deviceId, ['shell', 'wm', 'density']),
      adb.execDevice(deviceId, ['shell', "ip addr show wlan0 2>/dev/null | grep 'inet '"]),
      adb.execDevice(deviceId, ['shell', 'dumpsys', 'wifi']),
      adb.execDevice(deviceId, ['shell', 'cat', '/proc/net/dev']),
      adb.execDevice(deviceId, ['shell', 'cat', '/sys/class/thermal/thermal_zone0/temp']),
      adb.execDevice(deviceId, ['shell', 'settings', 'get', 'global', 'bluetooth_on']),
      adb.execDevice(deviceId, ['shell', 'settings', 'get', 'global', 'airplane_mode_on']),
      adb.execDevice(deviceId, ['shell', 'settings', 'get', 'global', 'mobile_data']),
      adb.execDevice(deviceId, ['shell', 'settings', 'get', 'secure', 'location_mode']),
      adb.execDevice(deviceId, ['shell', 'settings', 'get', 'global', 'zen_mode']),
      adb.execDevice(deviceId, ['shell', 'settings', 'get', 'global', 'ringer_mode']),
      adb.execDevice(deviceId, ['shell', 'cat', '/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq']),
      adb.execDevice(deviceId, ['shell', 'uname', '-r']),
      adb.execDevice(deviceId, ['shell', 'getprop', 'persist.sys.locale']),
      adb.execDevice(deviceId, ['shell', 'getprop', 'persist.sys.timezone']),
      adb.execDevice(deviceId, ['shell', 'getprop', 'sys.usb.state']),
      adb.execDevice(deviceId, ['shell', 'settings', 'get', 'system', 'accelerometer_rotation']),
    ]);

    const battery       = battRes.success     ? this.parseBattery(battRes.stdout)            : { level: null, temperature: null, charging: false, chargingType: 'N/A', chargingStatus: 'N/A' };
    const screenState   = powerRes.success    ? this.parseScreenState(powerRes.stdout)       : 'Unknown';
    const uptime        = uptimeRes.success   ? this.parseUptime(uptimeRes.stdout)           : 'Unknown';
    const memory        = memRes.success      ? this.parseMemory(memRes.stdout)              : null;
    const storage       = dfRes.success       ? this.parseStorage(dfRes.stdout)              : null;
    const cpuLoad       = loadRes.success     ? this.parseCpuLoad(loadRes.stdout)            : null;
    const cpuArch       = archRes.success     ? archRes.stdout.trim()                        : null;
    const brightness    = brightnessRes.success ? this.parseBrightness(brightnessRes.stdout) : null;
    const screenTimeout = timeoutRes.success  ? this.parseScreenTimeout(timeoutRes.stdout)   : null;
    const focusedApp    = focusRes.success    ? this.parseFocusedApp(focusRes.stdout)        : null;
    const density       = densityRes.success  ? this.parseDensity(densityRes.stdout)         : null;
    const wifiIp        = wifiIpRes.success   ? this.parseWifiIp(wifiIpRes.stdout)           : null;
    const wifiInfo      = wifiInfoRes.success ? this.parseWifiInfo(wifiInfoRes.stdout)       : null;
    const netTraffic    = netTrafficRes.success ? this.parseNetTraffic(netTrafficRes.stdout) : null;
    const thermalTemp   = thermalRes.success  ? this.parseThermal(thermalRes.stdout)         : null;
    const bluetooth     = btRes.success       ? (btRes.stdout.trim() === '1' ? 'ON' : 'OFF') : null;
    const airplaneMode  = airplaneRes.success ? (airplaneRes.stdout.trim() === '1' ? 'ON' : 'OFF') : null;
    const mobileData    = mobileDataRes.success ? (mobileDataRes.stdout.trim() === '1' ? 'ON' : 'OFF') : null;
    const gpsMode       = gpsRes.success      ? (() => {
      const MAP = { '0': 'Off', '1': 'Sensors only', '2': 'Battery saving', '3': 'High accuracy' };
      return MAP[gpsRes.stdout.trim()] || null;
    })() : null;
    const dnd           = dndRes.success      ? this.parseDND(dndRes.stdout)                 : null;
    const ringerMode    = ringerRes.success   ? this.parseRinger(ringerRes.stdout)           : null;
    const cpuFreq       = cpuFreqRes.success  ? this.parseCpuFreq(cpuFreqRes.stdout)         : null;
    const kernelVersion = kernelRes.success   ? kernelRes.stdout.trim()                      : null;
    const locale        = localeRes.success   ? localeRes.stdout.trim()                      : null;
    const timezone      = tzRes.success       ? tzRes.stdout.trim()                          : null;
    const usbState      = usbRes.success      ? usbRes.stdout.trim()                         : null;
    const autoRotate    = autoRotateRes.success ? (autoRotateRes.stdout.trim() === '1' ? 'ON' : 'OFF') : null;

    // Merge wifiIp into wifiInfo
    if (wifiInfo && wifiIp && !wifiInfo.ip) wifiInfo.ip = wifiIp;

    return {
      battery, screenState, uptime,
      memory, storage, cpuLoad, cpuArch, cpuFreq, kernelVersion,
      brightness, screenTimeout, density, autoRotate,
      focusedApp,
      wifiInfo: wifiInfo || (wifiIp ? { ip: wifiIp } : null),
      netTraffic, thermalTemp,
      bluetooth, airplaneMode, mobileData, gpsMode,
      dnd, ringerMode,
      locale, timezone, usbState,
      timestamp: Date.now(),
    };
  }
}

module.exports = { DeviceStatus };
