# 自检清单（提交/上线前）

事件与消息
- 事件名只用命名空间常量；无字面量/变量/模板字符串
- 新增全局事件已登记白名单
- WS 消息类型与后端一致（CI 契约检查通过）

功能链路
- Outline 首次导入：bookmark:save → outline:list
- UI/数据层事件作用域一致（onGlobal/emitGlobal）
- 组件初始化幂等（重复调用不报错）

构建与运行
- 构建通过：`pnpm run build:pdf-viewer`
- E2E 通过：`pnpm run e2e:browser`
- 入口无 Node-only 语法（`require()`/`__filename` 等）

编码与日志
- 所有文件显式 UTF-8；统一 `\n`
- 无 alert/confirm；错误统一 toast + 结构化日志

关联文档
- 事件规范：docs/standards/events.md
- WS 契约：docs/contracts/ws-outline.md
- 质量门禁：docs/quality/quality-gates.md
