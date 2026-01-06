# 步骤05：E2E 场景与验收测试

状态: 待执行
耗时预估: 30-60 分钟
产出: 手动+半自动的端到端验证脚本与步骤

## 目标
- 通过实际运行的前后端验证搜索闭环与 UI 呈现。

## 前置条件
- Node 依赖安装：`pnpm install`
- 启动器就绪：`python ai_launcher.py start --module pdf-home --vite-port 3001 --msgServer-port 8765 --pdfFileServer-port 8080`
  - 参考：`logs/dev-process-info.json`, `logs/frontend-process-info.json`

## 测试步骤
1) 启动服务
   - 运行：`python ai_launcher.py start --module pdf-home`
   - 确认 WS 状态：在 pdf-home 界面中 EventBus 触发 `msgcenter:status:request`，收到 `...:response` 为 connected。

2) 准备样本数据（可选）
   - 使用现有“添加 PDF”功能添加 3-5 份文件，确保数据库有记录（便于搜索验证）。

3) 执行搜索
   - 在搜索框输入：`deep learning`（应分词为两词）。
   - 观察：
     - 搜索开始：有“进行中”日志与统计清零。
     - 搜索完成：数量徽标正确显示，比如“共 3 条”。
     - 列表展示：至少显示 `title/author/tags` 等主要字段。

4) 清除搜索
   - 点击清空按钮或触发 `search:clear:requested`。
   - 预期：回退为“全部记录”，数量变化、列表刷新。

5) 边界用例
   - 特殊字符：输入 `50%_done`，应不被通配符误匹配。
   - 空搜索：输入为空 → 返回全部。

## 通过标准
- UI 可交互、无异常报错；日志无未知消息类型告警；响应结构与字段命名符合契约；日志 UTF-8 且换行 `\n`。

## 故障排查
- 查看前端日志：`logs/pdf-home-js.log`
- 查看后端日志：`logs/backend.log`（若存在）或控制台输出
- 确认 WSClient `VALID_MESSAGE_TYPES` 中包含 `pdf/search`
