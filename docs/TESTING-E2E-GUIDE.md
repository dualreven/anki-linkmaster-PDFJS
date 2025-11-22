# 端到端测试指南（e2e 流程）

本指南说明如何将多个"集成步骤"编排为完整的端到端流程，从前端事件到后端数据库再回传前端的闭环验证（不使用浏览器）。

---

## 什么是本项目的 E2E 测试？

**本项目的 E2E 测试本质上是"连贯的集成测试流"，通过流程编排器将多个独立的集成测试步骤串联执行。**

### 关键特征

1. **无浏览器依赖**：使用 Node/Jest（前端段）+ PyTest（后端段），不启动浏览器
2. **分段式验证**：将完整流程拆解为 F（前端）、N（协议）、B（后端）、CT（契约）多个步骤
3. **工件传递**：每个步骤产生 JSON 工件（`AItemp/flows/.../step-*.json`），形成证据链
4. **流程编排**：通过 `run-flows.mjs` 编排器按顺序执行步骤，共享 `run_id`
5. **可追溯性**：每步都有时间戳、事件名、载荷、结果，便于定位问题

### 与集成测试的关系

- **集成测试（integ）**：单个步骤的独立验证（如 F1、N2、B3）
  - 示例：`integ:frontend:pdf-viewer:outline-create:F1` - 仅验证前端发出请求
  - 产物：`step-F1.json`
  - 可独立运行，不依赖其他步骤

- **E2E 测试（e2e）**：多个集成测试步骤的串联执行（F1 → N2 → B3 → CT → 汇总）
  - 示例：`e2e:flow:pdf-viewer:outline-create` - 验证从前端到后端的完整流程
  - 产物：`step-F1.json` + `step-N2.json` + `step-B3.json` + `summary.json`
  - 通过 `run_id` 串联所有步骤

**类比**：
- **集成测试** = 单个乐器的演奏（小提琴手独奏）
- **E2E 测试** = 多个乐器的协奏（交响乐团演奏，指挥家 = 流程编排器）

### 为什么不用传统的浏览器 E2E？

| 传统浏览器 E2E 的问题 | 本项目分段式 E2E 的优势 |
|---------------------|----------------------|
| ❌ 慢：启动浏览器耗时 | ✅ 快：纯 Node/Python，毫秒级 |
| ❌ 脆弱：UI 变动导致失败 | ✅ 稳定：基于协议，UI 变动不影响 |
| ❌ 难定位：失败后需要看截图/录像 | ✅ 易定位：每步有 JSON 工件，精确定位 |
| ❌ 不可拆分：一个测试覆盖太多 | ✅ 可组合：每段独立测试，灵活组装 |
| ❌ 环境依赖：需要浏览器、显卡等 | ✅ 轻量：仅需 Node + Python 环境 |

---

## 1. 总体思路
- 用“流程编排器”顺序或条件地触发：前端段（无浏览器）→ 协议/转发 → 后端断言 → 契约校验 → 汇总报告。
- 所有步骤共享同一个 `run_id`，并通过 `AItemp/flows/.../step-*.json` 串联证据链。
- 不使用环境变量：流程执行时仅读取 `tests/e2e/config/local.json` 与 CLI 参数。

## 2. 关键文件
- 流程编排器：`tests/e2e/runner/run-flows.mjs`
- Python 步骤执行器：`tests/e2e/runner/run-py-step.mjs`（以 `python_exe` 直接运行 PyTest）
- 契约校验器：`tests/e2e/runner/contract-check.mjs`
- 产物确认：`tests/e2e/runner/confirm-artifact.mjs`
- 流程模板：`tests/e2e/flows/index.example.json`
- 统一配置：`tests/e2e/config/local.json`

## 3. 命令与命名
- 单条流程：`pnpm run e2e:flow:<module>:<feature>`
  - 例如：`pnpm run e2e:flow:pdf-home:add-pdf`
- 批量流程：`pnpm run e2e:flow:all`（可选并发，建议在端口/资源允许时再开启）

## 4. 流程编排（示例：pdf-home:add-pdf）
- F1（前端段）：Node/Jest 触发“添加 PDF”对应的事件，发送 `pdf-home:add-pdf:requested`；落地 `step-F1.json`；更新 `latest.run`。
- N2（协议转发）：校验服务器入站 requested 与出站 completed/failed 的一一对应；落地 `step-N2.json`。
- PY3（后端断言）：使用 PyTest 查询 DB（如 sqlite），验证记录/字段正确；落地 `step-PY3.json`。
- F4（前端确认，可选）：再次读取协议回执或前端内存存根，做最终一致性确认；落地 `step-F4.json`。
- CT（契约）：根据 `event-mapping.json` 与 schema 校验消息命名与结构；落地 `step-CT.json`。
- 汇总：聚合所有 `step-*.json` 生成 `AItemp/reports/e2e/<run_id>/summary.{json,md}`（可在后续迭代完善）。

## 5. 一致性与防回归
- 事件命名在各步必须一致（如 `add-pdf:requested` → `add-pdf:completed`）；不允许临时别名或兜底。
- 若某步失败，编排器应：
  - 落地失败产物与错误详情；
  - 停止后续依赖步骤或切换到“失败分支”；
  - 输出最小复现场景（命令/参数/数据快照）。

## 6. 环境与依赖
- 后端进程需预先运行（端口见 `local.json`）；如需启动/重启，可在编排器中加“前后置钩子”。
- Python 通过 `local.json.python_exe` 指定虚拟环境解释器；runner 直接用绝对路径调用，不激活 venv。
- Node 版本由仓库 `package.json`/锁文件统一管理；无浏览器依赖。

## 7. 产物规范
- 必备字段：`run_id`、`step_id`、`event_name`、`ts_start`/`ts_end`、`pass`、`errors[]`、`evidence{}`。
- 文件编码 UTF-8、`\n` 换行；路径中不得含空格或非 ASCII（若必须，请进行 URL/路径转义）。

## 8. 报告与可视化
- 汇总器应统计：通过/失败、耗时、关键事件、证据索引（文件、日志定位行、请求/响应摘要）。
- 可选：将 `summary.json` 转为 HTML 报告或上传至 CI 工件中便于审阅。

## 9. 常见问题定位
- UI 步骤通过但协议失败：优先检查 `event-mapping.json` 与服务端日志（日志时钟与 `request_id` 对齐）。
- 协议通过但 DB 断言失败：核查后端入参/约束/事务提交；必要时扩大日志窗口或启用 JSONL 审计。
- DB 通过但前端最终状态不一致：前端需要一次“最终拉取”或订阅回执事件；检查事件名与数据字段是否完全匹配。
