/* ================================================================
 * 月历 popover：选择任意日期切换待办视图
 * ================================================================ */

import { $, dKey, parseKey, formatDateLabel, bus } from './util.js';
import { datesWithTasks } from './store.js';

const panel = $('#calendarPanel');
const grid  = $('#calGrid');
const title = $('#calTitle');
const dateBtn = $('#dateBtn');
const dateLabel = $('#dateLabel');

let cursor = new Date();      // 当前展示月
let selected = dKey();        // 当前选中日期
let onSelectCallback = () => {};

/** 设置选中日期回调 */
export const onSelect = (cb) => { onSelectCallback = cb; };

const render = () => {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  title.textContent = `${year} 年 ${month + 1} 月`;

  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;     // 周一为 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev  = new Date(year, month, 0).getDate();

  const today = dKey();
  const has = new Set(datesWithTasks());
  const cells = [];

  for (let i = startOffset; i > 0; i--) {
    const d = daysInPrev - i + 1;
    cells.push(makeCell(d, dKey(new Date(year, month - 1, d)), true, today, has));
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(makeCell(d, dKey(new Date(year, month, d)), false, today, has));
  }
  const tail = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= tail; d++) {
    cells.push(makeCell(d, dKey(new Date(year, month + 1, d)), true, today, has));
  }

  grid.innerHTML = cells.join('');
};

const makeCell = (d, key, muted, today, hasSet) => {
  const cls = ['cal-cell'];
  if (muted) cls.push('muted');
  if (key === today) cls.push('today');
  if (key === selected) cls.push('selected');
  if (hasSet.has(key)) cls.push('has-task');
  return `<div class="${cls.join(' ')}" data-key="${key}">${d}</div>`;
};

/** 选中并通知 */
const select = (key) => {
  selected = key;
  cursor = parseKey(key);
  render();
  updateDateButton(key);
  onSelectCallback(key);
};

/** 更新顶部日期按钮文本 + 高亮 */
export const updateDateButton = (key) => {
  const { short, isToday } = formatDateLabel(key);
  dateLabel.textContent = short;
  dateBtn.classList.toggle('active', !isToday);
};

/** 打开/关闭月历 */
export const toggle = (open) => {
  const next = open ?? panel.hidden;
  if (next) {
    panel.hidden = false;
    cursor = parseKey(selected);
    render();
  } else {
    panel.hidden = true;
  }
  dateBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
};

export const close = () => toggle(false);

/** 程序设置选中（外部调用，不触发 onSelect） */
export const setSelected = (key) => {
  selected = key;
  cursor = parseKey(key);
  updateDateButton(key);
  if (!panel.hidden) render();
};

/* ----- 事件绑定 ----- */
dateBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  toggle();
});

$('#calPrev').addEventListener('click', () => {
  cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
  render();
});
$('#calNext').addEventListener('click', () => {
  cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  render();
});
$('#calToday').addEventListener('click', () => {
  select(dKey());
});

grid.addEventListener('click', (e) => {
  const cell = e.target.closest('.cal-cell');
  if (!cell) return;
  select(cell.dataset.key);
});

document.addEventListener('click', (e) => {
  if (!panel.hidden && !panel.contains(e.target) && !dateBtn.contains(e.target)) {
    close();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !panel.hidden) close();
});

/* 任务变化时刷新月历的小圆点 */
bus.on('tasks:changed', () => {
  if (!panel.hidden) render();
});
