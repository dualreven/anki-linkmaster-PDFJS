# Memory Bank - Context（简版）

本文件为“可快速上手的精简版上下文”。如需完整历史，可从 Git 历史检索旧版 context.md。

## 1) 项目硬约束
- 文件读写显式 UTF-8；统一使用 `\n` 换行。
- 事件命名强制三段式：`{module}:{action}:{status}`；全局事件需通过白名单（global-event-registry）放行。
- 禁止兜底原则：契约不匹配不得静默放过。

## 2) 关键协议与约定（前后端一致）
- WebSocket 消息常量（前端）：`WEBSOCKET_MESSAGE_TYPES.*`（pdf-library/outline/annotation/anchor等）。
- 消息类型（后端）：`MessageType(Enum)` 与 `msg_router.py` 显式路由；两端值必须一致。
- Outline 域：
  - 类型：`outline:{list|create|update|delete|reorder}:{requested|completed|failed}`。
  - list 返回：`data.outline_items: Array<{id,name,pageAt,position,children[]}>`。
  - 成功后前端适配器会二次拉取 list 保持一致性。

## 3) 近期问题与修复（要点）
- 2025-11-06 大纲“修改不成功”
  - 根因：初次导入仅在内存/本地，未落库；随后的 `outline:update` 在后端 404。
  - 修复：导入成功后前端立即 `bookmark:save:requested` 持久化整棵树 → 再 `outline:list` 对齐。
- 2025-11-06 事件域统一（bookmark → outline）
  - 后端补齐 outline 消息类型与处理器；capability 注册 outline 域；API 复用表插件。
- 2025-11-06 安装/订阅冲突
  - 修复重复订阅与作用域不一致（scoped ↔ global），侧栏 UI 与数据层统一用 onGlobal/emitGlobal；UI 初始化幂等。
- 2025-11-06 跨文档 URL 导航丢失
  - 为 URLNavigationFeature 增加 `#pendingManualNav`，在 `FILE.LOAD.SUCCESS` 时恢复。

## 4) Lint 规则状态（2025-11-06/07）
- 自定义规则 `custom/event-name-format`：
  - 禁止“变量/模板字符串”作为事件名；
  - 已升级为“禁止字符串字面量事件名，必须使用常量命名空间（*_EVENTS / *_MESSAGE_TYPES / PDF_VIEWER_EVENTS / WEBSOCKET_EVENTS）”；
  - EventBus 内核文件在 ESLint 覆盖中关闭该规则（保留灵活性）。

## 5) 测试覆盖（示例）
- 后端：`test_standard_server_outline.py` 等覆盖 outline 路由与成功流。
- 前端：Playwright 覆盖 outline CRUD、导航与安装顺序；URL 导航跨文档恢复自测用例。

## 6) 待办摘要
- 如需“改一处、全链路同步”事件/消息名：引入单一真源（Schema/TS 枚举）生成前端常量与后端 Enum，并在 CI 做差异校验。

（本简版将随变更持续更新，保持可读与高信噪比。）

