# 技术规范（清理版）

本文件汇总当前权威的技术与使用规范，过时内容已清理。

## 命名规范
- 目录统一使用 kebab-case：示例 `pdf-home`、`pdf-viewer`。
- 禁止使用 `pdf_home`（snake_case）。

## 文件 I/O 规范
- 所有文件读写必须显式指定 UTF-8 编码（Python `encoding='utf-8'`；PowerShell `-Encoding UTF8`）。
- 确保换行 `\n` 正确；按会话覆盖写场景使用 `mode='w'`。

## 前端日志规范
- 通过 QtWebEngine 远端调试（DevTools）捕获前端控制台：
  - pdf-home：写入 `logs/pdf-home-js.log`
  - pdf-viewer：写入 `logs/pdf-viewer-<pdf-id>-js.log`
- JS 层可使用共享 Logger 输出到控制台；由 Python 捕获程序写入日志（UTF-8）。

日志治理（配置项与默认）
- 生产默认：`WARN` 级别、事件采样 20%、JSON 不美化
- 运行时可通过 localStorage 调整（无需改代码）：
  - `LOG_LEVEL`: `debug|info|warn|error`
  - `LOG_EVENT_SAMPLE_RATE`: `0~1`（例如 `0.2`）
  - `LOG_RATE_LIMIT`: `messages,intervalMs`（如 `100,1000`）
  - `LOG_DEDUP_WINDOW_MS`: 重复折叠窗口毫秒
  - `LOG_EVENT_MAX_JSON`: 事件 JSON 最大长度
  - `LOG_EVENT_PRETTY`: `true|false`
  
编程方式（可在 Bootstrap 中设置）
```js
import { configureLogger, LogLevel, setModuleLogLevel } from 'src/frontend/common/utils/logger.js';
configureLogger({ globalLevel: LogLevel.INFO, rateLimit: { messages: 60, intervalMs: 1000 }, event: { sampleRate: 0.5 } });
setModuleLogLevel('Feature.annotation', LogLevel.WARN);
```

## 后端日志规范
- 统一使用 Python `logging`，显式 UTF-8；必要时采用覆盖写并确保行尾正确。

## 前端基础设施
- 统一依赖 `src/frontend/common/*`：
  - `event/event-bus.js`
  - `utils/logger.js`
  - `ws/ws-client.js`
- QWebChannel 逻辑由前端管理（如 `src/frontend/pdf-home/qwebchannel-manager.js`）。

### 搜索透传参数（2025-10-07）
- `search:query:requested` 支持可选字段透传至 WS：
  - `sort`: 例如 `[{ field: 'visited_at', direction: 'desc' }]`
  - `pagination`: 例如 `{ limit: 0, offset: 0, need_total: true }`（`limit=0` 表示全量）
  - `focusId`: 例如 `'abc123'`，用于结果渲染后聚焦并滚动到特定条目
- 由 `SearchManager` 构建消息：`data = { query, tokens, sort?, pagination? }`
- 由 `SearchManager` 在 `search:results:updated` 中回传 `{ focusId }`，供 `SearchResultsFeature` 聚焦并 `scrollIntoView`
- 典型用法：侧边栏“最近阅读”点击 → 触发“按 visited_at 降序 + SQL LIMIT 截断”的搜索，并在结果中高亮/定位到点击的条目

### SQL 截断优化（2025-10-07）
- 对于“无关键词 + sort=visited_at desc + 无 filters”的请求，截断在 SQL 层执行：
  - 插件：`PDFInfoTablePlugin.query_all_by_visited(limit, offset)`，`ORDER BY visited_at DESC LIMIT ? OFFSET ?`
  - API：`PDFLibraryAPI.search_records(payload)` 优先分支匹配上述模式时，走插件方法，必要时通过 `count_all()` 获取总数
  - 目的：避免加载全量后在内存中切片，提高性能与响应速度

## 事件与功能开关变更（2025-10-07）
- 启用 `pdf-home` 的 `header` 功能（`config/feature-flags.json` → `header.enabled = true`）。
- 排序按钮事件统一使用三段式 `*:requested`：
  - `header:sort:requested`
  - `search:sort:requested`
  - 旧的 `*:clicked` 命名不再使用（测试与文档已同步更新）。

## 第三方 Toast 使用规范（pdf-home 添加流程）
- 依赖：`izitoast`（已加入 package.json）
- 统一通过适配器调用：`src/frontend/common/utils/thirdparty-toast.js`
  - `pending(id, message)`：右上角粘性提示（timeout: false），需后续 `dismissById(id)` 关闭
  - `success(message, ms=3000)`：成功提示
  - `warning(message, ms=4000)`：警告提示
  - `error(message, ms=5000)`：错误提示
  - `dismissById(id)`：关闭 `pending(id)` 创建的提示
