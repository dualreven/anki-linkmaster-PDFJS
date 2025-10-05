# Memory Bank（精简版 / 权威）

## 总体目标
- 前端（pdf-home、pdf-viewer）为纯 UI 模块，复用共享基础设施（EventBus / Logger / WSClient），仅在必要时通过 QWebChannel 与 Python 通信。
- 后端分三类：WebSocket 转发器（仅收发转发）、HTTP 文件服务器（仅文件传输）、PDF 业务服务器（独立、接收指令执行业务）。
- 日志分层：前端控制台经 DevTools 捕获写入 UTF-8 文件；后端统一用 Python logging（文件覆盖写，UTF-8）。
- AI Launcher 模块化：服务短小、可 start/stop/status，模块可独立运行与测试。

## 统一规范
- 目录命名：统一 kebab-case（示例：`pdf-home` / `pdf-viewer`），禁止 `pdf_home`。
- 文件 I/O：所有读写显式 UTF-8；确保换行 `\n` 正确。
- 前端依赖：统一使用 `src/frontend/common/*`（EventBus / Logger / WSClient）。

## 模块职责
- pdf-home：列表/选择/动作的 UI；QWebChannel 前端侧管理；前端日志 → `logs/pdf-home-js.log`。
- pdf-viewer：渲染与控件 UI；按 pdf_id 输出日志 → `logs/pdf-viewer-<pdf-id>-js.log`；✅ **已完成重构 (2025-09-26)**。
- WebSocket 转发器：`src/backend/websocket/standard_server.py`（headless，仅路由）。
- HTTP 文件服务器：`src/backend/http_server.py`（仅文件传输，支持 Range，UTF-8 日志）。
- PDF 业务服务器（待实现）：`src/backend/services/pdf_business_server.py`（建议路径）。
- AI Launcher：`ai-scripts/ai_launcher/*`（ServiceManager / ProcessManager / CLI / 示例服务）。

## 现状（快照）
- 已完成：
  - 命名清理（统一 kebab-case）；前端日志捕获（pdf-home、pdf-viewer 按 pdf_id）。
  - pdf-viewer UI 私有字段使用修复（以 `#elements/#state` 为中心）。
  - HTTP 文件服务器可独立运行；AI Launcher 模块化骨架就绪。
  - ✅ **pdf-viewer日志系统重构完成 (2025-09-26)**：参考pdf-home设计，实现简化版架构，支持动态PDF ID命名格式。
  - ✅ **PDF中文渲染修复完成 (2025-09-30)**：使用Vite别名@pdfjs简化CMap和标准字体路径，解决中文字符无法渲染问题。
  - ✅ **PDF-Home添加和删除功能完成 (2025-10-01)**：包含文件选择、上传、删除、列表更新、错误处理等完整流程。参考提交: bf8b64d。
  - ✅ **PDF书签侧边栏功能完成 (2025-10-01)**：pdf-viewer模块的书签侧边栏功能已实现并可用。
  - ✅ **PDF-Viewer搜索按钮事件修复完成 (2025-10-03)**：修复了SearchFeature的参数签名错误和SimpleDependencyContainer的架构缺陷，实现了原型链式依赖注入，搜索按钮现可正常点击并弹出搜索框。参考提交: 待提交。
- 待办：
  - 实现最小版 PDF 业务服务器并接入 WS 转发。
  - 复核 pdf-viewer 全量对齐共享 EventBus/WSClient。
  - 为 Launcher 增加健康检查与 E2E 脚本。
  - ✅ **PDF书签加载问题修复** (2025-10-04): PDF自带书签无法加载问题已解决
    - 根因: PDFBookmarkFeature未注册到bootstrap + 错误的依赖声明
    - 修复: 在app-bootstrap-feature.js中注册Feature + 修正feature.config.js依赖为pdf-manager
    - 工作日志: AItemp/20251004145800-AI-Working-log.md
  - ✅ **侧边栏统一管理** (20251004030451-sidebar-unified-management):
    - 创建SidebarManagerFeature统一管理标注栏、书签栏、卡片栏、翻译栏
    - 实现右侧流动布局系统，支持多侧边栏并存
    - ❌ 所有按钮都不显示激活状态（需求变更v001.1）
    - ✅ 按钮切换关闭 + 侧边栏关闭按钮（X图标）
    - ✅ 宽度可拖拽调整（250-600px，支持localStorage持久化）（需求变更v001.2）
  - ✅ **PDF渲染区布局适配** (20251004193000) (2025-10-04 19:30-19:45):
    - 需求澄清: 侧边栏打开时PDF渲染区**自动缩小宽度**，不被遮挡，居中显示
    - 核心实现: 创建PDFLayoutAdapter监听`sidebar:layout:changed`事件，动态调整PDF容器margin-right
    - 技术方案: 事件驱动非侵入式设计，SidebarManager计算总宽度→发布事件→PDFLayoutAdapter调整布局
    - 文件修改: style.css (margin-right过渡)、pdf-layout-adapter.js (新建84行)、sidebar-manager/index.js (事件发布)
    - 提交记录: b44a799 "feat(pdf-viewer): 侧边栏打开时PDF渲染区自动缩小，不被遮挡"
    - 工作日志: AItemp/20251004193000-AI-Working-log.md
  - ✅ **插件隔离架构改进** (20251004200000) (2025-10-04 20:00):
    - 目标: 提升pdf-viewer功能域插件架构的隔离质量（7.6→9.0分）
    - 核心修复:
      1. 依赖声明完整性：sidebar-manager添加pdf-bookmark依赖
      2. 消除全局访问：SelectionMonitor改用依赖注入获取container
      3. 文档完善：创建EventBus使用规范指南（EVENTBUS-USAGE-GUIDE.md）
    - 文件修改: sidebar-manager/index.js、pdf-translator/index.js、SelectionMonitor.js
    - 新增文档: src/frontend/common/event/EVENTBUS-USAGE-GUIDE.md (完整的API使用指南)
    - 提交记录: c96f346 "refactor(architecture): 改进插件隔离架构和EventBus规范"
    - 分析报告: AItemp/20251004193000-pdf-viewer-isolation-analysis.md
    - 改进总结: AItemp/20251004200000-isolation-improvements-summary.md
  - ✅ **Worktree D 合并：书签智能添加功能** (2025-10-04 20:05):
    - 合并分支: d-main-20250927
    - 新增提交: b4250f6 feat(pdf-bookmark): 智能添加位置和自动选中功能
    - 功能说明:
      1. 添加书签时智能判断插入位置（在选中书签后面）
      2. 自动选中新添加的书签节点
      3. 优化用户体验
    - 文件修改: pdf-bookmark/index.js (+73行)、bookmark-manager.js (+23行)、bookmark-sidebar-ui.js (+65行)
    - 提交记录: 5106808 "Merge worktree D: 书签智能添加功能 (1个提交)"

## 已知问题：PDF列表双重更新问题 (2025-09-28)
**问题描述**：`pdf:list:updated` 事件被触发两次，导致UI可能重复渲染。

**根本原因**：
PDFManager的`handleResponseMessage`方法在处理WebSocket响应时，如果响应包含文件列表但没有batch_id，会自动触发额外的`loadPDFList()`请求，导致：
1. 第一次：处理初始的`get_pdf_list`响应，触发`pdf:list:updated`事件
2. 第二次：检测到响应包含files数组，认为是"聚合批次响应"，再次请求列表并触发事件

**影响**：
- 不必要的网络请求
- 潜在的UI闪烁或性能问题
- 事件监听器被多次调用

**建议修复方案**：
在`websocket-handler.js`第215行的条件判断中，排除`get_pdf_list`类型的响应，避免重复请求。

**验证证据（来自 logs/pdf-home-js.log）**：
- 初始化阶段：`PDFManager.initialize()` 调用 `loadPDFList()` 发布 `get_pdf_list`（事件总线日志 + WSClient 收到发送请求日志）。
- 连接建立后：WSClient 在 `onopen` 里调用 `#flushMessageQueue()`，队列中包含 `get_pdf_list`，完成首次真实发送（标记为 queue_flush）。
- 随后一次：收到带有聚合 files 的响应，`WebSocketHandler.handleResponse()` 认为需要刷新，触发第二次 `loadPDFList()`（标记为 refresh_after_aggregated_response）。

可运行的日志分析脚本（UTF-8）验证：`AItemp/tests/analyze-get-pdf-list.ps1`
- 读取 `logs/pdf-home-js.log`（`-Encoding UTF8`），分类 `get_pdf_list` 的上下文：
  - `initial_request_from_pdf_manager`
  - `queue_flush_after_connect`
  - `refresh_after_aggregated_response`
  - 统计输出示例：`total_matches=5`，其中包含队列刷新1次、聚合响应后刷新1次。

**相关模块/函数**：
- `src/frontend/common/pdf/pdf-manager-core.js:73` `loadPDFList()`
- `src/frontend/common/pdf/pdf-manager.js:25` `initialize()`（注册监听后调用 `loadPDFList()`）
- `src/frontend/common/pdf/websocket-handler.js:115` `handleResponse()`（聚合响应触发二次 `loadPDFList()`）
- `src/frontend/common/ws/ws-client.js:170` `#flushMessageQueue()`（连接建立后发送排队消息）

## 重要发现：AI重复开发问题系统性分析 ✅ 完成 (2025-09-28)
- **问题发现**：通过分析最近工作日志，发现AI开发中存在严重的重复开发问题
- **典型表现**：
  - 日志过滤功能在4小时内被反复修改
  - PDF列表更新存在两条并行处理路径
  - 控制台消息处理被重复实现
- **根本原因**：
  1. 上下文碎片化 - AI读取代码不完整，不了解已有实现
  2. 缺乏架构全貌认知 - 不理解整体系统架构
  3. 历史任务追溯不足 - 没有系统性回顾修改历史
  4. 功能去重检查缺失 - 开发前没有验证功能是否已存在
  5. 响应式开发模式 - 只解决当前问题，不考虑整体一致性
- **解决方案**：
  - 建立强制性架构调研流程
  - 实施功能去重检查机制
  - 强化历史工作日志追溯
  - 建立功能注册表和事件处理统一规范
- **产出文档**：`AItemp/AI重复开发问题分析报告-20250928.md`

## 已完成任务：分析 WSClient 两次发送 get_pdf_list ✅ 完成 (2025-09-28)
- 背景：用户反馈 `WSClient` 发送了两次 `get_pdf_list`。
- 目标：基于事实（日志+代码）解释两次发送的触发链路，并提供可复验证据。
- 执行结果：已识别为AI重复开发问题的典型案例，纳入系统性分析

## 已完成任务：PDF.js性能优化研究 ✅ 完成 (2025-09-27)
- **目标**: 研究PDF.js的性能优化方案，特别是页面边界检测、按需加载、虚拟化和内存管理
- **执行结果**:
  - ✅ **页面边界检测**：研究了PDF.js原生API方法（getViewport、getCropBox）和PDF文件结构解析
  - ✅ **按需加载策略**：深入分析了disableAutoFetch/disableStream配置和HTTP Range请求实现
  - ✅ **虚拟化方案**：提供了智能页面管理和预加载策略的具体实现代码
  - ✅ **内存优化**：研究了缓存策略和性能优化配置，可实现90%内存消耗降低
  - ✅ **技术调研**：分析了2024年最新技术趋势和版本兼容性问题
- **技术要点**：
  - 使用PDF.js原生API无需第三方库即可实现页面边界检测
  - 通过HTTP Range请求和智能缓存策略实现真正的按需加载
  - 合理配置disableAutoFetch/disableStream可显著提升大型PDF性能
  - 需要注意版本兼容性：建议使用2.5.207稳定版本
- **文档产出**：`AItemp/20250927141314-AI-Working-log.md` 包含详细的技术研究报告和代码示例

## 已完成任务：PDF-Viewer模块拆分方案设计 ✅ 完成 (2025-09-29)
- **目标**: 基于pdf-home模块的成功架构模式，设计pdf-viewer模块的完整拆分方案
- **背景**: pdf-home模块已成功实现模块化拆分，现需要将经验应用到pdf-viewer模块
- **执行结果**:
  - ✅ **pdf-home架构分析**: 识别出5层分层架构、依赖注入容器、专门管理器等成功模式
  - ✅ **文件大小分析**: pdf-home有16个200+行文件，pdf-viewer有13个200+行文件需要拆分
  - ✅ **拆分方案设计**: 提供了详细的三优先级拆分计划，涵盖所有超大文件
  - ✅ **目录结构规划**: 设计了与pdf-home一致的模块化目录结构
  - ✅ **实施策略**: 制定了渐进式拆分、接口兼容、测试覆盖等实施指导
