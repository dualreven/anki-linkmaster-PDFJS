# [pdf-viewer] outline/search 组合爆栈日志（延期修复）规格说明

**功能ID**: 20260110014111-outline-search-callstack-overflow-deferred-D  
**优先级**: 低  
**版本**: v001  
**创建时间**: 2026-01-10 01:41:11  
**状态**: 已记录（Deferred）

## 现状说明
- 用户确认：在 PDF Viewer 中“打开 search 后点击 outline 跳转”仍可触发爆栈日志。
- 当前不影响主路径使用，但日志污染明显。

## 存在问题
- 组合场景下触发 `Maximum call stack size exceeded`（递归/重入/循环事件链路的典型症状）。
- 缺少可重复、可自动化的最小回归测试用例。

## 提出需求
- 在不改变用户行为的前提下，消除该爆栈日志。
- 必须补 1 条最小回归测试，后续不得回归。

## 解决方案（占位，未来补齐）
- 先写最小复现测试（Jest/JSDOM 或更贴近 viewer wiring 的测试）。
- 再定位循环链路（outline 导航事件 ↔ search UI 状态事件 ↔ infra-nav/infra-ui 的重入保护）。
- 最小改动修复：打断循环/加幂等 guard/取消重入触发链路（禁止“静默兜底”）。

## 约束条件
### 仅修改本模块代码
- 仅允许修改 `src/frontend/pdf-viewer/**`（确需跨模块时必须在 spec 中明确新增范围并说明原因）。

### 严格遵循代码规范和标准
- 开发前必须阅读：`docs/SPEC/SPEC-HEAD-pdf-viewer.json` 与 `docs/SPEC/FRONTEND-EVENT-*.md`（事件生命周期/错误处理）。
- Fail-Fast：任何非预期行为必须显式失败，不允许隐式吞错兜底。

## 可行验收标准
### 单元测试
- 新增回归测试（必须）：覆盖 “search 打开 + outline 点击跳转” 场景，不再抛出爆栈异常。

### 门禁
- `pnpm -s run lint` ✅

