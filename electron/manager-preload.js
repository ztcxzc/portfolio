const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('portfolioAPI', {
  getProjects:    ()        => ipcRenderer.invoke('portfolio:getProjects'),
  saveProject:    (project) => ipcRenderer.invoke('portfolio:saveProject', project),
  deleteProject:  (id)      => ipcRenderer.invoke('portfolio:deleteProject', id),
  getDataPath:    ()        => ipcRenderer.invoke('portfolio:getDataPath'),
  exportProjects: ()        => ipcRenderer.invoke('portfolio:exportProjects'),
});
