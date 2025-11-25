/**
 * @file 搜索快捷键辅助工具
 * @module SearchShortcutHelper
 * @description
 * 提供统一的 Ctrl+F / Cmd+F 搜索快捷键绑定逻辑，避免在 pdf-home / pdf-viewer 中重复实现。
 */

/**
 * 安装全局搜索快捷键（Ctrl+F / Cmd+F）。
 *
 * @param {Object} options
 * @param {Function} options.onOpen - 当用户触发快捷键时调用的回调
 * @param {import('../../utils/logger.js').Logger} [options.logger] - 日志记录器
 * @param {string} [options.actorId="SearchShortcut"] - 调用方标识（仅用于日志）
 * @returns {Function} 取消绑定函数（调用后移除事件监听）
 */
export function setupGlobalSearchShortcut({ onOpen, logger, actorId = "SearchShortcut" } = {}) {
  if (typeof onOpen !== "function") {
    throw new Error("[SearchShortcut] onOpen callback is required");
  }

  const log = logger && typeof logger.info === "function" ? logger : null;

  const handler = (e) => {
    try {
      if (!e) {
        return;
      }
      const key = e.key || "";
      const ctrl = !!(e.ctrlKey || e.metaKey);

      if (ctrl && key.toLowerCase() === "f") {
        e.preventDefault();
        e.stopPropagation();
        try {
          log?.info?.("[SearchShortcut] Ctrl/Cmd+F intercepted", { actorId });
        } catch {
          // 忽略日志错误
        }
        try {
          onOpen();
        } catch (err) {
          try {
            log?.error?.("[SearchShortcut] onOpen callback failed", err);
          } catch {
            // 忽略日志错误
          }
        }
      }
    } catch {
      // 保持事件处理器健壮，不向外抛出
    }
  };

  document.addEventListener("keydown", handler);

  return function dispose() {
    try {
      document.removeEventListener("keydown", handler);
      try {
        log?.info?.("[SearchShortcut] Global shortcut listener removed", { actorId });
      } catch {
        // 忽略日志错误
      }
    } catch {
      // 忽略移除失败
    }
  };
}

