# 系统架构（极简索引）

目的：将“架构本体”沉淀到 docs/architecture 专题文档；此文件仅保留最小要点与索引。

- 架构要点（立即理解）
  - 分层与边界：前端（pdf-home、pdf-viewer）纯 UI；后端由 WS 转发器、HTTP 文件服务器、PDF 业务服务器（预留）构成。
  - 运行形态：源码（Vite/Hosted is_prod=false）与分发（静态路由 /static、/pdf-home、/pdf-viewer）。
  - 事件与作用域：统一 EventBus；跨模块 onGlobal/emitGlobal；ScopedEventBus 以 SCOPE_ID 稳定命名。
  - 导航互斥：URL 导航与 WS 导航不可并发；跨文档导航在 FILE.LOAD.SUCCESS 恢复。
  - 原则：Fail‑Fast，无兜底；UTF-8 + `\n`；目录 kebab-case。
  - Outline-only：后端只接受 `outline_id`；API 直连 `PDFOutlineTablePlugin`；严禁 `bookmark_*` 字段与回退路径。
  - Outline 加载策略（2025‑11‑09）：去掉前端本地缓存；查看器加载时统一走“后端优先”单次渲染：`outline-list → (empty? import from PDF → bulk-save) → outline-list → OUTLINE.LOAD.SUCCESS`。

- 主题索引（详细说明见 docs/architecture）
  1) 总览与组件 → docs/architecture/overview.md
  2) 分层模型与 Feature/Bus → docs/architecture/layers.md
  3) 导航与互斥策略 → docs/architecture/navigation.md
  4) 设计原则（Fail‑Fast 等） → docs/architecture/principles.md
  5) 关键组件（WS/HTTP/PDF 服务） → docs/architecture/components.md
  6) 构建与运行（源/分发） → docs/engineering/build-run.md

维护记录
- 2025-11-07 精简为索引版；详细内容迁移到 docs（见 todo-and-doing/1 doing/20251107-architecture-md-minify-migration/plan.md）。