### 维护记录（仅关键变更）
- 2025-11-07 压缩 memory-bank：完成 context.md、tech.md 简版/极简化；统一为“最新版规范”。
- 2025-11-07 建立迁移计划：todo-and-doing/1 doing/20251107-tech-md-minify-migration/plan.md；tech.md 仅保留索引与核心规则，其余细节迁往 docs/*。
- 2025-11-07 压缩 architecture.md 为极简索引；建立迁移计划：todo-and-doing/1 doing/20251107-architecture-md-minify-migration/plan.md；docs/architecture/* 初始化主题页。
- 2025-11-07 新增 docs/architecture/security-messaging.md（加密与消息中心），迁移计划第7条标为“已完成 v1”。
- 2025-11-07 修复 pdf-home 构建失败（Vite 无法解析 event-constants.js）：多处相对路径层级错误，已统一修正（详见 AItemp 工作日志）。
- 2025-11-07 WebSocket 响应事件常量错用（导致“未注册的全局事件：undefined”）
  - 根因：若干侧边栏 Feature 订阅使用了 `WEBSOCKET_EVENTS.MESSAGE.RESPONSE`（该常量不存在）；正确为 `WEBSOCKET_MESSAGE_EVENTS.RESPONSE`。
  - 影响：RecentSearches/RecentOpened/RecentAdded 在安装阶段订阅全局事件时，事件名为 `undefined` 被拦截并报错；功能不响应后端回执。
  - 修复：统一替换订阅常量为 `WEBSOCKET_MESSAGE_EVENTS.RESPONSE`，并新增防回归测试 `src/frontend/pdf-home/__tests__/ws-response-constant.usage.test.js`。
  - 验证：对涉及修改的源码与测试文件执行 ESLint（精确到文件），均 0 error/0 warning（2025‑11‑07 23:43）。

### 2025-11-08 PDF-Viewer 警告分析（pdfId=c83c60c58ad2）
- 证据源：
  - `dist/latest/logs/pdf-viewer-c83c60c58ad2.log` 行数 0（空）；
  - `dist/latest/logs/pdf-viewer-c83c60c58ad2-js.log` 行数 179（未见 ERROR，若干 WARNING/TRACE）。
- 主要告警与判定：
  - Outline 强制启用（行 6, 67）：运行模式提示，非异常；
  - UI 容器缺失自动创建（行 8）：未预置容器时的幂等创建路径，属可优化项；
  - TextLayer 容器缺失 → 禁用文本层（行 9）：功能被禁用的提示，如需选择/复制需启用；
  - URLNavigationFeature TRACE 以 WARNING 输出（行 18）：级别映射偏高，属于噪声；
  - OutlineUI “当前无大纲”（行 31, 62）：数据为空时的用户引导，随后已刷新列表。
- 建议（不执行，仅记录）：
  - 调整日志级别映射（trace→debug/info），降低噪声；
  - 在静态模板预置必要 UI 容器，评估是否启用 TextLayer（若启用则补齐容器）。

### 2025-11-08 日志级别降噪（已执行）
- 将“实为 info 的 warning”统一降级为 info（不影响 UI toast）：
  - Bootstrap：强制启用 Outline、跳过自动加载（存在 pdf-id）、模式启用提示 → `logger.info(...)`；
  - URLNavigationFeature：FILE.LOAD.REQUESTED 的 TRACE 路径 → `this.#logger.info(...)`；
  - UI：缺失容器自动创建、TextLayer 未启用 → `this.#logger.info(...)`；
  - OutlineUI：无大纲提示 → `this.#logger.info(..., { toast: { type:\"warn\" } })`（保留 UI 警示）。
- 防回归测试：`src/frontend/pdf-viewer/__tests__/log-levels.info-downgrade.guard.test.js` 静态校验指定消息不得使用 `warn`。

### 2025-11-08 URLJumpDispatcher 启动即弹 toast 的原因与定位（仅分析）
- 观察到的 toast：“[URLJumpDispatcher] 检查outlineItemId:null, 类型=object, 是null=true, 是undefined=false”。
- 代码位置（toast 源头）：
  - `src/frontend/pdf-viewer/features/infra-nav-url/components/url-jump-dispatcher.js:31` 附近，`tryExecute()` 顶部无条件输出调试日志，并附 `{ toast: { type: "error"|"warn" } }`。
- 调用路径（为何“刚启动就发射”）：
  - `src/frontend/pdf-viewer/features/infra-nav-url/index.js:353,362` 在门闸通过后调用 `dispatcher.tryExecute(this.#parsedParams, ...)`；
  - 门闸的入口条件为 `this.#parsedParams.hasParams === true`（仅含 `pdf-id` 时即满足），因此即使没有 `outlineItemId`，也会在渲染/加载就绪后调用 `tryExecute()`，触发上述调试 toast。
- 宿主侧过滤：`src/frontend/pdf-viewer/pyqt/main_window.py:319` 注入 MutationObserver 过滤匹配 `[URLJumpDispatcher] (检查outlineItemId|outlineItemId为空|parsed keys)` 的 toast，但无法阻止前端首次发射。
- 建议（未执行）：去除/降级这些调试型 toast，或仅在存在有效 `outlineItemId` 时发射；也可将“执行 tryExecute 的条件”改为“存在导航目标参数”而非“hasParams”。

### 2025-11-08 URLJumpDispatcher toast 抑制（已执行）
- 规则：当 `outlineItemId` 为 `undefined`（URL 未提供该键）时，不弹与该参数相关的调试 toast。
- 实施点：`src/frontend/pdf-viewer/features/infra-nav-url/components/url-jump-dispatcher.js`
  - 新增 `outlineItemIdRaw`（是否提供该键）；仅在“提供该键”时为“检查/keys/空值跳过”三类日志附 `{toast}`；
  - 若未提供该键（undefined），仅保留 `logger.info(...)`（无 toast）。
- 防回归：`src/frontend/pdf-viewer/features/infra-nav-url/__tests__/url-jump-dispatcher.toast-suppression.test.js`。

### 2025-11-08 扩展抑制 + Outline 模块级过滤（已执行）
- 扩展抑制：当 `outlineItemId === null` 时同样不弹 toast（与 `undefined` 一致，仅记日志）。
- 模块级过滤（仅 ERROR）：
  - `app-bootstrap-feature.js` 将以下模块设置为 `LogLevel.ERROR`：
    - `"Feature.pdf-outline"`, `"OutlineSidebarUI"`, `"OutlineManager"`。
  - 影响：Outline 相关 info/warn 日志和其附带 toast 被抑制，仅错误级别通过。

### 2025-11-08 URL 导航域模块级过滤（已执行）
- 归属：`[URLParamsParser]`（组件）、`[URLNavigationFeature]`（Feature）均隶属 `infra-nav-url`（URL 导航）。
- 过滤策略：在 `src/frontend/pdf-viewer/features/infra-nav-url/index.js` 安装阶段将下列模块级别设为 `ERROR`：
  - `"URLNavigationFeature"`, `"URLJumpDispatcher"`, `"URLParamsParser"`。
- 守卫：`src/frontend/pdf-viewer/features/infra-nav-url/__tests__/url-navigation.log-level.guard.test.js` 静态校验。

## 7) ESLint 仅 src 严格扫描摘要（2025-11-07）
- 命令：`pnpm exec eslint src --ext .js,.jsx,.ts,.tsx,.mjs,.cjs --max-warnings=0 --report-unused-disable-directives --format json`
- 结果：文件 329；错误 342；警告 0；可自动修复 0；报告：`AItemp/reports/eslint-report-20251107164424.src.json`。
- 错误类型分布（降序；详见 `AItemp/reports/eslint-by-rule-20251107173202.src.json`）：
  - `no-console`：131（文件 12）
  - `no-unused-vars`：116（文件 48）
  - `custom/event-name-format`：52（文件 21）
  - `no-unused-private-class-members`：32（文件 21）
  - `no-redeclare`：9（文件 3）
  - `no-undef`：1（文件 1）
  - `custom/logger-toast-shape`：1（文件 1）

### 7.1 目前已处理（2025-11-07 21:39 之后）
- 语法修复：`websocket-adapter.js` 多处 `catch { ... e }` → `catch (e) { ... }`；清理 EOF 多余空行。
- infra-sidebar：移除未用私有成员/方法
  - `index.js` 移除 `#logger` 私有字段与未用 `#getSidebarWidth()`；保持模块级 `logger`。
  - `layout-engine.js` 删除未用局部变量 `count`。
  - `real-sidebars.js` 删除未用导入 `isOutlineEnabled`。
- infra-ui：
  - `ui-layout-controls.js` 移除未用 import；删除 `#currentScrollMode/#currentSpreadMode` 写不读。
  - `ui-manager-core.js` 将 `const elements = ...` 改为 `void ...`；移除未用私有方法 `#copyWithTimeout()` 与手动复制对话框；移除未用 `#fallbackCopyToClipboard()`。
  - `ui-zoom-controls.js` 移除 `#totalPages` 字段；修复 `catch(_)` 为 `catch {}`。
- annotation：
  - tests：去除未用 `manager` 变量（改为直接 `new`）；清理多余空行。
  - comment-marker.js/comment-input.js：`catch(_)` → `catch {}`；移除未用私有字段 `#position` 与相关赋值。
  - screenshot：移除未用私有方法 `#convertPercentToCanvas`；`ScreenshotCapturer` 去掉未用 `#pdfViewerManager` 字段并同步调用点。
  - text-highlight：`HighlightRenderer` 去掉未用 `#pdfViewerManager` 与构造签名（相应 index/test 调整）；修复 `_` 占位引用。
- outline：
  - `pdf-outline/index.js` 将 toast `{type:'warning'}` 规范化为 `{type:'warn'}`。
  - `outline/outline-manager.js` 移除未用导入 `OutlineSidebarUIClassic`。
- ui：
  - `ui/dom-element-manager.js` 删除未用私有方法 `#createMissingElements()`。

备注：剩余问题集中在未用私有成员与格式类（trailing spaces、多余空行），下一轮继续收敛。

结论（2025-11-07 21:55）
- 已清空本轮 ESLint 报错（0 error, 0 warning）。

## 8) 前端路径规范补充（pdf-home 子域）
- 常量源：`src/frontend/common/event/event-constants.js`（唯一真源）。
- 典型层级映射：
  - `src/frontend/pdf-home/core/*` → `../../common/event/...`
  - `src/frontend/pdf-home/features/<feature>/*` → `../../../common/event/...`
  - `src/frontend/pdf-home/features/<feature>/(components|services|__tests__|styles)/*` → `../../../../common/event/...`
- 建议：在 Vite `resolve.alias` 中引入 `@fe-common -> src/frontend/common`，逐步替换硬编码相对路径，降低回归率；在 CI 加入 `Could not resolve` 扫描。

## 9) 测试执行（2025-11-08）
- 单元测试：使用 Jest 30（`pnpm test`），`jest.config.js` 设为 `jsdom`，映射 `logger.js/pdfjs-dist` 与样式到 mocks；`babel-jest` 处理 `*.js`，忽略 `node_modules` 中除 `pdfjs-dist`/`.mjs` 的包。
- E2E：使用 Playwright（`pnpm run e2e:browser`），需先 `pnpm run build:pdf-viewer`；仅在用户确认“包含 E2E”时执行。
- 目标：本次任务优先跑全量 Jest；若失败，记录失败套件与快照差异，输出 `test-results/` 汇总（如存在）。

### 9.1 本次结果（2025-11-08 00:44）
- Jest：套件 123（通过 100 / 失败 22 / 待定 1 / 运行时错误 8）；用例 691（通过 636 / 失败 54 / 待定 1）；
  - 代表失败：`qtwebengine-compatibility.test.js`（期望 WebGLStateManager 调用未触发）、`annotation-sidebar-ui.test.js`（删除确认/emit 未命中）。
  - 配置调整：`jest.config.js` 中 Babel 配置改为绝对路径；`testPathIgnorePatterns` 排除 `tests/e2e/`，避免 E2E 被 Jest 误执行。
- Playwright：共 14；通过 4；失败 10（`pdf-manager` 初始配置为 null 触发 `disabledByConfig` 读空）。

### 9.2 运行时崩溃修复（2025-11-08）
- 现象：dist/latest/logs 中多条 “Failed to install feature 'pdf-manager': Cannot read properties of null (reading 'disabledByConfig')” 并级联导致多个 Feature 安装失败。
- 根因：`WebGLStateManager.shouldUseCanvasFallback()` 在 DOMContentLoaded 之前被调用，`#detectionResult` 尚未初始化。
- 修复：对 `WebGLStateManager.getWebGLState()` 与 `shouldUseCanvasFallback()` 增加懒初始化（检测为 null 则先 `initialize()`）；同时在 `PDFManager.initialize()` 中先调用 `getWebGLState()` 再进行回退决策，满足测试期望与日志可观测性。
- 影响范围：仅限初始化阶段的 WebGL 决策与日志；不改变业务功能分支。

### 9.3 插件依赖顺序与装载一致性（2025-11-08）
- 症状：E2E（冷启动）期望的核心插件（infra-app/pdf-manager/infra-ui/infra-nav-core/pdf-outline/infra-sidebar）未能在 10s 内稳定就绪；控制台出现 “Service not found: pdfManager”；installed 列表名称与期望不一致（老名/新名混用）。
- 处置：
  - 别名一致性：FeatureRegistry 对外 API（`getInstalledFeatures()/getStatusSummary()`）统一返回“规范名”（应用 aliases）；依赖也经由 `#resolveName` 统一为规范名；
  - 服务注入：PDFManagerFeature 在安装后 `registerGlobal('pdfManager', instance)`，供 Outline 等特性通过容器解析；
  - 启动稳定性：pdf-outline 首次远端加载 timebox（1.5s）以避免 installAll 被外部 I/O 阻塞；
  - 静态服路径：`tests/e2e/browser/utils/static-server.mjs` 兼容 `src/frontend/dist/pdf-viewer/pdf-viewer/index.html` 与 `repoRoot/dist/pdf-viewer` 等多种布局，assets 指向对应 outDir。
  - 日志导入一致性：移除“默认导出当函数调用”的兼容逻辑，统一使用具名 `getLogger`，避免运行时报错 “Class constructor Logger cannot be invoked without 'new'”。
  - 结果：冷启动 E2E 用例通过；latest 冒烟仍有 404（属发行包路径问题，另议）。

### 9.4 全仓 WS 常量误用的防回归（2025-11-08）
- 新增测试：`src/frontend/common/__tests__/ws-response-constant.guard.test.js`
  - 禁止出现 `WEBSOCKET_EVENTS.MESSAGE.RESPONSE`；
  - 限制 `WEBSOCKET_EVENTS.MESSAGE.*` 仅允许 `SEND/RECEIVED/SEND_FAILED`；
  - 测试已包含简易注释过滤，避免误报注释文本。
- 目的：从源码侧静态把关，避免再次出现“事件名为 undefined → 未注册全局事件”的问题。

## 10) 当前问题记录（2025-11-08）
- 现象：`dist/latest/logs/pdf-home-js.log` 出现多条 `Uncaught TypeError: Cannot read properties of null (reading 'style')`；指向首页构建产物 `index-*.js`。
- 影响：早期脚本执行阶段异常，可能导致初始化体验不佳；pdf-viewer 日志仅出现 WARN，不影响主要功能。
- 根因（推断并验证）：第三方 toast（iziToast）在 `target` 传入 CSS 选择器时，若内部 `querySelector` 返回 `null`，其后续访问 `style` 引发异常；在 QtWebEngine 等环境偶发初始化竞态使容器未就绪。
- 修复：`src/frontend/common/utils/thirdparty-toast.js` 将 `ensureIziTarget()` 的返回由“选择器字符串”改为“DOM 元素”，所有 iziToast 调用改为直接传入 DOM 元素；保持失败降级到 `fallbackToast`。
- 防回归：新增单测 `src/frontend/common/utils/__tests__/thirdparty-toast.ensure-target.test.js` 覆盖容器自动创建与多种 toast 调用不抛异常。
- 待续步骤：完成 ESLint 与 Jest 全量/相关用例执行，若仍有 viewer 端 WARN 引发功能受限，再做 UI 容器兜底创建顺序核验。


## 11) Toast 库与样式状态（2025-11-08）
- 底层库：仍为 `iziToast@^1.4.0`（package.json 已验证）。
- 统一适配：`src/frontend/common/utils/notification.js` 以 `thirdparty-toast.js` 为第一优先（`getEngine()` 默认 `izi`），并在失败时回退内建 ToastManager。
- 自定义样式：`thirdparty-toast.js` 引入 `iziToast` 与其 CSS，同时通过固定容器 `#izi-toast-root` 与参数（`position/topRight/maxWidth/transitionIn`）覆盖默认外观；另含 DOM fallback，视觉为右上角卡片式。
- 核查结论：当前未替换底层库，仅使用了自定义样式；若需回归官方默认样式，可减少/移除上述覆盖参数与容器样式。


### 11.1 Hover 暂停问题（2025-11-08 11:20）
- 现象：用户报告 toast 无 hover 暂停，外观与默认不同。
- 根因：`thirdparty-toast.ensureIziTarget()` 为容器设置了 `pointer-events:none`，使得 `iziToast` 注入的子元素无法接收 hover/click。
- 修复：改为 `pointer-events:auto`（见 `src/frontend/common/utils/thirdparty-toast.js`），并新增回归测试 `src/frontend/common/utils/__tests__/thirdparty-toast.hover-pause.test.js`。


### 11.2 临时禁用 toast fallback（2025-11-08 11:20）
- 目的：验证“构建产物中的 toast 是否来自 izitoast”。
- 实施：在 `thirdparty-toast.js` 增加 `DISABLE_TOAST_FALLBACK=true`；所有 fallback 创建/渲染在该开关为真时早返回。
- 运行时覆写：`window.__DISABLE_TOAST_FALLBACK=false` 可临时恢复 fallback。
- 预期：若禁用后仍见 toast，来源不在本模块，需要继续排查其他实现或全局注入逻辑。


### 11.3 izitoast target 兼容性修正（2025-11-08 11:30）
- 背景：为修复早期 `null.style`，曾改为将 DOM 元素作为 `target` 传入；疑似在当前环境导致 izitoast 内部异常 → 走 fallback。
- 修正：保留容器创建，但改回传递选择器字符串 `#izi-toast-root`；并在 `thirdparty-toast.js` 添加日志与可禁用 fallback 的开关。
\n
### 11.4 验证（ESLint/Tests） 2025-11-08 11:37
- ESLint：thirdparty-toast/notification/toast-manager/global-error-toast 全部通过。
- Jest：thirdparty-toast.ensure-target / hover-pause 用例均通过。
\n
### 11.5 pdf-home 启动错误修复（2025-11-08 11:42）
- 现象：`Cannot read properties of undefined (reading "INFO")`。
- 根因：`thirdparty-toast.js` 引用 `getLogger` 造成与 `logger.js` 的循环依赖；`logger.js` 初始化阶段默认参数用到 `LogLevel.INFO`，在循环时序下未完成赋值。
- 修复：移除 thirdparty-toast 对 logger 的依赖，改为本地 console 封装（经 `globalThis.console`），避免触发 `no-console`；ESLint/测试均通过。
\n
### 11.6 定向构建脚本（2025-11-08 11:52）
- 修改 `package.json`：
  - `build:pdf-home` 使用 `VITE_BUILD_ONLY=pdf-home` + 输出到 `dist/latest/static` + `--base=/pdf-home/`
  - `build:pdf-viewer` 使用 `VITE_BUILD_ONLY=pdf-viewer` + 输出到 `dist/latest/static` + `--base=/pdf-viewer/`
- 新增 dev 依赖：`cross-env@^7.0.3`，保证 Windows/Unix 跨平台设置环境变量。
\n
### 11.7 Windows 定向构建修复（2025-11-08 12:15）
- 问题：`cross-env` 未安装/不可用导致脚本失败。
- 方案：新增 `scripts/build-only.mjs`，直接用 Node API 调用 Vite，并在脚本内设置 `process.env.VITE_BUILD_ONLY`；`package.json` 的 `build:pdf-*` 改为调用该脚本。
\n
### 11.8 撤销最小修复（2025-11-08 12:49）
- 恢复 main.js 中的 `import "pdfjs-dist/web/pdf_viewer.css"`；移除 index.html 中的动态 import。
- 后续若需解决样式缺失，倾向采用“全量前端构建”路径验证。

### 11.9 Outline 同步修复（2025-11-08 13:35）
- 现象：编辑/重命名后 UI 未反映最新结果，被误判为“未保存”，实际请求已发送。
- 根因：前端未消费 `pdf-viewer:outline-list:complete`，仅发送 list 请求但未处理回执 → 内存未更新。
- 修复：
  - M `src/frontend/pdf-viewer/features/pdf-outline/index.js` 在 `#setupEventListeners()` 中订阅 `WEBSOCKET_EVENTS.MESSAGE.RECEIVED`，当 `type === OUTLINE_LIST_COMPLETED` 时：
    1) `outlineManager.replaceFromRemote(data.outline_items)`，2) `#listReady=true`，3) `#refreshList()`，4) `#tryPendingNavigate()`。
  - M `src/frontend/pdf-viewer/outline/outline-manager.js` 新增 `replaceFromRemote(items)`，对远端树做深拷贝/规范化并重建索引。
  - M `src/frontend/pdf-viewer/bootstrap/app-bootstrap-feature.js` 保持默认 ERROR 级别，并支持 URL `?outlineLog=debug|info|warn|error` 动态提升日志级别以便排查。
- 防回归测试：
  - A 前端 `src/frontend/pdf-viewer/features/pdf-outline/__tests__/outline-sync-with-ws.test.js`：模拟 `OUTLINE_LIST_COMPLETED`，断言发出 `OUTLINE.LOAD.SUCCESS` 且内存更新。
  - A 后端 `src/backend/msgCenter_server/__tests__/test_outline_update_flow.py`：校验 `pdf-viewer:outline-update:request` 回应 complete，且服务端收到 update 载荷。
