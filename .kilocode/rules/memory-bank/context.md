# Memory Bank - Context（精简版）

## 🎯 AI开发架构改进指南（重要 - 长期参考）

### PDF-Viewer 架构分析与改进建议（20251010020347）

**背景**：
- AI开发特点：记忆有限、容易忽略隐式依赖
- 目标：避免AI修改一个功能时引起另一个功能的错误

**架构优势**：
- ✅ 插件化架构清晰（Feature模式）
- ✅ 事件驱动解耦（EventBus）
- ✅ 文档完善
- ✅ 命名规范严格（三段式事件名）

**核心问题**：
- ⚠️ 隐式依赖难追踪
- ⚠️ 事件契约不明确
- ⚠️ 全局/局部事件易混淆
- ⚠️ 缺少改动影响分析工具

**7个改进建议（按优先级）**：
1. **服务契约注册表** - 集中定义所有可注入服务及其接口，避免字符串拼写错误
2. **事件Payload Schema** - 为每个事件定义明确的数据结构，运行时验证
3. **Feature依赖图可视化** - 自动生成Mermaid依赖图，检测循环依赖
4. **事件流追踪工具** - 开发模式下记录完整事件链路，生成序列图
5. **Feature职责边界检查** - 定义允许/禁止行为清单，工具自动检测越界
6. **结构化日志** - 引入Trace ID，串联跨Feature调用链
7. **契约测试** - 为核心Feature编写"对外承诺"测试，CI强制通过

**实施路线图**：
- 第一阶段（1周）：服务契约注册表 + 事件Schema + 运行时验证
- 第二阶段（1周）：依赖图生成 + 事件流追踪工具
- 第三阶段（2周）：契约测试 + 职责文档
- 第四阶段（持续）：AI辅助开发工具

**衡量标准**：跨Feature bug减少50%、AI开发速度提升30%、代码审查时间减少40%

---

## 📅 当前活跃任务（最近）

### 当前任务（20251010204342）
名称：通信架构评估（WebSocket 是否应由 QWebChannel/本地事件总线完全替代）

背景：现状为“前端事件总线 + WebSocket 消息中心”为主链路，PyQt 环境下按需以 QWebChannel 承载本地能力（剪贴板/截图等）。希望评估是否可以完全取消 WebSocket，以 QWebChannel 承载全部请求，从而降低网络栈开销并保持模块独立。

结论：不建议彻底替换。建议抽象“传输层接口”，在 PyQt 环境优先使用 QWebChannel，在浏览器/Dev 环境回退 WebSocket；同时允许按消息类别进行通道路由。事件总线与消息契约保持不变，降低改造面与风险。

涉及模块/文件：
- 前端 WS：`src/frontend/common/ws/ws-client.js`
- QWebChannel：`src/frontend/pdf-home/qwebchannel/qwebchannel-bridge.js`、`src/frontend/pdf-home/index.html:56`
- 启动器：`src/frontend/pdf-home/launcher.py`
- 后端 WS：`src/backend/msgCenter_server/server.py`、`src/backend/msgCenter_server/README.md`

执行步骤（原子）：
1) 梳理调用点：标注哪些消息需要本地能力/低时延，可优先走 QWebChannel；其余保留 WS
2) 定义接口：`ITransport`（send/subscribe/request/close）与错误/超时规范
3) 实现适配器：`WebSocketTransport`（复用 WSClient）与 `QWebChannelTransport`（封装 qt.webChannelTransport）
4) 环境探测：`window.qt && window.qt.webChannelTransport` + 显式开关（例如 URL `?transport=`）
5) 路由策略：按消息类型前缀或白名单决定默认通道，失败自动回退并记录日志
6) 最小试点：挑 1-2 条链路（如配置读取/打开 PDF）做 A/B 测试与回归
7) 单测/集成/E2E：
   - 单元：接口契约、就绪探测、回退超时
   - 集成：PyQt 有/无 QWC 两种条件下自动切换
   - 端到端：复用 `tests/test_frontend_backend_integration.py` 验证一致性

