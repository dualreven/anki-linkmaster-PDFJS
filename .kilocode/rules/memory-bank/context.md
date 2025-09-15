# 当前工作上下文

## 工作焦点

- **主要任务**：AI启动器模块切换功能集成
- **当前状态**：ai-launcher.ps1 已成功集成模块切换功能，支持 pdf-home 和 pdf-viewer 模块的动态切换
- **优先级**：高 - 提高开发和测试效率的关键功能

## 最近变化

- ✅ **✅ AI启动器模块切换与PDF自动加载功能**：成功增强 ai-launcher.ps1，支持在启动 pdf-viewer 模块时自动加载指定 PDF 文件
  - 支持 `-Module {pdf-home|pdf-viewer}` 参数
  - 支持 `-Port PORT` 参数自定义Vite端口
  - 新增 `-Test` 参数：启动 pdf-viewer 时自动加载 `test_pdf_files\test.pdf`
  - 新增 `-Path PATH` 参数：启动 pdf-viewer 时加载指定路径的 PDF 文件（必须存在且为 .pdf 扩展名）
  - 自动创建模块特定的日志文件
  - 完整的帮助文档和使用示例
  - 参数验证：仅在 `-Module pdf-viewer` 时生效，非法路径或非PDF文件将报错退出
- ✅ 移除了 tech.md 中 python app.py 的手动调试用法
- ✅ 更新了最佳实践指南，推荐使用 ai-launcher.ps1 作为唯一启动方式

## 功能特性

### ai-launcher.ps1 新功能
- **模块切换**: 支持 pdf-home (文件管理) 和 pdf-viewer (PDF阅读器) 模块
- **端口配置**: 支持自定义Vite开发服务器端口
- **智能日志**: 自动创建模块特定的日志文件
- **PDF自动加载**: 支持通过 `-Test` 或 `-Path` 参数在启动 pdf-viewer 时自动加载 PDF 文件
- **完整文档**: 详细的帮助信息和使用示例

### 使用方法
```bash
# 默认启动 (pdf-viewer 模块，端口3000)
.\ai-launcher.ps1 start

# 启动 pdf-home 模块，端口3001
.\ai-launcher.ps1 start -Module pdf-home -Port 3001

# 启动 pdf-viewer 模块，端口3002
.\ai-launcher.ps1 start -Module pdf-viewer -Port 3002

# 启动 pdf-viewer 并自动加载测试文件
.\ai-launcher.ps1 start -Module pdf-viewer -Test

# 启动 pdf-viewer 并加载指定 PDF 文件
.\ai-launcher.ps1 start -Module pdf-viewer -Path "test_pdf_files\test.pdf"

# 查看帮助
.\ai-launcher.ps1 help
```

## 验证结果
- ✅ pdf-home 模块成功启动在端口3001
- ✅ pdf-viewer 模块成功启动在端口3002
- ✅ Vite服务器正确使用指定端口
- ✅ 模块日志文件正确创建和记录
- ✅ 所有服务进程正确管理
- ✅ `-Test` 和 `-Path` 参数在合法路径下触发 PDF 加载请求（通过 logs\load-pdf.json 文件触发）
- ✅ 非法参数（如非PDF文件、错误模块）时正确报错并退出

## 最佳实践更新
- **推荐**: 总是使用 `.\ai-launcher.ps1 start` 启动开发环境
- **禁止**: 直接执行 `npm run dev`、`python app.py` 等阻塞命令
- **理由**: ai-launcher.ps1 确保进程不会阻塞自动化流程，且支持自动化测试与调试集成

## 下一步计划

1. **PDF阅读器集成**：将PDF.js完全集成到现有的事件驱动架构中
2. **智能卡片生成**：实现从PDF内容自动提取重要信息的功能
3. **搜索与筛选**：添加全文搜索和高级筛选功能
4. **批量操作**：实现批量处理PDF文件的能力
5. **后端PDF自动加载**：实现后端监听 logs/load-pdf.json 文件并触发 WebSocket 消息加载 PDF（已实现）

