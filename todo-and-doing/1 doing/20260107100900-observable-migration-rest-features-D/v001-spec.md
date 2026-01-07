# 其余 Feature Observable 迁移推进（D）规格说明

**功能ID**: 20260107100900-observable-migration-rest-features-D
**优先级**: 中
**版本**: v001
**创建时间**: 2026-01-07 10:09:00
**预计完成**: 2026-01-08
**状态**: 设计中

## 现状说明
- `pdf-viewer/features` 中已完成 UI 订阅 store 的：`pdf-search`、`pdf-outline`、`infra-ui`、`infra-sidebar`。
- 仍偏事件/命令式驱动的：`pdf-resume`、`pdf-url-loader`、`pdf-translator`、`pdf-quick-actions`、`ai-assistant` 等。

## 存在问题
- 迁移缺少“样板路线图”：其他 Feature 可能重复造轮子、迁移顺序不统一。
- 小 Feature 的 TODO 容易长期搁置，形成隐性面条（例如 translator 获取当前页码的 TODO）。

## 提出需求
- 选取 1 个中等复杂度 Feature 作为“迁移样板”，完成从事件驱动到 `Manager+store` 的全链路迁移，并补齐回归测试。
- 同时产出“其余 Feature 的迁移清单”（按风险与收益排序），给后续迭代直接用。

## 解决方案
1) 选择样板 Feature（建议候选）：
   - `pdf-translator`（可落地 TODO：获取当前页码；并把 actions/UI 改为订阅 store）
   - 或 `pdf-resume`（把 resume flow 状态显式化为 store，减少事件分支）
2) 先写测试：确保 store 变化驱动 UI/行为；destroy 后无泄漏。
3) 实现 manager + store，并将 UI 改为 `store.subscribe`。
4) 产出迁移清单：列出剩余 Feature 的“现状/目标/改动点/潜在风险/建议测试点”。

## 约束条件
### 仅修改本模块代码
仅修改 `src/frontend/pdf-viewer/features/<选定Feature>/**` 与其测试；禁止跨 Feature 直接改动（避免与 A/B/C 冲突）。

### 严格遵循代码规范和标准
必须优先阅读和理解 `docs/SPEC/SPEC-HEAD-pdf-viewer.json` 下的规范与 refs。

## 可行验收标准
### 单元测试
- 样板 Feature：至少 2 条回归测试（store 驱动 + destroy 解绑）。
- 迁移清单：形成一份可直接执行的 markdown 清单（目录/验收要点明确）。

### 质量门禁
- `pnpm -s run lint` 通过
- `pnpm exec jest --runTestsByPath <本任务新增/改动用例>` 通过

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

