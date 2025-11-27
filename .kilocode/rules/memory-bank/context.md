# Memory Bank - Context（精简版）

最后更新：2025-11-27

## 当前任务快照（2025-11-27）
- 任务：🔍 分析 pdf-viewer 断点续读（resume）在高页码场景下的恢复页码偏差（例：关闭在 42 页，重开时在 39–40 跳动并最终停在 40 页）
- 前序任务：压缩 context.md；多轮修复 PDF 页码跳转偏差 Bug + pdf-resume 模块化重构（详见归档）

### 本次分析结论（pdf-resume 恢复页码 42→40 问题）
- 现象复述：用户在第 42 页关闭 pdf-viewer 后重新打开，同一文档会在 39–40 页之间短暂跳变，最终稳定停在第 40 页，而不是预期的 42 页。
- 关键链路：
  - 保存阶段：`PDFResumeFeature` 通过两条路径更新 resume：  
    1) `PAGE.CHANGING` 事件（由 `PDFViewerManager` 桥接 PDF.js 的 `pagechanging`），直接调用 `ResumeUpdater.setPage(pageNumber) + flush()`；  
    2) `PositionTracker` 基于 `viewerContainer` 视口中心，使用 `getCurrentPageAndPosition()`（内部调用 `detectCenterPageNumber` + `measureYPercent`）做滚动采样，同样调用 `setPage(pageAt) + flush()`。
  - 恢复阶段：`PDFResumeFeature.#applyLoadedResume()` 在收到后端的 `json_data.resume` 后，先恢复视图状态（缩放/布局/旋转），再通过 `NavigationService.navigateTo({ pageAt: resume.page, position: resume.y_percent })` 触发两步导航（`NAVIGATION.GOTO`→PDF.js 内部跳转 + `scrollToPosition` 二次平滑滚动）。
- 主要成因拆解：
  1. **保存阶段“当前页”定义不一致**  
     - PDF.js 的 `currentPageNumber` 与我们在 `pdf-page-detection-utils.detectCenterPageNumber()` 中使用的“视口中心页”不完全等价，尤其是在接近文档底部时：  
       - 用户通过页码输入或快捷跳转到第 42 页后，PDF.js 往往将第 42 页顶部对齐到视口上缘；  
       - 此时 `viewerContainer` 的**中心点**可能仍落在第 40～41 页区域（因为视口高度有限，底部无法完全再向下滚动）；  
       - 结果：`PAGE.CHANGING` 曾经发出过 `pageNumber = 42`，但用户继续微调滚动后，最后一个触发 resume 的事件往往来自 `PositionTracker`，其基于“中心页”检测出的 `pageAt` 可能是 40 或 41，而不是 42。  
     - `ResumeUpdater.flush()` 采用“最后一次 setPage 为准”的策略：如果最近一次调用来自 PositionTracker（`pageAt = 40`），则最终写入的 resume.page 就是 40，即使 PDF.js 内部的 `currentPageNumber` 仍为 42。
  2. **两步导航 + 位置测量的边界效应**  
     - 恢复时，`NavigationService.navigateTo()` 会：  
       1) 通过 `NAVIGATION.GOTO` 事件驱动 PDF.js 跳转到 `pageAt` 页面（内部有自己的滚动动画）；  
       2) 等待 `#waitForPageReady(pageAt)` + 额外 100ms，随后在我们的 DOM 层执行 `scrollToPosition(position, pageAt)`：  
          - 该方法尝试把“目标页中 y_percent 对应的点”放到视口中心；  
          - 但若目标页接近文档底部，理论上的中心位置会超出文档最大 `scrollTop`，代码里会被 `maxScrollTop` 截断；  
          - 被截断后，实际视口中心会偏上（落在上一两页的中部），这进一步放大了“保存阶段用中心页”的偏差。  
     - 从用户感知来看，这种“PDF.js 自己滚一段 + 我们再滚一段 + 边界截断”组合，很容易表现为：打开时先看到 39 页附近一闪，再滑到 40 页附近稳定下来，看不到 42 页，给人的直观印象就是“在 39–40 之间抖动，最后停在 40 页”。
  3. **中间状态写回的问题在上一轮已通过冻结机制缓解，但仍会放大上述偏差**  
     - 之前的 bug：在恢复导航过程中，PDF.js 的 `pagechanging` 会依次发出如 39→40→41→42 的中间页码；旧版本的 `PDFResumeFeature` 会立刻把这些中间页码写入 resume，导致“刚跳到 42，立刻又把 40 写回数据库”。  
     - 当前代码中已在 `PDFResumeFeature.#applyLoadedResume()` 中对 `PositionTracker` 调用 `freezeFor(3000)`，并在 `PAGE.CHANGING`/`ZOOM.CHANGING` 处理器里检查 `isFrozen`，避免恢复期间的中间状态被回写，这一块已经基本锁死。  
     - 但这只解决了“恢复期间写错”的问题，并**没有改变**“平时阅读时最后一次滚动由中心页检测驱动”的策略，因此在高页码 + 底部边界场景下，**保存下来的 resume 本身就有页码偏差（42 → 40）**，恢复逻辑只是在忠实执行这个“错误的真相”。  