## 技术债务

- 需要完善PDF元数据提取功能
- 考虑添加更多单元测试覆盖
- 性能优化空间（特别是大数据集处理）

## 风险点

- PDF.js与现有事件系统的集成复杂度
- 跨平台兼容性（QtWebEngine的PDF.js支持）
- 内存管理（处理大型PDF文件时的性能）
- 2025-09-14T17:35:26+08:00: 启动自动化测试计划。目标：运行前端单元测试 (npm test)，将 Jest 输出保存到 logs/jest-output.log，并在测试完成后分析失败用例。发起者：continuous-agent；理由：验证最近对事件常量与 emit(null) 修复在真实测试下是否生效。
  2025-09-14T17:44:14+08:00: 自动化测试运行结果摘要：
- 操作：在项目根运行 npm test，将输出写入 logs/jest-output.log。
- 结果：测试全部运行完毕。Summary: 27 个测试套件失败，5 个通过；总测试 344 个（225 失败，119 通过）。
- 主要失败簇（初步分析）：
  1. 大量失败来自 src/frontend/common/utils/indexeddb-cache-manager 的测试（IndexedDB 初始化 / onupgradeneeded 导致的 createIndex 报错：TypeError: Cannot read properties of undefined (reading 'createIndex')）。
  2. 报错与 jsdom 下缺失或未 mock 的 IndexedDB API 高度相关（导致 objectStore 未按预期创建，随之触发多个 beforeEach/钩子超时）。
- 初步结论与建议：
  - 问题并非由先前修复的 PDF_VIEWER_EVENTS 事件常量引起；是测试环境（Jest/jsdom）对 IndexedDB 支持不足或缺少 polyfill/mock。
  - 建议方案（优先级）：
    1) 在测试环境引入 fake-indexeddb（或 fake-indexeddb/auto），并通过 jest 的 setupFiles 全局引入，使 Node/jsdom 在测试时拥有 IndexedDB API；这是最小改动且对现有实现侵入性最低的方案。
    2) 若不愿意引入 polyfill，可在测试中单独 mock window.indexedDB，或在 IndexedDBCacheManager 的 initialize 中对缺失 indexedDB 做降级处理（使用内存实现或跳过相关逻辑），不过这可能影响实现验证的完整性。
    3) 修改后需重新运行 npm test，优先关注之前因 IndexedDB 导致的连锁失败是否消除。
- 后续步骤（待执行）：
  - 创建修复子任务：在 devDependencies 中添加 fake-indexeddb 并在 jest.setup.js 或 jest.config.js 的 setupFiles 中引入 'fake-indexeddb/auto'；提交分支并运行测试验证。
  - 若你同意，我将创建该子任务（new_task mode=continuous-agent），并在获准后提交 apply_diff 修改（先创建分支并 commit 快照的流程需遵循项目规范）。

## Git 状态（自动更新）

- 当前分支: feat/pdfjs-init-logging
- 工作区状态: 已提交所有修改
- 最近提交:
  - commit: 7a29626
  - date: 2025-09-14 22:32:58 +0800
  - message: 修复PDF-viewer中重复canvas问题，优化UIManager复用逻辑，更新context.md记录修复过程

## 操作说明（建议）

- 请在继续前确认是否需要将上述修改提交到版本库。常见选项：
  1. 提交（git add ...; git commit -m "..."; git push）
  2. 若为临时更改，可使用 git stash 保存
- 我将重置 AItemp/AI_DIALOG_COUNT.json 的计数（见下），并在文件更新后记录操作日志到 context.md

## 自动更新记录
- 2025-09-14T18:57:12+08:00: 将 Git 状态写入 context.md 并重置 AItemp/AI_DIALOG_COUNT.json（count -> 0）。由 continuous-agent 执行.

