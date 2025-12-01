/**
 * @file Event gate 执行辅助工具（pdf-viewer 复用 common 实现）
 * @description
 * 为保持向后兼容，pdf-viewer 模块通过 re-export 方式复用
 * `src/frontend/common/ws/ws-gate-runner.js` 中的通用实现。
 */

export {
  createEventStatusStore,
  markEventFired,
  runWithGate
} from "../../common/ws/ws-gate-runner.js";
