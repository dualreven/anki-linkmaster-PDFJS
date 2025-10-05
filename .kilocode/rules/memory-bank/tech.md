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

## 后端日志规范
- 统一使用 Python `logging`，显式 UTF-8；必要时采用覆盖写并确保行尾正确。

## 前端基础设施
- 统一依赖 `src/frontend/common/*`：
  - `event/event-bus.js`
  - `utils/logger.js`
  - `ws/ws-client.js`
- QWebChannel 逻辑由前端管理（如 `src/frontend/pdf-home/qwebchannel-manager.js`）。

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
- 2025-10-05：新增 `PDFLibraryAPI`，提供 `list_records/get_record_detail/update_record/delete_record/register_file_info`，单位为秒/毫秒转换遵循 JSON-MESSAGE-FORMAT-001，WebSocket `pdf/list` 消息返回 `records`。
- 校验：使用 `#hasFieldReference` 判断公式是否引用字段，floor(filename)/length(title) 等公式被视为合法。
- 搜索结果布局：`.search-results-container` 使用 `layout-single/double/triple` 类控制列数，按钮状态存储于 localStorage(`pdf-home:search-results:layout`)；布局按钮样式位于 search-results.css。