- 2025-09-14: 修复 PDF-viewer 事件常量缺失导致 UIManager 在 #handleResize 时 emit(undefined) 的问题。变更文件：src/frontend/common/event/pdf-viewer-constants.js（新增 UI.RESIZED、调整 UI.TOOLBAR_TOGGLE 命名）；此外对 constants 的命名进行了规范化，确保所有事件名满足 EventBus 验证规则（形如 module:namespace:event）。

2025-09-14T19:26:18+08:00: 检查任务 - 验证 PDF-viewer 模块原子规范文件完整性
- 操作：对比 src/frontend/pdf-viewer/docs/SPEC/SPEC-HEAD-pdf-viewer.json 中 private 列表与目录 src/frontend/pdf-viewer/docs/SPEC/ 下的实际文件。
- 结果：已验证，以下原子规范文件均存在（无缺失）：
  - PDF-VIEWER-STRUCTURE-001.md
  - PDF-VIEWER-EVENT-HANDLING-001.md
  - PDF-VIEWER-PDFJS-INTEGRATION-001.md
  - PDF-VIEWER-QTWEBENGINE-ADAPTATION-001.md
  - PDF-VIEWER-VITE-INTEGRATION-001.md
  - PDF-VIEWER-WEBSOCKET-CONTRACT-001.md
  - PDF-VIEWER-TEST-PLAN-001.md
- 其它操作：已将 AItemp/AI_DIALOG_COUNT.json 重置为 0（见 AItemp/AI_DIALOG_COUNT.json）。
- 建议：是否需要我基于 docs/AI-docs-schema/atom-spec.example.md 模板，为上述规范补充“正向例/反向例/验证步骤”的详细示例与代码片段？若需要，请回复“补充详细原子规范”或指定优先补充的规范 ID。
- 2025-09-14T20:05:05+08:00: 为 UIManager 复用 canvas 问题新增 jsdom 单元测试。
  - 文件：tests/frontend/pdf-viewer/ui-manager.spec.js
  - 目的：验证 UIManager 在容器已存在 id="pdf-canvas" 的 canvas 时不会创建重复的 canvas 元素，而是复用已有元素。
  - 测试要点：
    1. 在 DOM 中预先创建一个带 id="pdf-canvas" 的 canvas（模拟 index.html 的静态 canvas）。
    2. 导入并初始化 UIManager（尽可能兼容默认导出 / 命名导出 / 类构造签名）。
    3. 断言初始化后 document.querySelectorAll('#pdf-canvas').length === 1 且返回的元素严格等于最初的静态 canvas。
  - 验证建议：
    1. 在本地运行：npm test -- tests/frontend/pdf-viewer/ui-manager.spec.js
    2. 若测试因模块导入/初始化接口差异失败，请检查 src/frontend/pdf-viewer/ui-manager.js 的导出方式并在测试中适配（测试中已采用多种尝试路径以兼容常见导出形式）。
  - 下一步建议：将该测试加入 CI 路径；如果出现 Jest/jsdom 环境对 IndexedDB 的其他失败，请按既定计划引入 fake-indexeddb 并在 jest.setup.js 中通过 'fake-indexeddb/auto' 做全局 polyfill。

  - 2025-09-14T19:56:09+08:00: 修复 PDF-viewer 中重复 canvas (id="pdf-canvas") 问题。
  - 问题描述：在渲染 /pdf-viewer/index.html 时页面上出现两个具有相同 id="pdf-canvas" 的 canvas 元素。根因是 index.html 中静态包含了一个 canvas（id="pdf-canvas"），而 UIManager 初始化逻辑无条件创建并 append 了另一个同 id 的 canvas，导致 DOM 中存在重复 id，引发渲染/交互异常。
  - 修改内容：
    - 修改文件：src/frontend/pdf-viewer/ui-manager.js
      - 变更点：在创建 canvas 之前先检查容器中是否已存在 id="pdf-canvas" 的元素；若存在且为 HTMLCanvasElement 则复用该元素；否则才创建并 append 新的 canvas。并保证获取上下文（getContext）后再进行事件绑定等初始化操作。
    - 保留文件：src/frontend/pdf-viewer/index.html（静态 canvas 保留，UIManager 由复用优先改为必要时创建）
  - 验证建议：
    1. 在开发服务器 (npm run dev / 使用 ai-launcher.ps1) 下打开 http://localhost:3000/pdf-viewer/index.html，使用浏览器开发者工具检查 DOM，仅存在一个 id="pdf-canvas" 的 canvas。
    2. 加载 test.pdf 检查页面渲染是否正常（第一页能渲染且无重复 canvas）。
    3. 测试缩放、翻页、窗口 resize 等交互，确认 UIManager 对复用 canvas 的操作无副作用。
  - 备注：已在本地将 AItemp/AI_DIALOG_COUNT.json 计数更新为 1，并记录此次修复时间。
