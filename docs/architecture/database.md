# 数据库系统（索引版）

目标
- 定义后端数据库抽象层与插件化扩展点，统一事务/错误处理与 Schema 约束，支撑各业务域（outline/annotation/anchor 等）。

一、抽象层（建议目录）
- config/connection/transaction/executor/exceptions
  - connection：创建/管理连接（SQLite/可替换）
  - transaction：上下文式事务（begin/commit/rollback），支持嵌套语义或显式声明
  - executor：统一执行接口（参数化 SQL、批处理），返回 dict/tuple 统一结构
  - exceptions：统一异常（DatabaseError/DatabaseValidationError/NotFound 等）

二、Schema 与迁移
- 初始建表：`src/backend/database/create_tables.sql`
- 迁移策略：按版本脚本增量升级；运行期校验当前版本并在启动时执行必要迁移/拒绝启动
- 编码与约束：表/列名使用小写下划线；文本列 UTF-8；必要唯一键与索引（如 pdf_uuid + parent/order）

三、插件化（Table Plugins）
- 目的：以插件封装单张/一组表的 CRUD 与领域校验，向上提供清晰接口
- 示例（目录参考）：`src/backend/database/plugins/*`
  - pdf_outline_plugin：对齐前端 outline 域，接受 `outlineItem-XXXXXXXX` 与兼容旧 `bookmark-*` 的 ID，提供 list/create/update/delete/reorder
  - 校验模块：`plugins/pdf_outline/validate.py`（ID 格式、字段完整性、树结构合法性）
  - 事件集成：必要时通过后端 EventBus/MsgCenter 发出内部事件，便于观测

四、错误处理与映射
- 插件内部抛出领域异常（如 DatabaseValidationError / NotFound）
- 上层 handler 捕获后映射为 `*:failed` 的错误码：
  - VALIDATION_ERROR / OUTLINE_NOT_FOUND / CONFLICT / DB_ERROR
- 错误消息应人类可读，并附 `details`（字段路径/期望值/实际值）

五、性能与并发
- 事务边界尽量窄化；批量操作支持分批提交
- 必要索引：读多写少的查询路径加组合索引；重排（reorder）采用 O(1) 局部更新策略
- 并发冲突：以乐观并发为主；必要时引入版本号/时间戳检查

六、测试
- 单元：对各插件的 happy/edge/invalid 覆盖（新增/更新/删除/越界）
- 集成：结合 MsgCenter handlers，验证端到端 CRUD 与错误码映射
- 数据工厂与夹具：提供最小样本构造与清理工具

七、执行清单（最小）
- [ ] 插件对输入做严格校验（ID/必填/范围/正则/树结构）
- [ ] 异常全量映射为标准错误码；不得泄露底层栈信息
- [ ] Schema 版本与迁移可重复执行；启动时校验当前版本
- [ ] 必要索引已创建；大表/热路径已评估 explain
- [ ] 单元/集成测试通过；E2E 关键链路验证

参考
- 业务契约：docs/contracts/ws-outline.md
- 质量门禁：docs/quality/quality-gates.md
