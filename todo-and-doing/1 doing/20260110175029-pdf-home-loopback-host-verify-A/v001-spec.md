# pdf-home loopback host 收敛（IPv4/IPv6）规格说明

**功能ID**: 20260110175029-pdf-home-loopback-host-verify-A  
**优先级**: 高（P0）  
**版本**: v001  
**创建时间**: 2026-01-10 17:50:29  
**状态**: 设计中

## 现状说明
- 用户反馈：`pdf-home` 打开后 JS 报错：`Failed to fetch dynamically imported module: http://localhost:3000/pdf-home/index.js`。
- 本机现象可验证：Vite 可能只监听 `::1:3000`，导致 `127.0.0.1:3000` 连接被拒绝（QtWebEngine 对 localhost 的解析可能走 IPv4）。

## 存在问题
- `localhost` 的 IPv4/IPv6 解析在 Windows + QtWebEngine 环境下存在不确定性，导致 **页面能加载但模块动态 import 拉取失败**。
- runtime-ports 的 `url_port` / `vite_port` 在部分链路里可能不同步，进一步放大“加载端口/资源端口不一致”的风险。

## 提出需求
1) 统一 loopback host：开发模式下前端 URL 一律使用 `127.0.0.1`（避免 localhost 解析差异）。
2) Vite dev server 默认监听 `127.0.0.1`（必要时支持 `VITE_HOST` 覆盖）。
3) 明确并补齐“人工验收步骤”，写入文档，避免同类问题回归。

## 解决方案（验收/收敛任务）
- 手工点检与脚本化检查：
  - 确认 `http://127.0.0.1:<vite_port>/@vite/client` 可访问（200）。
  - 确认 `http://127.0.0.1:<vite_port>/pdf-home/index.js` 可访问（200）。
  - 通过 `gui_launcher` 打开 `pdf-home` / `pdf-viewer` / `new-card-scheduler`，验证不再出现 `[BOOT] import index.js failed`。
- 文档收敛：
  - 更新 `docs/module-switching-guide.md`（或等价启动指南）补充“loopback host 一致性检查”与排障步骤。

## 约束条件
### 仅修改本模块代码
- 本任务只允许改动：
  - `docs/module-switching-guide.md`（或其他启动相关 docs）
  - 如需补充示例，可改动 `docs/LAUNCHER-DUAL-MODE-GUIDE.md`
- 不允许引入新的“自动兜底”，发现异常必须显式报错或给出明确排障信息。

## 可行验收标准
### 单元测试
- 若本任务新增脚本/工具函数，必须有对应测试；纯文档任务可不加测试。

### 人工验收
- 按本任务 working-log 中的步骤执行，`pdf-home` 可稳定打开且不出现动态 import fetch 失败。