<!-- update: 2025-09-14 - 修复 EventBus 验证导致的 undefined 事件问题 -->

2025-09-15T00:51:45+08:00: 修复：pdf-home 模块中 pdf-table 的多选删除问题
- 问题概述：
  - 报告：用户发现 pdf-home 的表格无法进行“多选删除”操作。
  - 根因初步分析：Tabulator 在不同环境/版本下对“选中行”的 API 返回值不一致（有时返回 plain data objects，有时返回 RowComponent 对象）；TableWrapper 和 UIManager 之间对选中数据的期望不一致，导致 UIManager 无法正确收集选中 items 的 id/filename，从而批量删除未能触发或发送了空列表。
- 已执行的修改（代码级）：
  1. src/frontend/pdf-home/table-wrapper.js
     - 修改：getSelectedRows() 方法被正规化（normalization），现在会：
        - 在回退模式（fallback HTML table）下可靠读取 checkbox 并返回 plain object 列表（防御性拷贝）。
        - 在 Tabulator 模式下优先使用 getSelectedData()（若返回 plain objects 即采用），若返回 RowComponent 列表则调用 getData() 并转为 plain objects；若两者均不可用则基于 DOM 查找 selected 行并映射到内部数据。
        - 返回值保证为 plain object 数组（每项为 {id, filename, ...} 或尽可能可用的标识符），以便调用方无需关心底层 Tabulator 的返回类型差异。
  2. src/frontend/pdf-home/ui-manager.js
     - 修改：#handleBatchDelete() 中对选中项的读取逻辑增强：
        - 优先使用 pdfTable.getSelectedRows()（现在返回正规化的 plain objects）。
        - 增强回退检测：支持多种 checkbox 类名（.pdf-item-checkbox、.pdf-table-checkbox、.pdf-table-row-select）并从 DOM 中安全提取 data-filename / data-row-id / data-filepath。
        - 对收集到的 selected identifiers 进行了更鲁棒的提取（优先 id -> filename -> file_id -> fileId）。
        - 保持对 PDF_MANAGEMENT_EVENTS.BATCH.REQUESTED 事件的发送方式不变，但确保 payload.files 为非空且为前端/后端可识别的标识符数组。
- 验证与诊断：
  - 在 index.js 中已经添加（存在）对 Tabulator 原生事件 rowSelectionChanged 的诊断绑定（console 输出）。修改后，可在浏览器控制台进行以下验证：
    1. 启动前端（使用 ai-launcher.ps1 start 或 npm run dev）。
    2. 打开 pdf-home 页面，选中多行（使用 checkbox 或 rowSelection）。
    3. 点击“批量删除”按钮，确认提示并检查控制台是否发送了包含已选文件列表的 PDF_MANAGEMENT_EVENTS.BATCH.REQUESTED 事件（可以在 EventBus 日志或 network/WebSocket 消息中查看）。
    4. 观察后端（或 PDFManager 日志）是否收到了对应的批量删除请求，并且批次追踪（batch tracking）行为正常（pending 计数减少，最终触发列表刷新）。
