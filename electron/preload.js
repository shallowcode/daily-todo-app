/* ================================================================
 * 每日待办 · 预加载脚本
 * 安全暴露主进程 API 给渲染进程，contextIsolation 保护
 * ================================================================ */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  /* ----- 数据存储 ----- */
  getAll:        ()         => ipcRenderer.invoke('store:getAll'),
  setTasks:      (tasks)    => ipcRenderer.invoke('store:setTasks', tasks),
  setSettings:   (settings) => ipcRenderer.invoke('store:setSettings', settings),

  /* ----- 系统集成 ----- */
  setAutoLaunch: (enabled)  => ipcRenderer.invoke('app:setAutoLaunch', enabled),
  refreshTray:   ()         => ipcRenderer.send('settings:refresh-tray'),

  /* ----- 窗口控制 ----- */
  minimize: () => ipcRenderer.send('window:minimize'),
  hide:     () => ipcRenderer.send('window:hide'),
  close:    () => ipcRenderer.send('window:close'),

  /* ----- 主进程 → 渲染进程 通知 ----- */
  onSettingsChanged: (cb) => {
    const handler = (_e, settings) => cb(settings);
    ipcRenderer.on('settings:changed', handler);
    return () => ipcRenderer.removeListener('settings:changed', handler);
  }
});
