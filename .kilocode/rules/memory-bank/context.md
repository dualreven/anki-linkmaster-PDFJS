# Memory Bank - Context（精简版）

最后更新：2026-01-07（memory-bank lint：超限自动归档）

## 2026-01-07 并行合入：A/B/C/D 批量集成完成
- **状态**：已完成（main 通过 lint + 本轮最小 Jest 集合）。
- **worktree/分支**：
  - `anki-linkmaster-PDFJS`：`main`
  - `anki-linkmaster-A`：`worker/refactor-A`
  - `anki-linkmaster-B`：`worker/refactor-B`
  - `anki-linkmaster-C`：`worker/refactor-C`
  - `anki-linkmaster-D`：`worker/refactor-D`
- **合入方式**：integration 分支批量 `cherry-pick`（一次性验收后快进 main），随后 A/B/C/D 全部 `reset --hard main` 同步基线。
- **本轮合入要点**：
  - `infra-sidebar`：uninstall/destroy 解绑监听/计时器/订阅（含回归测试）。
  - WS Adapter：anchor create 缺少 `pdf_uuid` 时 fail-fast（含回归测试）。
  - WS inbound：新增 `ws-inbound-bridge-contract`（WeakMap(message)+Set(eventName)）去重领域事件发射（含回归测试）。
  - 测试提速：Annotation 导航冒烟用例改为“聚焦型”单测，降低 flake。
  - 合入工具：新增 `scripts/merge-fastlane.ps1` + 队列模板，减少人工合入/验收成本。

## 2026-01-06 协作方式升级（并行合入提速）
- **完成定义（DoD）**：每个 worktree “完成”必须交付 commit hash + 最小验收命令结果；否则不进入合入队列。
- **主干集成**：main 侧用 integration 分支批量 cherry-pick 功能提交，只在 main 跑一次门禁（lint + 新增测试并集），通过即合入。
- **落地位置**：协作协议写入 `todo-and-doing/3 template/v001-spec-template.md`，并作为每个 doing 任务的强制章节复用。
- **落地工具**：`scripts/merge-fastlane.ps1`（从 commit 列表/队列文件创建 integration 分支、批量 cherry-pick、跑 lint+指定测试、输出报告）。

## 2026-01-06（已修复）Outline：OUTLINE.LOAD.SUCCESS 重复发射
- **现象**：同一条 `OUTLINE_LIST_COMPLETED` 入站消息会触发两次 `PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS`（WebSocketAdapter(ws-inbound-bridge) 与 OutlineFeature 同时发射）。
- **修复**：新增 `ws-inbound-bridge-contract`：以 `WeakMap(message)+Set(eventName)` 记录“同一 message+eventName 只允许一次发射”，并在 `ws-inbound-bridge` 与 `OutlineFeature` 发射点共同接入，实现顺序无关去重（不再修改 message 对象）；并补回归测试覆盖“OutlineFeature + inbound bridge 并存”场景。

## 2026-01-06（已修复）Annotation：autoload 订阅泄漏 + comment 标注 position 缺失
- **autoload**：`setupAnnotationAutoLoadOnFileLoad` 返回 `unsubs[]`，由 `AnnotationFeature` 纳入 `#unsubs`，确保 `uninstall()` 后不再响应 `FILE.LOAD.SUCCESS/RESUME.FLOW.DONE/...`（补回归测试）。
- **comment position**：后端要求 `json_data.data.position` 必填；CommentTool 创建时同时写入 `positionPercent`（渲染优先）与 `position`（存为百分比 0..100），并在渲染恢复时兼容“百分比/像素”两种语义（补回归测试）。

## 2026-01-06 并行重构基础设施收敛（main 完成）
- **门禁新增**：新增 ESLint 规则 `custom/no-eventbus-subscription-in-manager`，禁止在 `*.manager*.js` 中使用 `eventBus.on/onGlobal/once` 订阅（订阅必须上移到 Feature composition root/adapter 层）。
- **Annotation 结构收敛**：
  - `AnnotationManager V2` 不再订阅 EventBus，仅保留方法 + store + 必要的 emit（兼容旧 UI/工具链）。
  - `AnnotationFeature` 负责把 `ANNOTATION.CREATE/UPDATE/DELETE/DATA.LOAD` 事件桥接到 Manager 方法，并显式保存/清理 unsubs（避免泄漏）。
- **WS 基础验证补强**：为 `AppCoreFeature` 补回归测试，覆盖“wsInfra 安装后必须调用 adapters[].onInitialized（若存在）”。
- **基线锚点**：commit `65dc3b5`，tag `foundation-20260106014352`。

## 2026-01-06 并行工作区重建（单向覆写）
- **策略**：A/B/C/D 历史工作区视为过时，全部丢弃；以 `main` 为唯一真源重新派生并行槽位。
- **结果**：重建 worktree 与分支 `worker/refactor-{A|B|C|D}`，四个 worktree 均指向 `foundation-20260106014352` 基线。

## 2026-01-06 todo-and-doing 清理（仅归档，不删历史）
- **动机**：减少 `todo-and-doing/1 doing/` 干扰，避免误把历史任务当“当前进行”。
- **操作**：将旧的 9 个 doing 任务整体移动到 `todo-and-doing/4 archive/20260106-doing-cleanup/`；`1 doing` 仅保留本轮 4 个并行任务目录（A/B/C/D）。

## 2026-01-06 todo-and-doing 深度清理（仅归档，不删历史）
- **动机**：降低 AI/人类打开目录时的噪音；只保留“当前并行任务入口 + 模板 + README”。
- **操作**：将 `todo-and-doing/2 todo/`、`todo-and-doing/3 done/`、`todo-and-doing/4 done/` 以及 `todo-and-doing/1 doing/` 内旧 `.md` 与根目录散落文件统一迁移到 `todo-and-doing/4 archive/20260106-todo-and-doing-cleanup/`。

