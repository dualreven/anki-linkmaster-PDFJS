### 待办任务:

1. 测试从pdf-home添加一个按钮,启动 加载特定 pdf文件的 pdf-viewer, 参考 AItemp\20250917012135-AI-Working-log.md
   1. 代码的修改导致 pdf-home模块显示不正常,需要修改
2. 测试双击点击 pdf-table 某一行, 可打印该行内容到控制台.
3. 结合1,2 实现双击 pdf-table 某一行, 将该行的pdf信息 用 pdf-viewer打开
4. ai-launcher.py 启动后 命令行的键盘输入变得不正常, 无法输入控制字符比如 `ctrl+c` 或者 `backspace` 需要检查修复,
5. 已有事件的命名要规范,变量化,未来新事件的命名应遵循规范

### 当前任务：相对导入错误修复 ✅ 已完成

**任务目标**：修复 "ImportError: attempted relative import beyond top-level package" 错误，使应用能够正常启动

**任务状态**：✅ 已完成

**修复的问题**：

1. ✅ **相对导入超出顶级包**: `src/backend/websocket/standard_server.py`中的`from ..pdf_manager.manager import PDFManager`失败
2. ✅ **main.py相对导入**: `src/backend/main.py`中的`from app.application import AnkiLinkMasterApp`失败
3. ✅ **application.py相对导入**: `src/backend/app/application.py`中的多个相对导入失败
4. ✅ **导入路径不一致**: 项目拆分后路径关系发生变化，相对导入不再正确工作

**修复措施**：

- ✅ 修改 `src/backend/websocket/standard_server.py`:
  - `from ..pdf_manager.manager import PDFManager` → `from src.backend.pdf_manager.manager import PDFManager`
  - `from ..pdf_manager.page_transfer_manager import page_transfer_manager` → `from src.backend.pdf_manager.page_transfer_manager import page_transfer_manager`

- ✅ 修改 `src/backend/app/application.py`:
  - `from ui.main_window import MainWindow` → `from src.backend.ui.main_window import MainWindow`
  - `from websocket.standard_server import StandardWebSocketServer` → `from src.backend.websocket.standard_server import StandardWebSocketServer`
  - `from pdf_manager.manager import PDFManager` → `from src.backend.pdf_manager.manager import PDFManager`
  - `from http_server import HttpFileServer` → `from src.backend.http_server import HttpFileServer`

- ✅ 修改 `src/backend/main.py`:
  - `from app.application import AnkiLinkMasterApp` → `from src.backend.app.application import AnkiLinkMasterApp`

**验证结果**：

- ✅ 所有关键模块导入测试通过
- ✅ 应用启动时的ImportError错误已完全解决
- ✅ 测试脚本验证所有8个导入均成功：
  - ✅ `src.backend.main`
  - ✅ `src.backend.app.application`
  - ✅ `src.backend.websocket.standard_server`
  - ✅ `src.backend.pdf_manager.manager`和`page_transfer_manager`
  - ✅ `src.backend.websocket.standard_protocol`
  - ✅ `src.backend.ui.main_window`
  - ✅ `src.backend.http_server`
- ✅ 项目结构保持完整，未增加额外依赖

**后续影响**：

- 保持了项目的包结构清晰性
- 简化了模块间的依赖关系
- 提高了代码的可维护性和扩展性
- 为后续功能开发奠定了基础
### 当前任务：ai-launcher模块选择修复 ✅ 已完成

**任务目标**：修复ai-launcher.ps1启动pdf-viewer模块时却启动pdf-home模块的问题

**任务状态**：✅ 已完成

**修复的问题**：

1. ✅ **环境变量缺失**: Vite启动命令中缺少VITE_MODULE环境变量设置
2. ✅ **模块选择失效**: 无论-Module参数设置什么值，总是加载pdf-home模块

**修复措施**：

- ✅ 修改 `ai-launcher.ps1`: 在Vite启动命令前添加环境变量设置 `$env:VITE_MODULE = "$Module"`

**验证结果**：

- ✅ Vite日志确认：`[Vite] Loading module: pdf-viewer`
- ✅ 页面内容确认：显示"PDF阅读器 - Anki LinkMaster"标题
- ✅ 模块切换功能正常工作

### JS文件拆分后运行失败修复 ✅ 已完成

**任务目标**：修复文件拆分后运行失败的问题，主要解决导入导出不一致导致的语法错误

**任务状态**：✅ 已完成

**修复的问题**：