- 后续建议（优先级排序）：
  1. 将上述修改提交为一个单独的 Git commit（遵循约定：先创建分支，运行测试，提交），建议分支名：fix/pdf-home-batch-delete.
  2. 在 CI 或本地运行前端测试（npm test），并手动/自动验证与 IndexedDB 无关的单元与集成测试（本次改动主要是 DOM/事件层面，单元影响应有限）。
  3. 考虑为 TableWrapper.getSelectedRows 增加单元测试，用 mock Tabulator 返回不同类型（plain objects / RowComponent）以确保兼容性不回退。
  4. 若你的团队接受更严格的类型约定，建议在事件规范中明确 selection 事件的 payload schema（例如：始终发送 array of { id, filename }），并在 EventBus 的校验逻辑中强制验证。
- 当前状态：
  - 代码已修改并写入工作区（files modified: src/frontend/pdf-home/table-wrapper.js, src/frontend/pdf-home/ui-manager.js）。
  - 建议进行一次手工 smoke 测试并在 CI 中包含相关测试。如需，我可以继续：创建分支、生成 commit、运行测试并提交 PR（new_task, mode: continuous-agent）。
2025-09-15T17:31:00+08:00: 修复中文PDF标题提取问题
- 问题：中文PDF文件"C:\Users\napretep\Downloads\基于深度特征的立定跳远子动作定位方法研究_花延卓.pdf"的标题不能被正确提取
- 根因：PDFMetadataExtractor.extract_metadata()返回的title字段为空字符串，但manager.py中的逻辑只在title键不存在时才使用文件名回退
- 修复：修改src/backend/pdf_manager/manager.py中的_extract_metadata方法，当提取的title为空字符串时也使用文件名作为回退
- 修改内容：
  - 将 `"title": metadata.get("title", os.path.splitext(os.path.basename(filepath))[0])`
  - 改为：`"title": extracted_title if extracted_title else filename_title`
- 验证：创建了单元测试src/backend/tests/test_pdf_manager_chinese.py，确保修复正确且不会被破坏
2025-09-15T01:53:00+08:00: 实现后端监听 logs/load-pdf.json 文件并触发 WebSocket 消息加载 PDF
- 问题：需要在后端实现自动监听 logs/load-pdf.json 文件，当文件被 ai-launcher.ps1 创建时，自动通过 WebSocket 向前端发送 PDF 加载请求
- 解决方案：
  1. 在 AnkiLinkMasterApp 类中添加 start_pdf_load_listener() 方法，用于启动后台线程监听文件
  2. 在 run() 方法中，当启动 pdf-viewer 模块时调用 start_pdf_load_listener()
  3. 后台线程定期检查 logs/load-pdf.json 文件是否存在且被修改
  4. 读取文件内容，提取 path 字段
  5. 通过 WebSocketServer 向所有连接的前端客户端广播 pdf_view_request 消息
  6. 成功发送消息后删除 logs/load-pdf.json 文件
- 实现文件：
  - src/backend/app/application.py：添加了 start_pdf_load_listener() 和 _pdf_load_listener_worker() 方法
  - src/backend/tests/test_pdf_load_listener.py：编写了完整的测试用例，验证文件监听、消息广播和文件删除功能
- 验证：
  - 测试用例覆盖了正常情况、无效JSON、不存在的PDF路径和缺少path字段等边界情况
  - 所有测试通过，确保功能稳定可靠
- 与 ai-launcher.ps1 的集成：
  - ai-launcher.ps1 在启动 pdf-viewer 模块时会创建 logs/load-pdf.json 文件
  - 后端监听器检测到文件后自动触发 WebSocket 消息，实现无缝集成
- 优势：
  - 实现了前后端的解耦，前端无需直接处理文件系统
  - 提供了统一的 PDF 加载接口，便于未来扩展
  - 自动清理临时文件，避免磁盘空间浪费
- 结果：中文PDF文件现在能正确显示文件名作为标题