状态：已完成评估与方案设计；待立项推进“传输层抽象 + QWC 适配器最小试点”。

### 当前任务（20251010200509）
名称：后端静态路由修复（/static 集中与回退）

背景：截图显示“仅有 HTML 框架、JS/CSS 未加载”。根因是构建脚本已将静态资源集中到 `dist/latest/static/`，但后端仍按旧入口或错误的 dist 根提供资源，导致 `/static/*` 404。具体表现：
- `DEFAULT_DIST_DIR` 指向仓库根时，请求 `/static/*` 实际落到 `<repo>/static/*`；
- `dist/latest/static/pdf-viewer/index.html` 缺失时，`/pdf-viewer/` 未做回退，仅返回某个 index.html，从而引用的 `/static/*` 继续 404。

相关模块/文件：
- `src/backend/pdfFile_server/config/settings.py`（动态探测 dist 根）
- `src/backend/pdfFile_server/handlers/pdf_handler.py`（静态路径解析与回退）

执行步骤（原子）：
1) 设计纯函数测试：`resolve_static_path(path, dist_root)`
2) 修复 `settings.DEFAULT_DIST_DIR`：优先 `dist/latest`，否则回退 `PROJECT_ROOT`
3) 在 `pdf_handler.py` 中新增 `resolve_static_path`，实现：
   - `/pdf-(home|viewer)/` → 优先 `/static/<module>/index.html`；viewer 缺失时回退 `src/frontend/pdf-viewer/pdf-viewer/index.html`；
   - `/pdf-(home|viewer)/assets/*` → `/static/*`；
   - `/js/*` → `/static/*`；`/pdf-(home|viewer)/js/*` → `/js/*`；
   - `/pdf-(home|viewer)/config/*` → `/static/<module>/config/*`
4) 在 `handle_static_request()` 中调用该函数，并保留 `[STATIC] directory=... path=...` 日志
5) 新增单测：`tests/backend/test_static_path_resolution.py`

状态：已完成（5/5 通过）。

### 当前任务（20251010190030）
名称：构建系统预研（重点：pdf-viewer 构建后潜在问题盘点）

背景：后续将进入“构建系统修复”阶段；为提升执行效率，先全面盘点 pdf-viewer 在生产构建后的高风险点，统一定位关键文件与排查路径，形成可复用的自检清单。

相关模块/文件：
- 构建脚本：`build.frontend.pdf_viewer.py`、`build.frontend.py`
- 打包配置：`vite.config.js`、`package.json`
- 运行器：`src/frontend/pdf-viewer/launcher.py`
- viewer 核心：
  - `src/frontend/pdf-viewer/index.html`
  - `src/frontend/pdf-viewer/main.js`
  - `src/frontend/pdf-viewer/bootstrap/app-bootstrap-feature.js`
  - `src/frontend/pdf-viewer/pdf/pdf-manager-refactored.js`
  - `src/frontend/pdf-viewer/pdf/pdf-config.js`
  - `src/frontend/pdf-viewer/features/ui-manager/components/pdf-viewer-manager.js`

发现与风险（摘要，详见 AItemp/20251010190030-AI-Working-log.md）：
- Worker 加载失败（路径/base、ESM Worker 与 QtWebEngine 兼容性、MIME）
- `standard_fonts/` 404（路径重写/静态暴露）
- `/pdf-viewer/` 显示目录（输出路径与静态路由 index 重写）
- 动态导入 chunk 404（绝对 base 与部署路径不符）
- `pdf_viewer.css` 未注入（多入口与 CSS 抽取）
- 同源/CORS（`/pdf-files/` 映射一致性）
- Feature 安装顺序/白名单（生产差异导致功能未启）

