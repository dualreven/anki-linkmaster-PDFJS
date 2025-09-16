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