## 2026-01-06（已修复）Jest 在部分 worktree 直接无法启动
- **现象**：`worker/refactor-C` 运行 `pnpm exec jest ...` 报 `Could not locate module ... mapped as ...tests\\__mocks__\\logger.js`。
- **根因**：`jest.config.js` 的 `moduleNameMapper` 指向 `<rootDir>/tests/__mocks__/*`，但 `.gitignore` 忽略 `tests/`，导致不同 worktree 可能缺失该目录与文件。
- **修复**：将 mocks 移到可被 git 跟踪的 `src/frontend/__mocks__/`，并更新 `jest.config.js` 映射；新增 CI 级回归测试断言映射目标文件存在（避免再次把 mapper 指向未纳入版本控制的路径）。

## 2026-01-06（已修复）开发模式 Hosted 后端不再强依赖 dist/static_dir
- **现象**：GUI 未勾选“生产模式”仍报 `static_dir 不存在：.../dist/latest/static`，导致 dev 也必须先 build dist 才能启动后端。
- **修复策略**：以 `url_port == pdfFile_port` 判定 prod（前端走后端静态）；否则判定 dev（前端走 Vite）。dev 下：
  - 后端不再要求 `static_dir` 存在；
  - HTTP 文件服务允许“仅服务 pdfs”（不挂载 `/static` `/pdf-home` `/pdf-viewer` 默认路由）。
- **实现**：`BackendLauncher.start()` + `EmbedFileServer(require_static=...)` + `resolve_path(static_root=None)`，并补回归测试覆盖 dev/prod 分支。

## 2026-01-05 前端架构重构：Observable Pattern 落地 (完成)
- **基建**：`observable.js` + `observable.test.js` (100% pass).
- **Core 迁移**：`ZoomManager`, `LayoutManager`, `ViewerManager` (Completed).
- **Feature 迁移**：`SearchManager`, `OutlineManager`, `SidebarManager`, `AnnotationManager V2` (Completed).

## 2026-01-05 修复与加固
- **AnnotationFeature**:
  - 修复了 `getAnnotationsByPage` 等查询方法缺失问题。
  - 修复了模型 partial update 校验逻辑。
  - 修复了测试冲突。
  - **重要修复**: 在 `app-bootstrap-feature.js` 中补齐了 `wsClient` 的注册，解决了标注数据无法加载的运行时问题。
- **OutlineFeature**: 修复了引导层引用错误。

## 2026-01-05 开发原则更新（TDD）
- **强制执行**：所有新代码必须先写测试 (Red-Green-Refactor).
- **熔断机制**：提交前必须检查对应的 `.test.js` 是否存在且通过.

## 2026-01-05（已修复）pdf-viewer 日志大量报错：WS 未注册/创建冲突
- **现象**：`logs/pdf-viewer-*-js.log` 持续出现 `[Injected] info request failed: 当前 WebSocket 客户端尚未通过 client:register:requested 或 pdf-viewer:register:requested 完成注册`。
- **关键线索**：同一份日志中同时出现 `pdf-viewer.bootstrap` 的 `WSClient registered in container`，以及 `pdf-viewer.container` 的 `WSClient creation failed` / `WSClient not available`。
- **初步判断**：
  - `src/frontend/pdf-viewer/bootstrap/app-bootstrap-feature.js` 手动创建并 `connect()` 的 `WSClient` 与 `src/frontend/pdf-viewer/features/infra-app/index.js`（`createPDFViewerContainer`）重复创建，导致事件订阅/容器初始化冲突。
  - `infra-app` 当前先 `connect()` 再安装 `WebSocketAdapterViewer`，可能错过 `websocket:connection:established` 事件，从而注册消息未发送。
- **修复**：
  - `app-bootstrap-feature.js` 不再手动创建/注册 `WSClient`，WSClient 唯一入口收敛到 `infra-app/createPDFViewerContainer`。
  - `infra-app` 调整为先 `setupWsInfra` 再 `connect`，保证注册逻辑不会漏掉 `connection:established`。
  - 已补回归测试覆盖上述两点。

## 2026-01-05（已修复）标注侧边栏空白：历史数据单条不兼容拖垮整批
- **现象**：PDF Viewer 内标注侧边栏为空白，但后端可观察到 `annotation:list:requested` → `annotation:list:completed`。
- **关键证据**：
  - 本地库 `data/anki_linkmaster.db`：`pdf_annotation` 表在 `pdf_uuid=c83c60c58ad2` 下存在记录（样本统计：9条）。
  - 其中部分 screenshot 历史记录仅包含像素 `rect`，缺少 `rectPercent`；而前端 `Annotation` 模型为严格校验（screenshot 必须含 `rectPercent`），会在 `Annotation.fromJSON()` 抛错。
- **根因猜想**：`AnnotationManager V2` 的 `_remoteLoad()` 对返回列表做 `map(Annotation.fromJSON)`，未逐条 try/catch；一条坏数据抛错会导致 `loadAnnotations` 整体失败，UI 呈现空白。
- **修复（兼容旧数据，不要求迁移）**：
  - `Annotation` 模型：screenshot 允许 `rectPercent` 或 legacy `rect`（两者都缺才报错）。
  - `AnnotationManager V2`：远端列表逐条解析，坏条跳过并告警，避免“一条坏数据拖垮整批”导致侧边栏全空白。
  - `ScreenshotMarkerRenderer`：无 `rectPercent` 时尝试从 legacy `rect` 计算百分比，尽力恢复旧标注 overlay。
  - commit：`ecab3e9`（`fix(annotation): load legacy screenshot rect`）。
