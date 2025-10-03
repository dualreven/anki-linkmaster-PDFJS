/**
 * @file 事件名称辅助工具
 * @module EventNameHelpers
 * @description 提供辅助函数来创建符合规范的事件名称，防止格式错误
 *
 * ⚠️ 重要规则：事件名称必须严格遵循三段式格式
 * 格式：{module}:{action}:{status}
 *
 * 示例：
 * - pdf:load:completed ✅
 * - bookmark:toggle:requested ✅
 * - sidebar:open:success ✅
 * - loadData ❌ (缺少冒号)
 * - pdf:list:data:loaded ❌ (超过3段)
 */

/**
 * 事件状态常量（第3段）
 * @enum {string}
 */
export const EventStatus = {
  // 请求类
  REQUESTED: 'requested',      // 请求执行某操作

  // 完成类
  COMPLETED: 'completed',      // 操作成功完成
  SUCCESS: 'success',          // 操作成功（语义同completed）
  FAILED: 'failed',            // 操作失败
  ERROR: 'error',              // 发生错误

  // 进行类
  STARTED: 'started',          // 操作开始
  PROGRESS: 'progress',        // 操作进行中
  UPDATED: 'updated',          // 状态已更新

  // 取消类
  CANCELED: 'canceled',        // 操作被取消
  ABORTED: 'aborted',          // 操作被中止
};

/**
 * 常用模块名称（第1段）
 * @enum {string}
 */
export const EventModule = {
  PDF: 'pdf',
  PDF_VIEWER: 'pdf-viewer',
  BOOKMARK: 'bookmark',
  ANNOTATION: 'annotation',
  SIDEBAR: 'sidebar',
  SEARCH: 'search',
  NAVIGATION: 'navigation',
  WEBSOCKET: 'websocket',
  UI: 'ui',
};

/**
 * 常用动作名称（第2段）
 * @enum {string}
 */
export const EventAction = {
  LOAD: 'load',
  SAVE: 'save',
  DELETE: 'delete',
  CREATE: 'create',
  UPDATE: 'update',
  TOGGLE: 'toggle',
  OPEN: 'open',
  CLOSE: 'close',
  NAVIGATE: 'navigate',
  SEARCH: 'search',
  RENDER: 'render',
};

/**
 * 创建符合规范的事件名称
 *
 * @param {string} module - 模块名称（小写，使用连字符）
 * @param {string} action - 动作名称（小写，使用连字符）
 * @param {string} status - 状态名称（小写，使用连字符）
 * @returns {string} 格式化的事件名称
 * @throws {Error} 如果任何参数为空或包含非法字符
 *
 * @example
 * // 使用字符串参数
 * const eventName = createEventName('pdf', 'load', 'completed');
 * // 返回: 'pdf:load:completed'
 *
 * @example
 * // 使用常量（推荐）
 * const eventName = createEventName(
 *   EventModule.PDF,
 *   EventAction.LOAD,
 *   EventStatus.COMPLETED
 * );
 * // 返回: 'pdf:load:completed'
 */
export function createEventName(module, action, status) {
  // 验证参数
  const parts = [module, action, status];
  const partNames = ['module', 'action', 'status'];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const name = partNames[i];

    if (!part || typeof part !== 'string') {
      throw new Error(
        `❌ createEventName() 错误：${name} 必须是非空字符串，但收到了：${typeof part} (${part})`
      );
    }

    // 检查是否包含冒号
    if (part.includes(':')) {
      throw new Error(
        `❌ createEventName() 错误：${name} 不能包含冒号，但收到了：'${part}'`
      );
    }

    // 检查是否为小写+连字符格式
    if (!/^[a-z][a-z0-9-]*$/.test(part)) {
      throw new Error(
        `❌ createEventName() 错误：${name} 必须是小写字母开头，只能包含小写字母、数字和连字符，但收到了：'${part}'`
      );
    }
  }

  return `${module}:${action}:${status}`;
}

/**
 * 验证事件名称格式是否正确
 *
 * @param {string} eventName - 要验证的事件名称
 * @returns {{ valid: boolean, error?: string }} 验证结果
 *
 * @example
 * const result = validateEventName('pdf:load:completed');
 * // { valid: true }
 *
 * @example
 * const result = validateEventName('loadData');
 * // { valid: false, error: '事件名称格式不正确...' }
 */
export function validateEventName(eventName) {
  if (typeof eventName !== 'string' || !eventName) {
    return {
      valid: false,
      error: `事件名称必须是非空字符串，但收到了：${typeof eventName} (${eventName})`
    };
  }

  const parts = eventName.split(':');

  if (parts.length !== 3) {
    return {
      valid: false,
      error: `事件名称必须正好3段，但 '${eventName}' 有 ${parts.length} 段`
    };
  }

  if (parts.some(p => !p)) {
    return {
      valid: false,
      error: `事件名称的各部分不能为空：'${eventName}'`
    };
  }

  return { valid: true };
}

/**
 * 解析事件名称为各个部分
 *
 * @param {string} eventName - 事件名称
 * @returns {{ module: string, action: string, status: string }} 解析结果
 * @throws {Error} 如果事件名称格式不正确
 *
 * @example
 * const parts = parseEventName('pdf:load:completed');
 * // { module: 'pdf', action: 'load', status: 'completed' }
 */
export function parseEventName(eventName) {
  const result = validateEventName(eventName);

  if (!result.valid) {
    throw new Error(`❌ parseEventName() 错误：${result.error}`);
  }

  const [module, action, status] = eventName.split(':');

  return { module, action, status };
}

/**
 * 创建带命名空间的事件名称（用于ScopedEventBus）
 *
 * @param {string} namespace - 命名空间（如功能域名称）
 * @param {string} module - 模块名称
 * @param {string} action - 动作名称
 * @param {string} status - 状态名称
 * @returns {string} 带命名空间的事件名称
 *
 * @example
 * const eventName = createNamespacedEventName(
 *   'pdf-viewer',
 *   'bookmark',
 *   'load',
 *   'completed'
 * );
 * // 返回: '@pdf-viewer/bookmark:load:completed'
 */
export function createNamespacedEventName(namespace, module, action, status) {
  const eventName = createEventName(module, action, status);
  return `@${namespace}/${eventName}`;
}