- **技术要点**:
  - pdf-home成功模式：Bootstrap模式、Container模式、Manager模式、Handler模式、Utils模式
  - 拆分目标：单个文件从平均395行降至150行，提升可维护性
  - 架构一致性：与pdf-home保持统一的分层架构和设计原则
  - 渐进式实施：按优先级分批拆分，确保功能完整性
- **产出文档**: `AItemp/20250929163759-AI-Working-log.md` 包含完整的分析报告和拆分方案
- **后续建议**: 建议按第一优先级开始实施，先处理最大的4个核心文件

## 已完成任务：PDF中文字符渲染修复 ✅ 完成 (2025-09-30)
- **问题**: PDF中的中文字符无法渲染，日志显示CMap文件加载失败(404错误)
- **根本原因**:
  - 相对路径计算错误：pdf-loader.js位于`src/frontend/pdf-viewer/pdf/`，使用`../../../`向上3层只到`src/`目录
  - 实际node_modules在项目根目录，需要向上4层才正确
  - Vite将错误路径映射为`/@fs/.../src/node_modules/...`导致404
- **解决方案**:
  - 在vite.config.js添加别名：`'@pdfjs': path.resolve(process.cwd(), 'node_modules/pdfjs-dist')`
  - 在pdf-loader.js和pdf-manager-refactored.js中使用`@pdfjs/cmaps/`和`@pdfjs/standard_fonts/`
- **技术亮点**:
  - 使用Vite官方推荐的resolve.alias功能
  - 路径简洁清晰，易于维护
  - 本地资源，不依赖网络
- **修改文件**:
  - `vite.config.js:44-49` - 新增resolve.alias配置
  - `src/frontend/pdf-viewer/pdf/pdf-loader.js:50-54,103-107` - 启用CMap和标准字体
  - `src/frontend/pdf-viewer/pdf/pdf-manager-refactored.js:61-62` - 启用标准字体
- **Commit**: 8653524 "修复: PDF中文字符渲染问题 - 使用Vite别名简化CMap路径"

## 已完成任务：PDF-Home模块日志系统分析 ✅ 完成 (2025-09-30)
- **目标**: 深度分析pdf-home模块的日志系统实现，包括初始化、配置、错误处理和事件监听机制
- **执行结果**:
  - ✅ **5层分层架构**: 识别出Bootstrap层、Container层、Manager层、Logger层、Console Bridge层的完整架构
  - ✅ **双路径日志系统**: 发现控制台输出(Logger)和WebSocket转发(ConsoleWebSocketBridge)并行机制
  - ✅ **事件驱动初始化**: 分析了基于EventBus的日志系统启动和错误处理流程
  - ✅ **错误处理链**: 梳理了从全局异常到用户友好提示的完整错误处理机制
  - ✅ **实际日志分析**: 通过真实日志文件验证了系统运行状态和事件流
- **技术发现**:
  - Logger实例缓存和单例模式确保模块内日志一致性
  - ConsoleWebSocketBridge实现了防循环的智能过滤机制
  - 事件总线中的subscriberId机制避免了重复订阅问题
  - 两阶段初始化模式(容器→连接)确保依赖正确创建
  - 分层错误处理：技术错误→业务错误→用户友好提示的转换链
- **产出文档**: `AItemp/20250930162000-AI-Working-log.md` 包含完整的技术分析报告

## 当前任务：实现统一的 `ai_launcher.py` (2025-09-27)
- **目标**: 创建一个位于项目根目录的 `ai_launcher.py` 脚本，用于统一管理所有前端和后端服务的生命周期。
- **背景**: 当前项目拥有一个模块化的 `ai-scripts/ai_launcher` 框架，但缺少一个顶层的、用户友好的命令行入口。此任务旨在创建该入口，并将其与现有框架集成。
- **原子步骤**:
  1.  **创建 `ai_launcher.py`**: 在项目根目录创建该文件，并使用 `argparse` 设置 `start`, `stop`, `status` 子命令。
  2.  **定义前端服务**: 在 `ai_scripts/ai_launcher/services/` 下创建 `frontend` 目录，并添加 `pdf_home_service.py` 和 `pdf_viewer_service.py`，用于封装各自的启动逻辑。
  3.  **实现 `start` 命令**:
      -   注册所有服务（Vite, WS, PDF Server, pdf-home, pdf-viewer）。
      -   根据 `--module` 参数确定要启动的前端服务。
      -   将所有命令行参数（如 `--vite-port`）传递给相应的服务。
      -   调用 `ServiceManager.start()` 启动服务。
  4.  **实现 `stop` 命令**: 调用 `ServiceManager.stop()` 来终止所有已知的服务。
  5.  **实现 `status` 命令**: 调用 `ServiceManager.status()` 来显示所有服务的状态。
  6.  **配置日志**: 使用 `logging_manager` 将 `ai_launcher.py` 的日志输出到 `logs/ai-launcher.log`。
\n## 新任务：完善 ai_launcher.py CLI（2025-09-27 任务单）
- 问题描述：需要在根目录的 `ai_launcher.py` 中实现 start/stop/status 命令，支持参数 `--vite-port`、`--msgServer-port`、`--pdfFileServer-port`、`--module`、`--pdf-id`；按要求编排启动流程，追踪并写入 `logs/dev-process-info.json` 与 `logs/frontend-process-info.json`；全程 UTF-8 与 `\n`；记录异常到 `logs/ai-launcher.log`。
- 背景：仓库已有模块化能力（`ai_scripts/ai_launcher`），后端已有 `src/backend/launcher.py`；前端各自有 `src/frontend/pdf-home/launcher.py` 与 `src/frontend/pdf-viewer/launcher.py`，其参数略有出入（`--ws-port/--pdf-port`），需要在编排层做参数映射。
- 相关模块/函数：
  - `ai_scripts.ai_launcher.core.PortManager`（端口合并、冲突检测与分配；`logs/runtime-ports.json`）
  - `ai_scripts.ai_launcher.services.persistent.NpmDevServerService`（`pnpm run dev`）
  - `src/backend/launcher.py`（后端 start/stop/status）
  - `src/frontend/pdf-home/launcher.py` 与 `src/frontend/pdf-viewer/launcher.py`（前端窗口）

### 执行步骤（原子任务拆分）
1. 解析 CLI：命令与参数定义（start/stop/status 与所列参数）。
2. 初始化日志：`logs/ai-launcher.log`（UTF-8）。
3. 端口解析：优先级（CLI > runtime-ports.json > npm-dev-vite.log > 默认）并校验可用性。
4. 启动 Vite：关闭已跟踪 Vite，启动 `pnpm run dev -- --port <vite>`，记录到 `logs/dev-process-info.json`。
5. 启动后端：`python src/backend/launcher.py start [--msgServer-port][--pdfFileServer-port]`。
6. 启动前端：基于 `--module` 分支，参数映射为 `--ws-port/--pdf-port/--vite-port`，`--pdf-id` 仅记录（pdf-viewer 实际不接收该参数）。记录到 `logs/frontend-process-info.json`。
7. stop：停止 Vite、前端，并调用后端 stop；清理各 JSON。
8. status：打印两份 JSON，并输出后端 status。
9. 测试：新增 AItemp 下测试脚本（干跑/不起进程），验证端口解析与 JSON/换行写入。

### 备注（接口不一致处理）
- `--msgServer-port` 映射为前端的 `--ws-port`；`--pdfFileServer-port` 映射为 `--pdf-port`。
- `--pdf-id`：pdf-viewer 实际使用 `--file-path` 推导 pdf_id，编排器保存该 id 到前端进程信息，不向启动器传参以避免不识别参数。

## 已完成任务记录（2025-09-27）

### WebSocket模块README文档编写 ✅ 完成
**任务目标**: 为WebSocket模块(msgCenter_server)编写完整的README文档，介绍架构、功能和使用方法

**执行结果**:
- ✅ **模块分析**: 深入分析了WebSocket模块的5个核心组件和分层架构设计
- ✅ **文档编写**: 创建了包含9个主要章节的完整README文档(`src/backend/msgCenter_server/README.md`)
- ✅ **质量保证**: 开发并运行了文档质量测试脚本(`scripts/test_msgcenter_readme.py`)
- ✅ **验证通过**: 所有8项质量检查全部通过，包括UTF-8编码、换行符格式、内容完整性

**文档特色**:
- 可视化架构图(ASCII艺术)展示系统层次结构
- 26个代码示例涵盖各种使用场景
- 完整的API文档(消息类型、状态码、错误处理)
- 实用的故障排除指南和调试技巧
- 详细的安全特性说明(AES-256-GCM加密、HMAC验证)

**文档规范**:
- 严格遵循UTF-8编码和`\n`换行符要求
- 结构化内容组织，便于开发者快速定位
- 丰富的代码示例和配置说明
- 完整的故障排除和维护指南

### pdfTable_server模块README文档编写 ✅ 完成
**任务目标**: 为pdfTable_server模块编写完整的README文档，介绍架构、功能和使用方法

**执行结果**:
- ✅ **模块分析**: 深入分析了AnkiLinkMasterApp主应用和application_subcode子模块架构
- ✅ **文档编写**: 创建了包含9个主要章节的完整README文档(`src/backend/pdfTable_server/README.md`)
- ✅ **质量保证**: 开发并运行了文档质量测试脚本(`scripts/test_pdftable_readme.py`)
- ✅ **验证通过**: 所有12项质量检查全部通过，包括UTF-8编码、子模块结构、错误码映射等

**文档特色**:
- 三层架构的可视化展示(前端应用层 → PDF应用服务器 → 后端服务层)
- 32个代码示例涵盖WebSocket消息、配置、扩展开发等场景
- 详细的子模块说明(application_subcode结构和SPEC规范)
- 完整的错误码映射和消息格式规范
- 实用的性能监控和维护建议

**文档规范**:
- 严格遵循UTF-8编码和`\n`换行符要求
- 模块化文档结构，突出服务协调器的核心作用
- 丰富的配置说明和多种启动方式
- 完整的开发规范和扩展指南

### pdf-home模块README文档编写 ✅ 完成 (2025-09-27)
**任务目标**: 为pdf-home模块重写完整的README文档，介绍架构、功能和使用方法

**执行结果**:
- ✅ **深度模块分析**: 全面分析了pdf-home模块的代码结构，包含558行的主应用文件和事件驱动架构
- ✅ **架构文档化**: 理解并文档化了事件驱动的组合式架构设计和依赖注入容器模式
- ✅ **功能清单**: 识别并详细描述了PDF文件管理、实时通信、Qt集成、调试监控等核心功能
- ✅ **完整文档创建**: 创建了1704行的综合性README文档，包含11个主要章节和61个代码示例
- ✅ **质量验证**: 开发并运行了10项质量测试，全部通过验证，确保文档符合项目标准

**文档特色**:
- ASCII架构图展示5层架构的可视化设计
- 61个代码示例涵盖JavaScript、Bash、JSON、Python等多种场景
- 完整的WebSocket API文档和QWebChannel桥接说明
- 详细的事件系统文档，包含Mermaid流程图
- 实用的故障排除指南和3种性能优化建议
- 完整的开发指南，包含环境设置、测试策略、调试技巧

**文档规范**:
- 严格遵循UTF-8编码和`\n`换行符要求
- 结构化的11章节组织，便于开发者导航
- 丰富的代码示例和实际配置说明
- 完整的API接口文档和故障排除指南
- 质量测试验证：3464词内容，15个内部链接，完整版本历史

### pdf-viewer模块README文档编写 ✅ 完成 (2025-09-27)
**任务目标**: 为pdf-viewer模块重写完整的README文档，介绍架构、功能和使用方法

