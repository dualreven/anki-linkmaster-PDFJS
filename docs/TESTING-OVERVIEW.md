# 测试模块使用指南总览

本文为本仓库测试体系的总览与入门，覆盖术语、分层、命名、目录与基础运行方式。配套细则见：
- 《docs/TESTING-INTEG-GUIDE.md》：集成测试（integ + contract/契约）
- 《docs/TESTING-E2E-GUIDE.md》：端到端测试（e2e 流程编排）

---

## ⚠️ 重要概念澄清

**本项目的"端到端测试（E2E）"是一种特殊形式的连贯集成测试，不同于传统的浏览器 E2E 测试。**

### 传统 E2E vs 本项目 E2E

| 维度 | 传统 E2E（Playwright/Selenium） | 本项目 E2E（分段式集成） |
|------|-------------------------------|------------------------|
| **执行环境** | 真实浏览器 | Node/Jest + PyTest（无浏览器） |
| **测试粒度** | 完整用户流程（黑盒） | 分段验证（白盒） |
| **测试速度** | 慢（秒级/分钟级） | 快（毫秒级） |
| **失败定位** | 难（需要截图/录像） | 易（每步有工件） |
| **可维护性** | 低（UI 变动频繁） | 高（协议稳定） |
| **本质** | UI 自动化测试 | **连贯的集成测试流** |

### 核心定义

- **集成测试步骤（integ）**：独立的测试单元，验证某一段逻辑（前端段/协议段/后端段）
- **E2E 测试（e2e）**：通过"流程编排器"将多个集成测试步骤串联执行，形成完整的数据流验证
- **工件传递（artifact）**：每个步骤产生 JSON 工件（`step-*.json`），下一步骤读取并验证
- **连贯性**：通过统一的 `run_id` 将所有步骤串联成证据链

**公式**：

```
E2E 测试 = 集成测试步骤1（F1） → 集成测试步骤2（N2） → 集成测试步骤3（B3） → ... → 汇总报告
```

**示例**：pdf-home 添加 PDF 的 E2E 流程

```
F1（前端段）→ N2（协议转发）→ PY3（后端断言）→ F4（前端确认）→ CT（契约）→ 汇总报告
   ↓              ↓                ↓                ↓              ↓
step-F1.json  step-N2.json    step-PY3.json    step-F4.json  step-CT.json
```

每个 `step-*.json` 都是独立的集成测试产物，E2E 流程通过 `run_id` 串联它们。

---

## 目标与原则
- 多语言一致性：前端（Node/Jest，无浏览器）、协议/中转（Node/Python）、后端（Python）共用同一套事件/协议约定。
- 无环境变量：所有配置以 JSON 或 CLI 参数传入；文件读写显式 UTF-8 与 `\n`。
- 可溯源：测试产物写入 `AItemp/`，每步落地 JSON 证据，形成全链路可追踪报告。
- 可组合：用“步骤化集成测试”验证各环节，再由 e2e 流程编排整合为一条完整链路。

## 测试分层
- 单元测试（unit）：函数/模块级，语言内各自完成（Jest/PyTest）。
- 集成测试（integ）：跨模块但不拉起整套 UI 的步骤化验证；含契约测试（ct）。
- 端到端测试（e2e）：从前端 UI/协议触发到后端 DB 完成并回传前端的完整流程。

## 统一命名（脚本/命令）
- 集成测试前缀：`integ:`；端到端前缀：`e2e:`；契约测试前缀：`ct:`。
- 推荐命名形如：
  - 前端段（无浏览器）：`integ:frontend:<module>:<feature>`（Node/Jest）
  - 协议/转发步骤：`integ:protocol:<module>:<feature>:relay`（Node 或 Python）
  - 后端断言步骤：`integ:backend:<module>:<feature>:db-assert`（PyTest）
  - 契约：`ct:<domain>:<module>:<feature>`（Node/Python，校验 schema/事件映射）
  - 端到端流程：`e2e:flow:<module>:<feature>`（Node 流程编排器串联上述步骤）

## 目录结构（关键）
- 配置：`tests/e2e/config/local.json`（端口、路径、python.exe）
- 事件映射：`tests/e2e/config/event-mapping.json`（requested→{completed|failed} 对应表）
- 流程模板：`tests/e2e/flows/index.example.json`
- 前端段：`tests/e2e/node/**`（Node/Jest·integ）
- 协议/中转：`tests/e2e/python/msgcenter/**` 或 `tests/e2e/node/**`
- 后端断言：`tests/e2e/python/backend/**`
- 编排/工具：`tests/e2e/runner/**`
- 产物：`AItemp/flows/<module>/<feature>/<run_id>/step-*.json` 与 `AItemp/reports/**`

## 配置与约束
- `tests/e2e/config/local.json` 示例键：
  - `ws_port`、`http_port`、`db_path`、`public_dir`、`python_exe`
- Python 必须使用虚拟环境解释器：通过 `python_exe` 指定绝对路径（不使用 activate）。
- 前端/后端事件名三段式：`{module}:{action}:{status}`；严格一致。

## 常用命令（示例）
- 前端段（Node/Jest）：`pnpm -s integ:frontend:pdf-viewer:outline-create:F1`
- 协议步骤（转发）：`pnpm run integ:protocol:pdf-home:add-pdf:relay`
- 后端步骤（DB 断言）：`pnpm run integ:backend:pdf-home:add-pdf:db-assert`
- 契约检查：`pnpm run ct:ws:pdf-home:add-pdf`
- 流程编排：`pnpm run e2e:flow:pdf-home:add-pdf`

## 产物与报告
- 每个步骤将写入 `AItemp/flows/.../step-<ID>.json`，并更新 `latest.run` 指针。
- e2e 流程结束聚合生成 `AItemp/reports/e2e/<run_id>/summary.{json,md}`（可在后续迭代补充）。

## 废弃说明
- 基于 QtWebEngine 的 E2E、注入式 GUI Launcher E2E 与 Playwright 浏览器用例均已废弃；请改用本指南所述“分段集成 + 流程编排”的架构。