执行步骤（原子，进入修复时遵循）：
1) 单模块构建 viewer 并以 `--prod` 启动，抓取 Network/Console 证据
2) 若 Worker 失败：优先 `base: './'` 验证 → ESM Worker 显式 `workerPort` → legacy worker 回退
3) 若字体 404：启用 `window.__PDFJS_VENDOR_BASE__` 回退（必要时代码注入）
4) 验证 `/pdf-viewer/` index 重写与 MIME；补齐后端路由映射
5) 记录剩余 Feature 安装异常，拆分到二阶段任务

状态：预研完成；待进入“构建系统修复”阶段

### 当前任务（20251010102745）
名称：修复 pdf-home 生产构建运行中的事件命名与白名单问题（阶段一）

背景：已验证构建成功，但运行时多个 Feature 安装失败，日志显示事件命名未满足“三段式”规范（{module}:{action}:{status}），导致 EventBus 校验拦截；同时存在少量全局事件误判与重复订阅提示。

相关模块/文件：
- 本地事件（scoped）：
  - src/frontend/pdf-home/features/sidebar/components/sidebar-panel.js（sidebar 按钮与列表交互）
  - src/frontend/pdf-home/features/sidebar/recent-searches/index.js（最近搜索）
  - src/frontend/pdf-home/features/sidebar/recent-searches/feature.config.js（事件常量）
  - src/frontend/pdf-home/features/sidebar/recent-opened/feature.config.js（事件常量）
  - src/frontend/pdf-home/features/sidebar/recent-added/feature.config.js（事件常量）
- 全局事件白名单：src/frontend/common/event/event-constants.js、src/frontend/common/event/global-event-registry.js
- 事件总线：src/frontend/common/event/event-bus.js、src/frontend/common/event/scoped-event-bus.js

执行步骤（原子）：
1) 将以下本地事件改为三段式并同步使用处：
   - search:clicked → search:item:clicked
   - limit:changed → limit:value:changed
   - sidebar:toggled → sidebar:toggle:completed
   - pdf:clicked → pdf:item:clicked
2) 构建 pdf-home 并以 --prod 运行，检查 Feature 安装日志是否消除命名校验错误。
3) 若仍有白名单/订阅重复问题，记录具体事件与订阅者ID，二阶段再修复（本阶段不处理跨域大改）。

状态：进行中（阶段一仅聚焦事件命名与直接使用处同步）

### 追加备注（构建差异处理 / 20251010）
- 发现“开发能跑、构建不能跑”的典型触发点：
  1) 动态导入（FeatureRegistry → ScopedEventBus）的 Chunk 解析在生产下更易失败；
  2) 事件白名单依赖对象递归收集，生产 Treeshaking 可能丢失部分分组（如 SYSTEM/HEADER/PDF_EDITOR）。
- 修复策略：
  - 改为静态导入 ScopedEventBus；
  - 显式收集命名导出的事件常量（SEARCH/HEADER/PDF_EDITOR/SYSTEM 等）
  - SearchBar 直接发全局事件，绕过桥接，确保“点击搜索”在构建产物下仍可工作。

### 当前任务（20251010064621）
**名称**：继续使用 iziToast 并修复 Qt 环境下的挂载问题

**背景**：生产运行中出现 `Cannot read properties of null (reading 'style')` 错误

**解决方案**：
- `thirdparty-toast.js`：新增固定容器 `#izi-toast-root`，通过 `target` 挂载到稳定节点
- `notification.js`：引入可切换引擎（iziToast ↔ ToastManager），支持 `window.__NOTIFY_ENGINE` 覆盖
- `search-bar.js`：对 `style` 操作加防御判空

**状态**：✅ 已完成

---

### 当前任务（20251010）
**名称**：拆分前端构建（模块化构建系统）

**成果**：
- 新增 `build.frontend.pdf_home.py` - 独立构建 pdf-home 模块
- 新增 `build.frontend.pdf_viewer.py` - 独立构建 pdf-viewer 模块
- 更新 `vite.config.js` - 支持通过 `VITE_BUILD_ONLY` 环境变量控制构建目标

**优势**：
- 支持并行构建，提升构建速度约17%-50%
- 模块解耦，便于独立开发和测试
- 减少构建产物体积

