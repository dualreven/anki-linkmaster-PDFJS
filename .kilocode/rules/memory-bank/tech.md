# 技术规范（最新版·极简索引）

### 2025-11-10 gui_launcher 线程实现迁移
- 新增模块：`src/gui_launcher/workers.py`
  - 导出：`LauncherThread`、`_AiThread`
  - 依赖：`src.launcher.config`（`LauncherConfig/Options/Ports/Paths`）、`src.gui_launcher.services`
- 入口适配：`gui_launcher.py` 通过
  ```python
  from src.gui_launcher.workers import LauncherThread as _WorkersLauncherThread, _AiThread as _WorkersAiThread
  LauncherThread = _WorkersLauncherThread
  _AiThread = _WorkersAiThread
  ```
  保持对外类名不变。
- 注意：所有文件 I/O 保持 `encoding='utf-8'`；换行统一 `\\n`。

### 2025-11-10 Vite 端口写入覆盖问题修复
- 背景：`src/launcher/dev_server.ensure_vite` 使用 `write_runtime_ports` 覆盖写入 `{vite_port,npm_port}`，会抹掉后端已写入的 `{msgCenter_port,pdfFile_port}`，导致 GUI 二次读取端口时丢失 ws/http。
- 修复：改为 `merge_runtime_ports` 合并写入；新增用例 `src/launcher/__tests__/test_dev_server_merge_ports.py` 防回归。

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
  - Outline 首次导入（后端优先、一次渲染）：  
    1) 首先 `pdf-viewer:outline-list:request`；  
    2) 若返回空 → 从 PDF 提取原生大纲并 `pdf-viewer:outline-bulk-save:request`；  
    3) 保存完成后再次 `outline-list:request` 并仅在最终回执时发出一次 `OUTLINE.LOAD.SUCCESS`；  
    4) 去掉本地缓存（localStorage）写入/读取逻辑。
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

## 阅读历史（Resume Reading）使用说明（2025-11-10 更新：服务端持久化）
- 启动参数
  - `resumeReading.enabled: boolean`（默认 `true`）
  - `resumeReading.applyMode: "ifNoExplicitJump" | "always" | "disabled"`（默认 `ifNoExplicitJump`）
  - `resumeReading.throttleMs: number`（默认 `2500`）
  - `resumeReading.transport: "ws"`（默认 `ws`）
- 服务端字段
  - `pdf_info.json_data.resume: { page: number, y_percent?: number, zoom?: number, rotation?: number, updated_at: ms }`
- 读写消息（WS）
  - 读取：`{ type: "pdf-library:info:requested", data: { pdf_id } }`
  - 写入：`{ type: "pdf-library:record-update:requested", data: { file_id: pdf_uuid, updates: { visited_at, json_data: { resume: { ... } } } } }`
- 优先级（显式跳转 > resume > 首页）
  - URL/WS/Anchor 显式导航优先；满足条件时才应用 resume。
- 错误处理（Fail‑Fast）
  - resume 非法（越界/比例无效）→ toast + 回首页；不启用默认本地兜底（如需兜底须显式配置）。

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

## Python后端事件常量使用规范（2025-11-10）
- 背景：后端数据库插件使用四段式事件名 `table:{table-name}:{action}:{status}`
- 强制要求：禁止使用字符串字面量，必须使用常量
- 常量位置：`src/backend/database/plugin/table_event_constants.py`
- 使用示例：
  ```python
  from src.backend.database.plugin import TableEventConstants

  # ❌ 错误：使用字符串字面量
  event_bus.on('table:pdf-info:delete:completed', handler)

  # ✅ 正确：使用常量
  event_bus.on(TableEventConstants.PDFInfo.DELETE_COMPLETED, handler)
  ```
- 常量结构：
  ```python
  class TableEventConstants:
      class PDFInfo:
          CREATE_COMPLETED: Final[str] = 'table:pdf-info:create:completed'
          CREATE_FAILED: Final[str] = 'table:pdf-info:create:failed'
          UPDATE_COMPLETED: Final[str] = 'table:pdf-info:update:completed'
          # ...
      class PDFAnnotation:
          CREATE_COMPLETED: Final[str] = 'table:pdf-annotation:create:completed'
          # ...
  ```
- Pylint检查：
  - 错误代码：E9001 (table-event-string-literal)
  - 检查范围：`event_bus.on/emit/once()` 的第一个参数
  - 智能提示：自动推荐对应的常量名
  - 白名单：`event_bus.py`、`table_event_constants.py` 不检查
- 运行检查：
  ```bash
  cd src/backend
  export PYTHONPATH=.
  python -m pylint \
    --load-plugins=linters.table_event_lint_checker \
    --enable=E9001 \
    --disable=all \
    database/plugins/*.py
  ```
- CI集成建议：
  - 在 `pyproject.toml` 或 `.pylintrc` 中启用 E9001 规则
  - 在 pre-commit hooks 中运行检查
  - 在 CI/CD 流程中作为质量门禁
- 向后兼容：
  - 保留 `TableEvents` 辅助类（动态生成事件名）
  - 仅在跨插件事件监听时强制使用常量
  - 插件内部的 `_emit_event()` 可继续使用辅助函数
