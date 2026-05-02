/* ================================================================
 * 数据存储模块（统一抽象）
 *  - 在 Electron 环境下走主进程 IPC（保存到 userData/data.json）
 *  - 在浏览器环境下回退到 localStorage（便于开发预览）
 * ================================================================ */

import { bus, debounce } from './util.js';

const HAS_API = typeof window !== 'undefined' && !!window.api;
const LS_KEY = 'dt.app.v1';

const DEFAULT = {
  tasks: {},
  settings: {
    alwaysOnTop: true,
    autoLaunch: false,
    themeMode: 'auto',
    dayStart: '06:00',
    nightStart: '19:00',
    windowX: null,
    windowY: null
  }
};

let state = structuredClone(DEFAULT);

/** 加载初始数据 */
export async function load() {
  if (HAS_API) {
    const data = await window.api.getAll();
    state = {
      tasks: data.tasks || {},
      settings: { ...DEFAULT.settings, ...(data.settings || {}) }
    };
  } else {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state = {
          tasks: parsed.tasks || {},
          settings: { ...DEFAULT.settings, ...(parsed.settings || {}) }
        };
      }
    } catch (e) { console.error(e); }
  }
  bus.emit('store:loaded', state);
  return state;
}

const persistTasks = debounce(() => {
  if (HAS_API) window.api.setTasks(state.tasks);
  else localStorage.setItem(LS_KEY, JSON.stringify(state));
}, 250);

const persistSettings = () => {
  if (HAS_API) window.api.setSettings(state.settings);
  else localStorage.setItem(LS_KEY, JSON.stringify(state));
};

/* ----- 公开 API ----- */
export const getState = () => state;

export const getTasks = (dateKey) => state.tasks[dateKey] || [];

export const setTasks = (dateKey, list) => {
  if (list.length === 0) delete state.tasks[dateKey];
  else state.tasks[dateKey] = list;
  persistTasks();
  bus.emit('tasks:changed', { dateKey, list });
};

export const datesWithTasks = () => Object.keys(state.tasks)
  .filter(k => state.tasks[k] && state.tasks[k].length > 0);

export const getSettings = () => ({ ...state.settings });

export const updateSettings = async (patch) => {
  state.settings = { ...state.settings, ...patch };
  persistSettings();
  bus.emit('settings:changed', state.settings);
  return state.settings;
};

/** 将 autoLaunch 同步到操作系统 */
export const setAutoLaunch = async (enabled) => {
  if (HAS_API) {
    const real = await window.api.setAutoLaunch(enabled);
    state.settings.autoLaunch = real;
    bus.emit('settings:changed', state.settings);
    return real;
  } else {
    return updateSettings({ autoLaunch: enabled }).then(s => s.autoLaunch);
  }
};

/* ----- 监听主进程推送的设置变化（如托盘菜单点击） ----- */
if (HAS_API && window.api.onSettingsChanged) {
  window.api.onSettingsChanged((settings) => {
    state.settings = { ...state.settings, ...settings };
    bus.emit('settings:changed', state.settings);
  });
}