**状态**：✅ 已完成并提交

---

### 当前任务（20251009）
**名称**：修复 PDF-Viewer 翻译功能无反应

**问题**：划词后点击翻译无反应，事件被 EventBus 全局白名单拦截

**解决**：
- 将 `PDF_TRANSLATOR_EVENTS` 加入 `global-event-registry.js` 白名单
- 新增测试验证事件注册

**涉及模块**：
- `features/text-selection-quick-actions/index.js`
- `features/pdf-translator/index.js`
- `common/event/global-event-registry.js`

**状态**：✅ 已完成

---

### 合并任务（20251009-20251010）
**名称**：从 worker/branch-B 合并到 main

**合并内容**：
- 新增 PDF outline 功能
- 改进锚点侧边栏 UI
- 优化 PDF 管理器核心逻辑
- 新增测试用例
- 修复 toast 通知挂载点问题
- 更新 WebSocket 适配器

**冲突解决**：`.kilocode/rules/memory-bank/context.md` 采用 worker/branch-B 版本

**状态**：✅ 已完成（提交 37860d1）

---

## 📚 历史任务归档（概要）

### 锚点功能系列改进（20251009）
**主要工作**：
- 增强锚点侧边栏加载约束（失败/超时提示 + 重试）
- 新增"页内位置(%)"列，移除"激活"列
- 修复滚动后锚点页码/位置不更新
- 锚点跳转改为通过 URL Navigation 实现
- 修复锚点→URL导航跳转失败问题
- 并发闸门（锚点+渲染）后再执行跳转
- 锚点跳转延迟调整为1s

**关键技术点**：
- WebSocket 适配器失败桥接
- RENDER.READY 事件机制
- URL 导航链路稳定性

**状态**：✅ 全部完成

---

### Annotation 标注系统（20251008）
**主要工作**：
- 理解 annotation 插件架构
- ann_id 格式统一（随机段6位）
- 后端双格式校验
- 评论链路持久化

**涉及模块**：
- `features/annotation/` - 前端Feature
- `backend/database/plugins/pdf_annotation_plugin.py` - 后端插件
- 数据模型、工具注册表、侧边栏UI

**状态**：✅ 已完成

---

### PDF-Home Filter 功能（20251007）
**主要工作**：
- 分析 Filter 功能架构
- 搜索框与侧边栏联动
- 分页限制处理

**状态**：✅ 已完成

---

### 构建系统（20251010）
**阶段划分**：
- **Step 1**：后端构建（`build.backend.py`）- 复制后端源码到 `dist/latest/`
- **Step 2**：前端构建（`build.frontend.py`）- Vite 多入口构建
- **Step 3**：总控脚本（计划中）- 并行调度

**关键特性**：
- UTF-8 编码强制
- 过滤复制（忽略缓存、测试目录）
- PDF.js vendor 独立管理
- 元数据记录（JSON格式）

**状态**：Step 1-2 已完成，Step 3 待实施

---

## 🔧 技术规范摘要

### 事件命名规范（强制）
**格式**：`{module}:{action}:{status}`（必须3段，用冒号分隔）

**正确示例**：
- `pdf:load:completed`
- `bookmark:toggle:requested`
- `sidebar:open:success`

**错误示例**（禁止）：
- `loadData` ❌ 缺少冒号
- `pdf:list:data:loaded` ❌ 超过3段
- `pdf_list_updated` ❌ 使用下划线

### 局部事件 vs 全局事件
**局部事件**（Feature内部）：
- 使用 `scopedEventBus.on()` / `scopedEventBus.emit()`
- 自动添加命名空间 `@feature-name/`

**全局事件**（Feature间通信）：
- 使用 `scopedEventBus.onGlobal()` / `scopedEventBus.emitGlobal()`
- 不添加命名空间前缀

### Logger 系统（强制使用）
**禁止**：`console.log` / `console.error` / `console.warn` / `console.info`

