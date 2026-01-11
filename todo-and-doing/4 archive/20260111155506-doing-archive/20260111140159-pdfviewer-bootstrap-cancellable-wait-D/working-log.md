# 20260111140159-pdfviewer-bootstrap-cancellable-wait-D 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-11 14:01
### 工作内容:
- 初始化任务，定位 bootstrap 等待链路，设计可取消机制与回归测试。
### 工作步骤:
1. 阅读 `docs/SPEC/SPEC-HEAD-pdf-viewer.json` 与测试清理规范
2. 仅在 `src/frontend/pdf-viewer/bootstrap/**` 内定位等待/异步链路
3. 先写回归测试，再做可取消等待改造
4. 跑 `pnpm -s run lint` 与定向 Jest
### 工作结果:
- ✅ 已实现 bootstrap “可取消等待”链路：destroy/uninstall 后不再继续推进 installAll 后续步骤，并 Fail-Fast 抛出可控 AbortError。
- ✅ 已新增 1 条回归测试：destroy 在 installAll pending 期间可用，且 abort 后不会产生 unhandledRejection。
- 变更点（严格 scope：`src/frontend/pdf-viewer/bootstrap/**`）：
  - `src/frontend/pdf-viewer/bootstrap/app-bootstrap-feature.js`
    - 引入 `AbortController`，并在 `registry` 创建后提前暴露 `window.pdfViewerApp.destroy()`（可 await、幂等）。
    - `installAll` 等待改为可取消：abort 后立即 Fail-Fast（`AbortError`），并对 abort 后 installAll 迟到 reject 做 warn+catch 防止未捕获。
    - 关键阶段插入 `assertNotAborted`，避免 abort 后继续推进（自动加载/showInfo 等）。
  - `src/frontend/pdf-viewer/bootstrap/__tests__/app-bootstrap-feature.cancellable-wait.test.js`
    - 回归：destroy during installAll → bootstrap reject AbortError；并验证 abort 后 installAll late reject 不触发 unhandledRejection。
### 存在问题:
- 无
### 下一步计划:
- 提交 git 并更新本任务 `report.md`。