**执行结果**:
- ✅ **深度模块分析**: 全面分析了pdf-viewer模块的代码结构，理解了容器化依赖注入架构
- ✅ **完整文档创建**: 创建了2332行的综合性README文档，包含13个主要章节和79个代码示例
- ✅ **质量验证**: 开发并运行了11项质量测试，全部通过验证，确保文档符合项目标准
- ✅ **部署运维**: 新增部署指南、监控维护、安全考虑等生产环境相关内容

**文档特色**:
- ASCII架构图展示五层架构的可视化设计
- 79个代码示例涵盖JavaScript、Bash、JSON、Python、Docker等多种技术栈
- 完整的WebSocket API文档和QWebChannel桥接说明
- 详细的部署指南，包含Nginx配置、Docker容器化、系统服务配置
- 全面的安全考虑，涵盖网络安全、文件安全、输入验证等防护措施
- 完整的监控维护方案，包含性能监控脚本和自动化维护脚本

**文档规范**:
- 严格遵循UTF-8编码和`\n`换行符要求
- 结构化的13章节组织，从架构概述到部署运维的完整覆盖
- 丰富的代码示例和实际配置说明
- 完整的API接口文档和故障排除指南
- 质量测试验证：4969词内容，17个章节，14个内部链接，79个代码块

### pdfFile_server模块化重构 ✅ 完成 (2025-09-27)
**任务目标**: 将现有的pdfFile_server.py重构为模块化结构，提高代码的可维护性和扩展性

**执行结果**:
- ✅ **模块化重构**: 将168行单文件重构为6个子模块的分层架构
- ✅ **文档编写**: 创建了包含9个主要章节的完整README文档(`src/backend/pdfFile_server/README.md`)
- ✅ **兼容性测试**: 开发并运行了7项兼容性测试，全部通过验证
- ✅ **向后兼容**: 保持与原有HttpFileServer类和run_server函数的完全兼容性

**模块化架构**:
- config/: 配置层 - 统一管理所有可配置参数
- utils/: 工具层 - 日志配置等通用工具
- handlers/: 处理层 - HTTP请求处理逻辑
- server/: 服务层 - 服务器启动和管理
- cli/: 接口层 - 命令行接口
- README.md: 完整的模块文档(600行)

**技术特性**:
- 分层架构设计，职责清晰分离
- 完整CORS支持和健康检查端点
- UTF-8编码和覆盖模式日志系统
- 阻塞和非阻塞两种启动模式
- 完整的命令行参数验证和帮助

**文档规范**:
- 严格遵循UTF-8编码和`\n`换行符要求
- 详细的架构说明和使用指南
- 完整的API文档和故障排除指南
- 丰富的代码示例和配置说明

### 先前任务记录（已完成）
- 新增文档：`README.ai_launcher.md`、`src/backend/README.md`
- 新增测试：`scripts/test_readmes.py`，校验 UTF-8 读取、关键段落、无 `\r` 字符（保证使用 `\n`）
- 本地执行测试：PASS



### 变更记录（2025-09-28）
- 调整 PDFManager 初始列表请求触发时机：仅在 `WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED` 事件触发后调用 `loadPDFList()`（一次性订阅后自动取消）。
- 代码：src/frontend/common/pdf/pdf-manager.js（使用 UTF-8 编码保存，确保 `\n` 换行）。
- 预期：消除连接前入队导致的首次 flush 发送，减少一次不必要的 get_pdf_list 触发。
- 测试：AItemp/tests/test-pdfmanager-load-trigger.ps1 通过。


### 诊断：大量 [console-websocket-bridge.js:<line>] 日志来源 (2025-09-28)
- 来源：前端 `ConsoleWebSocketBridge` 覆写了 `console.*`，所有控制台输出都会先进入 `intercept()`，再通过 `originalConsole[level](...)` 打印，故 QWebEngine/浏览器记录的源文件与行号指向 `console-websocket-bridge.js`（常见为 61/77/87）。
- 触发：启用了 console-bridge 后，EventBus 订阅/发布、WSClient 信息级日志等都会通过该桥打印并被捕获，数量较大属预期。
- 证据：`AItemp/tests/summarize-bridge-logs.ps1` 统计发现 `console-websocket-bridge.js:87` 占多数；用户环境可能因版本/打包差异显示为 :61。
- 降噪建议：
  1) 收紧 `shouldSkipMessage()` 的 `skipPatterns`（过滤 EventBus 订阅/发布、桥接启用/禁用日志等）
  2) 仅在 `websocket:connection:established` 后启用桥接，必要时只转发 warn/error
  3) 为桥接添加采样/节流，或对 INFO 级别按模块白名单输出


### JS 日志清理（2025-09-28）
- 需求：去掉日志中 `[JAVASCRIPTCONSOLEMESSAGELEVEL.INFOMESSAGELEVEL] [http://localhost:3000/...:87]` 类冗余前缀
- 变更：`src/frontend/pyqtui/main_window.py:write_js_console_message`
  - 级别简化改为大小写无关，映射到 INFO/WARN/ERROR/CRITICAL
  - 新增清理规则：剔除消息开头的 `[JavaScriptConsoleMessageLevel.*]` 与 `[http(s)://...:line]` 段
  - 仍保留 `[filename:line]` 形式的精简来源
- 测试：`AItemp/tests/test_js_log_cleanup.py` PASS
- 影响：仅改变写入日志的可读性，不影响业务逻辑与WS交互


### 日志过滤恢复（2025-09-28）
- 将 `src/frontend/common/utils/console-websocket-bridge.js` 还原为"基线过滤"：
  - `intercept()` 调用 `shouldSkipMessage(messageText)`（不再传入级别）
  - `shouldSkipMessage(messageText)` 使用原始 `skipPatterns`（仅避免循环/重复，而不屏蔽 INFO 噪音）
- 目的：恢复此前被过滤掉的 EventBus/队列/初始化类 INFO 日志。
- 测试：`AItemp/tests/test-console-bridge-restore.ps1` PASS

### QWebChannel 初始化失败分析 ✅ 完成 (2025-09-28)
**问题**: 日志中出现 `[QWebChannelManager] [WARN] QWebChannel initialization failed: QWebChannel not available - running in browser mode`

**根本原因**:
- Vite 开发服务器无法提供 `/js/qwebchannel.js` 文件（404错误）
- 文件实际位置：`public/js/qwebchannel.js`（项目根目录）
- Vite 配置：`root: 'src/frontend'`，默认publicDir为 `src/frontend/public`
- 导致 `QWebChannel` 对象未定义，触发浏览器模式降级

**历史修复状态**:
- 曾通过配置修复：在 `vite.config.js` 添加 `publicDir: path.resolve(process.cwd(), 'public')`
- 但该修复已被回滚（参考 `20250928185656-AI-Working-log.md`）

**当前影响**:
- 系统自动降级为浏览器模式，功能正常
- 无法使用 Qt 原生文件选择器等 PyQt 集成功能
- 如在 PyQt WebEngine 环境中运行，会继续等待 `qt.webChannelTransport` 并可能超时

**解决方案**:
1. 重新应用 Vite 配置修复
2. 或将静态资源迁移到 `src/frontend/public/` 目录
3. 改进环境检测逻辑，更好区分浏览器模式和 Qt 模式

**相关文档**: `AItemp/20250928185730-AI-Working-log.md` 包含详细分析

## pdf-viewer重构进展

### 当前状态
- 最后更新: 2025-10-04 19:00
- 阶段: ✅ **全模块 Feature-based 架构统一完成 + 核心功能全面扩展**
- 成果:
  * ✅ Worktree A (pdf-viewer annotation) 合并完成 (15个提交)
  * ✅ Worktree B (pdf-home) 三次合并全部完成
  * ✅ Worktree C (pdf-viewer translator) 合并完成 (2个提交)
  * ✅ Worktree D (pdf-viewer bookmark) 合并完成 (2个提交)
  * ✅ 两个模块架构完全统一
  * ✅ V1架构文件全部清理
  * ✅ 共享 micro-service 基础设施
  * ✅ 12个功能域全部实现 (新增: PDFTranslator, PDFBookmark增强, Annotation完善)
  * ✅ 开发工具脚本完善（5个工具）
  * ✅ PDF排序器完整实现（4种模式）
  * ✅ PDF翻译器完整实现
  * ✅ PDF书签增强（拖拽、跳转）
  * ✅ PDF标注功能完善
  * ✅ 前后端通信协议文档完善

### 已完成工作（最新优先）

1. **合并 worktree A、C、D (三大功能完整实现)** ✅ 完成 (2025-10-04 19:00)
   - **合并分支**:
     * worktree A: `feature-bookmark-fix` → `main` (Annotation功能完善)
     * worktree C: `feature-pdf-processing` → `main` (PDF翻译功能)
     * worktree D: `d-main-20250927` → `main` (书签功能增强)
   - **合并提交**: e6700d6 (A), 147f86a (C), 23a6be7 (D)
   - **代码变更**: +6,018行 / -304行 / 净增5,714行
   - **修改文件**: 35个
   - **功能提交**: 19个 (15个annotation + 2个translator + 2个bookmark)
   - **主要成果**:
     * ✅ **PDFTranslatorFeature (翻译功能)** - 完整实现
       - 翻译侧边栏UI (758行)
       - 文本选择监控服务 (410行)
       - 翻译服务抽象 (343行)
       - MyMemory翻译引擎 (225行)
       - 翻译结果自动创建高亮标注
     * ✅ **PDFBookmarkFeature增强 (书签功能)**
       - 书签拖拽排序和层级调整
       - 书签跳转功能
       - Hover按钮交互
       - 书签对话框和工具栏
       - 书签存储服务
     * ✅ **AnnotationFeature完善 (标注功能)**
       - 评论历史记录和对话框
       - 标注预览功能
       - ID复制功能增强
       - 卡片布局优化
       - 排序和辅助功能
       - 工具状态管理优化
   - **新增文件** (12个):
     * 翻译功能 (7个): TranslatorSidebarUI.js, TranslationService.js, SelectionMonitor.js, MyMemoryEngine.js, ITranslationEngine.js, events.js, index.js
     * 书签功能 (5个): bookmark-dialog.js, bookmark-toolbar.js, bookmark.js, bookmark-manager.js, bookmark-storage.js
   - **架构改进**:
     * Feature注册顺序优化 (按依赖关系)
     * SidebarManagerFeature扩展 (管理4个侧边栏)
     * 翻译引擎抽象层设计
   - **冲突解决**: 1个冲突 (app-bootstrap-feature.js)
     * 原因: C和D都修改了Feature注册列表
     * 解决: 合并两边的import和register调用
   - **工作日志**: `AItemp/20251004184500-AI-Working-log.md`

2. **第三次合并 worktree B (PDF排序器功能)** ✅ 完成 (2025-10-04 18:35)
   - **合并分支**: `feature/pdf-home-add-delete-improvements` → `main` (第三次合并)
   - **合并提交**: d406ad2
   - **代码变更**: +3,521行 / -40行 / 净增3,481行
   - **本次合并的6个提交**:
     * 3873ef0 - docs(pdf-home): 添加前后端通信协议完整指南
     * 1ca570b - debug: 添加应用启动调试标识
     * 9d156b2 - feat: 启用 pdf-sorter 和 filter 功能模块
     * d04dc15 - feat(pdf-sorter): 添加排序面板完整样式
     * afe8fd1 - refactor(notification): 改用CSS类控制Toast显示隐藏
     * 035fd70 - fix(pdf-sorter): 修复事件订阅被覆盖导致模式切换无效的问题
   - **主要成果**:
     * ✅ PDF排序器(pdf-sorter)完整实现 - 4种排序模式（简单/多字段/权重/自定义）
     * ✅ 新增前后端通信协议完整指南文档（693行）
     * ✅ 完整UI组件体系（4个组件，2,412行）
     * ✅ 服务层抽象（2个服务，671行）
     * ✅ 新增417行样式代码
     * ✅ 通知系统优化（CSS类控制）
   - **新增文件** (7个):
     * Communication-Protocol-Guide.md (693行) - 前后端通信协议指南
     * mode-selector.js (300行) - 排序模式选择器
     * multi-sort-builder.js (398行) - 多字段排序构建器
     * sorter-panel.js (324行) - 排序面板主组件
     * weighted-sort-editor.js (390行) - 权重排序编辑器
     * sort-manager.js (361行) - 排序管理服务
     * tabulator-adapter.js (310行) - Tabulator适配器
   - **架构特性**:
     * 依赖注入架构
     * 事件驱动通信
     * 插件化设计
     * 状态管理
   - **冲突解决**: 无冲突，自动合并成功
   - **工作日志**: `AItemp/20251004183000-AI-Working-log.md`

