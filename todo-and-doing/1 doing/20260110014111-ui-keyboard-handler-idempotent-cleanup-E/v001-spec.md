# [pdf-viewer][E] ui：KeyboardHandler 监听幂等 + 卸载对称规格说明

**功能ID**: 20260110014111-ui-keyboard-handler-idempotent-cleanup-E  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-10 01:41:11  
**状态**: 开发中

## 现状说明
- 扫描报告指出：`KeyboardHandler` 在某些情况下会直接对 `document` 注册 `keydown`，若重复初始化可能导致重复监听与多次 emit。

## 存在问题
- 缺少“只注册一次 + destroy 必卸载”的幂等保障与回归测试。

## 提出需求
- 让 `KeyboardHandler` 满足：
  - `setupEventListener()` 幂等（重复调用不重复 add）；
  - `destroy()/removeEventListener()` 必定对称 remove；
  - 不允许 destroy 后仍能触发 emit。
- 必须补 1 条回归测试防回归。

## 解决方案（建议）
- 采用内部 flag/保存 unsubscribe 的方式，保证 add/remove 成对。
- 用 spy `document.addEventListener/removeEventListener` + 触发事件验证。

## 约束条件
### 仅修改本模块代码
- 仅允许修改：`src/frontend/pdf-viewer/ui/keyboard-handler.js`（及对应 `__tests__`）

### 严格遵循代码规范和标准
- 必须阅读：`docs/SPEC/SPEC-HEAD-pdf-viewer.json`
- Fail-Fast：重复注册/缺失卸载应通过测试被捕捉，禁止默默继续。

## 可行验收标准
### 单元测试（必须新增）
- 新增回归测试：重复 setup 不重复 add；destroy 后 keydown 不触发 emit。

### 门禁
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath <本任务新增测试文件路径>` ✅

