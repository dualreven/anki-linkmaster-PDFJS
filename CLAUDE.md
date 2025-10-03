---
基本规则:
   - 总是使用中文回复.
   - 询问用户时,使用Python脚本发出声音提醒: `python quick_beep.py`
     (备用方法: PowerShell API调用，如果Python不可用)

项目技术栈和开发工具:
   - 前端构建工具: Vite 5.0.0 (开发服务器 + 构建工具)
   - 前端框架: 原生JavaScript (支持ES6+ 语法)
   - 核心依赖: 
        * PDF.js 3.4.120 (PDF处理和渲染)
        * Tabulator Tables 5.4.4 (表格组件)
   - 开发工具:
        * Babel 7.28.3 (ES6+ 转译)
        * Jest 30.1.1 (单元测试)
        * ESLint 9.34.0 (代码检查)
        * TypeScript ESLint 8.41.0 (TypeScript 支持)
   - 构建配置:
        * Vite 配置支持 CommonJS 模块 (PDF.js 兼容)
        * Babel 配置支持私有类方法和属性
        * Jest 配置支持 jsdom 测试环境
   - 项目启动方式 (重要!):
        ⚠️ 严禁直接运行 npm run dev 或 python app.py 等命令!
        必须使用 ai_launcher.py 脚本来管理项目启动和停止:

        启动所有服务: python ai_launcher.py start
        检查服务状态: python ai_launcher.py status
        查看运行日志: python ai_launcher.py logs
        停止所有服务: python ai_launcher.py stop
        
        项目包含的服务:
        - npm-dev server (端口 3000): 前端开发服务器
        - debug.py (端口 9222): Python 调试控制台
        - app.py: 主应用程序 (包含 WebSocket 服务器端口 8765)

        ⚡ 新增: 直接命令行启动后端服务器 (2025-09-24):
        cd src/backend && python main.py                        # 使用默认端口启动
        cd src/backend && python main.py --ws-port 8766 --http-port 8081  # 指定端口启动
        cd src/backend && python main.py --module pdf-home      # 启动pdf-home模块
        cd src/backend && python main.py --help                 # 查看所有可用参数

        后端服务器支持的命令行参数:
        * --module: 前端模块 (pdf-viewer|pdf-home, 默认: pdf-viewer)
        * --vite-port: Vite开发服务器端口 (默认: 3000)
        * --ws-port: WebSocket服务器端口 (默认: 8765)
        * --http-port: HTTP文件服务器端口 (默认: 8080)

        PDF Viewer 启动方式:
        python src/frontend/pdf-viewer/launcher.py --pdf-id sample

        launcher.py 支持的参数:
        * --pdf-id: PDF标识符（会自动在 data/pdfs/ 等目录查找）
        * --page-at: 目标页码（从1开始）
        * --position: 页面内垂直位置百分比（0-100）

        端口配置优先级: 命令行参数 > 环境变量 > 默认值
        
        开发命令 (仅用于特殊情况的手动调试):
        * npm run dev: 启动开发服务器 (端口3000，根目录为 src/frontend/pdf-home)
        * npm run build: 构建生产版本 (输出到 src/frontend/pdf-home/dist)
        * npm run test: 运行测试套件 (Jest + jsdom 环境)
        * npm run preview: 预览构建结果

文件修改时的注意事项: 
   必须遵守和阅读开发规范: 每当你要修改一个模块时,你必须先阅读这个模块的开发规范, 通常他保存在 [模块名]/docs/SPEC 下面, 特别注意有个头文件 [模块名]/docs/SPEC/SPEC-HEAD-[模块名].yml 他记录了所有引用的规范, 必须先阅读规范, 然后遵守规范来修改和测试代码.
   与用户商量你的修改计划: 每次开始修改代码的任务前, 你必须先和用户商议讨论你的计划.

