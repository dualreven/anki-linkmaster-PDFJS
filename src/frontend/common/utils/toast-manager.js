/**
 * 简易堆叠式 Toast 管理器（左上角）
 * - 支持 info/success/error 类型
 * - 支持可选自动关闭时长，0 表示不自动关闭
 * - 返回 toastId，可用于更新/关闭
 */

import { getLogger } from './logger.js';

const logger = getLogger('ToastManager');

class ToastManager {
  constructor() {
    this._container = null;
    this._seq = 1;
    this._toasts = new Map();
    this._ensureContainer();
    this._injectStylesOnce();
  }

  _ensureContainer() {
    if (this._container && document.body.contains(this._container)) return;
    const container = document.createElement('div');
    // 统一右上角堆叠
    container.id = 'toast-container-top-right';
    container.setAttribute('role', 'status');
    container.style.position = 'fixed';
    container.style.right = '12px';
    container.style.top = '12px';
    container.style.zIndex = '9999';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '8px';
    document.body.appendChild(container);
    this._container = container;
  }

  _injectStylesOnce() {
    if (document.getElementById('toast-manager-styles')) return;
    const style = document.createElement('style');
    style.id = 'toast-manager-styles';
    style.type = 'text/css';
    // 保持样式尽量轻量，避免全局污染
    style.appendChild(document.createTextNode(`
      .toast-item{min-width:200px;max-width:420px;padding:10px 12px;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.15);color:#fff;font-size:13px;line-height:1.4;opacity:0;transform:translateY(-6px);transition:opacity .16s ease,transform .16s ease}
      .toast-item.show{opacity:1;transform:translateY(0)}
      .toast-info{background:#2b6cb0}
      .toast-success{background:#2f855a}
      .toast-error{background:#c53030}
      .toast-close{margin-left:8px;cursor:pointer;color:rgba(255,255,255,.85)}
      .toast-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
      .toast-msg{word-break:break-all}
    `));
    document.head.appendChild(style);
  }

  _createNode(message, type) {
    const el = document.createElement('div');
    el.className = `toast-item toast-${type}`;
    const row = document.createElement('div');
    row.className = 'toast-row';
    const span = document.createElement('span');
    span.className = 'toast-msg';
    span.textContent = message;
    const close = document.createElement('span');
    close.className = 'toast-close';
    close.textContent = '×';
    close.title = '关闭';
    close.addEventListener('click', () => {
      try { this.dismiss(el._toastId); } catch (e) { /* ignore */ }
    });
    row.appendChild(span);
    row.appendChild(close);
    el.appendChild(row);
    return el;
  }

  show(message, { type = 'info', duration = 3000 } = {}) {
    try {
      this._ensureContainer();
      const id = this._seq++;
      const node = this._createNode(message, this._normalizeType(type));
      node._toastId = id;
      this._container.appendChild(node);
      // 触发进入动画
      requestAnimationFrame(() => node.classList.add('show'));
      let timer = null;
      if (duration > 0) {
        timer = setTimeout(() => this.dismiss(id), duration);
      }
      this._toasts.set(id, { node, timer });
      return id;
    } catch (e) {
      logger.warn('Toast show failed', { error: e?.message });
      return -1;
    }
  }

  update(id, { message, type, duration } = {}) {
    const t = this._toasts.get(id);
    if (!t) return false;
    const { node, timer } = t;
    if (typeof message === 'string') {
      const span = node.querySelector('.toast-msg');
      if (span) span.textContent = message;
    }
    if (type) {
      node.classList.remove('toast-info', 'toast-success', 'toast-error');
      node.classList.add(`toast-${this._normalizeType(type)}`);
    }
    if (typeof duration === 'number') {
      if (timer) clearTimeout(timer);
      t.timer = duration > 0 ? setTimeout(() => this.dismiss(id), duration) : null;
    }
    return true;
  }

  dismiss(id) {
    const t = this._toasts.get(id);
    if (!t) return false;
    const { node, timer } = t;
    if (timer) clearTimeout(timer);
    node.classList.remove('show');
    // 等动画结束再移除
    setTimeout(() => {
      try {
        node.remove();
      } catch (_) {}
    }, 160);
    this._toasts.delete(id);
    return true;
  }

  _normalizeType(type) {
    switch (String(type)) {
      case 'success':
      case 'error':
      case 'info':
        return type;
      default:
        return 'info';
    }
  }
}

let _singleton = null;
export function getToastManager() {
  if (!_singleton) _singleton = new ToastManager();
  return _singleton;
}

export default { getToastManager };