- 样式：适配器内部已 `import 'izitoast/dist/css/iziToast.min.css'`，无需重复引入
- 位置：统一右上角（topRight），与既有规范一致
- 适用范围：当前仅在 `pdf-home` 的“添加 PDF”流程中使用；其他模块暂不修改

### 标注保存策略（pdf-viewer / 2025-10-08）
- AnnotationManager 在创建标注时的保存路径：
  - 远端保存：当 `wsClient.isConnected()` 为 true 且已设置 `pdfId` 时，调用 WS 接口保存；
  - 本地回退：若未连接 WS 或未设置 `pdfId`，回退到本地 Mock 保存，确保 `ANNOTATION.CREATED` 事件仍然发出，侧边栏可及时展示。
- pdfId 的设置：
  - AnnotationFeature 监听 `NAVIGATION.URL_PARAMS.PARSED`（从 URL 解析到 `pdf-id`）与 `FILE.LOAD.SUCCESS`（从 `filename` 推断 id，去掉 .pdf 后缀），调用 `AnnotationManager.setPdfId()`；
  - 建议 pdf-viewer 启动带上 `?pdf-id=xxx`，避免依赖文件名推断。
- 验证方法：
  - 运行 `node AItemp/manual-tests/test-annotation-create-fallback.mjs`，应输出 `[OK] CREATED emitted with screenshot annotation`；
  - 界面手测：截图→保存→侧边栏出现新标注卡片。

## 启动与编排（AI Launcher）
- 模块化服务管理：
  - `ai-scripts/ai_launcher/core/service_manager.py`
  - `ai-scripts/ai_launcher/core/process_manager.py`
  - `ai-scripts/ai_launcher/cli/command_parser.py`
- 示例服务：
  - `services/persistent/ws_service.py`：WebSocket 转发器
  - `services/persistent/pdf_service.py`：HTTP 文件服务器
  - `services/persistent/npm_service.py`：Vite 开发服务器
- 示例入口：`ai-scripts/ai_launcher/example_run.py`（支持 `start/stop/status`）

## AI Launcher 使用方法（ai_launcher.py）

### 概述
- **主要入口**：项目根目录的 `ai_launcher.py`
- **功能**：统一管理前后端服务的生命周期（Vite开发服务器 + WebSocket服务器 + HTTP文件服务器 + 前端窗口）
- **重要原则**：⚠️ 在AI自动化开发环境中，严禁直接运行 `npm run dev` 或 `python app.py`，必须使用 `ai_launcher.py` 以避免终端阻塞

### 基本命令

#### 1. start - 启动服务
```bash
python ai_launcher.py start [选项]
```

**服务启动顺序**：
1. Vite 开发服务器（端口 3000，可配置）
2. 后端服务器（WebSocket + HTTP 文件服务）
3. 前端模块窗口（pdf-home 或 pdf-viewer）

**命令行参数**：
- `--vite-port <端口号>` - 指定 Vite 开发服务器端口（默认：3000）
- `--msgServer-port <端口号>` - 指定 WebSocket 服务器端口（默认：8765）
- `--pdfFileServer-port <端口号>` - 指定 PDF 文件服务器端口（默认：8080）
- `--module <模块名>` - 指定启动的前端模块，可选值：
  - `pdf-home` - PDF 文件管理界面（列表、添加、删除）
  - `pdf-viewer` - PDF 阅读器界面（渲染、缩放、翻页）
- `--pdf-id <标识>` - 传给 pdf-viewer 的 PDF 文件标识（仅 pdf-viewer 模块使用）

**使用示例**：
```bash
# 启动 pdf-home 模块（默认端口）
python ai_launcher.py start --module pdf-home

# 启动 pdf-viewer 并打开指定 PDF
python ai_launcher.py start --module pdf-viewer --pdf-id 12345

# 自定义所有端口启动 pdf-home
python ai_launcher.py start --module pdf-home --vite-port 3001 --msgServer-port 8766 --pdfFileServer-port 8081

# 仅启动后端服务（不启动前端窗口）
python ai_launcher.py start
```

#### 2. stop - 停止服务
```bash
python ai_launcher.py stop
```

**功能**：按顺序停止所有正在运行的服务
1. 前端模块窗口
2. Vite 开发服务器
3. 后端服务器

**清理操作**：
- 杀死所有相关进程
- 清理进程信息文件（`logs/dev-process-info.json`, `logs/frontend-process-info.json`）
- 记录停止日志到 `logs/ai-launcher.log`

#### 3. status - 查看状态
```bash
python ai_launcher.py status
```

**输出信息**：
- Vite 开发服务器状态（PID、端口、运行时间）
- 前端模块状态（模块名、PID、启动参数）
- 后端服务器状态（WebSocket 端口、HTTP 端口、健康状态）