开发工具和测试规范:
   代码质量检查: 修改完成后必须运行 `npm run test` 确保所有测试通过
   ESLint 检查: 代码必须通过 ESLint 检查，遵循项目代码规范
   Babel 转译支持: 项目支持 ES6+ 语法，包括私有类方法和属性
   模块导入规范: 使用 ES6 模块导入语法，但注意 PDF.js 等 CommonJS 模块的兼容性处理
   测试覆盖率: 新功能必须编写对应的单元测试，确保代码质量

debug代码时的注意事项:
   debug的逆向思维: 从与用户使用行为最近的代码开始检查bug, 比如表格渲染不正常, 则直接看表格渲染的问题, 确定表格渲染的正确性, 如果正常, 再回推别的问题. 

本项目的前后端通信原理（添加/删除）:
   概述: 本项目的添加/删除功能基于事件驱动与异步消息传递：UI 发出用户意图 → 本地事件总线分发 → 管理器组装并发送消息到后端 → 后端执行并返回结果/广播 → 前端接收并更新 UI。
   核心原则（高层）:
      - 明确责任链：UI 负责收集用户意图并触发本地事件；管理层负责把事件转为可靠的对外消息；网络层负责实际传输并报告传输结果；后端负责执行并在变更后广播状态更新。
      - 可追溯性：每次交互应带可追溯 metadata（调用者标识、唯一请求 id 或 trace token），便于从 UI 一端追溯到后端处理结果并排查问题。
      - 幂等与确认：对可能被重复发出的操作（删除、添加确认）设计为幂等或通过唯一请求 id 实现幂等保证；仅在收到明确成功确认后再更新关键本地状态或以广播结果为准。
      - 防御性更新：后端响应可能为空或为局部信息，前端不应盲目用空数组覆盖本地列表；遇到模糊响应时应主动拉取完整列表以重建一致性。
      - 向后兼容：在迁移期间前端应同时提交可辨识资源的多种标识（例如唯一 id 与可读名称），后端以唯一 id 为优先处理依据并兼容名称匹配作为回退。

   添加功能的典型底层流程（概念）:
      - 步骤：UI 请求文件选择或上传 → 前端通过事件触发管理器发送"请求选择/上传"的消息 → 后端（或本地托管进程）弹出选择器或接收上传并持久化 → 后端返回添加结果与摘要 → 管理器收到结果并触发本地列表刷新或广播。
      - 要点：添加常常是多步的（交互式选择 + 后端确认），需要 request_id/summary 来表明实际被添加的数量与失败项；若添加成功，应触发完整列表刷新或广播以保持视图一致。

   删除功能的典型底层流程（概念）:
      - 步骤：UI 发起删除（携带资源标识）→ 本地事件总线转发到管理器 → 管理器构建删除消息并通过网络发送到后端 → 后端执行删除并返回确认/失败详情 → 后端通常会广播更新后的列表或管理器在确认后请求完整列表。
      - 要点：删除应以唯一标识为主（id），但为兼容性可同时提交名称作为回退；删除必须有明确确认（成功/失败），前端在收到成功后再更新本地视图或等待后端广播。

代码工程化思想:
   传入变量应无外部副作用: 函数接受的参数应当是不可变的, 该变量作为副本传入, 外部修改该变量不会影响其在函数内部的状态.
   必须写注释: 不管是js还是py,编写任何函数都要先写文档,描述用法和输入输出.
   ES6+ 最佳实践: 使用 const/let 替代 var，使用箭头函数、解构赋值、模板字符串等现代语法
   异步编程: 使用 async/await 处理异步操作，避免回调地狱
   错误处理: 使用 try-catch 捕获异常，提供有意义的错误信息
   模块化: 合理组织代码结构，避免全局变量污染
   性能优化: 注意大文件的分块加载，避免阻塞主线程