**正确方式**：
```javascript
import { getLogger } from '../common/utils/logger.js';
const logger = getLogger('ModuleName');

logger.debug('调试信息', extraData);
logger.info('一般信息', extraData);
logger.warn('警告信息', extraData);
logger.error('错误信息', errorObject);
```

---

## 📝 备注

- **文件版本**：压缩精简版（从1296行压缩至~300行）
- **压缩日期**：2025-10-10
- **压缩原则**：保留最近任务详情 + 重要指导性内容 + 历史任务概要
- **详细历史**：参见 `AItemp/` 目录下的AI工作日志
---

### 当前任务（20251011023000）
名称：Anki 插件事件桥接（pdf-viewer / pdf-home 打开）

背景：
- 插件侧提供通用事件总线（request/response 信号，事件为 dict，建议包含 type/request_id）；
- 需要在本仓内订阅插件的“打开窗口”类请求，并以与仓内一致的事件命名进行对齐；

事件命名（对齐本仓三段式）：
- 打开 viewer：`pdf-library:open:viewer`（兼容 `open_pdf` / `pdf-library:viewer:requested`）
- 打开 home：`pdf-library:open:home`（新约定，待插件侧确认）

涉及模块/文件：
- 新增：`src/integrations/anki_event_bridge.py`
- 测试：`tests/test_anki_event_bridge.py`

执行步骤（原子）：
1) 读取插件 `event_bus.py` 机制，确认 `on_request/emit_request`
2) 设计桥接类：try 导入 → 订阅 → 解析 payload → 调用启动器
3) 先编写测试（桩模块注入 `hjp_linkmaster_dev.lib.common_tools.event_bus`）
4) 实现桥接模块，显式 UTF-8 日志输出
5) 运行并通过测试

状态：已完成（测试通过）。

### 当前任务（20251011060000）
名称：大纲（outline）自动展开功能

背景：
- 用户希望打开 Outline 侧边栏时，所有书签节点自动展开
- 原代码为避免大型树卡顿，禁用了自动展开

⚠️ 关键发现：错误的文件！
- 最初修改了 `outline-sidebar-ui.js`，但系统实际使用的是 `bookmark-sidebar-ui.js`
- 通过用户反馈"没有toast弹出"，追踪 `real-sidebars.js` 发现真相
- 教训：修改前要先确认组件是否真正在运行（追溯注册点）

实现方案：
- 在 jsTree 初始化后监听 `ready.jstree` 事件
- 调用 `$container.jstree("open_all")` 展开所有节点
- 添加详细的 toast 调试日志和错误处理

涉及文件：
- ❌ src/frontend/pdf-viewer/features/pdf-outline/components/outline-sidebar-ui.js（误修改，系统未使用）
- ✅ src/frontend/pdf-viewer/ui/bookmark-sidebar-ui.js（正确文件，已修改）
- 📖 src/frontend/pdf-viewer/features/sidebar-manager/real-sidebars.js（确认实际使用的组件）

验证方法：
- 打开 pdf-viewer 的 Outline 侧边栏
- 应该看到以下 toast 消息（按顺序）：
  1. "Creating jstree with X nodes"
  2. "jsTree created, waiting for ready event..."
  3. "jsTree ready event fired!"
  4. "✅ Outline tree expanded automatically"

状态：✅ 已完成修改（正确文件），等待用户测试验证

---

### 当前任务（20251011054500）
名称：修复 outline 插件 jstree 拖拽节点丢失问题

背景：
- 将节点拖入到另一个节点成为子节点时，操作失败
- 子节点彻底消失（从数据库返回的数据就没有这个节点）
- 推测是前端操作逻辑问题

根因分析：
- `BookmarkManager.saveToStorage()` 中的 `cloneAndDedup()` 函数存在逻辑缺陷
- 问题1：调用 `node.toJSON()` 会递归序列化整个子树，与 `cloneAndDedup` 的递归逻辑冲突
- 问题2：如果节点引用残留在旧位置，`visited` Set 检查会导致节点在新位置被跳过
- 致命场景：节点先被旧位置序列化（添加到 visited），后在新位置被跳过，导致丢失