### 端口配置

**优先级**（从高到低）：
1. 命令行参数（`--vite-port` 等）
2. 运行时配置文件（`logs/runtime-ports.json`）
3. Vite 日志文件（`logs/npm-dev-vite.log`）
4. 默认值（Vite: 3000, WebSocket: 8765, HTTP: 8080）
5. 可用性自动探测（如果默认端口被占用）

**端口冲突处理**：
- 自动检测端口占用
- 尝试杀死占用端口的旧进程
- 如果无法释放，自动选择可用端口

### 状态文件

#### logs/dev-process-info.json
记录 Vite 开发服务器进程信息：
```json
{
  "pid": 12345,
  "port": 3000,
  "command": "pnpm run dev -- --port 3000",
  "started_at": "2025-10-01T20:00:00"
}
```

#### logs/frontend-process-info.json
记录前端模块进程信息：
```json
{
  "module": "pdf-home",
  "pid": 12346,
  "ws_port": 8765,
  "vite_port": 3000,
  "pdf_port": 8080,
  "pdf_id": null,
  "started_at": "2025-10-01T20:00:05"
}
```

#### logs/runtime-ports.json
运行时端口配置（持久化）：
```json
{
  "vite": 3000,
  "websocket": 8765,
  "http": 8080
}
```

---

## PDF-Home 搜索与筛选补充（2025-10-07）

- SearchManager 负责透传 query/tokens，并支持可选的 `filters`/`sort`/`pagination`。
- FilterFeature 负责构建高级条件，应用后通过 `filter:state:updated` 更新全局状态。
- RecentSearchesFeature 会持久化最近搜索词到配置（config-read/write）。

### 已存搜索条件（SavedFilters）用法变更
- 原“搜索栏上的‘保存条件’按钮”已移除。
- 通过侧边栏“📌 已存搜索条件”的“＋”保存当前搜索条件：
  - 内容：关键词 `searchText`、筛选 `filters`、排序 `sort`；
  - 持久化：`pdf-library:config-write:requested → data/pdf-home-config.json.saved_filters`；
  - 应用：点击保存项 → 填充搜索框 → 发送 `filter:state:updated` → `search:query:requested`（含 filters/sort）。

#### logs/ai-launcher.log
启动器运行日志（UTF-8 编码）：
```
[2025-10-01 20:00:00] [INFO] Starting AI Launcher...
[2025-10-01 20:00:01] [INFO] Vite server started on port 3000 (PID: 12345)
[2025-10-01 20:00:02] [INFO] Backend services started
[2025-10-01 20:00:05] [INFO] Frontend module 'pdf-home' started (PID: 12346)
```

### 参数映射关系

ai_launcher.py 会自动将参数映射到各个服务：

| ai_launcher 参数 | 后端服务参数 | 前端模块参数 |
|-----------------|------------|------------|
| `--msgServer-port` | `--ws-port` | `--ws-port` |
| `--pdfFileServer-port` | `--http-port` | `--pdf-port` |
| `--vite-port` | - | `--vite-port` |
| `--pdf-id` | - | 不传递（内部使用） |

### 故障排查

**常见问题**：

1. **端口被占用**
   ```bash
   # 查看端口占用
   python ai_launcher.py status
   # 停止所有服务释放端口
   python ai_launcher.py stop
   ```

## 稳定性治理操作要点
- 契约（CDC）
  - 事件/消息负载以 JSON Schema 维护于 `docs/schema/events/*.schema.json`；
  - Producer/Consumer 各自提供契约测试于 `tests/contract/`；若任一契约失败，阻断合并；
  - Schema 版本策略：新增字段→向后兼容；字段移除/语义变更→标记弃用并提供兼容窗口与迁移指引。
- 回归基线（BCT）
  - `tests/bct/` 维护关键用户旅程用例（搜索分页与截断一致、双击打开 viewer、书签增删不影响其他分支、pdf-edit 保存成功与 Toast）；
  - 基线失败视为回归，必须先修复（或回滚）后再合并其他变更。
- 合并门禁（CI）
  - 变更需通过：契约（CDC）+ 基线（BCT）+ 冒烟（BVT）；
  - 小步提交与特性开关：不稳定功能默认关闭，在开关关闭路径保证兼容；
  - 多 worktree 并行时，建议按“模块边界”拆分 PR，避免跨域耦合。
- 可观测性
  - 统一 UTF-8 结构化日志；统计事件失败率、Schema 校验失败计数；
  - 关键错误（P0/P1）触发告警并支持一键回滚/关闭开关。

2. **Vite 启动失败**
   ```bash
   # 查看详细日志
   cat logs/npm-dev.log
   # 检查 node_modules 是否完整
   pnpm install
   ```