⚠️ EventBus 事件命名规范 (严格遵守):
   格式: {module}:{action}:{status}  (必须正好3段，用冒号分隔)

   示例:
   ✅ 正确: 'pdf-list:load:completed', 'bookmark:toggle:requested', 'ui:refresh:success'
   ❌ 错误: 'loadData', 'pdf-list:data:load:completed', 'pdf_list_updated', 'onButtonClick'

   规则:
   - module: 模块名称 (小写，用连字符分隔，如 pdf-list, pdf-viewer)
   - action: 动作名称 (小写，用连字符分隔，如 load, toggle, refresh)
   - status: 状态 (requested/completed/failed/success/error 等)
   - ⚠️ 必须正好3段，不能多也不能少！

   ⚠️ 局部事件 vs 全局事件 (严格区分):

   局部事件（功能域内部）- 使用 emit():
   - 自动添加命名空间前缀: @{feature-name}/
   - 仅在当前功能域内传播
   - 示例: eventBus.emit('data:load:completed', data)
   - 实际事件名: '@pdf-list/data:load:completed'

   全局事件（跨功能域通信）- 使用 emitGlobal():
   - 不添加命名空间前缀
   - 所有功能域都可以监听
   - 示例: eventBus.emitGlobal('pdf:list:updated', data)
   - 实际事件名: 'pdf:list:updated'

   ❌ 常见错误:
   - 混用局部和全局事件，导致事件无法正确传递
   - 在功能域内发全局事件时忘记使用 emitGlobal()
   - 监听全局事件时使用了带命名空间的事件名

   ⚠️ 不符合此格式的事件名会导致 EventBus 验证失败，代码无法运行！

   参考文档:
   - src/frontend/common/event/event-bus.js (EventNameValidator 类)
   - src/frontend/common/event/scoped-event-bus.js (ScopedEventBus 类)

功能域模块化架构 (Feature-based Modular Architecture):
   架构定义: pdf-home和pdf-viewer采用统一的功能域模块化架构，每个功能作为独立可插拔模块，通过共享micro-service基础设施协作，支持并行开发。

   📖 理解架构原理: src/frontend/ARCHITECTURE-EXPLAINED.md
   - 深度解析插件模式如何工作
   - EventBus、Registry、Container的运作原理
   - 完整运行流程演示
   - 实战案例

   核心开发原则:
   1. 功能域隔离
      - 每个Feature必须是独立目录 (features/功能名/)
      - Feature内部结构: index.js(入口) + components/ + services/ + events.js
      - 一个Feature = 一个独立功能，职责单一

   2. 事件驱动通信
      - Feature之间只能通过EventBus通信，禁止直接引用
      - 事件命名规范: `模块:功能:动作` (如 pdf-viewer:bookmark:toggle)
      - 所有事件定义集中在 common/event/constants.js

   3. 依赖注入
      - Feature依赖必须通过DependencyContainer注入
      - 在feature.config.js声明依赖: dependencies: ['logger', 'eventBus']
      - 禁止直接import其他Feature的代码

   4. 共享基础设施 (common/micro-service/)
      - FeatureRegistry - 注册和管理Feature
      - DependencyContainer - 依赖注入容器
      - ScopedEventBus - 作用域事件总线
      - StateManager - 响应式状态管理
      - FeatureFlagManager - 特性开关

   严格禁止:
   ❌ Feature之间直接调用函数或访问属性
   ❌ 在Feature内部创建全局变量
   ❌ 硬编码依赖其他Feature的路径
   ❌ 绕过EventBus直接操作DOM或状态
   ❌ 复制粘贴代码，应提取到common/或创建新Feature

   开发新Feature的标准流程（严格遵守）:
   ⚠️ 开发任何新功能前，必须先阅读：src/frontend/HOW-TO-ADD-FEATURE.md

   简化版步骤：
   1. 阅读 HOW-TO-ADD-FEATURE.md 完整文档
   2. 复制标准模板创建Feature类（必须实现4个接口）
   3. 在bootstrap/app-bootstrap-feature.js注册
   4. 通过EventBus通信，禁止直接调用其他Feature

   关键原则：
   - Feature类必须有：name, version, dependencies, install(), uninstall()
   - 在bootstrap中用 registry.register(new YourFeature()) 注册
   - 依赖其他Feature时，在dependencies数组中声明，不要import
   - 私有字段用 # 前缀