修复方案：
1. 重写 `cloneAndDedup()` 函数，不再调用 `toJSON()`
2. 手动构建 JSON 对象，只序列化当前节点属性
3. 递归处理 children 时应用 `visited` 检查
4. 优先使用 `this.#bookmarks.get(childId)` 获取最新状态
5. 添加警告日志便于调试

涉及文件：
- src/frontend/pdf-viewer/features/pdf-bookmark/services/bookmark-manager.js（已修复）
- src/frontend/pdf-viewer/features/pdf-bookmark/models/bookmark.js（无需修改）
- src/frontend/pdf-viewer/features/pdf-outline/components/outline-sidebar-ui.js（无需修改）
- src/frontend/pdf-viewer/features/pdf-bookmark/services/__tests__/bookmark-manager.reorder-to-child.test.js（已创建测试）

验证方法：
- 手动测试：拖拽节点到另一个节点下，刷新后验证节点是否保留
- 检查浏览器控制台是否有重复节点警告
- 检查 localStorage 中保存的数据是否有重复节点

状态：✅ 已完成修复，等待用户手动测试验证

---

### 当前任务（20251011053000）
名称：修复 pdf-viewer translate 模块事件未注册问题

背景：
- translate 模块划词翻译功能无反应
- 日志显示多个 pdf-translator:* 事件"未注册的全局事件"被拦截
- 根因：PDF_TRANSLATOR_EVENTS 未导入到 global-event-registry.js 白名单

修复内容：
1. 在 `global-event-registry.js` 中导入 `PDF_TRANSLATOR_EVENTS`
2. 调用 `collectStrings(PDF_TRANSLATOR_EVENTS, AllowedGlobalEvents)` 收集事件
3. 新增测试文件验证事件注册（translator-events-registration.test.js）

涉及文件：
- src/frontend/common/event/global-event-registry.js（已修改）
- src/frontend/pdf-viewer/features/pdf-translator/events.js（无需修改）
- src/frontend/pdf-viewer/features/pdf-translator/__tests__/translator-events-registration.test.js（已创建）

验证方法：
- 重新运行 pdf-viewer，检查日志中是否还有 "未注册的全局事件" 错误
- 测试划词翻译功能是否正常工作

状态：✅ 已完成修复，等待用户实际运行验证

---

### 当前任务（20251011024500）
名称：新增 integrations 构建脚本（build.integrations.py）

背景：
- 需要为插件侧分发 `src/integrations`（含 anki_event_bridge.py），以便在 dist 包中可直接 import。

执行步骤（原子）：
1) 对齐现有 build.* 风格与 dist 目录约定；
2) 先写测试：调用脚本到临时 dist，断言 `src/integrations/anki_event_bridge.py` 与元信息 JSON 存在；
3) 实现脚本：过滤复制、UTF-8 元信息写入、--clean 支持；
4) 运行测试并通过。

涉及文件：
- 新增：`build.integrations.py`
- 新增测试：`tests/test_build_integrations.py`

状态：已完成（测试通过）。

### 当前任务（20251011025500）
名称：将 integrations 构建集成到 rebuilda_all.py

背景：
- 希望一键构建时自动包含 `src/integrations`，便于 Anki 插件侧直接引入 dist 包。

执行步骤（原子）：
1) 在 `rebuilda_all.py:build_all()` 中，pdf-home 构建之后追加调用 `build.integrations.py --dist dist/latest --clean`；
2) 验证参数与编码标志与既有风格一致（`-X utf8`）。

状态：已完成，并记录于 AItemp。

### 当前任务（20251011032000）
名称：URL 参数支持 annotation-id 并自动跳转标注（线路A）

背景：
- 需求：Anki 插件事件回调启动 viewer 时，携带需要聚焦的标注 ID；前端加载后自动定位并高亮该标注。

