/* ================================================================
 * 设置面板模块
 *  - 主题模式 / 切换时间 / 始终置顶 / 开机自启
 * ================================================================ */

import { $, $$, bus } from './util.js';
import { getSettings, updateSettings, setAutoLaunch } from './store.js';
import * as theme from './theme.js';

const panel = $('#settingsPanel');
const openBtn = $('#settingsBtn');
const closeBtn = $('#settingsClose');

const themeSeg = $('#themeMode');
const dayStart = $('#dayStart');
const nightStart = $('#nightStart');
const autoTimeGroup = $('#autoTimeGroup');
const alwaysOnTop = $('#alwaysOnTop');
const autoLaunch = $('#autoLaunch');

const open = () => { panel.hidden = false; sync(); };
const close = () => { panel.hidden = true; };

/** 把当前设置同步到 UI */
const sync = () => {
  const s = getSettings();
  $$('.seg-btn', themeSeg).forEach(b =>
    b.classList.toggle('active', b.dataset.mode === s.themeMode)
  );
  dayStart.value = s.dayStart;
  nightStart.value = s.nightStart;
  alwaysOnTop.checked = !!s.alwaysOnTop;
  autoLaunch.checked = !!s.autoLaunch;
  autoTimeGroup.classList.toggle('disabled', s.themeMode !== 'auto');
};

/* ----- 事件绑定 ----- */
openBtn.addEventListener('click', open);
closeBtn.addEventListener('click', close);

themeSeg.addEventListener('click', async (e) => {
  const btn = e.target.closest('.seg-btn');
  if (!btn) return;
  await theme.setMode(btn.dataset.mode);
  sync();
});

const onTimeChange = async () => {
  await theme.setSchedule(dayStart.value, nightStart.value);
};
dayStart.addEventListener('change', onTimeChange);
nightStart.addEventListener('change', onTimeChange);

alwaysOnTop.addEventListener('change', async (e) => {
  await updateSettings({ alwaysOnTop: e.target.checked });
  if (window.api?.refreshTray) window.api.refreshTray();
});

autoLaunch.addEventListener('change', async (e) => {
  await setAutoLaunch(e.target.checked);
  if (window.api?.refreshTray) window.api.refreshTray();
  // 实际状态可能与请求不同（系统拒绝），重新同步
  sync();
});

/* 主进程或托盘改了设置 → 更新 UI */
bus.on('settings:changed', () => {
  if (!panel.hidden) sync();
});

export const init = () => sync();