AI 接管开发时的具体规则:

   1. 开发前的准备工作:
      - 必须先阅读要修改模块的 SPEC 文档，通常在 `[模块名]/docs/SPEC/` 目录下
      - 查看模块的结构图和接口文档，了解模块的职责和边界
      - 使用 `python ai_launcher.py status` 检查项目服务状态
      - 使用 `npm run test` 确保当前代码库状态正常
      - 使用 `git status` 查看当前工作目录状态，清理无关文件
      - ⚠️ 严禁直接运行 npm run dev 或 python app.py 等命令，必须使用 ai_launcher.py

   2. 任务规划和执行:
      - 使用 TodoWrite 工具创建具体的任务清单，每个任务都要有明确的完成标准
      - 按优先级排序：先修复阻塞问题，再实现新功能，最后优化
      - 每个任务都要有对应的测试计划，包括单元测试和集成测试
      - 复杂任务要分解为不超过30分钟的小任务

   3. 代码编写具体要求:
      - JavaScript 文件必须使用 ES6+ 语法，优先使用 const 和 let
      - 类的私有方法必须使用 # 前缀，私有属性使用 _ 前缀
      - 所有函数必须有 JSDoc 注释，说明参数、返回值和用途
      - 异步操作必须使用 async/await，并提供错误处理
      - 事件处理函数必须使用具名函数，便于调试
      - 禁止使用全局变量，所有数据都必须封装在类或模块中

   4. 测试和质量检查:
      - 修改代码后立即运行 `npm run test` 验证功能
      - 新功能必须编写对应的 Jest 测试用例
      - 测试覆盖率不能低于 80%
      - 使用 `node eslint.config.js` 或 `eslint` 检查代码风格，修复所有警告
      - 重要功能必须手动测试，包括边界情况和异常处理


   6. PDF.js 相关的特殊要求:
      - 使用 PDF.js 时必须处理加载状态和错误状态
      - PDF 渲染完成后必须清理资源，避免内存泄漏
      - 大文件必须分块加载，提供进度显示
      - PDF 操作必须有超时处理，避免长时间等待

   7. 表格组件 (Tabulator) 的使用规范:
      - 表格数据必须使用响应式设计，支持动态更新
      - 表格操作（增删改）必须有确认对话框
      - 大数据量表格必须实现虚拟滚动
      - 表格导出功能必须支持多种格式（CSV、Excel、PDF）

   8. WebSocket 通信规范:
      - WebSocket 连接必须自动重连机制
      - 消息发送必须有唯一 ID，用于匹配响应
      - 网络断开时必须有本地状态保存
      - 消息队列必须有防重复机制

   9. 调试和问题排查:
      - 使用 console.log 调试时必须包含明确的标识
      - 错误信息必须包含上下文，便于定位问题
      - 使用浏览器开发者工具检查性能和内存使用
      - 重要操作必须有日志记录，便于事后分析

   10. 文档和注释要求:
      - 所有新功能必须更新对应的文档
      - API 接口必须有详细的参数说明
      - 复杂逻辑必须有流程图或时序图
      - 配置项必须有默认值和取值范围说明

   11. 项目架构特点:
      - 前端根目录为 `src/frontend/pdf-home`，不是项目根目录
      - 后端使用 Python，位于 `src/backend/` 目录
      - 前后端通过 WebSocket 通信，有完整的消息协议
      - 使用事件总线架构，各模块通过事件解耦
      - 有完整的错误处理和日志记录系统

   12. 特殊文件和配置:
      - ESLint 使用现代配置格式 (`eslint.config.js`)
      - Jest 有专门的设置文件 (`jest.setup.js`)
      - Vite 配置了 CommonJS 支持以兼容 PDF.js
      - Babel 配置了测试环境的特殊处理
      - 项目使用 `.kilocode/` 目录进行 AI 开发配置

   13. 重要提醒 - 项目启动方式:
      - ⚠️ 必须使用 ai_launcher.py 脚本来管理项目启动和停止
      - 严禁直接运行 npm run dev 或 python app.py 等命令
      - 开发前：使用 `python ai_launcher.py start` 启动所有服务
      - 开发中：使用 `python ai_launcher.py status` 检查服务状态
      - 查看日志：使用 `python ai_launcher.py logs` 监控运行情况
      - 开发后：使用 `python ai_launcher.py stop` 停止所有服务
      - 原因：直接启动会导致终端阻塞，无法进行 AI 自动化开发

   14. AI声音提醒系统:
      - 主要命令：`python quick_beep.py` (三音节上升提醒音)
      - 测试脚本：`python beep_reminder.py` (测试5种声音方法)
      - 技术方案：
        * 主要方法：winsound.Beep() - Windows内置模块
        * 备用方法：ctypes + Windows API
        * 最后备用：系统铃声 echo \a
      - 使用场景：询问用户、完成重要任务、需要注意时

   15. Claude Code 强化工作流 (借鉴Kilocode smart-agent):
      - 基于事实的决策机制：
        * 收集事实依据：每个重要决策前必须先收集足够的事实信息
        * 避免凭空猜测：不确定时优先使用搜索、读取文件等工具获取准确信息
        * 验证假设：对关键假设必须通过实际操作或测试来验证

      - 原子化任务分解：
        * 复杂任务强制分解：超过3个主要步骤的任务必须先列出详细计划
        * 原子任务标准：每个子任务应该是不可再分且可独立验证的
        * 时间控制：单个原子任务应控制在15-30分钟内完成

      - 验证驱动开发：
        * 代码修改后立即验证：每次代码变更后必须运行相关测试
        * 功能实现分步验证：复杂功能实现过程中要分阶段验证
        * 错误快速发现：通过频繁验证尽早发现问题

      - 结构化思考流程：
        * 问题分析：明确当前面临的具体问题和困境
        * 方案设计：基于事实提出可行的解决方案
        * 风险评估：识别潜在风险和应对措施
        * 实施验证：执行方案并验证结果

      - 工作记录机制：
        * 使用TodoWrite工具：复杂任务必须用TodoWrite追踪进度
        * 关键决策记录：重要的技术决策和理由要记录到相关文档
        * 失败经验总结：遇到问题时要分析原因并记录解决方案

      - 质量控制标准：
        * 代码质量：修改代码后必须通过ESLint和测试
        * 文档完整：新功能必须有对应的文档和使用说明
        * 向后兼容：变更要考虑对现有功能的影响
        * 错误处理：关键功能必须有完善的错误处理机制

