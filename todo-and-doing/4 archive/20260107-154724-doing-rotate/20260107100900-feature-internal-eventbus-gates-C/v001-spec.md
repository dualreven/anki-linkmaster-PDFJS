# Feature 内部 EventBus 约束收紧（C）规格说明

**功能ID**: 20260107100900-feature-internal-eventbus-gates-C
**优先级**: 中
**版本**: v001
**创建时间**: 2026-01-07 10:09:00
**预计完成**: 2026-01-08
**状态**: 设计中

## 现状说明
- 已存在门禁：`custom/no-eventbus-subscription-in-manager`（禁止在 `*.manager*.js` 订阅 EventBus）。
- 目前仍允许 Feature 内部通过 EventBus 做 UI 更新闭环（例如 annotation/anchor），导致“混合态”长期存在。

## 存在问题
- 缺少明确的“Feature 内部通讯”规范落地：UI ↔ Manager 的最佳实践虽已出现（search/outline/infra-ui），但没有制度化约束，容易回退。

## 提出需求
- 明确并落地一条可执行规则：Feature 内部（UI ↔ Manager）必须以 `ObservableState` 为主，EventBus 只用于跨 Feature/跨窗口桥接。
- 在代码与门禁层面给出“最低限度”的可自动化检查，避免回归。

## 解决方案
1) 文档化规则：在 `docs/standards/` 或 memory bank 记录“Feature 内部事件禁止闭环”的准则与例外清单。
2) 轻量门禁（优先脚本而非复杂 ESLint AST）：
   - 新增 CI 脚本扫描 `src/frontend/pdf-viewer/features/**` 下的“Feature 内部 EventBus 订阅热点”（按白名单/例外过滤）。
   - 输出报告并在门禁中 fail（仅对新增增量或明确黑名单目录生效，避免一次性全仓阻塞）。
3) 提供迁移指引：给出 `store.subscribe` 的标准写法、unsubscribe 的标准模式、以及测试模板。

## 约束条件
### 仅修改本模块代码
仅修改 `scripts/ci/**`、`docs/**`、`src/frontend/common/**` 中与门禁/指引相关内容；禁止直接改动业务 Feature（避免与 A/B/D 冲突）。

### 严格遵循代码规范和标准
必须优先阅读和理解 `docs/SPEC/SPEC-HEAD-coding.json`、`docs/SPEC/SPEC-HEAD-TEST.json`、`docs/SPEC/SPEC-HEAD-pdf-viewer.json` 中相关约束。

## 可行验收标准
### 单元测试
- 若新增脚本/规则，必须有至少 1 条测试或自验证用例（例如对一组 fixture 文件的扫描结果断言）。

### 质量门禁
- `pnpm -s run lint` 通过
- `pnpm exec jest --runTestsByPath <本任务新增/改动用例>` 通过（如涉及 jest 测试）

## 协作协议（并行开发提速版，必须遵守）
本项目的“并行”目标是：**各分支并行排雷，主干一次性集成验收**，避免在合并阶段才补交付物。

### 完成定义（DoD：没有 commit hash 就不算完成）
- 必须提交到对应 worktree 分支（工作区干净），并给出 **commit hash**。
- 必须通过最小验收：`pnpm -s run lint` + “本任务新增/改动的测试文件集”。
- 必须在 `working-log.md` 写明：改动范围（目录）、验收命令与结果、风险点（如跨模块边界）。

### 合入 main 的交付格式（复制这段到群里/issue）
- `commit(s)`: `<hash1> <hash2>`
- `scope`: `<只改动的目录列表>`
- `tests`: `<lint命令>` + `<jest --runTestsByPath ...>`（贴出通过结论）
- `notes`: `<是否触碰跨模块契约/是否需要人工点检>`

### 集成方式（主干一次性验证）
- 默认不做 rebase；**main 仅 cherry-pick 功能提交**（避免把“同步 main 的提交”二次合并）。
- main 侧只跑一次门禁：`lint` + `jest --runTestsByPath <四个任务新增测试并集>`；通过即合入。

