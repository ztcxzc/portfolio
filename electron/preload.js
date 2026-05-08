const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('adbAPI', {
  getDevices:       ()                            => ipcRenderer.invoke('adb:getDevices'),
  getDeviceStatus:  (deviceId)                    => ipcRenderer.invoke('adb:getDeviceStatus', deviceId),
  getDeviceInfo:    (deviceId)                    => ipcRenderer.invoke('adb:getDeviceInfo', deviceId),
  getScreenshot:    (deviceId)                    => ipcRenderer.invoke('adb:getScreenshot', deviceId),
  startStream:      (deviceId)                    => ipcRenderer.invoke('adb:startStream', deviceId),
  stopStream:       (deviceId)                    => ipcRenderer.invoke('adb:stopStream', deviceId),
  onStreamFrame:    (cb)                          => ipcRenderer.on('stream:frame', (_e, data) => cb(data)),
  offStreamFrame:   ()                            => ipcRenderer.removeAllListeners('stream:frame'),
  startScrcpy:      (deviceId)                    => ipcRenderer.invoke('adb:startScrcpy', deviceId),
  stopScrcpy:       (deviceId)                    => ipcRenderer.invoke('adb:stopScrcpy', deviceId),
  sendTap:          (deviceId, x, y)              => ipcRenderer.invoke('adb:sendTap', deviceId, x, y),
  sendKey:          (deviceId, keycode)           => ipcRenderer.invoke('adb:sendKey', deviceId, keycode),
  sendText:         (deviceId, text)              => ipcRenderer.invoke('adb:sendText', deviceId, text),
  restartServer:    ()                            => ipcRenderer.invoke('adb:restartServer'),
  connectWireless:  (host, port)                  => ipcRenderer.invoke('adb:connectWireless', host, port),
  pushFile:         (deviceId, local, remote)     => ipcRenderer.invoke('adb:pushFile', deviceId, local, remote),
  pullFile:         (deviceId, remote)            => ipcRenderer.invoke('adb:pullFile', deviceId, remote),
  listFiles:        (deviceId, path)              => ipcRenderer.invoke('adb:listFiles', deviceId, path),
  openFile:         ()                            => ipcRenderer.invoke('dialog:openFile'),
});
