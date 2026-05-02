/* ================================================================
 * 主题模块
 *  - 三种模式：auto（按时间）/ light / dark
 *  - 自动模式下每分钟检查一次时间，平滑切换
 *  - 切换通过 [data-theme] 属性，所有 transition 自动生效
 * ================================================================ */

import { bus } from './util.js';
import { getSettings, updateSettings } from './store.js';

let currentTheme = 'light';     // 实际生效的主题（解析后）
let autoTimer = null;

/** 把 'HH:MM' 转为分钟数 */
const toMin = (s) => {
  const [h, m] = String(s || '06:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** 根据当前时间解析自动模式应该是什么主题 */
const resolveAuto = () => {
  const { dayStart, nightStart } = getSettings();
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const day = toMin(dayStart);
  const night = toMin(nightStart);
  if (day < night) {
    return (cur >= day && cur < night) ? 'light' : 'dark';
  } else {
    // 跨午夜：白天开始 > 夜晚开始
    return (cur >= day || cur < night) ? 'light' : 'dark';
  }
};

/** 应用主题 */
const apply = (theme) => {
  if (theme === currentTheme) return;
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  bus.emit('theme:applied', theme);
};

/** 重新计算并应用 */
export const refresh = () => {
  const { themeMode } = getSettings();
  const target = themeMode === 'auto' ? resolveAuto() : themeMode;
  apply(target);
};

const startAutoTimer = () => {
  stopAutoTimer();
  autoTimer = setInterval(refresh, 60_000);
};
const stopAutoTimer = () => {
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
};

/** 设置主题模式 */
export const setMode = async (mode) => {
  await updateSettings({ themeMode: mode });
  refresh();
  if (mode === 'auto') startAutoTimer();
  else stopAutoTimer();
};

/** 设置切换时间（自动模式有效） */
export const setSchedule = async (dayStart, nightStart) => {
  await updateSettings({ dayStart, nightStart });
  refresh();
};

/** 单击切换：在 light/dark 间切换，并切到非自动模式 */
export const toggle = async () => {
  const next = currentTheme === 'dark' ? 'light' : 'dark';
  await setMode(next);
};

/** 初始化 */
export const init = () => {
  refresh();
  if (getSettings().themeMode === 'auto') startAutoTimer();
  bus.on('settings:changed', refresh);
};

export const getCurrent = () => currentTheme;