3. **前端窗口无法启动**
   ```bash
   # 查看启动器日志
   cat logs/ai-launcher.log
   # 检查 Python 虚拟环境
   python --version
   ```

4. **WebSocket 连接失败**
   ```bash
   # 查看后端日志
   cat logs/websocket-server.log
   # 确认 WebSocket 服务器正在运行
   python ai_launcher.py status
   ```

### 开发最佳实践

1. **开发前**：`python ai_launcher.py start --module <模块名>`
2. **开发中**：`python ai_launcher.py status` 检查服务状态
3. **遇到问题**：查看 `logs/ai-launcher.log` 和各服务日志
4. **开发后**：`python ai_launcher.py stop` 停止所有服务
5. **切换模块**：先 `stop`，再 `start --module <新模块>`

## PyQt 窗口生命周期策略（重要）
- 关闭行为：所有前端窗口（尤其是 `pdf-viewer`）必须设置 `WA_DeleteOnClose`，确保用户关闭窗口时对象被销毁，触发 `destroyed` 信号，便于宿主侧（如 `pdf-home`）清理 `viewer_windows` 映射。
- 设置方式（统一通过兼容层）：
  - `from src.qt.compat import QtCore`
  - `self.setAttribute(QtCore.Qt.WidgetAttribute.WA_DeleteOnClose, True)`（PyQt6）；如不兼容，回退 `QtCore.Qt.WA_DeleteOnClose`
- 映射清理：`pyqt-bridge.py` 必须同时保留两条清理路径：
  - `viewer.destroyed.connect(lambda: pop(...))`
  - 打开前检查 `existing.isVisible()`，不可见则先移除再重建
- 目的：避免“关闭后再次打开需双击两次”的错误体验，提升窗口生命周期一致性。

### AI 开发环境特别注意

⚠️ **严禁直接运行以下命令**（会导致终端阻塞）：
- `npm run dev`
- `python app.py`
- `python src/backend/main.py`
- `python src/frontend/pdf-home/launcher.py`

✅ **正确做法**：
```bash
# 统一使用 ai_launcher.py
python ai_launcher.py start --module pdf-home
```

**原因**：
- 直接运行会占用终端，无法进行 AI 自动化操作
- ai_launcher.py 会在后台启动服务，记录进程信息
- 支持进程管理、日志收集、优雅停止等功能

## 测试与可运行性
- 每个模块需提供独立运行与最小验证路径：
  - 前端应用：独立 launcher + 日志文件检查。
  - WebSocket 转发：指令回环/路由测试。
  - HTTP 文件服：健康检查 + Range 请求测试。
  - Launcher：服务 `start/stop/status` 冒烟测试。

## Worktree 环境（Windows / PowerShell）
- Node 包管理：优先 `pnpm`，设置共享 store（示例 `C:\\pnpm-store`），在各 worktree 使用 `pnpm install --frozen-lockfile`；可选 Yarn Berry(PnP)。
- Node 版本：`nvm-windows` + `.nvmrc` 固定版本；结合 `direnv` 或终端集成自动切换。
- Python 虚拟环境：在仓库外集中创建 venv（如 `C:\\venvs\\anki-linkmaster-PDFJS`），按分支差异可创建多个；进入 worktree 时激活。
- 自动激活：可选 `direnv`/`posh-direnv` 实现进入目录即激活 Node/venv。
- Git worktree 配置：使用 `git config --worktree` 进行工作树本地化配置与 hooks 隔离。


## JS 控制台日志捕获（QtWebSocket 替代方案）
- 位置：`src/frontend/pdf-home/js_console_logger.py`
- 实现：通过 `QWebSocket` 连接 QtWebEngine DevTools 的 `webSocketDebuggerUrl`，监听 `textMessageReceived` 事件。
- 启动方式：在 `src/frontend/pdf-home/launcher.py` 中通过 `QTimer.singleShot(2000, ...)` 延迟初始化，确保运行在 Qt 主线程。
- 依赖：不再依赖第三方 `websocket-client`；仍使用 HTTP 请求读取 `http://localhost:<debugPort>/json` 获取目标。
- 日志：写入 `logs/pdf-home-js.log`，显式 UTF-8 编码，逐行写入并确保换行 `\n`。

## Babel/Vite 配置要点（2025-09-26）
- vite 使用 `vite-plugin-babel`，通过 `babelConfig.configFile = path.resolve(process.cwd(), 'babel.config.js')` 显式指定配置文件路径。
- `babel.config.js` 改为 ESM `import` 直接引入插件对象，避免字符串插件名在 Windows/虚拟路径解析失败。
- 顶层 devDependencies 必须包含：
  - `@babel/plugin-transform-private-methods`
  - `@babel/plugin-transform-class-properties`
  - `@babel/plugin-transform-optional-chaining`
  - `@babel/plugin-transform-nullish-coalescing-operator`
  - `@babel/plugin-syntax-dynamic-import`
