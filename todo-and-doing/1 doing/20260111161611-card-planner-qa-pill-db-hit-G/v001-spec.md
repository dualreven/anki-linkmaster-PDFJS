# Card Planner - `[[annotationId]]` 仅在 DB 命中时胶囊化（G）

**功能ID**: 20260111161611-card-planner-qa-pill-db-hit-G  
**优先级**: P0  
**版本**: v001  
**创建时间**: 2026-01-11 16:16  
**状态**: doing  

## 背景
v009 已实现 Q/A 并列“智能输入框”，当前对 `[[...]]` token 做统一高亮/胶囊渲染，但用户要求进一步收敛：
- **前提：标注ID存在于数据库**（即后端 `annotation:bulk-get` 可查到），才视为“真 id”并胶囊化；
- 查不到的 `[[xxx]]` 视作普通文本（不胶囊、不高亮）。

## 需求（必须满足）
1) `qa-smart-input` 渲染层：仅对“DB 命中”的 `[[annotationId]]` 做胶囊化；未命中的保持普通文本样式。
2) 粘贴与注入逻辑不变：接收到注入/粘贴后仍会把 id 追加到末尾并规范化为 `[[id]]` 形态；**仅改变渲染表现**（A 方案）。
3) 必须补回归测试：覆盖“命中→胶囊”、“未命中→普通文本”。

## 推荐实现（保证隔离与可回归）
- 命中定义：`annotation:bulk-get:completed` 的 `data.annotations[].id` 集合包含该 id（前端以此视为 DB 命中）。
- UI 渲染：在 `qa-smart-input.js` 内对 token 进行分类：
  - `known`：命中 → 胶囊/高亮
  - `unknown`：不命中 → 直接文本渲染（不要包裹胶囊类名）
- 测试：使用 adapter/mock 注入“只返回部分 annotations”的结果，断言 DOM 中只有命中 id 存在胶囊标识。

## 约束（严格隔离 scope，禁止与其他任务重叠）
### 允许修改/新增（仅限）
- `src/frontend/new-card-scheduler/planner/ui/**`
- `src/frontend/new-card-scheduler/planner/token-utils.js`
- `src/frontend/new-card-scheduler/planner/__tests__/**`

### 禁止修改
- 禁止修改：`gui_launcher.py`（F 的 scope）
- 禁止修改：后端数据库/插件代码（H 的 scope）
- 禁止修改：`docs/**`（I 的 scope）
- 禁止修改：`.kilocode/rules/memory-bank/**`

## 验收标准（DoD：没有 commit hash 不算完成）
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath <本任务测试文件集> -i` ✅
- `report.md`（必须提交）：包含 scope、命令、结果、commit hash、改动文件清单
- git 提交：提供 commit hash，工作区干净