2. **再次合并 worktree B 的新提交（V1架构清理）** ✅ 完成 (2025-10-02 22:17)
   - **合并分支**: `feature/pdf-home-add-delete-improvements` → `main` (第二次合并)
   - **合并提交**: aea64a0
   - **代码变更**: +730行 / -4,125行 / 净删除3,395行
   - **本次合并的3个提交**:
     * 321ec96 - refactor(pdf-home): 移除V1架构，完全迁移到V2功能域架构
     * d2ff056 - chore(scripts): 添加PDF字段扩展相关的开发工具脚本
     * 70aa160 - docs(memory-bank): 更新Memory Bank记录代码库清理和工具脚本提交
   - **主要成果**:
     * ✅ 删除所有V1架构文件（约3,730行代码）
     * ✅ 新增5个后端开发工具脚本（483行）
     * ✅ 扩展PDF模型字段（7个学习管理字段）
     * ✅ 优化功能域架构实现
     * ✅ 代码库精简度提升83%
   - **删除的V1组件**:
     * ❌ Bootstrap启动器 (app-bootstrap.js)
     * ❌ V1主应用 (pdf-home-app.js, 270行)
     * ❌ 三大管理器 (初始化/表格/WebSocket, 846行)
     * ❌ Table模块 (6个文件, 1,564行)
     * ❌ UI模块 (7个文件, 1,196行)
   - **新增开发工具** (src/backend/scripts/):
     * migrate_pdf_fields.py (89行) - PDF字段数据迁移工具
     * verify_migration.py (97行) - 迁移验证工具
     * set_demo_values.py (95行) - 演示数据生成器
     * test_pdf_list_output.py (115行) - WebSocket输出格式测试
     * debug_websocket_message.py (87行) - WebSocket消息调试工具
   - **冲突解决**: 1个冲突（context.md，保留两边内容合并）
   - **工作日志**: `AItemp/20251002221737-AI-Working-log.md`

2. **合并 worktree B 的 pdf-home 功能域架构** ✅ 完成 (2025-10-02 18:00)
   - **合并分支**: `feature/pdf-home-add-delete-improvements` → `main`
   - **合并提交**: ceaf394
   - **代码变更**: +16,480行 / -78行 / 净增16,402行
   - **主要成果**:
     * ✅ PDFListFeature 完整迁移（最复杂的列表功能）
     * ✅ 批量删除功能改进
     * ✅ 错误处理增强
     * ✅ 双模式启动支持（兼容旧版 + 新版功能域）
   - **新增功能域**:
     * features/pdf-list/ (907行) - PDF列表管理
     * features/pdf-editor/ (469行) - PDF编辑
     * features/pdf-sorter/ (438行) - PDF排序
   - **pdf-home 核心组件** (独立实现):
     * core/feature-registry.js (656行)
     * core/dependency-container.js (392行)
     * core/state-manager.js (641行)
     * core/feature-flag-manager.js (505行)
   - **测试覆盖**: 新增2500+行测试代码
   - **文档**: 迁移指南、测试指南、架构总结等
   - **冲突解决**: 4个冲突（scoped-event-bus采用A版本，配置文件合并）
   - **工作日志**: `AItemp/20251002180000-AI-Working-log.md`

2. **合并 worktree A 的 Feature-based 架构重构** ✅ 完成 (2025-10-02 17:00)
   - **合并分支**: `feature-bookmark-fix` → `main`
   - **合并提交**: 82e8dcc
   - **代码变更**: +25,146行 / -2,988行 / 净增22,158行
   - **架构统一**: pdf-viewer 与 pdf-home 采用相同的插件化架构
   - **共享基础设施** (common/micro-service/):
     * ✅ FeatureRegistry - 功能域注册和管理
     * ✅ DependencyContainer - 依赖注入容器
     * ✅ ScopedEventBus - 作用域事件总线
     * ✅ StateManager - 响应式状态管理
     * ✅ Feature Flags - 特性开关管理
   - **新增功能域**:
     * features/app-core/ - 应用核心
     * features/pdf-reader/ - PDF阅读
     * features/pdf-bookmark/ - 书签管理
     * features/pdf-manager/ - PDF管理
     * features/pdf-ui/ - UI管理
     * features/websocket-adapter/ - WebSocket适配
   - **测试覆盖**: 新增3000+行测试代码
   - **文档完善**: 新增架构文档、开发指南、类型定义
   - **目录优化**: Python文件→pyqt/，CSS→assets/
   - **工作日志**: `AItemp/20251002170000-AI-Working-log.md`

2. **分析了pdf-home的架构模式** (2025-09-29)
   - 识别出5层分层架构
   - 依赖注入容器模式
   - Manager模式架构

2. **制定了pdf-viewer的重构方案** (2025-09-29)
   - 设计了详细的文件拆分策略
   - 规划了模块化目录结构
   - 制定了渐进式实施计划

3. **完成基础设施加载改进** (2025-09-30)
   - **EventBus使用单例模式**: 修改`container/app-container.js`使用全局EventBus单例
   - **容器添加initialize()方法**: 实现两阶段初始化（先创建WSClient，后建立连接）
   - **创建bootstrap入口**: 新增`bootstrap/app-bootstrap.js`统一启动流程
   - **实现两阶段初始化**: app-core.js中先初始化容器，再连接WebSocket

4. **PDFViewer组件集成问题分析与临时解决方案** (2025-10-01) ⚠️
   - **问题**: AnnotationEditorType未定义导致PDFViewer初始化失败
   - **根本原因**: pdfjs-dist v3.11.174在Vite构建环境下的兼容性问题
     * PDFViewer组件内部依赖AnnotationEditorType等枚举类型
     * Vite的依赖预构建过程中这些类型未正确导出
     * 错误发生在pdfjs内部代码第6035行,不是参数配置问题
   - **已尝试的方案**:
     1. 添加EventBus和LinkService配置 - 失败
     2. 移除annotationEditorMode参数 - 失败
     3. 多次修改配置参数 - 均失败
   - **临时解决方案**:
     * 禁用PDFViewer组件的使用
     * 保留现有的canvas-based PDF渲染方式
     * 简化PDFViewerManager为容器管理器
   - **修改文件**: `src/frontend/pdf-viewer/pdf-viewer-manager.js:1-62`
   - **未来改进方向**:
     1. 研究正确的Vite配置支持pdfjs-dist v3.11
     2. 考虑降级到pdfjs-dist v2.x
     3. 等待pdfjs-dist v3.12+修复
     4. 参考pdfjs官方Vite集成示例

### 技术要点
- EventBus从创建实例改为使用`eventBusSingleton`
- 容器新增`initialize()`和`isInitialized()`方法
- Bootstrap模式解析配置并动态加载应用
- 与pdf-home保持架构一致性
- **PDF.js需要独立的EventBus系统**,不能复用应用EventBus
- **LinkService是PDF链接导航的必需组件**
- **annotationEditorMode设为0可避免AnnotationEditorType相关错误**

### 验证结果
- EventBus单例正常工作，事件订阅和发布正常
- 容器初始化成功，两阶段初始化按预期执行
- WebSocket连接成功建立到ws://localhost:8765
- Console桥接器成功从早期桥接器切换到主桥接器
- **待验证**: PDFViewer初始化修复效果(需重启服务测试)

### 相关文档
- `AItemp/pdf-viewer-refactoring-plan.md` - 完整重构方案
- `AItemp/pdf-viewer-infrastructure-loading.md` - 基础设施加载详细说明
- `AItemp/20250930003500-AI-Working-log.md` - 基础设施改进工作日志
- `AItemp/20251001204624-AI-Working-log.md` - PDFViewer初始化错误修复

### 下一步 (已完成)
- ✅ 用户重启服务并测试修复效果
- ✅ 查看日志解决渲染问题
- ✅ 实现渲染模式切换功能

### 最新进展 (2025-10-01 21:01)
- ✅ **修复renderPage方法缺失**: 在UIManager中添加委托方法
- ✅ **新增渲染模式切换功能**: 用户可在Canvas和PDFViewer模式间切换
- ✅ **修复PDFViewer模式空白**: 实现切换时的自动重新渲染
- 📝 **工作日志**: `AItemp/20251001204624-AI-Working-log.md` 记录完整修复过程

### 渲染模式切换功能
- **UI**: HTML中新增切换按钮
- **管理器**: `render-mode-manager.js` 管理模式状态和切换
- **渲染**: 两种模式分别渲染到不同容器
  * Canvas模式 → #pdf-canvas
  * PDFViewer模式 → #viewer (动态创建canvas)
- **切换**: 自动重新渲染当前页面,保持状态

## 当前任务：PDF-Viewer架构重构 v002 (2025-10-02)

### 任务背景
执行 `todo-and-doing/2 todo/20251002040217-pdf-viewer-architecture-refactoring/v002-spec.md` 需求文档，系统性重构PDF-Viewer模块架构。

### 核心目标
1. 建立清晰的五层架构 (共用/核心/功能/适配器/入口)
2. 消除重构遗留问题 (备份文件、桥接文件、-refactored后缀)
3. 改继承为组合模式
4. 提升代码可维护性和协作开发效率

### 主要问题
- P0-1: 文件组织混乱 - 根目录堆积19个文件
- P0-2: 重构遗留冗余 - 大量过渡性文件和命名混乱
- P0-3: 继承设计不合理 - PDFViewerApp继承PDFViewerAppCore
- P1-1: app-core.js职责过重 - 340行承担10+项职责
- P1-2: 事件总线封装无价值 - eventbus.js无意义封装
- P1-3: WebSocket处理分散 - 逻辑分散在3个地方
- P1-4: Handler目录职责不清

### 五层架构设计
```
Layer 1: 基础设施层 (common/, shared/)
Layer 2: 核心领域层 (core/)
Layer 3: 功能特性层 (features/)
Layer 4: 适配器层 (adapters/)
Layer 5: 应用入口层 (bootstrap/, main.js)
```

### 执行阶段
- **阶段1 (执行中)**: Layer 1 基础设施层准备 (3-4小时)
  - 1.1 项目清理 - 删除备份/桥接/无价值封装文件
  - 1.2 目录结构创建 - 创建五层架构目录
  - 1.3 类型系统建立 - 创建TypeScript类型定义
  - 1.4 依赖检查配置 - 集成dependency-cruiser
  - 1.5 路径更新 - 批量更新导入路径
- **阶段2 (待执行)**: Layer 4 适配器层重构 (4-5小时)
- **阶段3 (待执行)**: Layer 2 核心领域层重构 (6-8小时)
- **阶段4 (待执行)**: Layer 3 功能特性层重构 (5-6小时)
- **阶段5 (待执行)**: Layer 5 应用入口层重构 (4-5小时)
- **阶段6 (待执行)**: 完善和优化 (3-4小时)

### 相关文档
- 主规格说明: `v002-spec.md`
- 协作开发指南: `v002-appendix-collaboration.md`
- 实施步骤: `v002-appendix-implementation.md`
- 测试清单: `v002-appendix-testing.md`
- 工作日志: `AItemp/20251002120700-AI-Working-log.md`

## 代码库清理和工具脚本提交 (2025-10-02 14:00)

### 工作状态整理 ✅
- **背景**: 从上下文超限的对话中恢复，确认所有任务完成状态
- **已完成功能**:
  - ✅ PDF通知系统（commit 02e727a）- 替换alert为页面通知
  - ✅ V1架构移除（commit 321ec96）- 完全迁移到V2功能域架构
  - ✅ PDF记录扩展字段（commit 26fdc51）- 7个学习管理字段

### 开发工具脚本提交 ✅
- **提交**: commit d2ff056
- **新增文件** (5个Python脚本):
  1. `src/backend/scripts/migrate_pdf_fields.py` - PDF字段数据迁移工具
  2. `src/backend/scripts/verify_migration.py` - 迁移验证工具
  3. `src/backend/scripts/set_demo_values.py` - 演示数据生成器
  4. `src/backend/scripts/test_pdf_list_output.py` - WebSocket输出格式测试
  5. `src/backend/scripts/debug_websocket_message.js` - WebSocket消息调试工具
