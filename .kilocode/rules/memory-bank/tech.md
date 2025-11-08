# 技术规范（最新版·极简索引）

目的：将“规则本体”沉淀到 docs 下的专题文档；此文件仅保留最小可执行要点与索引。

- 核心规则（立即执行）
  - UTF-8 + \n：所有读写显式 UTF-8，统一换行 \n。
  - Fail‑Fast：参数/事件/消息不合法一律失败，禁止兜底/静默回退。
  - 事件三段式：`{module}:{action}:{status}`；事件名必须通过命名空间常量引用（`*_EVENTS`、`*_MESSAGE_TYPES`、`PDF_VIEWER_EVENTS`、`WEBSOCKET_EVENTS`）。
  - 白名单：全局事件新增前，先在常量中登记；`global-event-registry.js` 放行。
  - 作用域：跨模块用 `onGlobal/emitGlobal`；避免 scoped↔global 不一致；组件初始化需幂等。
  - WebSocket 常量使用规范：请求/发送事件用 `WEBSOCKET_EVENTS.MESSAGE.SEND|RECEIVED|SEND_FAILED`；响应事件用 `WEBSOCKET_MESSAGE_EVENTS.RESPONSE`（切勿写成 `WEBSOCKET_EVENTS.MESSAGE.RESPONSE`）。

- 主题索引（详细说明见 docs）
  1) 事件与常量命名规范 → docs/standards/events.md
  2) WebSocket 契约（Outline 域示例） → docs/contracts/ws-outline.md
  3) 构建与运行（源码/分发与静态路由） → docs/engineering/build-run.md
  4) 质量门禁（Lint/测试/E2E/契约差异检查） → docs/quality/quality-gates.md
  5) 自检清单（上线前/提交前） → docs/checklists/self-check.md

- 现行检查清单（最小集合）
  - 事件名：只用命名空间常量；禁止字面量/变量/模板字符串。
  - 全局事件：新增前登记白名单。
  - Outline 首次导入：bookmark:save:requested → outline:list:requested。
  - UI/数据层事件作用域一致；重复初始化有幂等守卫。
 - 禁用 alert/confirm；错误统一 logger.error(...,{toast:true})。

维护记录
- 2025-11-07 精简为索引版；详细内容迁移到 docs（见 todo-and-doing/1 doing/20251107-tech-md-minify-migration/plan.md）。
 - 2025-11-07 接口调整：HighlightRenderer 构造签名由 `(pdfViewerManager, logger)` → `(logger)`；ScreenshotCapturer 构造签名由 `(pdfViewerManager)` → `()`；调用点与测试已同步。

## ESLint 使用规则（团队标准）

- 扫描范围与命令
  - 范围：src（包含产品代码与测试）；不针对第三方依赖执行。
  - 基准命令（严格门禁，0 容忍）：  
    `pnpm exec eslint src --ext .js,.jsx,.ts,.tsx,.mjs,.cjs --max-warnings=0 --report-unused-disable-directives`
  - 自动修复（仅限格式类规则；业务契约类需人工）：  
    `pnpm exec eslint src --ext .js,.jsx,.ts,.tsx,.mjs,.cjs --fix`
  - 生成报告（可选）：  
    `pnpm exec eslint src --ext .js,.jsx,.ts,.tsx,.mjs,.cjs --format json > AItemp/reports/eslint-report-YYYYMMDDHHmmss.src.json`

- 关键门禁（全部按 error 报告）
  - 自定义规则
    - custom/event-name-format：事件名必须来自命名空间常量（*_EVENTS、*_MESSAGE_TYPES、PDF_VIEWER_EVENTS、WEBSOCKET_EVENTS）；禁止字符串字面量、变量、模板字符串作为事件名。
    - custom/no-event-literal：同上，禁止直接使用字符串事件。
    - custom/logger-toast-shape：`{ toast }` 形状受限；`toast.type` 仅允许 'error' | 'warn' | 'info' | 'success' | 'debug'。
  - 内置规则
    - no-console：严禁使用；统一使用内部 logger。仅 logger.js 允许 console（见 overrides）。
    - no-unused-vars / no-unused-private-class-members：禁止未使用的变量/私有成员。不要用 `_` 作为占位逃避检查；应删除或实际使用。
    - no-undef：禁止未定义标识符（典型如 `catch { ... e }` 误用）。
    - no-redeclare：禁止重复声明。
    - 风格相关：no-trailing-spaces、no-multiple-empty-lines、eol-last 等。

