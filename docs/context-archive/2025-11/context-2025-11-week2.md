# Context 归档 - 2025年11月第2周（11-08 ~ 11-14）

**归档日期**：2025-11-14
**来源**：保留在 context.md 的最近变更

---

## 📝 说明

本周的记录仍在 `context.md` 的"最近7天变更记录"中保留。

### 主要内容概览

- **2025-11-14**：MsgCenter 严格"目标对象存在"策略、WebSocket 客户端身份系统
- **2025-11-13**：测试策略更新（放弃 Playwright）、WebSocket 使用约束
- **2025-11-12**：测试目录梳理、测试文档整合
- **2025-11-11**：GUI 启动调整、PDF-Home 问题修复
- **2025-11-10**：GUI 模块化、阅读历史模块、Linters 模块
- **2025-11-09**：Outline 修复、大纲加载策略变更
- **2025-11-08**：日志降噪、Toast 调试、ESLint 扫描

---

## 🔑 关键主题索引

### 1. MsgCenter 严格转发策略（2025-11-14）
- **原则**：不做业务处理，仅负责转发
- **目标对象检查**：
  - Viewer 目标：必须命中 `viewer_id/pdf_uuid`
  - 后端服务：按域前缀检查上下文对象
- **失败立即返回**：`NO_TARGET_OBJECT`(404) 或 `NO_BACKEND_SERVICE`(503)

### 2. WebSocket 客户端身份系统（2025-11-14）
- **客户端命名**：`pdf-viewer-<pdf_uuid>:<viewer_id>`
- **身份注册**：`client:register:requested` → `_client_identity`
- **严格约束**：未注册客户端返回 `CLIENT_NOT_REGISTERED`(401)

### 3. 测试策略重大调整（2025-11-13）
- **放弃 Playwright**：改用"Node/Jest 前端段 + PyTest 后端段"
- **分段集成拼接**：F/N/B/P 段落步骤化验证
- **废弃基座**：QtWebEngine、Playwright、注入式 GUI Launcher E2E

### 4. WebSocket 使用约束（2025-11-13）
- **强制要求**：必须使用 PyQt 的 QtWebSockets
- **禁止使用**：Python `websockets`、Node `ws`、浏览器原生 `WebSocket`
- **统一托管**：由 PyQt 进程管理连接生命周期

### 5. GUI 模块化（2025-11-10）
- **新模块**：`src/gui_launcher/workers.py` 承载线程类
- **简化入口**：`gui_launcher.py` 仅作装配层
- **保持兼容**：通过名称重绑定保持对外 API 不变

### 6. 阅读历史模块（2025-11-10）
- **服务端存储**：`pdf_info.json_data.resume`
- **自动恢复**：冷启动按优先级应用（显式跳转 > resume > 首页）
- **节流写入**：监听滚动/点击，2.5s 节流发送

### 7. 后端 Linters 模块（2025-11-10）
- **自定义检查器**：`table_event_lint_checker.py`
- **错误代码**：E9001（table-event-string-literal）
- **强制常量**：`TableEventConstants.*`

---

## 📌 相关文件

### 前端
- `src/frontend/common/ws/ws-client.js`
- `src/frontend/pdf-viewer/features/pdf-resume/`
- `src/frontend/pdf-viewer/adapters/websocket-adapter.js`

### 后端
- `src/backend/msgCenter_server/standard_server.py`
- `src/backend/msgCenter_server/core/server_api.py`
- `src/backend/linters/table_event_lint_checker.py`
- `src/gui_launcher/workers.py`

### 测试
- `tests/e2e/runner/run-flows.mjs`
- `tests/e2e/config/event-mapping.json`
- `docs/TESTING-OVERVIEW.md`

---

**详细内容请参考 `context.md` 的"最近7天变更记录"章节。**

**7天后（2025-11-21）本周记录将移入本文件，并从 context.md 中移除。**
