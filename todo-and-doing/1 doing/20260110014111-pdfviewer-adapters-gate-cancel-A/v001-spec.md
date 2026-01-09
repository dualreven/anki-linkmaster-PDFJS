# [pdf-viewer][A] adapters：gate/destroy 竞态收敛规格说明

**功能ID**: 20260110014111-pdfviewer-adapters-gate-cancel-A  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-10 01:41:11  
**状态**: 开发中

## 现状说明
- 扫描报告指出：`adapters` 存在 fire-and-forget 异步路径，`destroy()` 期间可能触发竞态与未捕获错误。
- adapters 内部存在订阅清理风险（需要统一清理策略）。

## 存在问题
- gate 等待期间 destroy 可能导致回调继续执行，引发异常或残留订阅。

## 提出需求
- 让 adapters 的“等待/异步处理”具备可取消能力，并确保 destroy 后不再触发任何业务副作用。
- 必须补 1 条最小回归测试防回归。

## 解决方案（建议）
- 为 gate/等待路径引入明确的取消信号（例如 AbortSignal 或内部 `#isDestroyed` guard + 统一 early-return）。
- 订阅清理：统一从 handler 返回 cleanup（函数/数组），由装配层集中执行（避免漏 add）。

## 约束条件
### 仅修改本模块代码
- 仅允许修改：`src/frontend/pdf-viewer/adapters/**`

### 严格遵循代码规范和标准
- 必须阅读：`docs/SPEC/SPEC-HEAD-pdf-viewer.json`
- Fail-Fast：输入不合法直接抛错/返回错误；禁止“吞掉异常后继续执行”。

## 可行验收标准
### 单元测试（必须新增）
- 建议新增：`src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.gate-destroy.regression.test.js`
- 断言：gate 等待中调用 destroy，不抛异常且不残留订阅/定时器。

### 门禁
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath <本任务新增测试文件路径>` ✅