- 验证脚本：
  - `node scripts/test-import-babel-plugin.mjs`
  - `node scripts/test-babel-transform.mjs`
## AI Launcher Vite 日志增强（2025-09-26）
- `ProcessManager.start(..., check_delay=0.5)`：默认在启动后短延迟检查子进程退出，若异常退出会清理 PID 并将尾部日志写入 `ai-launcher.process.<service>`。
- `ProcessManager.tail_log(lines=20)`：用于服务在失败时读取日志尾部摘要。
- `NpmDevServerService`
  - 日志文件固定为 `logs/npm-dev.log`（UTF-8）。
  - 失败时通过 logger `ai-launcher.service.npm-dev` 输出摘要，提示查看对应日志。
- 新增自动化测试 `tests/ai_launcher/test_process_manager.py` 验证上述逻辑。- npm-dev 服务改动（2025-09-26）
  - `ProcessManager.start` 新增 `env` 参数并在 Windows 下继续使用 UTF-8 日志；启动后若子进程快速退出会记录尾部输出。
  - `NpmDevServerService` 传入 `NO_COLOR=1`, `FORCE_COLOR=0`, `CLICOLOR{,_FORCE}=0`, `VITE_FORCE_COLOR=0`，并在启动后调用 ANSI 转义清理（`logs/npm-dev.log` 保持无色）。
  - 自动化覆盖见 `tests/ai_launcher/test_process_manager.py`。
## pdf-viewer 启动诊断同步 (2025-09-26)
- launcher.py 支持新的 CLI:
  - --diagnose-only：跳过 Qt 事件循环，输出 JSON 诊断。
  - --disable-webchannel / --disable-websocket / --disable-js-console / --disable-frontend-load：分别屏蔽组件。
- 诊断输出格式：components.<name> = { enabled, executed, note }。
- 配套测试：python ai-scripts/tests/test_pdf_viewer_launcher_diagnose.py。
- 推荐排查：先 --diagnose-only --disable-js-console 验证 JS 日志线程，再逐项恢复。

### 2025-10-05 PDFCardFeature 使用说明
- 入口：src/frontend/pdf-viewer/features/pdf-card/index.js 注册 PDFCardFeature
- 依赖：通过依赖容器暴露 cardSidebarUI，SidebarManager 的 
eal-sidebars.js 首次打开时调用 container.get('cardSidebarUI')
- Feature 注册顺序：需在 pp-bootstrap-feature.js 中放在 SidebarManagerFeature 之前，保证侧栏可获取 UI
- UI 类：CardSidebarUI 提供 initialize(container)、getContentElement()，并监听 PDF_CARD.LOAD.SUCCESS

### 2025-10-05 PDFInfoTablePlugin 使用说明
- 模块：src/backend/database/plugins/pdf_info_plugin.py，需搭配 Stage1 SQLExecutor 与 Stage2 EventBus。
- 构造：PDFInfoTablePlugin(executor, event_bus, logger=None)，启用前调用 enable() 以创建表和索引。
- 事件：发布事件命名统一为 	able:pdf-info:<action>:<status>；订阅时务必使用连字符版本（EventBus 不接受下划线）。
- 核心接口：
  - alidate_data(data)：按规范校验 uuid/title/时间戳/json_data。
  - CRUD：insert / update / delete / query_by_id / query_all(limit, offset)。
  - 扩展：search(keyword, fields=None, limit=50)、ilter_by_tags(tags, match_mode='any')、ilter_by_rating(min_rating, max_rating)、get_visible_pdfs()、update_reading_stats(uuid, reading_time_delta)、dd_tag(uuid, tag)、
emove_tag(uuid, tag)、get_statistics()。
- 测试：运行 pytest src/backend/database/plugins/__tests__/test_pdf_info_plugin.py（32 用例，覆盖建表/验证/CRUD/事件）。
- 样例数据：plugins/__tests__/fixtures/pdf_info_samples.py 提供 make_pdf_info_sample/make_bulk_samples 工具，便于生成标准化输入。
### 2025-10-05 PDFAnnotationTablePlugin 使用说明
- 模块：src/backend/database/plugins/pdf_annotation_plugin.py。
- 启用：先启用 PDFInfoTablePlugin 并插入 pdf_uuid，再实例化 PDFAnnotationTablePlugin(executor, event_bus, logger) 调用 enable()。
- 支持类型：screenshot / 	ext-highlight / comment，分别要求 rect/imagePath/imageHash、selectedText/textRanges/highlightColor、position/content 等字段。
- 常用方法：
  - query_by_pdf(pdf_uuid) / query_by_page(pdf_uuid, page_number) / query_by_type(pdf_uuid, ann_type)。
  - count_by_pdf(pdf_uuid) / count_by_type(pdf_uuid, ann_type)。
  - delete_by_pdf(pdf_uuid)（触发事件 	able:pdf-annotation:delete:completed）。
  - dd_comment(ann_id, content) / 