- 结论：  
  - 当前 42→40 问题不是单一函数的 off-by-one，而是 **“中心页检测 + 两步导航 + 底部滚动边界 + 以最后一次 PositionTracker 写入为准”** 叠加造成的系统性偏差：  
    - 在文档中部时，中心页 ≈ 当前页，行为正常；  
    - 在接近末尾时，中心页倾向于落在倒数第二、第三页，导致 resume.page 往前飘；  
    - 再加上恢复时的两步滚动动画，用户会明显看到“先在 39–40 抖一阵，最后停在 40”，而从未真正停在 42。  
  - 之前增加冻结（freeze）的修复主要阻止了“恢复过程把中间页码写回 resume”的回归风险；本次分析进一步确认了**保存策略本身在高页码场景下对“当前页”的定义存在误差**，这是用户现在仍然能复现 42→40 现象的根本原因。

---

## 1) 项目硬约束（永久保留）
- **Python 虚拟环境强制使用**：详见 `docs/architecture/environment.md`
- **文件编码**：显式 UTF-8 + 统一换行 `\n`
- **事件命名**：强制三段式 `{module}:{action}:{status}`；全局事件需通过白名单放行
- **Fail-Fast 原则**：禁止兜底，契约不匹配必须失败
- **DRY 原则**：开发前必须搜索已有实现，禁止重复代码，发现重复必须询问用户
- **代码审计优先级**：P0删除死代码 → P1抽象重复代码 → P2固化经验为规则

### 前端错误提示统一策略
- `notification.js`：底层 toast 封装
- `websocket-error-handler.js`：统一 WS 错误监听
- `domain-error-notifier.js`：领域错误提示入口
- 禁止在 Feature 内自行构造新的全局 toast DOM

---

## 2) 关键协议（最新版）

### WebSocket 消息常量
- 前端：`WEBSOCKET_MESSAGE_TYPES.*`
- 后端：`MessageType(Enum)` + `msg_router.py` 显式路由
- 两端值必须一致

### Outline 域协议
- 类型：`outline:{list|create|update|delete|reorder}:{requested|completed|failed}`
- 后端 API：严格使用 `PDFOutlineTablePlugin`
- 加载策略：后端优先、一次渲染，无前端本地缓存

### MsgCenter 转发规则
- **目标对象存在性原则**：不做业务处理，仅负责转发；无法投递则失败
- **Viewer 目标**：必须命中 `viewer_id/pdf_uuid`
- **客户端身份**：除注册消息外，未注册 socket 返回 401

### 事件常量使用规范
- 前端：禁止字符串字面量，必须使用命名空间常量
- 后端：数据库插件事件必须使用 `TableEventConstants.*`

---

## 3) AI 协作与 Plan 模式

- **触发范围**：所有会产生副作用的操作必须采用"先 Plan 后执行"
- **执行顺序**：
  1. 读取最近 8 个 AI-Working-log，总结上次目标和结果
  2. 创建新的 AI-Working-log，记录本次目标
  3. 输出 Plan 并等待用户确认
  4. 执行修改和测试
  5. 更新 context.md / architecture.md / tech.md
- **思考流程**：基于事实 → 存在困境 → 提出猜想 → 进行验证 → 合理执行

---

## 4) 最近变更摘要（详见归档）

### 2025-11-27
- ✅ PDF 页码跳转偏差 Bug 第二次修复（NavigationService 增加 100ms 滚动等待）
- ✅ PDF 页码跳转偏差 Bug 第一次修复（删除 ensurePageVisible，问题变严重）
- ✅ pdf-resume 模块化重构（-42% 代码量）
- ✅ context.md 压缩与归档

### 2025-11-26
- ✅ pdf-viewer 断点续读状态保存链路修复（json_data.resume 透传）

### 2025-11-25
- ✅ gui_launcher 跳转测试修复（WebSocketAdapter.onInitialized 调用）
- ✅ 前端应用启动/DI/FeatureRegistry 引导流程抽象统一
- ✅ WebSocket 适配器安装逻辑统一抽象

**详细记录**：`docs/context-archive/2025-11/context-2025-11-week3-4.md`

---

## 5) 当前待办
- [ ] 引入单一真源生成前后端事件常量
- [ ] 在 CI 做差异校验，确保事件/消息名同步
- [ ] 补充阅读历史 E2E 测试

---

## 6) 快速索引

### 文档
- **架构设计**：`architecture.md` + `docs/architecture/`
- **技术规范**：`tech.md` + `docs/standards/`
- **测试指南**：`docs/TESTING-OVERVIEW.md`（⚠️ 本项目 E2E 是连贯的集成测试流）

### 历史归档
- **2025年11月第3-4周**：`docs/context-archive/2025-11/context-2025-11-week3-4.md`
- **2025年11月第1-2周**：`docs/context-archive/2025-11/context-2025-11-week1.md`、`week2.md`
- **2025年10月及更早**：`docs/context-archive/2025-10/`

### 核心检查清单
- [ ] 事件名：只用命名空间常量；禁止字面量
- [ ] 全局事件：新增前登记白名单
- [ ] ESLint 通过：`pnpm exec eslint src --max-warnings=0`
- [ ] Jest 通过：`pnpm test`
- [ ] 显式 UTF-8、统一 `\n`、Fail-Fast 无兜底

---

## 维护规则
1. 每周归档一次历史记录（保留最近 3 天）
2. **context.md 始终保持在 200 行以内**
3. 重要变更记录 3 天后移入归档
4. 每月整理一次归档文件，更新索引

## 查找历史记录
- 打开 `docs/context-archive/` 对应年月目录
- 使用 Ctrl+F 搜索关键词
- Git 历史：`git log -p -- .kilocode/rules/memory-bank/context.md`

归档策略：保留最近3天变更摘要，历史见 `docs/context-archive/`；memory-bank 的整体压缩与归档行为遵循《Memory Bank 压缩机制规范》（`.kilocode/rules/memory-bank/compression.md`）。
