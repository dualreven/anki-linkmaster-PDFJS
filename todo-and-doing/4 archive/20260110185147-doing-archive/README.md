# Doing Archive - 20260110185147

归档时间：2026-01-10 18:51:47（本地）

## 本次归档（ABCDE - 20260110175029 批次）
- A：`20260110175029-pdf-home-loopback-host-verify-A`
  - 合入 main：`078578f`
  - 内容：补齐 loopback host 排障/点检文档（Vite/QtWebEngine）
- B：`20260110175029-infra-ui-coordinator-slim-B`
  - 合入 main：`f9b963b`（功能）+ `4574b5e`/`4da0995`（日志）
  - 内容：拆分 coordinator subscriptions + 回归测试（uninstall 清理）
- C：`20260110175029-pdf-annotation-sidebar-zombie-cleanup-C`
  - 合入 main：`c286cae`（测试）+ `c169755`（日志）
  - 内容：强化“sidebar 仅 store 驱动”契约回归测试
- D：`20260110175029-pdf-search-dom-manager-extract-D`
  - 合入 main：`56641fc`
  - 内容：任务重复，已在 working-log 关闭（本批不做代码改动）
- E：`20260110175029-ui-keyboard-handler-singleton-E`
  - 合入 main：`8535dfd`（功能）+ `a11c089`（日志）
  - 内容：KeyboardHandler 防重复监听 + 回归测试

## 门禁（main）
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath ... -i` ✅

