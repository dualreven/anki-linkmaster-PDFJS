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
- 待办：
  - 实现最小版 PDF 业务服务器并接入 WS 转发。
  - 复核 pdf-viewer 全量对齐共享 EventBus/WSClient。
  - 为 Launcher 增加健康检查与 E2E 脚本。

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
- 最后更新: 2025-10-01 20:46
- 阶段: PDFViewer组件集成

### 已完成工作
1. **分析了pdf-home的架构模式** (2025-09-29)
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

