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
- 待办：
  - 实现最小版 PDF 业务服务器并接入 WS 转发。
  - 复核 pdf-viewer 全量对齐共享 EventBus/WSClient。
  - 为 Launcher 增加健康检查与 E2E 脚本。

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