emove_comment(ann_id, comment_id)。
- 事件：启用时自动订阅 	able:pdf-info:delete:completed 并级联删除标注。订阅者 ID：pdf-annotation-plugin-<id>。
- 测试：运行 pytest src/backend/database/plugins/__tests__/test_pdf_annotation_plugin.py（44 用例）。

### 2025-10-05 PDFBookmarkTablePlugin 使用说明
- 模块：`src/backend/database/plugins/pdf_bookmark_plugin.py`。
- 依赖：启用前需先启用 `PDFInfoTablePlugin`，保持 pdf_uuid 存在；事件命名为 `table:pdf-bookmark:*:*`。
- 数据要求：`json_data` 含 `name/type/pageNumber`，`type=region` 时必须提供 `region.scrollX/scrollY/zoom`；`children` 为递归数组。
- 常用接口：`query_by_pdf`、`query_root_bookmarks`、`query_by_page`、`count_by_pdf`、`delete_by_pdf`、`add_child_bookmark`、`remove_child_bookmark`、`reorder_bookmarks`、`flatten_bookmarks`。
- 树操作：`add_child_bookmark` 自动设置 `parentId/order` 并更新父节点；`reorder_bookmarks` 根据 ordered_ids 更新 `order` 字段；`flatten_bookmarks` 返回附带 `level` 的扁平列表。
- 测试命令：`pytest src/backend/database/plugins/__tests__/test_pdf_bookmark_plugin.py`（39 用例）。

### 2025-10-05 SearchConditionTablePlugin 使用说明
- 模块：`src/backend/database/plugins/search_condition_plugin.py`。
- 条件类型：`fuzzy`(keywords/searchFields/matchMode)、`field`(field/operator/value)、`composite`(operator+conditions)。
- 排序模式：`mode=0` 默认；`mode=1` 需 `manual_order`；`mode=2` 需 `multi_sort` 列表；`mode=3` 需 `weighted_sort.formula`。
- 扩展接口：`query_by_name`、`query_enabled`、`increment_use_count`、`set_last_used`、`activate_exclusive`、`query_by_tag`、`search_by_keyword`。
- 事件：`table:search-condition:create|update|delete:completed`。
- 测试：`pytest src/backend/database/plugins/__tests__/test_search_condition_plugin.py`（29 用例）。
- 2025-10-05：新增 `PDFLibraryAPI`，提供 `list_records/get_record_detail/update_record/delete_record/register_file_info`，单位为秒/毫秒转换遵循 JSON-MESSAGE-FORMAT-001，WebSocket `pdf-library:list:records` 消息返回 `records`。

## 2025-10-05 Annotation事件规范
- AnnotationFeature 缺省使用 ScopedEventBus，跨模块交互统一经 `emitGlobal/onGlobal`。
- PDF_VIEWER_EVENTS 新增注解导航 SUCCESS/FAILED、侧边栏辅助按钮及通知错误常量，CRUD 失败常量也需使用同名常量调用。
- 工具类（Comment/Screenshot/TextHighlight）与 AnnotationManager/Event UI 必须引用常量，不得再硬编码字符串事件。
- 2025-10-05: AnnotationSidebarUI 卡片头部新增删除按钮，通过 `PDF_VIEWER_EVENTS.ANNOTATION.DELETE` 触发；TextSelectionQuickActionsFeature 在监听 `@annotation/annotation-tool:*` 时禁用快捷操作。
- 2025-10-05: 标注UI按钮表情化：QuickActionsToolbar 与 AnnotationSidebarUI 操作按钮改用 Unicode 表情，统一提供 aria-label/title 辅助文本。

### 2025-10-06 PDFLibraryAPI 扩展
- 新增接口：`list_bookmarks(pdf_uuid)` 返回 `{bookmarks, root_ids}`；`save_bookmarks(pdf_uuid, bookmarks, root_ids=None)` 负责树形书签覆盖写；`search_records(payload)` 支持多 token 权重排序 + 过滤 + 分页。
- 书签序列化：前端结构（含子节点）通过 `_flatten_bookmark_tree` 映射为 `pdf_bookmark` 行，`parentId`/`order` 与层级信息同步写入。
- 搜索逻辑：在内存层整合 title/author/notes/tags/subject/keywords，支持短语匹配（query），默认排序遵循 `match_score` → `updated_at`。
- 单测：`python -m pytest src/backend/api/__tests__/test_pdf_library_api.py`。
- WebSocket 消息扩展：`bookmark/list` -> data={pdf_uuid}，响应带 `bookmarks`/`root_ids`；`bookmark/save` -> data={pdf_uuid, bookmarks, root_ids}，成功返回 `saved` 数量，异常统一返回 `type=error`。
- WSClient 增强：提供 `request(type, payload, {timeout,maxRetries})` 泛化调用，维护 `_settlePendingRequest`，新增消息类型 `bookmark/list`、`bookmark/save` 及事件 `websocket:message:bookmark_list/save`；前端书签默认通过 `RemoteBookmarkStorage` 走 WebSocket，自动回落至 LocalStorage。

