# Card Planner - Q/A 并列智能输入框（标注ID识别/高亮/粘贴/注入追加）

**功能ID**: 20260111144355-card-planner-qa-smart-input-F  
**优先级**: P0（用户核心交互需求）  
**版本**: v001  
**创建时间**: 2026-01-11 14:43  
**状态**: doing  

## 用户需求（必须满足）
1) 卡片规划器中，Q/A 两个区域改为 **并列的两个输入框**（左右并排）。
2) 输入框不是“简单 textarea”：需要能**识别输入内容中的标注ID**并做“突出增强”（高亮/胶囊/pill 风格均可）。
3) 输入框支持粘贴：可粘贴标注ID列表（多行/空格分隔均可）。
4) 接收到插入消息（`card-planner:ingest:requested`）时：在目标卡片对应面（Q 或 A）的输入框**末尾**追加标注ID，且必须用 `[[id]]` 包裹。
   - 注意：favicon 404 可忽略，本任务不处理。

## 推荐实现策略（保证可回归）
- **单一真源**：以 `CardsEngine`（`src/frontend/new-card-scheduler/planner/cards-model.js`）里的 Q/A 数组为真源。
  - UI 输入框仅是该真源的可视化编辑器：
    - 渲染时：把数组渲染为 token 文本：`[[id]]`（建议用换行分隔）。
    - 编辑时：从输入框内容解析 `[[id]]` token（和/或纯 id）→ 更新真源（必要时为 engine 增加“替换某张卡某个面”的 API）。
- **“注入末尾追加”满足方式**：注入路径继续走现有 `engine.dispatchIngest(...)`（append 语义），UI rerender 后自然表现为“末尾追加”。
- **高亮识别规则（建议）**：
  - token：匹配 `\\[\\[([^\\[\\]\\r\\n]+)\\]\\]` 的内容视为 annotationId
  - unknown/known：可通过现有 meta 预览（`getCardMetaPreview`）区分；unknown 也要高亮，但样式可更弱。

## 约束条件（严格隔离 scope，禁止与其他任务重叠）
### 允许修改/新增（仅限）
- `src/frontend/new-card-scheduler/planner/ui/**`
- `src/frontend/new-card-scheduler/planner/cards-model.js`
- `src/frontend/new-card-scheduler/planner/wiring/msgcenter-wiring.js`（仅当确实需要对“末尾追加”更精确控制）
- `src/frontend/new-card-scheduler/planner/wiring/paste-wiring.js`（若需从“全局 paste”改为“输入框内 paste”）
- `src/frontend/new-card-scheduler/planner/__tests__/**`

### 禁止修改
- 禁止修改：`src/frontend/new-card-scheduler/bootstrap/**`、`src/frontend/new-card-scheduler/features/**`、`src/frontend/new-card-scheduler/main.js`
- 禁止修改：`.kilocode/rules/memory-bank/**`

## 交付物（必须提交到 git）
- 代码改动（scope 内）
- ≥2 条 Jest 回归测试（覆盖：token 解析/高亮渲染、注入/粘贴的末尾追加）
- `report.md`（必须提交）：包含 scope、命令、结果、commit hash

## 验收标准（DoD：没有 commit hash 不算完成）
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath <本任务测试文件...> -i` ✅
- git 提交：提供 **commit hash**，工作区干净