- **用途**: 支持PDF记录扩展字段功能的开发、测试和维护

## PDF记录编辑功能开发 (2025-10-03)

### ✅ 完整功能已交付 (2025-10-03 15:40)

**功能概述**: PDF记录编辑功能的端到端实现，包括前端表单、WebSocket通信、后端处理和自动刷新。

#### 前端实现完成
- **表单字段扩展** (src/frontend/pdf-home/features/pdf-edit/index.js):
  - ✅ 新增4个元数据字段（title, author, subject, keywords）
  - ✅ 表单HTML生成 (lines 391-453)
  - ✅ 表单数据收集 (lines 518-530)
  - ✅ HTML转义防护 XSS攻击

- **WebSocket通信修复** (src/frontend/pdf-home/features/pdf-edit/index.js):
  - ✅ 修复EventBus调用方式 (lines 537, 568)
    - 问题: 使用了 `globalEventBus.emitGlobal()` (不存在的方法)
    - 修复: 改用 `scopedEventBus.emitGlobal()` (功能域架构标准方式)
  - ✅ WebSocket消息发送 (lines 563-580)
    - 消息类型: `update_pdf`
    - 数据格式: `{file_id, updates}`

#### 后端实现完成
- **消息处理器实现**:
  - ✅ 消息类型枚举 (standard_protocol.py:23)
  - ✅ 消息路由添加 (standard_server.py:232-234)
  - ✅ 更新处理器 (standard_server.py:482-530)
    - 参数验证: file_id, updates
    - 错误处理: INVALID_REQUEST, UPDATE_FAILED
    - 成功响应: 返回更新结果

- **数据持久化**:
  - ✅ PDFManager.update_file() (manager.py:248-281)
    - 更新元数据: pdf_file.update_metadata()
    - 保存到文件: self.save_files()
    - 触发信号: file_list_changed.emit()

- **自动列表刷新**:
  - ✅ 列表变更广播 (standard_server.py:746-761)
    - 获取最新列表: pdf_manager.get_files()
    - 构建响应消息: PDFMessageBuilder.build_pdf_list_response()
    - 广播到所有客户端: broadcast_message()

#### 完整数据流转
```
用户点击保存
  ↓
前端收集表单数据
  ↓
scopedEventBus.emitGlobal(WEBSOCKET_EVENTS.MESSAGE.SEND)
  ↓
WSClient发送 {type: "update_pdf", data: {file_id, updates}}
  ↓
后端standard_server接收并路由到handle_pdf_update_request
  ↓
PDFManager.update_file(file_id, updates)
  ↓
更新元数据 → 保存文件 → 触发file_list_changed信号
  ↓
on_pdf_list_changed() 广播最新列表
  ✓ 消息类型: "list"
  ✓ 数据: 完整PDF列表
  ↓
前端pdf-list功能域接收 "list" 消息
  ↓
自动刷新表格显示
```

#### 表单字段完整列表 (共9个)
1. **文件名** (filename) - 只读，系统字段
2. **书名** (title) - 可编辑文本 ✨
3. **作者** (author) - 可编辑文本 ✨
4. **主题** (subject) - 可编辑文本 ✨
5. **关键词** (keywords) - 可编辑文本，逗号分隔 ✨
6. **评分** (rating) - 星级组件 (1-5星)
7. **标签** (tags) - 标签输入组件
8. **已读状态** (is_read) - 开关组件
9. **备注** (notes) - 多行文本域

#### 技术亮点
- ✅ 功能域架构遵循：使用 `scopedEventBus.emitGlobal()` 发送全局事件
- ✅ 安全性：HTML转义、输入trim处理
- ✅ 实时性：自动广播列表更新，无需手动刷新
- ✅ 错误处理：完整的前后端错误处理链
- ✅ 最小化修改：仅修改必要的方法和文件

#### 相关提交
- `fix(pdf-edit): 修复WebSocket消息发送方式` - EventBus调用修复
- `feat(pdf-edit): 添加书名、作者、主题、关键词等元数据字段` - 表单字段扩展
- `feat(backend): 实现PDF更新处理和自动列表广播` - 后端完整实现

#### 工作日志
- `AItemp/20251003140000-AI-Working-log.md` - 完整开发过程和调试记录

### 待办任务概览
**已完成**:
- ✅ PDF-Home添加删除按钮功能
- ✅ PDF记录扩展字段功能（7个学习管理字段）
- ✅ PDF书签侧边栏功能
- ✅ **PDF编辑表单字段扩展** (2025-10-03)
- ✅ PDF标注功能按钮加载修复 (2025-10-03)
- ✅ **PDF记录编辑功能（端到端完整实现）** (2025-10-03) ⭐

**进行中**:
- 📋 20251002120000 - PDF记录编辑模态框
  - ✅ Phase 1: 表格编辑按钮
  - ✅ Phase 2: 模态框管理器
  - ✅ Phase 3: 表单组件（基础）
  - ✅ Phase 3.5: 表单字段扩展（元数据）
  - ✅ **Phase 4: 后端数据交互（已完成）** ⭐
  - ⏳ Phase 5: 样式和优化（可选）

**待开发** (按优先级排序):
1. 📋 20251002001902 - PDF列表排序系统
2. 📋 20251002005635 - PDF列表过滤系统
3. 📋 20251002130000 - PDF-Home协作架构
4. 📋 20250923184000 - 统一通信架构
5. 📋 PDF标注功能Phase 3-10 - 截图/高亮/批注工具实现

### 技术规范遵循
- ✅ 遵循CLAUDE.md流程规范：读取历史日志 → 检查Memory Bank → 执行任务 → 更新文档
- ✅ Git提交规范：使用约定式提交（Conventional Commits）
- ✅ 代码库管理：工具脚本纳入版本控制，临时文档保留在工作区
- ✅ ES6+语法和代码质量标准

### 相关文档
- 最新工作日志: `AItemp/20251003140000-AI-Working-log.md`
- 前次工作日志: `AItemp/20251002140000-AI-Working-log.md`
- 分支: `feature/pdf-home-add-delete-improvements`
- 最新commit: d2ff056

## PDF标注功能模块化架构实施 ✅ Phase 0完成 (2025-10-03 18:00)

### 任务概述
实施PDF标注功能的模块化插件化架构（v003规范），支持并行开发多个标注工具

### Phase 0: 基础设施 ✅ 完成

**架构升级**：
```
AnnotationFeature v1.0 (简单Feature)
    ↓ 升级为
AnnotationFeature v2.0 (容器/协调器)
  ├── ToolRegistry (工具注册表)
  ├── AnnotationManager (数据管理器)
  └── AnnotationSidebarUI (UI管理器)
```

**核心组件**：
1. ✅ **IAnnotationTool接口** (`interfaces/IAnnotationTool.js`)
   - 定义11个必须实现的方法
   - 元数据、生命周期、UI、清理方法
   - validateAnnotationTool验证函数

2. ✅ **ToolRegistry工具注册表** (`core/tool-registry.js`)
   - 工具注册、初始化、激活/停用
   - 互斥激活机制（同时只能有一个工具激活）
   - 工具按钮创建和管理

3. ✅ **AnnotationManager数据管理器** (`core/annotation-manager.js`)
   - 标注CRUD操作（创建、更新、删除、查询）
   - Phase 1 Mock模式（内存存储）
   - 事件驱动架构

4. ✅ **Annotation模型升级** (`models/annotation.js`)
   - 支持imagePath（v003规范：文件路径 + MD5哈希）
   - 兼容imageData（旧版base64）
   - createScreenshot方法签名更新

5. ✅ **AnnotationFeature重构** (`index.js`)
   - 从简单Feature升级为容器模式
   - 版本v2.0.0
   - 管理三大核心组件的生命周期

**并行开发架构**：
```
tools/
  ├── screenshot/     ← 开发者A (待实现)
  │   ├── index.js
  │   ├── screenshot-capturer.js
  │   └── qwebchannel-bridge.js
  ├── text-highlight/ ← 开发者B (待实现)
  └── comment/        ← 开发者C (待实现)
```

**内外层通信机制**：
- 工具插件 → 发布事件 → EventBus → AnnotationManager处理 → 发布成功事件 → AnnotationFeature → 更新UI
- 完全解耦，工具无需知道外层实现

**技术要点**：
- 事件总线驱动
- 依赖注入模式
- 插件接口标准化
- Git零冲突并行开发

### 后续任务分工
- **Phase 1 (ScreenshotTool)**: 待AI-A实现
- **Phase 2 (TextHighlightTool)**: 待AI-B实现
- **Phase 3 (CommentTool)**: 待AI-C实现

### 相关文档
- 架构规范: `todo-and-doing/2 todo/20251002213000-pdf-annotation-sidebar/v003-modular-screenshot-spec.md`
- 并行策略: `todo-and-doing/2 todo/20251002213000-pdf-annotation-sidebar/parallel-development-strategy.md`
- 工作日志: `AItemp/20251003170000-AI-Working-log.md`
- 测试说明: `AItemp/Phase0-测试说明.md`

---

## PDF标注功能按钮加载修复 ✅ 完成 (2025-10-03 01:00)

### 任务概述
成功修复PDF-Viewer模块中标注功能(AnnotationFeature)按钮无法加载的问题（已被Phase 0架构升级替代）

### 关键问题和解决方案

#### 问题1: EventBus事件名称格式错误
- **错误**: 使用4段式事件名 `pdf-viewer:annotation:sidebar:toggle`
- **要求**: EventBus严格要求3段式格式 `{module}:{action}:{status}`
- **解决**: 重构27个ANNOTATION事件为3段式格式
- **文件**: `src/frontend/common/event/pdf-viewer-constants.js`

#### 问题2: Feature接口实现错误
- **错误**: 使用类字段声明 `name = 'annotation'`
- **要求**: 必须使用getter方法 `get name() { return 'annotation'; }`
- **解决**: 修正name/version/dependencies为getter方法
- **文件**: `src/frontend/pdf-viewer/features/annotation/index.js:30-42`

#### 问题3: install方法签名错误
- **错误**: 参数命名为 `install(container)`
- **要求**: 必须接收 `install(context)` 并解构
- **解决**: 改为 `install(context)` 并解构出 `{globalEventBus, logger, container}`
- **文件**: `src/frontend/pdf-viewer/features/annotation/index.js:51-63`

#### 问题4: DOM选择器不可靠
- **错误**: 使用style属性选择器 `querySelector('div[style*="flex-direction:column"]')`
- **问题**: style属性可能被动态修改或覆盖
- **解决**: 为容器添加ID并使用 `getElementById('pdf-viewer-button-container')`
- **文件**:
  * `src/frontend/pdf-viewer/ui/bookmark-sidebar-ui.js:222` - 添加ID
  * `src/frontend/pdf-viewer/features/annotation/index.js:121` - 使用ID选择

### 验证结果
- ✅ 标注按钮成功显示在UI中(书签和卡片按钮之间)
- ✅ 点击按钮成功触发 `annotation-sidebar:toggle:requested` 事件
- ✅ 侧边栏正常显示/隐藏
- ✅ 键盘快捷键 Ctrl+Shift+A 正常工作
- ✅ 按钮样式随侧边栏状态动态更新

### 技术要点
1. **EventBus命名规范**: 严格的3段式格式 `{module}:{action}:{status}`
2. **Feature接口规范**: name/version/dependencies必须使用getter方法
3. **依赖注入模式**: install方法接收context对象并解构
4. **DOM选择最佳实践**: 优先使用ID选择器而非style属性选择器
5. **架构一致性**: AnnotationFeature遵循与AppCoreFeature/UIManagerFeature相同的模式

### 修改文件清单
1. `src/frontend/common/event/pdf-viewer-constants.js` - 重构27个事件名称
2. `src/frontend/pdf-viewer/features/annotation/index.js` - 修正Feature类实现
3. `src/frontend/pdf-viewer/ui/bookmark-sidebar-ui.js` - 添加按钮容器ID
4. `src/frontend/pdf-viewer/features/annotation/components/annotation-sidebar-ui.js` - 创建侧边栏UI