### 2025-10-06 加权排序公式构建器与搜索结果布局
- 校验：使用 `#hasFieldReference` 判断公式是否引用字段，floor(filename)/length(title) 等公式被视为合法。
- 搜索结果布局：`.search-results-container` 使用 `layout-single/double/triple` 类控制列数，按钮状态存储于 localStorage(`pdf-home:search-results:layout`)；布局按钮样式位于 search-results.css。

### 2025-10-06 PDFLibraryAPI.add_pdf_from_file 更新
- 新增 12 位十六进制 UUID 与 `<uuid>.pdf` 文件名校验，保持与 `StandardPDFManager` 副本策略一致。
- 默认优先调用 `StandardPDFManager` 并写表，失败时回滚并返回 `UPLOAD_FAILED`；当管理器禁用时回退至直接建表但仍记录原路径。
- 返回结构保持 `{success, uuid, filename, file_size|error}`，供 WebSocket 响应直接使用。
- WebSocket `handle_pdf_upload_request` 现透传 `PDFLibraryAPI` 结果，fallback 时解析 `(success, payload)` 元组并回传原始错误信息，前端可准确提示原因。
- `PDFManager.add_file` 现在在重复写入时直接发出"文件已存在于列表中"信号，Legacy 适配器即可透传该信息。

## 2025-10-06 PDF-Home 搜索 v001 变更说明
- 默认搜索字段：后端与前端均包含 `title, author, filename, tags, notes, subject, keywords`
- SQL 安全：统一使用参数绑定；所有 LIKE 条件采用 `ESCAPE '\\'` 语法并对 `%`、`_` 进行转义；tags 使用 JSON 文本包含匹配
- 事件契约：WebSocket `type: "pdf-library:search:records"`，响应 `status: "success"`，`data: { records, count, search_text }`
- UI 行为：SearchBar → SearchManager（发起 WS）→ SearchResultsFeature（渲染）；空搜索返回全部

## 2025-10-06 搜索语义（v001）
- 默认字段：title/author/filename/tags/notes/subject/keywords
- 关键词：按空格分词；关键词之间 AND；字段内 OR；LIKE 模糊匹配（转义 `%`、`_`，使用 `ESCAPE '\'`）
- UI 提示：SearchBar 占位符注明"空格=且"

### 日志策略更新（前端）
- EventBus：无订阅者日志→debug；websocket:message:received 默认 suppress。
- WSClient：type="response" 当作 ACK；仅 settle pending，不广播。
- ConsoleBridge：建议启用过滤规则，避免日志回环（下一步可加开关）。
- 代码风格：统一使用 getLogger().info/warn/error/debug，禁用裸 console.*。

## 前端脚本加载规范更新（PDF-Viewer）

- 归口：PDF-Viewer Assets
- 变更：src/frontend/pdf-viewer/assets/floating-controls.js 现使用 ES Module 语法（import getLogger）。
- 要求：在 src/frontend/pdf-viewer/index.html 中必须以模块方式加载：
  - <script type="module" src="assets/floating-controls.js"></script>
- 说明：统一使用项目 Logger，不得回退 console.*；如需在 HTML 直连脚本中使用 Logger，必须以模块脚本加载。

