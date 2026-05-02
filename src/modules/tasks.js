/* ================================================================
 * 任务模块：渲染、添加、勾选、删除（按当前选中日期）
 *  - 任务排序：未完成在前 / 已完成在后；同组按创建时间倒序
 *  - 完成 / 取消完成会平滑滑动到新位置（FLIP 动画）
 * ================================================================ */

import { $, $$, uid, bus, dKey } from './util.js';
import { getTasks, setTasks } from './store.js';

const list = $('#taskList');
const empty = $('#emptyState');
const input = $('#taskInput');
const form = $('#addForm');

let activeDate = dKey();          // 当前展示的日期键
let isFirstRender = true;

const FLIP_DURATION = 360;
const FLIP_EASING = 'cubic-bezier(.4, 0, .2, 1)';

/* ----- 排序：未完成在前，同组内按创建时间倒序 ----- */
const sortTasks = (items) => [...items].sort((a, b) => {
  if (a.done !== b.done) return a.done ? 1 : -1;
  return (b.createdAt || 0) - (a.createdAt || 0);
});

/* ----- 设置当前日期 ----- */
export const setActiveDate = (key) => {
  activeDate = key;
  isFirstRender = true;            // 切换日期 → 整体淡入而非 FLIP
  render();
};
export const getActiveDate = () => activeDate;

/* ----- 创建一个 .task-item DOM ----- */
const createNode = (t) => {
  const li = document.createElement('li');
  li.className = `task-item ${t.done ? 'done' : ''}`;
  li.dataset.id = t.id;
  li.innerHTML = `
    <div class="checkbox" role="checkbox" aria-checked="${t.done}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
           stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
    <span class="task-text"></span>
    <button class="del-btn" title="删除">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
      </svg>
    </button>
  `;
  li.querySelector('.task-text').textContent = t.text;
  return li;
};

/* ----- 渲染：增量更新 DOM + FLIP 动画 ----- */
export function render() {
  const items = sortTasks(getTasks(activeDate));

  empty.classList.toggle('hidden', items.length > 0);

  /* —— 1. FLIP First：记录现有节点的位置 —— */
  const oldRects = new Map();
  if (!isFirstRender) {
    list.querySelectorAll('.task-item').forEach(el => {
      oldRects.set(el.dataset.id, el.getBoundingClientRect().top);
    });
  }

  /* —— 2. Diff 更新 DOM —— */
  const existing = new Map();
  list.querySelectorAll('.task-item').forEach(el => {
    existing.set(el.dataset.id, el);
  });

  const wantIds = new Set(items.map(t => t.id));

  // 移除多余节点（删除场景由调用方先做出场动画，再 render）
  existing.forEach((el, id) => {
    if (!wantIds.has(id)) el.remove();
  });

  // 按新顺序追加（已存在的会被移动而非重建，这是 appendChild 的特性）
  items.forEach((t, i) => {
    let el = existing.get(t.id);
    if (!el) {
      el = createNode(t);
      // 新节点：入场动画（淡入 + 上滑）
      el.style.animation = `itemIn ${FLIP_DURATION}ms ${FLIP_EASING} ${i * 30}ms backwards`;
    } else {
      // 复用：更新完成状态（不重建，FLIP 才能工作）
      el.classList.toggle('done', t.done);
      el.querySelector('.checkbox').setAttribute('aria-checked', t.done);
    }
    list.appendChild(el);          // 移动到正确位置
  });

  /* —— 3. FLIP Last + Invert + Play —— */
  if (!isFirstRender) {
    list.querySelectorAll('.task-item').forEach(el => {
      const oldTop = oldRects.get(el.dataset.id);
      if (oldTop == null) return;        // 新增节点已在 createNode 时配了入场动画
      const newTop = el.getBoundingClientRect().top;
      const dy = oldTop - newTop;
      if (Math.abs(dy) < 0.5) return;
      el.animate(
        [
          { transform: `translateY(${dy}px)` },
          { transform: 'translateY(0)' }
        ],
        { duration: FLIP_DURATION, easing: FLIP_EASING }
      );
    });
  } else {
    // 首次或切换日期：整体淡入
    list.style.animation = 'none';
    void list.offsetWidth;
    list.style.animation = `fadeSlide ${FLIP_DURATION}ms ${FLIP_EASING}`;
  }
  isFirstRender = false;
}

/* ----- 添加任务 ----- */
const addTask = (text) => {
  text = text.trim();
  if (!text) return;
  const items = getTasks(activeDate).slice();
  // 数据顺序：新加的放最前；FLIP 排序后会落到"未完成"组的最上方
  items.unshift({ id: uid(), text, done: false, createdAt: Date.now() });
  setTasks(activeDate, items);
};

/* ----- 切换完成（带勾选弹跳动画）----- */
const toggleTask = (id, li) => {
  const items = getTasks(activeDate).map(t =>
    t.id === id ? { ...t, done: !t.done, completedAt: !t.done ? Date.now() : null } : t
  );
  // 庆祝动画
  const target = items.find(t => t.id === id);
  if (target?.done) {
    const cb = li.querySelector('.checkbox');
    cb.classList.add('celebrate');
    setTimeout(() => cb.classList.remove('celebrate'), 320);
  }
  setTasks(activeDate, items);
};

/* ----- 删除任务（出场动画 → 数据更新）----- */
const deleteTask = (id, li) => {
  li.classList.add('removing');
  setTimeout(() => {
    const items = getTasks(activeDate).filter(t => t.id !== id);
    setTasks(activeDate, items);
  }, 280);
};

/* ----- 事件绑定 ----- */
form.addEventListener('submit', (e) => {
  e.preventDefault();
  addTask(input.value);
  input.value = '';
  input.focus();
});

list.addEventListener('click', (e) => {
  const li = e.target.closest('.task-item');
  if (!li) return;
  const id = li.dataset.id;

  if (e.target.closest('.checkbox')) { toggleTask(id, li); return; }
  if (e.target.closest('.del-btn')) { deleteTask(id, li); return; }
});

bus.on('tasks:changed', ({ dateKey }) => {
  if (dateKey === activeDate) render();
});

export const init = () => render();
