# PDFViewer infra-ui：ui-manager-core 进一步瘦身与装配收敛（B）规格说明

**功能ID**: 20260111010855-pdfviewer-infra-ui-ui-manager-core-slim-B  
**优先级**: 中（P1）  
**版本**: v001  
**创建时间**: 2026-01-11 01:08（本地）  
**状态**: doing  

## 现状说明
- infra-ui 已引入 coordinator/subscriptions，但 `ui-manager-core.js` 仍接近 500 行（当前约 497），属于“面条回潮高风险壳层”。
- 目标不是“无限拆分”，而是把职责边界继续清晰化，降低未来改动冲突。

## 存在问题
- ui-manager-core 仍承担过多职责（事件/DOM/状态混杂），维护成本高。
- 近期虽已加 CI gate（禁止 components 直接 `eventBus.on`），但 core 壳仍可能继续膨胀。

## 提出需求（目标）
1) 将 `ui-manager-core.js` 中的一个“相对独立域”抽为独立模块（例如：标题/按钮/状态条/resize/wheel 等其中一个域），使 core 更接近装配层。
2) 补齐至少 2 条回归测试：
   - 1 条针对装配层：模拟关键事件 → 断言子模块被调用（而非子模块自行订阅）。
   - 1 条针对 destroy/uninstall：验证订阅/监听器清理对称（避免泄漏）。

## 解决方案（建议方向）
- 优先采用“提取模块 + 明确注入依赖（eventBus/logger/dom）”模式，保持可测试性。
- 禁止新增兜底逻辑；任何缺失依赖/非法参数必须 fail-fast 抛错或显式失败（按现有规范）。

## 约束条件（严格代码隔离）
### 允许修改（scope）
- `src/frontend/pdf-viewer/features/infra-ui/components/ui-manager-core.js`
- `src/frontend/pdf-viewer/features/infra-ui/components/**`（仅限被拆出的新模块文件与相关测试）

### 禁止修改
- 禁止修改 `src/frontend/pdf-viewer/features/pdf-annotation/**`（避免与 C 冲突）
- 禁止修改 `src/frontend/pdf-viewer/features/pdf-search/**`（避免与 D 冲突）
- 禁止修改 `src/frontend/pdf-viewer/ui/**`（避免与 A 冲突）

### 规范必读
- `src/frontend/pdf-viewer/docs/SPEC/SPEC-HEAD-pdf-viewer.json`

## 可行验收标准（DoD：没有 commit hash 就不算完成）
- 必须提交 git 并提供 **commit hash**（工作区干净）。
- 必须新增/更新 ≥2 个测试用例，并给出定向命令（文件路径）：
  - `pnpm exec jest --runTestsByPath <本任务新增/修改测试文件1> <测试文件2> -i`
- `pnpm -s run lint` 通过。
- `working-log.md` 写明：core 拆分后的职责边界、暴露 API、以及 destroy 清理点。

