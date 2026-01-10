# KeyboardHandler 全局监听防泄漏规格说明

**功能ID**: 20260110175029-ui-keyboard-handler-singleton-E  
**优先级**: 中（P1）  
**版本**: v001  
**创建时间**: 2026-01-10 17:50:29  
**状态**: 设计中

## 现状说明
- scan-E 指出：`src/frontend/pdf-viewer/ui/keyboard-handler.js` 可能重复对 `document` 注册 `keydown` 监听，导致一键多发、多实例叠加。

## 存在问题
- 多实例/重建时容易出现重复监听 → 重复 emit → 行为放大且难排障。
- destroy 时未必覆盖到所有注册路径 → 内存泄漏与全局污染。

## 提出需求
1) 为 `KeyboardHandler` 增加“只注册一次”的 guard，并在 destroy/uninstall 中强制卸载。
2) 新增回归测试：重复 setup 不应重复 addEventListener；destroy 后应 removeEventListener。

## 解决方案
- 在 `KeyboardHandler` 内记录注册状态与解绑函数（或 subscriberId），保持 Fail-Fast。
- 测试使用 JSDOM + spy `document.addEventListener/removeEventListener`。

## 约束条件
### 仅修改本模块代码
- 仅允许修改：`src/frontend/pdf-viewer/ui/**`（必要时涉及 `core/lifecycle-manager.js` 的调用点，需在 working-log 解释原因）

## 可行验收标准
### 单元测试
- 新增/更新 Jest 测试通过，并在 working-log 记录测试路径。

