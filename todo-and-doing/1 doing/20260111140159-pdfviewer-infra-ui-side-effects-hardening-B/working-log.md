# 20260111140159-pdfviewer-infra-ui-side-effects-hardening-B 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-11 14:01
### 工作内容:
- 初始化任务，梳理 infra-ui 副作用清理点与测试策略。
### 工作步骤:
1. 阅读 `docs/SPEC/SPEC-HEAD-pdf-viewer.json` 与测试清理规范
2. 仅在 `src/frontend/pdf-viewer/features/infra-ui/**` 内定位 subscriptions/listeners/timeouts
3. 先写回归测试，再做收敛与 uninstall 强化
4. 跑 `pnpm -s run lint` 与定向 Jest
### 工作结果:
- 交付副作用收敛：对 `setTimeout` 类副作用做对称清理，避免卸载后仍触碰 DOM。
- 新增回归测试覆盖 uninstall/destroy 后不残留 timeout 副作用。
### 存在问题:
- 无
### 下一步计划:
- 无（已完成）

## 工作记录2
**时间**: 2026-01-11 15:10
### 工作内容:
- 清理 infra-ui 内的 timeout 副作用并强化 uninstall：
  - Copy PDF ID 按钮：卸载时 clearTimeout + 立即复位按钮状态
  - Zoom 动画：destroy 时 clearTimeout + 立即移除动画 class
- 回归测试：补齐 timeout cleanup 的用例，并修复既有测试的 destroy/依赖 stub。

### 交付:
- commit: `5ad13af4`
- tests:
  - `pnpm -s run lint` ✅
  - `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/features/infra-ui/components/__tests__/ui-manager-core-copy-pdf-id.timeout-cleanup.test.js src/frontend/pdf-viewer/features/infra-ui/components/__tests__/ui-zoom-controls.timeout-cleanup.test.js src/frontend/pdf-viewer/features/infra-ui/components/__tests__/ui-zoom-controls.destroy.test.js src/frontend/pdf-viewer/features/infra-ui/__tests__/copy-pdf-id-button.test.js -i` ✅