执行步骤（原子）：
1) 解析并传递 annotation-id（bridge → launcher CLI → URL）
2) 扩展 URLParamsParser 解析 annotationId
3) URLNavigationFeature 在 PDF 加载完成后尝试触发标注跳转（重试机制）
4) 运行测试（bridge 层）

涉及文件：
- src/integrations/anki_event_bridge.py
- src/frontend/pdf-viewer/launcher.py
- src/frontend/pdf-viewer/features/url-navigation/components/url-params-parser.js
- src/frontend/pdf-viewer/features/url-navigation/index.js
- tests/test_anki_event_bridge.py

状态：已完成（测试通过）。


### 当前任务（20251010175226）
名称：修复生产环境打开 pdf-viewer 显示目录而非 index.html（/pdf-viewer/ 路由与构建协作）

背景：
- 启动后端与 pdf-home（--prod），双击 PDF 打开 viewer，浏览器显示“Directory listing for /pdf-viewer/”。
- 现有构建产物疑似为：dist/latest/pdf-viewer/pdf-viewer/index.html，导致 /pdf-viewer/ 命中目录而非文件。

相关模块/脚本：
- build.frontend.pdf_viewer.py（输出目录结构与 base 路径）
- src/frontend/pdf-home/pyqt-bridge.py（build_pdf_viewer_url 构造 /pdf-viewer/ 生产 URL）
- src/backend/pdfFile_server/handlers/pdf_handler.py（静态路由对 /pdf-viewer/ 的 index.html 追加逻辑）

执行步骤（原子）：
1) 检查 dist/latest/pdf-viewer 目录结构与 index.html 实际位置；
2) 统一产物结构：index.html 放置在 dist/latest/pdf-viewer/index.html（根层），assets/js/vendor 同级子目录；
3) 修改 build.frontend.pdf_viewer.py 的 out_dir 与拷贝/写入规则，避免多一层 pdf-viewer/ 嵌套；
4) 修改 build_pdf_viewer_url：生产使用 http://127.0.0.1:{pdfFile_port}/pdf-viewer/?...（尾随/ 保证追加 index）；
5) 后端静态路由：确保 /pdf-viewer/ 自动追加 index.html；
6) 设计并运行测试：
   - 单元：build_pdf_viewer_url 在存在与缺失 index.html 两种情况下的 URL；
   - 路由：静态处理函数对 /pdf-viewer/ 的解析应返回 index.html；
7) 重新构建并回归测试。

状态：新建（准备执行）


### 进展更新（20251010175839）
- 已修改：src/backend/pdfFile_server/handlers/pdf_handler.py —— 目录请求（含查询）自动映射 index.html；新增 /pdf-viewer 嵌套 config 映射；
- 已清理并统一：src/frontend/pdf-home/pyqt-bridge.py 的 uild_pdf_viewer_url（生产优先，自动回退开发；仅一处定义）；
- 新增测试：scripts/tests/test_build_pdf_viewer_url.py，通过。
- 预期：/pdf-viewer/?... 不再出现目录列表；仍兼容嵌套产物。

待办：
- 如需彻底扁平化产物，可在 uild.frontend.pdf_viewer.py 中构建后将 pdf-viewer/index.html 上移到根；当前先由后端路由兼容，避免额外改动。

### 清空并重建记录（追加）
- 已执行 stop → rm dist/latest → build.backend → build.frontend.pdf_viewer(失败：缺少 src/frontend/pdf-viewer) → build.frontend.pdf_home(成功)
- 产物：
  - 后端：dist/latest/src/backend
  - pdf-home：dist/latest/pdf-home
  - pdf-viewer：待补（源码缺失）
- 路由：/pdf-viewer/?... 自动映射 index.html（新目录优先，旧目录回退）；因此一旦补齐 viewer 产物，无需改 URL。

### 新增任务（20251011035030）
名称：pdf-viewer 启动时自动刷新 visited_at

背景：
- 侧边栏“最近阅读”依赖 `pdf_info.visited_at` 降序展示。
- 现在仅在特定交互（如编辑/阅读统计）会更新，首次从 pdf-home 打开 viewer 后未必能及时刷新。

