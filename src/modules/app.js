/* ================================================================
 * 应用入口：装配各模块、处理日期切换、窗口控制
 * ================================================================ */

import { $, dKey, parseKey, bus } from './util.js';
import * as store from './store.js';
import * as theme from './theme.js';
import * as tasks from './tasks.js';
import * as calendar from './calendar.js';
import * as settings from './settings.js';

(async () => {
  await store.load();

  /* ----- 初始化各模块 ----- */
  theme.init();
  tasks.init();
  settings.init();

  /* ----- 切换日期联动 ----- */
  let activeDate = dKey();

  const switchDate = (key) => {
    activeDate = key;
    tasks.setActiveDate(key);
    calendar.setSelected(key);
  };

  calendar.onSelect((key) => switchDate(key));
  calendar.setSelected(activeDate);

  /* ----- 每分钟检测：日期变了 → 自动切到新的"今天" ----- */
  const tickTimer = setInterval(() => {
    const today = dKey();
    if (activeDate !== today) {
      // 仅当用户停留在"昨天的今天"时，跨午夜后才自动跟到新今天
      const last = parseKey(activeDate);
      const now = parseKey(today);
      const diff = (now - last) / 86400000;
      if (Math.abs(diff) === 1 && diff > 0) {
        switchDate(today);
      }
    }
    calendar.updateDateButton(activeDate);
  }, 60_000);

  /* ----- 主题按钮：单击切换亮/暗（脱离 auto） ----- */
  $('#themeBtn').addEventListener('click', () => theme.toggle());

  /* ----- 窗口控制按钮 ----- */
  $('#minBtn').addEventListener('click', () => window.api?.minimize());
  $('#closeBtn').addEventListener('click', () => window.api?.hide());

  /* ----- 阻止默认拖放、右键菜单（更像应用） ----- */
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  /* ----- 退出清理（可选） ----- */
  window.addEventListener('beforeunload', () => clearInterval(tickTimer));
})();
