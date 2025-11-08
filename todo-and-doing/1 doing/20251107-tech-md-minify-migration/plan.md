# tech.md 极简化迁移计划（执行表）

说明：将原 tech.md 的详细内容迁移到 docs 下的专题文档。本表跟踪迁移状态与负责人。

| 序号 | 主题/模块                     | 目标文档路径                              | 迁移内容要点                                                                 | 状态         | 负责人   | 截止日期   | 备注 |
|-----:|------------------------------|-------------------------------------------|------------------------------------------------------------------------------|--------------|----------|------------|------|
| 1    | 事件与常量命名规范            | docs/standards/events.md                  | 三段式规则、命名空间常量、白名单机制、scoped/global 使用约定、Lint 门禁     | 已完成 v1    | Codex-AI | 2025-11-09 | 与 eslint-rules/event-name-format.js 保持一致 |
| 2    | WebSocket 契约（Outline 域）  | docs/contracts/ws-outline.md              | 消息类型集合、负载结构、导入后持久化、前后端一致性与自动二次拉取             | 已完成 v1    | Codex-AI | 2025-11-09 | 对照 MessageType 与 WEBSOCKET_MESSAGE_TYPES |
| 3    | 构建与运行                    | docs/engineering/build-run.md             | 源码/分发模式、静态路由、目录与日志路径、QtWebEngine 限制                    | 已完成 v1    | Codex-AI | 2025-11-10 | 结合 BUILDING.md 校准 |
| 4    | 质量门禁                      | docs/quality/quality-gates.md             | Lint 规则、测试范围、E2E 场景、CI 契约差异检查建议                           | 已完成 v1    | Codex-AI | 2025-11-10 | 附 `scripts/ci/ws-contract-diff.mjs` |
| 5    | 自检清单                      | docs/checklists/self-check.md             | 提交/上线前检查项（事件、白名单、作用域、幂等、日志、编码/换行）             | 已完成 v1    | Codex-AI | 2025-11-08 | 面向快速落地 |

执行说明
- 迁移以“事实为准”：以 src/** 与后端 handlers/** 当前实现为依据编写文档。
- 若文档与代码不一致，以代码为准，并在 PR 中同步修文档与链接。
- 本计划完成后，tech.md 仅保留索引条目与“核心规则（立即执行）”。

更新记录
- 2025-11-07 创建计划，初始化 5 个迁移条目。