- Overrides 与豁免点（仅限以下文件/场景）
  - logger 实现文件（如 common/utils/logger.js）：允许 console（rule: off）；其他文件一律禁止。
  - 事件总线内核与工具（event-bus 实现层）：允许关闭 custom/event-name-format 与 no-event-literal（用于框架内生成/透传）；业务与测试代码仍必须遵守事件常量门禁。
  - 测试代码：遵循与产品代码一致的事件门禁与 no-console；可根据需要开启 Jest 环境声明，但不得放宽自定义事件规则。

- 提交流程与 CI 门禁
  - 提交前本地必跑：同“基准命令”；`--max-warnings=0` 强制中断有风险的提交。
  - CI 保底：同一条命令；报告按时间戳落地到 `AItemp/reports/`，用于排障归档。

- 常见修复指引
  - 事件名：将 `on("x-y-z", handler)` 等字符串/变量，替换为命名空间常量 `on(PDF_VIEWER_EVENTS.X.Y.Z, handler)`；模板字符串/变量拼接一律禁止。
  - 捕获错误：不使用 `catch () {}` 或 `catch(_) {}` 这类占位写法；若不使用错误对象，写 `catch { ... }`；若要使用则 `catch (e) { ... }` 并实际引用 e。
  - 未用变量/参数：删除变量或使用之；请勿通过 `_` 命名或注释规避。
  - 日志：使用模块级 `getLogger("ModuleName")`；禁止在功能代码中使用 `console.*`。

- 约定与产物
  - Lint 运行与报告输出，务必写入 AItemp/reports（禁止污染根目录）。
  - 与本文档描述不一致的需求变更，须先更新 `eslint.config.js` 与本节说明，再执行大范围治理。
 - 2025-11-07 约束补充：新增 WS 响应常量使用规范与静态扫描测试，防止 `RESPONSE` 常量误用。

## 测试运行规范（Jest / Playwright）
- Jest
  - 入口：`pnpm test` 或 `pnpm exec jest`。
  - Babel：`jest.config.js` 使用 `babel-jest`，并显式传入绝对路径 `babel.jest.config.cjs`（避免在不同 CWD/根解析失败）。
  - 排除：`testPathIgnorePatterns` 排除 `tests/e2e/`，E2E 不由 Jest 执行。
  - 报告：`--json --outputFile test-results/jest-results-YYYYMMDDHHMMSS.json`；概览可落地到 `AItemp/reports/jest-summary-*.md`。
  - Mock（建议）：对 ESM 动态导入模块（如 `pdfjs-dist/build/pdf`）优先使用 `jest.unstable_mockModule`；或在实现中为 Jest 提供 CJS `require()` 分支，确保 `doMock` 生效。
- Playwright
  - 入口：`pnpm exec playwright test -c ./playwright.config.js`（或 `pnpm run e2e:browser`）。
  - 配置：默认 `tests/e2e/browser`；headless；可在需要时启用 trace/screenshot。
  - 报告：可用 `--reporter=json | Out-File test-results/playwright-results-*.json` 保存结果；静态服务器与 WS Mock 由测试工具自行启动（无需 Vite 预览）。

## 事件总线错误可观测性（订阅/发布）
- event-bus 增强：
  - 在 `on()` 与 `emit()` 的“未注册/无效事件”错误路径附带订阅者/执行者ID与调用栈（前5帧），便于快速定位来源；
  - 在 `on()` 中订阅者ID推断提前于白名单校验，保证日志携带订阅者ID。


## Toast 引擎调试开关（2025-11-08）
- `window.__DISABLE_TOAST_FALLBACK`：布尔；默认 true（禁用 fallback，仅用 izitoast）；设为 false 可恢复降级路径。
- 影响范围：`src/frontend/common/utils/thirdparty-toast.js`。

## Outline 调试日志开关（2025-11-08）
- URL 参数：`?outlineLog=debug|info|warn|error`
- 默认：ERROR（在 `app-bootstrap-feature.js` 中先设置为 ERROR，再按参数提升）
- 影响模块：`Feature.pdf-outline`、`OutlineSidebarUI`、`OutlineManager`