### 后续开发计划
- Phase 3: 截图工具实现 (4小时)
- Phase 4: 文字高亮工具实现 (3小时)
- Phase 5: 批注工具实现 (3小时)
- Phase 6: 标注管理器实现 (4小时)
- Phase 7: 标注渲染器实现 (3小时)
- Phase 8: 数据存储/WebSocket实现 (3小时)
- Phase 9: 集成测试 (3小时)
- Phase 10: 文档和优化 (2小时)

### 待清理
- 移除调试console.log语句(约30行)
- 简化日志级别
- 优化事件监听器注册

### 相关文档
- 工作日志: `AItemp/20251003010000-AI-Working-log.md`
- 需求文档: `todo-and-doing/PDF标注功能需求`

---

## CommentTool实现Bug修复 ✅ 完成 (2025-10-03 17:44)

### 任务概述
继续Phase 0架构，验证并修复CommentTool实现中的数据结构访问错误

### 关键Bug和修复

#### Bug 1: Annotation对象创建方式错误
- **错误**: 直接在构造函数中传入content和position作为顶层属性
- **正确**: 应使用`Annotation.createComment()`静态工厂方法
- **影响**: 创建的Annotation对象不符合模型规范
- **修复**: `tools/comment/index.js:219`
  ```javascript
  // 错误：
  const annotation = new Annotation({
    type: 'comment',
    content,
    pageNumber,
    position: { x, y },
    createdAt: new Date().toISOString(),
  });

  // 修复：
  const annotation = Annotation.createComment(pageNumber, { x, y }, content);
  ```

#### Bug 2: CommentMarker访问属性错误
- **错误**: 直接从annotation解构position和content
- **正确**: 应从annotation.data中获取
- **影响**: 标记创建时无法获取正确的位置和内容
- **修复**: `tools/comment/comment-marker.js:38-39`
  ```javascript
  // 错误：
  const { id, pageNumber, position, content } = annotation;

  // 修复：
  const { id, pageNumber, data } = annotation;
  const { position, content } = data;
  ```

#### Bug 3: createAnnotationCard访问属性错误
- **错误**: 使用annotation.content访问内容
- **正确**: 应使用annotation.data.content
- **影响**: 侧边栏卡片显示"无内容"
- **修复**: `tools/comment/index.js:371`
  ```javascript
  // 错误：
  ${annotation.content || '无内容'}

  // 修复：
  ${annotation.data.content || '无内容'}
  ```

#### Bug 4: 跳转事件名称错误
- **错误**: 使用`annotation:jump-to:requested`
- **正确**: 应使用`annotation:jump:requested`（符合EventBus 3段式格式）
- **影响**: 跳转功能无法触发
- **修复**: `tools/comment/index.js:407`

#### Bug 5: 私有字段未声明
- **错误**: 使用`this.#handleKeydown`但未在类中声明
- **影响**: ESLint报错，代码无法通过语法检查
- **修复**: `tools/comment/comment-input.js:33` - 添加私有字段声明

### Annotation模型数据结构规范
根据`annotation/models/annotation.js`，comment类型的正确结构：
```javascript
{
  id: string,              // 自动生成
  type: 'comment',         // 类型
  pageNumber: number,      // 页码
  data: {                  // ⚠️ 类型特定数据必须在data对象中
    position: { x, y },    // 位置坐标
    content: string        // 批注内容
  },
  createdAt: string,       // ISO 8601
  updatedAt: string        // ISO 8601
}
```

### 验证结果
- ✅ 所有语法检查通过（ESLint无错误）
- ✅ Annotation对象创建符合模型规范
- ✅ 标记渲染使用正确的数据访问路径
- ✅ 事件名称符合EventBus 3段式规范
- ✅ 服务状态正常（Vite: 3002, msgCenter: 8776, pdfFile: 8080）

### 技术要点
1. **静态工厂方法**: 优先使用`Annotation.createComment()`而非直接构造
2. **数据结构访问**: comment类型数据在`annotation.data`中，不是顶层属性
3. **EventBus规范**: 严格遵循3段式事件名称格式
4. **私有字段声明**: JavaScript私有字段必须先声明再使用

### 修改文件清单
1. ✅ `src/frontend/pdf-viewer/features/annotation/tools/comment/index.js`
   - 修复Annotation创建（line 219）
   - 修复内容访问（line 371）
   - 修复事件名称（line 407）

2. ✅ `src/frontend/pdf-viewer/features/annotation/tools/comment/comment-marker.js`
   - 修复属性访问（line 38-39）
   - 更新JSDoc文档

3. ✅ `src/frontend/pdf-viewer/features/annotation/tools/comment/comment-input.js`
   - 添加私有字段声明（line 33）

### 后续任务
- ⏳ 浏览器实际测试CommentTool功能
- ⏳ 验证批注创建、显示、删除流程
- ⏳ 验证标记点击和高亮效果
- ⏳ 验证跳转功能
- ⏳ 处理PDF页面元素选择器的兼容性问题

### 相关文档
- 工作日志: `AItemp/20251003174421-AI-Working-log.md`
- 架构规范: `todo-and-doing/2 todo/20251002213000-pdf-annotation-sidebar/v003-modular-screenshot-spec.md`
- Annotation模型: `src/frontend/pdf-viewer/features/annotation/models/annotation.js`

---

## CommentTool页面跳转Bug修复 ✅ 完成 (2025-10-03 18:01)

### 问题描述
用户反馈：启用批注功能后，点击任何一个页面都会跳转到第一页。

### 根本原因
三个关键问题导致：
1. **事件冒泡**: 点击事件没有阻止冒泡，触发了其他导航逻辑
2. **页码获取不准确**: 总是使用`pdfViewerManager.currentPageNumber`或默认值1
3. **坐标系统混乱**: 使用容器相对坐标但定位不准确

### 修复方案

#### 1. 阻止事件冒泡 ✅
**文件**: `tools/comment/index.js:185-186`
```javascript
e.preventDefault();
e.stopPropagation();
```
- 防止点击触发其他导航处理器
- 避免页面滚动或跳转

#### 2. 使用事件委托获取准确页码 ✅
**文件**: `tools/comment/index.js:188-201`
```javascript
// 查找实际点击的页面元素
let pageElement = e.target.closest('.page');
if (!pageElement) {
  this.#logger.warn('Click target is not within a .page element, ignoring');
  return;
}

// 从页面元素获取页码
const pageNumber = parseInt(pageElement.dataset.pageNumber) || this.#getCurrentPageNumber();

// 获取点击位置（相对于页面元素）
const pageRect = pageElement.getBoundingClientRect();
const x = e.clientX - pageRect.left;
const y = e.clientY - pageRect.top;
```
- 使用事件委托找到实际点击的`.page`元素
- 从`data-page-number`属性直接读取页码
- 坐标相对于页面元素计算（用于渲染标记）

#### 3. 改用fixed定位和视口坐标 ✅
**文件1**: `tools/comment/index.js:203-212`
```javascript
// 获取显示输入框的位置（相对于视口）
const displayX = e.clientX;
const displayY = e.clientY;

this.#commentInput.show({
  x: displayX,
  y: displayY,
  pageNumber,
  ...
});
```

**文件2**: `tools/comment/comment-input.js:59-77,138`
```javascript
// 调整位置避免超出视口
const adjustedX = Math.min(x, window.innerWidth - 320);
const adjustedY = Math.min(y, window.innerHeight - 200);

this.#container.style.cssText = `
  position: fixed;
  left: ${adjustedX}px;
  top: ${adjustedY}px;
  ...
`;

// 添加到body（因为使用fixed定位）
document.body.appendChild(this.#container);
```
- 使用`position: fixed`相对于视口定位
- 添加边界检查防止超出屏幕
- 直接添加到`document.body`

### 技术要点
1. **事件委托模式**: 使用`e.target.closest()`查找实际点击元素
2. **坐标系统分离**:
   - 批注标记坐标: 相对于`.page`元素（用于渲染）
   - 输入框坐标: 相对于视口（用于UI显示）
3. **事件处理**: `preventDefault()` + `stopPropagation()`

### 验证结果
- ✅ ESLint语法检查通过
- ✅ 事件冒泡问题已解决
- ✅ 页码获取准确（基于实际点击的页面）
- ✅ 坐标系统清晰（批注vs UI分离）
- ✅ 边界检查完善（输入框不超出视口）

### 测试建议
1. 在第2/3页创建批注，验证页面不跳转
2. 检查标记是否准确出现在对应页面
3. 测试页面边缘点击，输入框不超出屏幕
4. 测试滚动状态下的批注创建

### 修改文件清单
1. ✅ `src/frontend/pdf-viewer/features/annotation/tools/comment/index.js`
   - 添加事件阻止（line 185-186）
   - 实现事件委托获取页码（line 188-196）
   - 坐标分离处理（line 198-212）

2. ✅ `src/frontend/pdf-viewer/features/annotation/tools/comment/comment-input.js`
   - 改用fixed定位（line 66）
   - 添加边界检查（line 59-60）
   - 简化DOM添加（line 138）

### 相关文档
- 详细工作日志: `AItemp/20251003180103-AI-Working-log.md`
- 前次修复: `AItemp/20251003174421-AI-Working-log.md`

---

## CommentTool重复创建卡片Bug修复 ✅ 完成 (2025-10-03 18:15)

### 问题描述
用户反馈：一次批注点击会创建两个标注卡片。

### 根本原因
**重复事件监听**问题：`annotation:create:success` 事件被两个组件同时监听并处理：

1. **AnnotationSidebarUI** (annotation-sidebar-ui.js:322) 监听 `PDF_VIEWER_EVENTS.ANNOTATION.CREATED`
2. **AnnotationFeature** (index.js:196) 也监听 `annotation:create:success`

两者是同一事件（CREATED = 'annotation:create:success'），导致每次创建都调用两次 `addAnnotationCard()`。

### 修复方案 ✅
删除AnnotationFeature中的重复监听器，保留AnnotationSidebarUI的监听。

**文件**: `features/annotation/index.js:194-204`

**理由**:
- **职责分离**: UI组件应该自己监听自己需要的事件
- **低耦合**: 容器不应该直接操作UI组件的内部方法
- **架构清晰**: AnnotationFeature作为容器/协调器，只负责管理组件生命周期

### 正确的架构关系
```
AnnotationFeature (容器/协调器)
  ├── ToolRegistry (工具管理) - 自治
  ├── AnnotationManager (数据管理) - 自治
  └── AnnotationSidebarUI (UI管理) - 自治，自己监听事件
```

### 事件流程
```
CommentTool → 发布 'annotation:create:requested'
    ↓
AnnotationManager → 监听并创建 → 发布 'annotation:create:success'
    ↓
AnnotationSidebarUI → 监听并添加卡片 (只一次)
```

### 组件职责分配

**AnnotationFeature (容器)**:
- ✅ 管理组件生命周期
- ✅ 协调初始化顺序
- ❌ 不直接操作UI
- ❌ 不处理业务事件

**AnnotationSidebarUI (UI组件)**:
- ✅ 监听CRUD事件
- ✅ 渲染卡片列表
- ✅ 处理用户交互

### 验证结果
- ✅ ESLint语法检查通过
- ✅ 删除重复监听器
- ✅ 职责边界清晰
- ✅ 添加详细注释

### 测试建议
1. 创建一个批注 → 侧边栏只显示**1个**卡片
2. 连续创建3个批注 → 侧边栏显示**3个**卡片（不重复）
3. 删除批注 → 卡片正常移除

### 技术要点
1. **事件驱动最佳实践**: 一个事件只被一个组件处理（UI更新类）
2. **容器模式**: 容器管理生命周期，不干涉内部逻辑
3. **职责分离**: UI组件自治，自己监听自己的事件

### 修改文件
1. ✅ `src/frontend/pdf-viewer/features/annotation/index.js`
   - 删除重复事件监听（line 194-204）
   - 添加职责说明注释

### 相关文档
- 详细工作日志: `AItemp/20251003181547-AI-Working-log.md`
- 页面跳转修复: `AItemp/20251003180103-AI-Working-log.md`
- 数据结构修复: `AItemp/20251003174421-AI-Working-log.md`