1. ✅ **导入导出不一致**: index.js 使用默认导入 `import TableWrapper from './table-wrapper.js'`，但拆分后的 table-wrapper.js 只提供命名导出 `export class TableWrapper`
2. ✅ **Tabulator引用缺失**: table-utils.js 中的 runTabulatorSmokeTest 函数使用 `new Tabulator()` 但没有导入 Tabulator
3. ✅ **PDFViewerApp方法冲突**: PDFViewerApp类中重复定义了父类PDFViewerAppCore的私有方法
4. ✅ **UIManagerCore方法缺失**: UIManagerCore类缺少公开的getContainer()方法

**修复措施**：

- ✅ 修改 `src/frontend/pdf-home/index.js`: 将默认导入改为命名导入 `import { TableWrapper } from './table-wrapper.js'`
- ✅ 修改 `src/frontend/pdf-home/table-utils.js`: 添加 Tabulator 导入 `import { Tabulator } from 'tabulator-tables'`
- ✅ 修改 `src/frontend/pdf-viewer/main.js`: 删除重复的方法定义，使用父类方法
- ✅ 修改 `src/frontend/pdf-viewer/app-core.js`: 将私有方法改为公开方法
- ✅ 修改 `src/frontend/pdf-viewer/ui-manager-core.js`: 添加getContainer()公开方法

**验证结果**：

- ✅ 应用成功启动并正常运行
- ✅ 前端页面在 http://localhost:3000 正常访问
- ✅ WebSocket连接正常建立，数据正常传输
- ✅ 没有出现语法错误和 "Tabulator is not defined" 错误
- ✅ PDF查看器模块初始化成功，无方法调用错误

### 历史状态记录

#### JS文件行数统计与拆分改造（已完成）

**任务目标**：统计src目录下所有js文件的行数，对行数大于500的文件进行拆分改造，确保每个文件行数都小于500
**当前状态**：✅ 已完成 (6/6)

### 历史状态记录

#### PDF表格双击打开PDF查看器（功能已验证）

**用户需求**：在 pdf-home 的 PDF表格上双击任何一行，使用 pdf-viewer 打开对应的PDF
**当前状态**：✅ 功能已成功实现并验证

**相关模块与文件**：

- `src/frontend/pdf-home/table-wrapper.js`：表格组件（已修复isSelected问题）
- `src/frontend/pdf-home/index.js`：PDFhome应用主文件（第75-90行实现双击事件）
- `src/frontend/common/pdf/pdf-manager.js`：处理OPEN.REQUESTED事件（第160-175行）
- `src/backend/websocket/standard_server.py`：后端处理OPEN_PDF请求（第327-366行）
- `ai-launcher.ps1`：模块启动脚本（支持-PdfPath参数）
- `src/frontend/pdf-viewer/main.js`：PDF查看器自动加载（第625-630行）

**功能链验证结果**：

1. ✅ 前端双击事件：index.js rowDblClick → 获取行数据 → 触发OPEN.REQUESTED事件
2. ✅ PDF管理器：监听OPEN.REQUESTED → 调用openPDF方法
3. ✅ WebSocket通信：发送OPEN_PDF请求到后端
4. ✅ 后端处理：handle_open_pdf_request → 调用ai-launcher.ps1启动pdf-viewer
5. ✅ 参数传递：通过-PdfPath参数和window.PDF_PATH注入
6. ✅ PDF查看器：自动检查window.PDF_PATH并加载对应PDF

### Python AI Launcher 帮助信息功能实现 ✅ 已完成

**任务目标**：为 `ai-launcher.py` 添加命令行帮助信息功能，使其在执行 `python ai-launcher.py` 时显示完整的使用说明，包括支持的子命令、参数和示例，提升脚本的可用性和可维护性

**任务状态**：✅ 已完成

**实现的问题**：

1. ✅ **无参数时无帮助信息**: 原脚本在无参数时仅显示默认启动行为，未提供使用指南
2. ✅ **帮助信息缺失**: 缺乏对子命令、参数、使用示例的完整说明
3. ✅ **与 PowerShell 版本不一致**: Python 版本缺少 PowerShell 版本中的详细帮助文档

**修复措施**：

- ✅ 修改 `ai-launcher.py`: 在 `run()` 方法中添加 `if len(sys.argv) == 1: launcher.parse_arguments().print_help()` 逻辑
- ✅ 保留原有 `argparse` 的 `epilog` 示例和参数说明，确保信息完整
- ✅ 保持与 `ai-launcher.ps1` 的帮助内容结构和信息一致，包括子命令、参数、示例
- ✅ 验证 `python ai-launcher.py` 和 `python ai-launcher.py --help` 均显示完整帮助信息

