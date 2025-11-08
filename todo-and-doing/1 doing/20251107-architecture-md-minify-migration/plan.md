# architecture.md 极简化迁移计划（执行表）

说明：将原 architecture.md 的详细说明迁移到 docs/architecture 下的专题文档。本表跟踪迁移状态与负责人。

| 序号 | 主题/模块             | 目标文档路径                          | 迁移内容要点                                           | 状态       | 负责人   | 截止日期   | 备注 |
|-----:|------------------------|---------------------------------------|--------------------------------------------------------|------------|----------|------------|------|
| 1    | 架构总览与组件         | docs/architecture/overview.md         | 高层结构与组件职责、统一日志策略                       | 已完成 v1  | Codex-AI | 2025-11-09 | 与实际模块清单保持同步 |
| 2    | 分层模型与 Feature/Bus | docs/architecture/layers.md           | Registry/依赖/别名、ScopedEventBus 与 onGlobal/emitGlobal | 已完成 v1  | Codex-AI | 2025-11-09 | 对齐事件规范 |
| 3    | 导航与互斥策略         | docs/architecture/navigation.md       | URL ↔ WS 互斥、跨文档恢复时序                           | 已完成 v1  | Codex-AI | 2025-11-09 | 结合相关 E2E 用例 |
| 4    | 设计原则               | docs/architecture/principles.md       | Fail‑Fast、编码/目录规范、质量控制                      | 已完成 v1  | Codex-AI | 2025-11-10 | 与质量门禁一致 |
| 5    | 关键组件               | docs/architecture/components.md       | WS 转发器、HTTP 文件服务器、PDF 业务服务器（预留）     | 已完成 v1  | Codex-AI | 2025-11-10 | 细节可继续扩展 |
| 6    | 构建与运行（链接）     | docs/engineering/build-run.md         | 源/分发形态、静态路由、日志目录、常见坑                 | 已完成 v1  | Codex-AI | 2025-11-10 | 与 BUILDING.md 互补 |
| 7    | 加密与消息中心         | docs/architecture/security-messaging.md | 统一加密策略、消息中心设计与错误处理框架               | 已完成 v1  | Codex-AI | 2025-11-15 | 索引版已提交，可继续扩展示例 |
| 8    | 数据库系统             | docs/architecture/database.md         | 连接/事务/执行/异常抽象，插件化扩展                    | 已完成 v1  | Codex-AI | 2025-11-15 | 索引版已提交，可继续扩展示例 |

更新记录
- 2025-11-07 创建计划，初始化 8 个迁移条目；1~6 标记为“已完成 v1”
