# PDF 批量删除功能提案

概要
本提案描述在 pdf-home 模块中新增“批量删除选中行”的前端与后端协作方案，目标是一次性发送单个批量删除请求，后端一次性返回结果并同步最新列表，前端据此更新表格。

背景与动机
- 现有实现倾向于逐行删除，造成大量请求、竞态和用户体验不佳。
- 批量删除可减少网络往返、简化错误处理并提升用户体验。

关键假设（待事实复核）
1) 后端可新增或已有接受文件标识数组的批量删除接口（WebSocket 或 HTTP）。
2) TableWrapper.getSelectedRows() 返回对象含可识别字段（优先 id，其次 filename）。
3) 后端能在单次响应中返回 removed/failed 明细及可选的最新 pdf 列表，或允许前端随后拉取最新列表。

设计要点
- 事件流
  1. UIManager 收集选中行并发布 pdf:batch:requested 事件（含 files 数组 与 requestId）
  2. PDFManager 监听该事件，构建并发送单次请求（优先 WebSocket，备选 HTTP POST）
  3. 后端处理并一次返回结果 { removed, failed, pdfs (optional) }
  4. PDFManager 发布 pdf:batch:completed 或 pdf:batch:failed，并发布 pdf:list:updated 或触发列表刷新
  5. UIManager 显示成功/失败信息并刷新表格

- 事件命名建议（与现有规范一致）
  - pdf:batch:requested
  - pdf:batch:completed
  - pdf:batch:failed

前端变更（文件）
- src/common/event/event-constants.js：新增 BATCH 事件常量
- src/frontend/pdf-home/ui-manager.js：已存在 #handleBatchDelete，实现完善（按钮状态、loading、重试提示、错误展示）
- src/frontend/pdf-home/table-wrapper.js：一般无需修改，但需确认 getSelectedRows() 输出字段
- src/common/pdf/pdf-manager.js：新增监听与发送逻辑，解析响应并发布更新事件

后端变更建议（由后端实现）
- 支持 WebSocket 消息 type "pdf.batch.delete" 或 HTTP POST /api/pdfs/batch-delete
- 响应格式示例:
  {
    "type":"pdf.batch.delete.result",
    "payload": {
      "requestId":"uuid",
      "removed":["file1","file2"],
      "failed":[{"file":"file3","reason":"not_found"}],
      "pdfs":[... optional updated list ...]
    }
  }

错误与部分失败处理
- 建议后端在部分失败时返回 removed 与 failed 明细
- 前端展示失败摘要并可选择“重试失败项”
- 删除应尽量设计为幂等操作；重复删除同一项应被视为成功或无害

性能与安全考虑
- 对单次批量大小可设软上限（例如 500），超过时建议分批或后台任务
- 删除操作需进行权限校验；前端在请求时携带现有认证令牌/会话

测试计划
- 单元测试：pdf-manager 在收到 REQUESTED 时发送正确 payload，并在模拟响应时触发 COMPLETED / FAILED，并触发列表刷新
- 集成测试：在前端环境中模拟后端回放，验证 UI 行为（按钮禁用、提示、表格刷新）
- E2E（可选）：使用 Playwright/Puppeteer 测试真实场景

开发步骤（高层）
1. 更新事件常量并提交
2. 在 pdf-manager 中实现 BATCH 请求/响应逻辑（mock 可配置）
3. 在 ui-manager 中完善交互（禁用按钮、显示 loading、success/error）
4. 编写单元/集成测试
5. 与后端对接；如果后端需改造，协同完成并确认接口

决策记录
- 首选方案：使用 WebSocket 单次批量请求（与项目现有实时架构一致）
- 备选方案：使用 HTTP POST /api/pdfs/batch-delete（兼容性更高）

下一步
- 已授权则创建本提案文档并同时发起对 agent-fact-review、agent-spec-review、agent-rationality-review 的复核请求

联系人：agent-master（将协调整个实现流程）