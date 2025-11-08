# 构建与运行（源码/分发）

目标：统一前后端在“源码/分发”两种形态下的运行方式与目录约定，降低环境差异带来的问题。

运行形态
- 源码（Source）
  - 前端：Vite dev server 提供资源；Hosted 以 `is_prod=false` 运行
  - 静态入口：`/pdf-home`、`/pdf-viewer` 由 dev server 代理
  - 目录：`<repo>/logs`、`<repo>/data`
- 分发（Dist）
  - 静态路由：`/static`、`/pdf-home`、`/pdf-viewer`（由内置 HTTP 服务器提供）
  - HTTP 服务：仅做文件传输，支持 Range；不承担业务逻辑
  - 目录：`dist/latest/logs`、`dist/latest/data`、`dist/latest/static`

静态路由与 base
- pdf-home：base=/pdf-home/
- pdf-viewer：base=/pdf-viewer/
- 构建命令（示例）：
  - `pnpm run build:pdf-home`
  - `pnpm run build:pdf-viewer`

日志策略
- 前端：统一通过 Logger 输出 UTF-8 文本；按模块/实例落盘至 logs 目录（如 `pdf-viewer-<pdfId>-js.log`）
- 后端：Python logging，滚动/分文件；错误均带时间戳、等级与模块信息

常见问题与规避
- QtWebEngine 环境下，viewer 入口不得包含 Node-only 语法（如 `require()`、`__filename`）；通过构建检查脚本规避
- 跨形态路径：避免硬编码绝对路径；使用相对路由与 base
- UTF-8 + `\n`：任何生成/写入需显式编码与换行，防止跨平台 CRLF 问题

检查命令
- 构建：`pnpm run build:pdf-viewer`
- E2E：`pnpm run e2e:browser`
- Lint：`pnpm run lint` 或子命令（见质量门禁）

迁移任务与历史说明
- 见 `todo-and-doing/1 doing/20251107-tech-md-minify-migration/plan.md`
