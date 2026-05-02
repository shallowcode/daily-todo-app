/* ================================================================
 * 工具函数集合
 * ================================================================ */

export const $  = (sel, parent = document) => parent.querySelector(sel);
export const $$ = (sel, parent = document) => Array.from(parent.querySelectorAll(sel));

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** 把日期标准化为 'YYYY-MM-DD' */
export const dKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** 将 'YYYY-MM-DD' 解析为本地 Date 对象 */
export const parseKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

/** 根据日期键生成显示文案：统一为"X 月 X 日 · 周 X" */
export const formatDateLabel = (key) => {
  const d = parseKey(key);
  const w = WEEK[d.getDay()];
  return {
    short: `${d.getMonth() + 1} 月 ${d.getDate()} 日 · 周${w}`,
    full:  `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · 周${w}`,
    isToday: key === dKey()
  };
};

/** 节流：等待 ms 之后执行最后一次调用 */
export const debounce = (fn, ms = 200) => {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};

/** 极简事件总线，模块间解耦 */
export const bus = (() => {
  const map = new Map();
  return {
    on(event, fn) {
      if (!map.has(event)) map.set(event, new Set());
      map.get(event).add(fn);
      return () => map.get(event)?.delete(fn);
    },
    emit(event, payload) {
      map.get(event)?.forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } });
    }
  };
})();