## 2025-10-05 数据库 Phase3（PDFInfo 表插件）
- ⏳ 阶段目标：完成数据库Phase3的首个数据表插件（PDFInfoTablePlugin），确保插件测试通过后继续实现文档中剩余功能。
- 当前状态：插件代码和测试已由上一轮开发完成但尚未复核，需要重新运行 `pytest src/backend/database/plugins/__tests__/test_pdf_info_plugin.py` 确认绿色。
- 关键路径：
  - 需求文档：`todo-and-doing/2 todo/20251005140340-backend-database-impl/v001-phase3-pdf-info.md`（包含字段约束、扩展方法、测试用例清单）。
  - 代码位置：`src/backend/database/plugins/pdf_info_plugin.py`（主实现）、`src/backend/database/plugins/__tests__/test_pdf_info_plugin.py`（单测）、`src/backend/database/plugins/__tests__/fixtures/pdf_info_samples.py`（样例数据，如存在）。
- 执行步骤（原子任务）：
  1. 阅读需求规范与现有实现，确认接口、事件、扩展查询覆盖的契合度。
  2. 运行上述pytest命令验证插件行为，若失败收集日志与失败案例。
  3. 根据需求文档补足缺失的功能/测试（例如高级查询、标签管理、统计等）。
  4. 测试全部通过后更新工作日志与memory bank，并准备继续Phase3后续（annotation/bookmark/search_condition）。
- 注意事项：所有文件读写显式UTF-8；遵循TablePlugin接口规范；开发前先补齐测试；如拆分多模块需考虑subagent。
## 当前任务 (2025-10-05 15:55)
- 合并 worktree A(feature-bookmark-fix) 与 worktree D(d-main-20250927) 到 main 分支
- 目标：同步侧边栏与 d-main 分支最新改动，保持主线最新
- 预计步骤：检查 git 状态 → 拉取两个分支最新提交 → 合并并解决冲突 → 基本验证
- 相关路径：worktree A=C:/Users/napretep/PycharmProjects/anki-linkmaster-A，worktree D=C:/Users/napretep/PycharmProjects/anki-linkmaster-D
### 2025-10-05 16:05 更新
- main 分支已合并 feature-bookmark-fix（f378ef4）与 d-main-20250927（399d04a），获取了 UI 布局优化与 PDF 卡片侧栏骨架
- d-main-20250927 新增 PDFCardFeature（卡片侧栏UI、feature.config、Sidebar注册时从容器延迟获取实例）已同步到主线
- 合并后保留反向链接侧栏占位（real-sidebars.js）及既有文档改动，需要后续功能实现时替换
- pnpm run test 受 WebGL/IndexedDB 依赖缺失影响失败（fake-indexeddb、canvas 未安装），后续定位前需补齐测试依赖


## 2025-10-05 数据库 Phase3（PDFAnnotation 表插件）
- ✅ 阶段目标：PDFAnnotationTablePlugin 已完成，支持截图 / 文本高亮 / 批注三类标注的建表、数据校验、CRUD、扩展查询、评论管理与事件发布。
- 当前状态：代码与测试位于 `src/backend/database/plugins/`；与 PDFInfo 插件联动（外键/事件）已验证通过。
- 关键资料：
  - 需求文档：`todo-and-doing/2 todo/20251005140340-backend-database-impl/v001-phase3-pdf-annotation.md`
  - 代码：`src/backend/database/plugins/pdf_annotation_plugin.py`
  - 测试：`src/backend/database/plugins/__tests__/test_pdf_annotation_plugin.py`
  - 样例：`src/backend/database/plugins/__tests__/fixtures/pdf_annotation_samples.py`
- 主要实现要点：
  1. 数据验证区分 screenshot/text-highlight/comment 三类 payload，并校验 comments 数组。
  2. CRUD 及扩展方法（按 PDF/页码/类型查询、计数、批量删除、评论增删）。
  3. 事件统一使用 `table:pdf-annotation:*:*`，启用时订阅 `table:pdf-info:delete:completed` 实现级联删除。
- 测试结论：`pytest src/backend/database/plugins/__tests__` 共 76 项全部通过（含 pdf_info + pdf_annotation）。
- 后续衔接：继续 Phase3 其他表插件（bookmark / search_condition），复用同目录结构与事件命名规范。

## 2025-10-05 数据库 Phase3（PDFBookmark 表插件）
- ✅ 阶段目标：PDFBookmarkTablePlugin 已实现，支持层级书签、排序、递归扁平化与级联删除。
- 当前状态：`pdf_bookmark_plugin.py` 与测试、样例均落地，已通过插件测试全集（115 项）。
- 核心文件：
  - 代码：`src/backend/database/plugins/pdf_bookmark_plugin.py`
  - 测试：`src/backend/database/plugins/__tests__/test_pdf_bookmark_plugin.py`
  - 样例：`src/backend/database/plugins/__tests__/fixtures/pdf_bookmark_samples.py`
- 主要功能：
  1. 验证 `bookmark_id`、`pageNumber`、`region`、`children` 等字段，支持递归校验。
  2. CRUD + 扩展方法（按 PDF/页 查询、统计、批量删除、子节点增删、重排、扁平化）。
  3. 事件遵循 `table:pdf-bookmark:*:*`，监听 `table:pdf-info:delete:completed` 执行级联删除。
- 测试结论：`pytest src/backend/database/plugins/__tests__` → 115 Passed（含 info / annotation / bookmark 插件）。
- 后续衔接：Phase3 剩余表（search_condition）沿用相同目录与约定，注意事件命名和外键依赖。

## 2025-10-05 数据库 Phase3（SearchCondition 表插件）
- ✅ 阶段目标：SearchConditionTablePlugin 完成，实现筛选/排序条件的持久化、统计与事件发布。
- 当前状态：`search_condition_plugin.py`、测试与样例均落地，插件套件合计 144 用例全部通过。
- 核心文件：
  - 代码：`src/backend/database/plugins/search_condition_plugin.py`
  - 测试：`src/backend/database/plugins/__tests__/test_search_condition_plugin.py`
  - 样例：`src/backend/database/plugins/__tests__/fixtures/search_condition_samples.py`
- 主要功能：
  1. 支持 fuzzy / field / composite 三类条件递归校验，包含 sort_config 模式 0-3 验证。
  2. 扩展方法：`query_by_name`、`query_enabled`、`increment_use_count`、`set_last_used`、`activate_exclusive`、`query_by_tag`、`search_by_keyword`。
  3. 事件命名 `table:search-condition:*:*`，便于前端监听保存/更新/删除行为。
