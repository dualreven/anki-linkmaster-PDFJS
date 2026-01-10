# PDFViewer pdf-outline：UI 解耦 WS + cleanup 契约回归（E）规格说明

**功能ID**: 20260111010855-pdfviewer-outline-ui-decouple-and-cleanup-E  
**优先级**: 中（P1）  
**版本**: v001  
**创建时间**: 2026-01-11 01:37（本地）  
**状态**: doing  

## 现状说明
- pdf-outline 已完成“UI 不直连 WS 事件”的第一轮治理，但仍需要继续把“订阅/副作用/DOM 更新”边界固化为可测试、可卸载的契约，防止回潮成面条。

## 存在问题
- Outline 相关模块中，仍可能存在：
  - 监听器/订阅清理不对称（destroy/uninstall 后仍残留监听）
  - UI 层仍隐式依赖低层 transport/协议细节（未来改协议会扩散修改面）

## 提出需求（目标）
1) 明确并固化边界：
   - UI 只消费领域事件 / store（禁止直接订阅 `WEBSOCKET_EVENTS` / 直接 new WSClient）
   - WS/协议只进 manager/service 层（或 adapter），由其发出领域事件/store 更新
2) cleanup 契约强化：
   - uninstall/destroy 幂等，重复调用不抛错
   - 订阅/监听器清理对称（不残留）
3) 增加 ≥2 条防回归测试（必须可定向执行）：
   - 1 条针对“UI 不直连 WS”的门禁式测试（例如扫描/断言不出现特定 import/on）
   - 1 条针对 destroy/uninstall cleanup 的行为测试（JSDOM + spy）

## 解决方案（建议方向）
- 以最小可交付为先：先补测试固化契约，再做最小拆分/重排（避免大范围重构导致冲突）。
- 禁止兜底：任何缺失依赖/非法参数必须 fail-fast（按项目原则）。

## 约束条件（严格代码隔离）
### 允许修改（scope）
- `src/frontend/pdf-viewer/features/pdf-outline/**`
- `src/frontend/pdf-viewer/features/pdf-outline/__tests__/**`

### 禁止修改
- 禁止修改 `src/frontend/pdf-viewer/features/infra-ui/**`（避免与 B 冲突）
- 禁止修改 `src/frontend/pdf-viewer/features/pdf-annotation/**`（避免与 C 冲突）
- 禁止修改 `src/frontend/pdf-viewer/features/pdf-search/**`（避免与 D 冲突）
- 禁止修改 `src/frontend/pdf-viewer/ui/**`（避免与 A 冲突）
- 禁止修改 `src/gui_launcher/**` / `src/launcher/**`（旧 E 已归档）

### 规范必读
- `src/frontend/pdf-viewer/docs/SPEC/SPEC-HEAD-pdf-viewer.json`

## 可行验收标准（DoD：没有 commit hash 就不算完成）
- 必须提交 git 并提供 **commit hash**（工作区干净）。
- 必须新增/更新 ≥2 个测试用例，并提供定向命令（文件路径）：
  - `pnpm exec jest --runTestsByPath <测试文件1> <测试文件2> -i`
- `pnpm -s run lint` 通过。
- `working-log.md` 写明：边界收敛点、测试覆盖点、以及是否需要人工点检（一般不需要）。