**验证结果**：

- ✅ 执行 `python ai-launcher.py` 显示完整帮助信息，包含子命令、参数、使用示例
- ✅ 执行 `python ai-launcher.py --help` 显示完全相同的内容
- ✅ 帮助信息与 `ai-launcher.ps1` 的帮助内容在功能和结构上完全一致
- ✅ 脚本原有功能（start/stop/status/logs）未受影响，仍可正常执行
- ✅ 代码符合 Python 命令行工具最佳实践，结构清晰，易于维护和扩展

### Application.py 模块化拆分 ✅ 已完成

**任务目标**：拆分 `src/backend/app/application.py`，将代码行数压缩到400以内，将拆分出的文件统一存放在 `src/backend/app/application_subcode/` 下面，确保引用正确

**任务状态**：✅ 已完成

**拆分结果**：

- **主应用文件**: 163 行（原1000行 → 163行，压缩83.7%）
- **辅助函数模块**: 47 行（helpers.py）
- **响应处理器模块**: 98 行（response_handlers.py）
- **WebSocket处理器模块**: 644 行（websocket_handlers.py）
- **客户端处理器模块**: 102 行（client_handler.py）
- **命令行处理器模块**: 89 行（command_line_handler.py）

**架构改进**：

- ✅ **模块化设计**: 将单一大型文件拆分为功能明确的多个模块
- ✅ **职责分离**: 每个模块负责特定功能领域
- ✅ **可维护性**: 代码更易于理解和维护
- ✅ **扩展性**: 便于未来功能扩展和测试

**验证结果**：

- ✅ 所有模块导入测试通过
- ✅ 文件结构完整且符合要求
- ✅ 主应用文件行数163 < 400（符合要求）
- ✅ 所有Python文件语法检查通过
### Application Subcode模块规范文档创建 ✅ 已完成

**任务目标**：为 `src/backend/app/application_subcode` 模块创建规范文档，特别强调事件命名的规范性和使用变量，保存在私人规范目录 `docs/SPEC` 下

**任务状态**：✅ 已完成

**创建的内容**：

1. **规范头文件**：`src/backend/app/application_subcode/docs/SPEC/SPEC-HEAD-application_subcode.json`
   - ✅ 定义模块规范头结构，使用JSON格式
   - ✅ 包含meta信息、引用规范、私有规范列表
   - ✅ 引用通用后端命名规范为参考

2. **四大原子规范文档**：
   - ✅ **BACKEND-APPSUBCODE-EVENT-NAMING-001.md**：事件信号命名规范
   - ✅ **BACKEND-APPSUBCODE-VARIABLE-NAMING-001.md**：变量常量使用规范
   - ✅ **BACKEND-APPSUBCODE-MESSAGE-TYPE-001.md**：消息类型命名规范
   - ✅ **BACKEND-APPSUBCODE-MODULE-STRUCTURE-001.md**：模块结构组织规范

3. **规范重点**：
   - ✅ **事件命名规范性**：强制使用常量而非硬编码字符串，统一WEBSOCKET_MESSAGE_TYPES常量类
   - ✅ **变量常量化**：变量使用snake_case，常量使用UPPER_CASE，避免硬编码
   - ✅ **消息类型统一**：所有WebSocket消息类型必须在常量类中定义
   - ✅ **模块组织规则**：文件拆分原则、类组织规则、导入顺序规范

**验证结果**：

- ✅ 目录结构完整：`src/backend/app/application_subcode/docs/SPEC/` 下创建5个规范文件
- ✅ 格式符合要求：使用标准原子规范模板，包括详细内容、正反例、验证方法
- ✅ 私规范定位正确：保存在 `src/backend/app/application_subcode/docs/SPEC` 下
- ✅ 内容面向实际代码：规范基于现有代码分析，针对性解决硬编码、命名不一致等问题
- ✅ 特别突出常量化：所有文档都强调避免硬编码字符串，使用常量比较

**后续影响**：

- 为application_subcode模块建立了全面的代码规范体系
- 为后续代码重构和功能开发提供了具体可遵循的标准
- 规范文档可作为代码审查和验收的标准
- 为整个项目的后端开发规范奠定了基础模式
- ✅ 模块间引用正确，功能保持不变