- 测试结论：`pytest src/backend/database/plugins/__tests__` → 144 Passed（info/annotation/bookmark/search_condition 全部插件）。
- 后续衔接：Phase3 已完成四个插件，可进入集成或 Stage4；若新增条件类型需在 `_validate_condition` 扩展。
## 当前任务 (2025-10-05 17:51)
- 目标：梳理并理解现有前后端通信链路，在保持统一消息协议的前提下设计与实现供前端调用的后端 API 层。
- 背景：数据库插件层（pdf_info/pdfs_annotation/pdf_bookmark/search_condition）已完成，需要通过统一通信架构向前端暴露受控接口。
- 相关模块：src/backend/pdfTable_server、src/backend/msgCenter_server、src/backend/database/plugins/*、src/backend/api/*、src/frontend/common/ws、src/frontend/pdf-home。
- 重要文档：docs/SPEC/SPEC-HEAD-communication.json、docs/SPEC/JSON-MESSAGE-FORMAT-001.md、todo-and-doing/2 todo/20250923184000-unified-communication-architecture/v001-spec.md。
### 拆解步骤
1. 阅读并整理现有通信架构代码/文档，明确消息流、事件命名及现有 API 空缺。
2. 根据数据库能力列出前端所需 API 场景，完成接口设计草案（消息类型、payload、响应结构）。
3. 为 API 层编写测试（优先覆盖查询/创建/更新/删除流程及错误分支）。
4. 实现 API 层代码，衔接数据库插件和通信层，确保事件发布/日志符合规范。
5. 运行测试并排查，确保新增逻辑与现有系统协同无回归。
6. 更新文档、memory bank 及工作日志，准备后续前端联调。

### 进展 2025-10-05 19:05
- 已实现 `PDFLibraryAPI`（数据库 → 前端）封装，提供 list/detail/update/delete/register_file 接口，并新增单元测试 `src/backend/api/__tests__/test_pdf_library_api.py`。
- WebSocket 服务器接入新 API：支持 `pdf/list` 消息、文件增删事件同步数据库并广播新版记录结构。
- 新逻辑保持原有 `pdf-home:get:pdf-list` 兼容，新增广播时同时发送旧版 `list` 与新版 `pdf/list`。
- 2025-10-05 16:09 提交流程检查：当前分支 d-main-20250927 工作区干净，无需提交。
- 2025-10-05 16:16 edge-tts 安装：因清华镜像缺包，改用官方 PyPI (-i https://pypi.org/simple) 成功安装 edge-tts 7.2.3。
- 2025-10-05 16:21 高亮标注问题：反向选择文字时渲染方向错误，需排查 highlight 工具的范围计算与渲染逻辑。
- 2025-10-05 16:45 高亮标注修复：TextSelectionHandler 增加 lineRects 百分比坐标，HighlightRenderer 支持 lineRects 回放，反向划选不会偏移。
- 2025-10-05 16:59 截图跳转问题：现仅按页滚动，需接入已有精确跳转API，并使用标注矩形实现精准定位。
- 2025-10-05 17:10 截图跳转：AnnotationFeature 使用 rectPercent 计算中心百分比并直接调用 navigationService，实现截图标注精确定位；新增 position-utils 辅助函数及单元测试。
- 2025-10-05 17:29 截图标记增强：需在标记框添加颜色选择与跳转按钮，默认收起，hover 关闭按钮时展开。
- 2025-10-05 17:55 截图标记框新增悬停控制：关闭按钮 hover 展开颜色选项与跳转按钮，支持切换 markerColor 并自动打开标注侧边栏高亮卡片。

## 20251005181633 高亮标注悬停工具按钮增强
- 当前问题：文字高亮标注仅渲染背景色，缺少悬停操作按钮，用户无法在PDF页面直接删除/复制/换色/定位/翻译。
- 背景：2025-10-05 已修复反向高亮偏移并完善标注侧边栏，现需进一步提升高亮交互体验。
- 相关模块：	ext-highlight/highlight-renderer.js、	ext-highlight/index.js、nnotation-sidebar、pdf-translator。

### 执行步骤（原子任务拆分）
1. 调研现有高亮渲染、侧边栏及翻译栏事件流程，确定可扩展的DOM与事件入口。
2. 设计并补充测试方案（单元/集成），覆盖悬停工具栏渲染、事件派发（删除/复制/换色/跳转/翻译）。
3. 基于测试驱动实现 hover 工具栏 DOM 结构与样式，确保与现有高亮布局兼容。
4. 打通五个按钮事件：调用删除请求、复制文本到剪贴板、同步切换颜色、触发侧边栏跳转并高亮卡片、向翻译栏发送文本。
5. 执行并记录测试，确认样式与交互在多高亮并存场景下无冲突。
- 输出：更新日志、测试结果、需要时更新架构/技术文档。
- 结果：新增 HighlightActionMenu 管理文字高亮悬停操作，支持删除/复制/换色/跳转/翻译；HighlightRenderer 提供包围盒和颜色更新接口；TextHighlightTool 调整为统一事件流并打通翻译、侧边栏联动。
- 测试：新增 highlight-action-menu.test.js、	ext-highlight-tool.test.js 并扩充 highlight-renderer.test.js，执行 pnpm run test -- highlight-renderer highlight-action-menu text-highlight-tool 全部通过。
- 修复翻译按钮体验：TextHighlightTool 现在触发 sidebar:open:requested 时使用 SidebarManager 的实际 ID 	ranslate，点击翻译后侧边栏立即打开。
- 新需求：在非标注模式下监听文本选取，弹出四按钮快捷操作（复制/标注/翻译/AI）。
- 要求：实现为独立插件，复用现有事件（标注创建、翻译触发），避免影响既有工具。
- 关键点：文本选取位置、按钮定位、与 SelectionMonitor/AnnotationFeature/PDFTranslatorFeature 的协作。
- 2025-10-05 18:02 AI助手修复：feature.config 仅依赖 annotation，保证在 SidebarManager 前注册，避免 aiAssistantSidebarUI 未加载导致侧边栏空白。
- 文本选择快捷操作插件 	ext-selection-quick-actions：监听非标注模式下的文本选择，在鼠标抬起位置展示四个按钮（复制/标注/翻译/AI）。复制直接写入剪贴板；标注自动创建黄色高亮并激活标注侧边栏；翻译发送 PDF_TRANSLATOR_EVENTS.TEXT.SELECTED 并打开翻译栏；AI 留空待扩展。
- 关键实现：selection-utils 负责坐标换算与包围盒、行矩形百分比；quick-actions-toolbar 管理浮动按钮；主 Feature 处理事件监听、状态切换及侧边栏联动。
- 新增单元测试：selection-utils.test.js、quick-actions-toolbar.test.js，确保坐标换算与 UI 显示逻辑稳定；既有 	ext-highlight-tool.test.js 继续通过。
- 修复复制按钮导致工具栏再次定位的问题：在 TextSelectionQuickActionsFeature.#handleMouseUp 内判断若事件发生于工具栏自身则不重新展示，并在复制完成后调用 #clearSelection() 防止残留选择触发重定位。
- Quick Actions 复制修复：在 #handleMouseUp 内识别工具栏交互，阻止 selectionchange 立刻清空状态；复制完成后调用 #clearSelection() 并隐藏按钮，确保剪贴板写入成功且面板不再移动。

## 2025-10-05 PDF-Home 搜索端到端方案讨论
- 问题背景：前端 Search/Filter 组合目前在浏览器内对 @pdf-list/data:load:completed 缓存做模糊筛选，后端仅有 StandardPDFManager 基于文件列表的简易 search_files；数据库层尚未提供分词、筛选、排序一体化查询，无法满足一次 SQL 完成"搜索→筛选→排序"的要求。
- 相关模块：前端 src/frontend/pdf-home/features/search、src/frontend/pdf-home/features/filter、src/frontend/pdf-home/features/search-results；后端 src/backend/api/pdf_library_api.py、src/backend/msgCenter_server/standard_server.py、src/backend/pdfTable_server/application_subcode/websocket_handlers.py；数据库插件 pdf_info_plugin.py、search_condition_plugin.py。
- 现状评估：
  1. PDFLibraryAPI 已负责 pdf_info 记录映射但缺少搜索接口；pdf_info 表文本字段可通过 json_extract 访问，已有若干普通索引。
  2. FilterManager 能将 fuzzy/field/composite 条件序列化；WS 常量已定义 pdf-home:search:pdf-files 但仍由旧 StandardPDFManager.search_files 处理。
  3. 搜索词拆分仅在前端按空格进行，无法满足"按非文本符号分割"的需求；也未对标签、笔记等字段做权重控制。
- 待解决要点：
  1. 设计多 token 匹配 + 权重排名 + 过滤约束的 SQL（可用 CTE + LOWER(... LIKE ?)/json_each 或引入 FTS5）并返回 match_score。
  2. 将 Filter 条件 JSON 翻译为 SQL where 子句（支持 AND/OR/NOT、标签包含、数值区间、布尔字段）。
  3. 统一消息流：Search/Filter 通过 WSClient 发出 pdf-home:search:pdf-files，StandardWebSocketServer 调用 PDFLibraryAPI.search_records，返回标准化结果事件供 SearchResults 渲染。
  4. 补齐测试：数据库层搜索单测、WebSocket handler 集成测，前端 SearchService/Jest 覆盖 payload 组装与结果派发。
- 下一步：编写详细方案文档，确认字段权重 & 排序策略，定义分页/排序 schema，并规划数据同步触发 FTS/索引更新。
- 用户确认前端搜索结果需要分页控件；方案需明确分页UI与请求参数。

### 2025-10-05 PDF-Home 排序面板修复
- 问题：排序按钮点击后无任何响应，原因是 pdf-sorter 功能域在安装阶段直接查找 DOM #sort-btn 并绑定 click，实际按钮由 SearchFeature 渲染且安装顺序靠后，导致绑定失败。
- 方案：改为监听全局事件 search:sort:clicked 与 header:sort:clicked 触发排序面板；仅当全局事件不可用时才启用 DOM 兜底，避免重复 toggle。
- 关键文件：src/frontend/pdf-home/features/pdf-sorter/index.js、src/frontend/pdf-home/features/pdf-sorter/__tests__/sorter-panel-events.test.js。
- 测试：pnpm test -- sorter-panel-events（覆盖 search/header 事件驱动排序面板展示）。
- 影响：排序面板与配置区可通过现有事件体系正常打开，未改变其他功能域事件命名，前端排序交互对齐架构规范。

### 2025-10-05 搜索任务拆分
- 已创建 6 个并行规格文档（todo-and-doing/2 todo/20251005195xxx-*），覆盖：
  1. 后端 LIKE SQL 搜索实现 20251005195000-pdf-search-like-sql
  2. WebSocket 搜索消息路由 20251005195100-pdf-search-ws-routing
  3. 前端 SearchService 重构 20251005195200-pdf-search-frontend-service
  4. 搜索结果分页 UI 20251005195300-pdf-search-pagination-ui
  5. 筛选条件序列化 20251005195400-pdf-search-filter-serialization
  6. 测试与 QA 覆盖 20251005195500-pdf-search-testing
- 关键决策：首版采用 LIKE + 多 token + CASE 权重方案，预留未来 FTS5 升级路径；前端必须通过 SearchService 统一发起请求并支持分页控件。
- 2025-10-05 21:00: 开始实施第一层 LIKE 搜索任务：目标是实现 PDFLibraryAPI.search_records、对应 SQL CTE、测试覆盖。

## 20251005203920 Annotation事件规范审查
- 问题: annotation 模块的事件命名、数据结构和常量使用存在多处不符合既有规范的情况, 造成事件监听与发布脱节。
- 背景: PDF_VIEWER_EVENTS 已给出统一事件清单, EventBus 使用指南要求通过 ScopedEventBus 区分局部/全局事件。
- 相关模块: src/frontend/pdf-viewer/features/annotation/index.js, core/annotation-manager.js, core/tool-registry.js, tools/{comment,text-highlight,screenshot}, components/annotation-sidebar-ui.js。
- 现状梳理:
  - CommentTool 仍发布 `annotation:jump:requested`, AnnotationFeature 监听的是 `annotation-navigation:jump:requested`, 导致跳转事件失配。
  - TextHighlightTool 删除事件 payload 使用 `annotationId`, AnnotationManager #handleDeleteAnnotation 只接受 `id`, 删除流程不一致。
  - 多数事件直接硬编码字符串, 未复用 `PDF_VIEWER_EVENTS`, 且 `annotation-navigation:jump:success` 等新事件未补登记到常量文件。
  - 侧边栏触发 `pdf-viewer:annotation:*` 事件未遵循三段式命名, Notification 事件也缺少常量。
  - 模块内全部通过 globalEventBus 通信, 未利用 ScopedEventBus 隔离内部事件。
- 原子任务拆分:
  1. 整理 annotation 模块现有事件清单, 标记命名/数据结构/常量差异。
  2. 设计事件治理方案, 包含命名规范校准、常量补全、ScopedEventBus 引入及数据契约调整。

## 202510052055 Annotation事件治理
- AnnotationFeature 现优先使用 ScopedEventBus；缺省时基于 globalEventBus 创建并在卸载时销毁，跨模块事件通过 `emitGlobal/onGlobal` 分发。
- PDF_VIEWER_EVENTS 补充：`ANNOTATION.NAVIGATION.JUMP_{REQUESTED,SUCCESS,FAILED}`、`ANNOTATION.SIDEBAR` 下的 FILTER/SORT/SETTINGS/ID 复制、CRUD 失败常量以及顶层 `NOTIFICATION.ERROR.TRIGGERED`。
- AnnotationManager/ToolRegistry/CommentTool/TextHighlightTool/ScreenshotTool/AnnotationSidebarUI 全量改用事件常量；TextHighlightTool 删除请求参数改为 `id`；CommentTool 跳转使用导航常量。
- 截图与高亮工具调用 `emitGlobal(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.OPEN_REQUESTED)` 与 `emitGlobal(PDF_TRANSLATOR_EVENTS.TEXT.SELECTED)`，ScreenshotTool 错误提示使用通知常量。
- text-highlight-tool 测试同步更新，验证颜色变更、跳转、翻译场景下新事件流。

## 202510052139 标注卡片删除按钮
- 需求: 在标注侧边栏的卡片上新增删除按钮，统一触发 annotation 删除流程。
- 相关文件: src/frontend/pdf-viewer/features/annotation/components/annotation-sidebar-ui.js, 各工具 createAnnotationCard 实现。
- 约束: 按钮需复用现有删除事件 (PDF_VIEWER_EVENTS.ANNOTATION.DELETE)，遵循侧边栏样式规范。
- 原子任务:
  1. 梳理卡片渲染入口，决定统一处理或分工具扩展。
  2. 实现删除按钮 DOM & 事件，调用公共删除逻辑。
  3. 更新 UI/测试，验证操作。

## 202510052150 标注UI表情优化
- 需求: 在标注插件系统UI（侧边栏工具按钮、卡片按钮、快捷操作按钮等）使用Unicode表情取代纯文字标识。
- 关注范围: annotation-sidebar-ui, tools下的按钮, text-selection-quick-actions。
- 注意: 保留tooltip解释文字，确保表情含义直观。
## 2025-10-06 PDF书签持久化调研
- 触发：用户要求完成 pdf-viewer 书签功能的持久化存储，询问后端基础设施是否完备。
- 目标：盘点现有数据库插件、API、消息通道是否已覆盖书签 CRUD；若缺口存在需拆解原子任务（后端/前端）。
- 关联模块：`src/backend/database/plugins/pdf_bookmark_plugin.py`、`src/backend/api/pdf_library_api.py`、`src/backend/websocket/standard_server.py`、`src/frontend/pdf-viewer/features/bookmark/*`。
- 待办：
  1. 阅读 bookmark 插件及 API 实现，确认书签写入/读取能力与事件流。
  2. 核对 WebSocket 消息是否暴露书签存储接口。
  3. 若无现成接口，设计最小持久化协议并整理到 todo 文档。
  4. 更新本调研结果与后续任务安排。
### 2025-10-06 调研结论
- `PDFBookmarkTablePlugin` 已具备完整 CRUD/层级能力并通过单测，但 `PDFLibraryAPI` 尚未暴露书签 CRUD 接口，仅用于统计数量。
- WebSocket `StandardWebSocketServer` 当前仅提供 `pdf/list` 等基础消息，缺少 `bookmark/*` 相关路由，前端无法直接调用后端持久化接口。
- 前端 `features/pdf-bookmark` 仍使用 `LocalStorageBookmarkStorage`，未集成远端存储实现；持久化落地需新增后端 API、消息协议与前端存储策略切换。
### 2025-10-06 书签持久化执行步骤
1. 设计并补充后端 API (`PDFLibraryAPI`) 的书签 CRUD 接口，同时规划对应单元测试。
2. 在 WebSocket 标准服务器中定义 `bookmark/*` 消息协议与路由，实现与 API 的集成，并规划消息流测试。
3. 扩展前端书签存储层：新增远端存储实现、切换策略与回退方案，设计前端单元/集成测试。
4. 设计端到端验证（含前端→WS→API→数据库闭环），实现并执行回归测试。
- 2025-10-06：PDFLibraryAPI 增补 `list_bookmarks`/`save_bookmarks`/`search_records` 接口；实现 LocalStorage → 数据库的树形书签持久化转换，并重写搜索逻辑（支持 tokens、多字段权重、过滤、分页）。对应单测 `src/backend/api/__tests__/test_pdf_library_api.py` 全部通过。
- 2025-10-06：WebSocket 标准服务器新增 `bookmark/list` 与 `bookmark/save` 消息处理，统一委派到 PDFLibraryAPI，并返回 `{bookmarks, root_ids}` / `{saved}` 数据结构。
- 2025-10-06：前端书签存储切换为远端优先模型，BookmarkManager 支持注入 `wsClient`，默认通过 RemoteBookmarkStorage→WebSocket→PDFLibraryAPI 持久化；WSClient 新增 `request()` + `_settlePendingRequest`，统一请求/响应链路。