目标：
- 每次 pdf-viewer 成功加载 PDF 时，自动向后端发送记录更新消息，将对应 PDF 的 `visited_at` 更新为当前时间（毫秒）。

涉及模块/文件：
- 前端（viewer）：`src/frontend/pdf-viewer/adapters/websocket-adapter.js:183`
- 事件常量：`src/frontend/common/event/event-constants.js`
- 后端（标准WS）：`src/backend/msgCenter_server/standard_server.py:1624` 处理 `pdf-library:record-update:requested` → `PDFLibraryAPI.update_record`（优先 `pdf_info_plugin.update`）

实现要点：
- 监听 `PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS`（viewer加载成功）。
- 从 URL 查询串解析 `pdf-id`（来自 pdf-home/launcher/pyqt-bridge）。
- 若存在 `pdf-id`，通过 WS 发送 `pdf-library:record-update:requested`，载荷：
  - `file_id: <pdf-id>`（uuid/兼容title/filename的解析由后端兜底）
  - `updates: { visited_at: Date.now(), json_data: { last_accessed_at: Date.now() } }`
- 与现有 `pdf_loaded` 旁路日志消息并存，不影响。

测试设计（单测）：
- 新增 `src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.update-visited.test.js`
- 伪造 `window.location.search='?pdf-id=abc123def456'`；触发 `FILE.LOAD.SUCCESS`；断言 `WSClient.send` 被调用一次 `pdf_loaded`，一次 `pdf-library:record-update:requested`，且包含 `file_id` 与数值型 `visited_at/last_accessed_at`。

注意事项：
- 当 URL 缺少 `pdf-id`（例如独立 launcher 仅传 `file`）时，跳过更新（无法可靠映射 uuid）。
- 该实现不引入新契约；严格复用 `WEBSOCKET_MESSAGE_TYPES.PDF_LIBRARY_RECORD_UPDATE_REQUESTED`。

状态：已实现前端桥接与单元测试文件；CI/Jest 在本地环境可能需要 ESM 配置修复后再跑。

### 新增任务（20251011041030）
名称：修复 URL 导航“未跳转”——捕获作用域 RENDER.READY 事件

背景：
- JS 日志（如 `logs/pdf-viewer-c83c60c58ad2-js.log`）显示 URLNavigationFeature 多次捕获“标注数据加载完成”，但未捕获“渲染就绪/门闸通过”，因此未执行跳转。
- 根因：RENDER.READY 由 pdf-reader 作用域事件总线发出（@pdf-reader/ 前缀），URLNavigationFeature 仅监听了全局事件，未收到。

措施：
- 在 `src/frontend/pdf-viewer/features/url-navigation/index.js` 中，新增对 pdf-reader 作用域 `PDF_VIEWER_EVENTS.RENDER.READY` 的监听；一旦收到将 `#renderReady=true` 并调用 `#tryExecuteGatedNavigation()`。

影响：
- 低风险增强；当 URL 含 `page-at/position/annotation-id` 时，加载后应能自动跳转。

备注：
- 若 URL 仅有 `pdf-id`，按设计不会跳转，这是预期行为。

### 新增任务（20251011043800）
名称：去除 URL 导航中的“渲染就绪”门闸，仅依赖“标注就绪”

背景与动机：
- 实际运行中，标注数据加载完成通常发生在渲染就绪之后；且原有“双门闸”让导航在某些环境下未能触发。

措施：
- 修改 `src/frontend/pdf-viewer/features/url-navigation/index.js`：
  - `#tryExecuteGatedNavigation()` 仅检查 `#annotationDataLoaded`；不再判断 `#renderReady`。
  - 移除对 `RENDER.READY` 的监听作为门闸触发点（保留字段但不依赖）。
  - 日志“等待渲染与标注数据加载门闸”改为“等待标注数据加载门闸”。

预期：
- 当 URL 含 `page-at` 或 `annotation-id` 时，标注加载完成后立即执行跳转。