# AI助手协作记录 (自动维护)

## 最近工作进展 [2025-09-20 18:25]
🔧 **调试**: 分析并修复PDF双击事件调用链和日志分离问题

### PDF双击事件完整调用链
通过深入分析前端代码，发现了完整的双击事件传播路径：

1. **用户双击** → Tabulator表格行双击事件
2. **Tabulator捕获** → `rowDblClick` 事件处理器
3. **事件发出** → `PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED` 事件到EventBus
4. **PDFManager监听** → `EventHandler.setupEventListeners()` 捕获事件
5. **调用openPDF** → `PDFManagerCore.openPDF(filename)` 方法
6. **WebSocket发送** → `WEBSOCKET_EVENTS.MESSAGE.SEND` 消息
7. **后端处理** → `StandardWebSocketServer.handle_open_pdf_request()`
8. **窗口创建** → `Application.open_pdf_viewer_window()`
9. **文件名注入** → `window.PDF_PATH` JavaScript注入

### 已修复的问题
- **文件ID解析**: 修复后端将file_id解析为完整文件名的逻辑
- **403错误**: 通过PDF管理器获取完整文件名(含.pdf扩展名)
- **日志分离**: 实现PDF特定日志文件创建机制

### 待修复问题
- **双击重复事件**: 一次双击触发两次`pdf:open:requested`事件

## 当前项目状态
- 最后更新: 2025年09月20日 15:05
- 工作重心: 测试追加模式更新memory-bank
- 优先级: low

## Kilocode协作状态
- 上下文已同步: ✅
- 工作日志已创建: ✅
- 可以无缝接管任务

## 下次AI助手启动提醒
- 请检查最新的工作进展
- 关注当前任务的优先级
- 如有疑问可查看AItemp/目录下的详细工作日志