## 契约一致性与门禁（新增）
- 合并前必须先合入契约（docs/contracts/*）并通过评审。
- 响应消息需满足：事件名三段式映射至 type，且响应 status=success/error 与事件状态一致。
- 后续将提供轻量 Schema 校验脚本（前端/后端均本地可跑），未通过禁止合并。


- 当前契约样例位于: todo-and-doing/1 doing/20251006182000-bus-contract-capability-registry/schemas
- 规格说明: todo-and-doing/1 doing/20251006182000-bus-contract-capability-registry/v001-spec.md

- 新增脚本：scripts/validate_schemas.py（UTF-8-SIG 读取，检查Schema关键字段），建议在CI中执行。

## 新增：Annotation 域 WS 消息（v1）
- 请求：
  - nnotation:list:requested → data: { pdf_uuid }
  - nnotation:save:requested → data: { pdf_uuid, annotation }
  - nnotation:delete:requested → data: { ann_id }
- 响应：
  - nnotation:list:completed → data: { annotations: [], count }
  - nnotation:save:completed → data: { id, created?, updated? }
  - nnotation:delete:completed → data: { ok }
- 说明：前端 AnnotationManager 自动从 DI 容器获取 wsClient，可用即远程持久化；否则退化为 Mock。

## 代码格式化工具（2025-10-06）
- 使用 Prettier 统一批量格式化，配置文件 `.prettierrc.json`（100列、单引号、LF）。
- 默认忽略目录：`node_modules/`、`build/`、`dist/`、`logs/`、`AItemp/`、`todo-and-doing/`（见 `.prettierignore`）。
- 命令：
  - 写入格式：`pnpm run format`（封装 `scripts/run-prettier.mjs --write`，作用于 `src/`、`scripts/` 及根部配置文件）。
  - 校验：`pnpm run format:check`（同脚本 `--check`）。可用 `--pattern <glob>` 指定子集。
- 示例：`pnpm run format:check -- --pattern scripts/test-formatting-sample.js`
- 快速自测：`pnpm run test:format` 会在示例文件上执行 `format:check`，验证命令链路。


### 技术变更：Toast 方案
- 引入第三方库 iziToast 作为统一 toast 方案；废弃原先依赖 DOM 元素（#global-success/#global-error）的方式。
- 使用方法不变：
  - showSuccess(message, durationMs=3000)
  - showError(message, durationMs=5000)
  - showInfo(message, durationMs=3000)
  - hideAll()
- 实现位置：src/frontend/common/utils/notification.js（内部 import 'izitoast/dist/css/iziToast.min.css' 全局引入样式）
- 注意：duration=0 表示不自动关闭（iziToast 用 	imeout: false）。
# 技术变更记录（SQLite 搜索+筛选）

## UI 交互细则补充（2025-10-07）
- pdf-home 侧边栏（宽度 280px）展开时不得遮挡搜索结果区域：
  - 由 `SidebarContainer` 在交互层对 `.main-content` 施加行内样式，展开：`margin-left: 280px; width: calc(100% - 280px)`；收起：清空行内样式；
  - 首次渲染根据当前状态立即应用，避免初始遮挡。
  - 事件契约保持不变：仍发布 `sidebar:toggle:completed { collapsed: boolean }`。
  - 若后续统一改回纯 CSS，请在 `style.css` 内为 `.sidebar:not(.collapsed) + .main-content` 定义等效规则，并移除行内样式逻辑。

时间：2025-10-07 05:35

## 变更摘要
- 后端新增 `pdf_info_plugin.search_with_filters`：在 SQLite 内部执行“搜索 + 筛选”的 WHERE 条件。
- API/Service 统一使用以上方法收敛候选集，再在 Python 端计算 `match_score` 与分页，兼容既有排序与单测。
- WebSocket 路由 `pdf-library:search:requested` 负载扩展：可携带 `filters`、`sort`、`search_fields`。
- 前端 `SearchManager` 发送时传入 `filters`；`FilterBuilder` 输出与 SearchCondition 一致的条件对象；`FilterFeature` 将“应用筛选”改为触发后端搜索。

## 使用方式变更
- 前端触发搜索：
  - 原：`eventBus.emit('search:query:requested', { searchText })`
  - 新（可选条件）：`eventBus.emit('search:query:requested', { searchText, filters })`

## 注意事项
- `tags has_any` 使用 LIKE 近似匹配，后续可升级 FTS/虚表优化。
- `match_score` 排序仍在 Python 侧，若要纯 SQL 排序需设计打分公式或 FTS 排名函数。
## 书签存储一致性（pdf-viewer）
- 问题修复（2025-10-07）
  - saveToStorage 仅序列化“根节点树”（`rootIds -> tree`），不再将 Map 中所有节点作为顶层提交，避免后端将所有节点当作根导致覆盖写入异常。
  - loadFromStorage 递归将“根与所有子孙”写入内部 Map，保证 `getBookmark(id)` 可命中任意层级，排序/删除操作稳定。
- 验收基线
  - 删除根节点：仅该根及其子孙被移除；其它根不受影响；刷新后保持一致。
  - 删除子节点：仅该节点（及其子孙）被移除；父与同级以及其它根不受影响；刷新后保持一致。
### 大纲（原书签）拖拽排序索引策略（2025-10-08）
- UI 与数据层的配合：
  - UI 在 drop 事件中对同父情形计算 newIndex：`before => targetIndex`，`after => targetIndex + 1`；
  - 数据层（BookmarkManager.reorderBookmarks）在同父且 `oldIdx < targetIndex` 时执行一次左移修正（`targetIndex -= 1`），最终效果与语义保持一致；
- 这样可以消除“UI 与数据层双重修正”的叠加导致的偏移，避免回读后看起来“节点消失/跑飞”。
- 术语统一：UI 中文展示统一由“书签”改为“大纲”，事件常量与模块命名保持不变。
