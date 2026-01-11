# Card Planner（新卡片规划器）契约（Draft v0）

## 目的与边界
- 本文档固化“制卡链路”中 Card Planner 的对外契约：它向 MsgCenter 发射“最终制卡信息”，由 MsgCenter 转发给后端制卡程序（后端程序尚未实现）。
- 规划器内部实现可变，但本文档中的输出结构、Fail‑Fast 行为、以及插入/查询/选择语义必须稳定。

## 1) 最终制卡输出（Planner → MsgCenter）

### 1.1 顶层结构
- 类型：JSON 数组
- 数组顺序：必须反映当前草稿卡（draft cards）在规划器中的排序（拖拽排序后的顺序）。
- 数组元素：每个元素代表一张“待制卡任务”。

### 1.2 元素结构（每张卡）
```json
{
  "title": "",
  "Q": "…… [[ann_test_1]] ……",
  "A": "…… [[ann_test_2]] ……"
}
```

字段说明：
- `title`: string，草稿卡命名；默认 `""`；必须随最终数据一起发送。
- `Q`: string，卡片正面内容文本；其中可嵌入 0+ 个 `[[annotation-id]]` token（见下文）。
- `A`: string，卡片背面内容文本；其中可嵌入 0+ 个 `[[annotation-id]]` token（见下文）。

术语澄清（避免歧义）：
- 本文档中的 `annotation-id` 指 **token `[[...]]` 内部的原始 id 字符串**（例如 `ann_...`）。
- `[[annotation-id]]` token 仅表示“引用某条标注”，并不规定最终制卡程序如何渲染该引用（由后端制卡实现决定）。
- 推荐测试伪标注 id：`ann_test_1`、`ann_test_2`（后端应保证 `annotation:bulk-get` 可查到）。

Fail‑Fast：
- `title` 必须为 string；`Q/A` 必须为 string。
- 建议禁止空任务：`Q.trim()` 与 `A.trim()` 同时为空应视为无意义任务并报错（实现方可在 UI 层阻止或在发射前校验）。
- `[[annotation-id]]` 中的 `annotation-id` 必须为非空字符串；不允许包含换行与 `[`/`]`（推荐实现以严格解析为准，非预期输入应报错而非吞掉）。

迁移提醒（实现同步）：
- 当前仓库的前端/后端校验若仍按 `Q/A: string[]` 处理，需要同步升级为 `Q/A: string`，否则会导致协议校验失败。

## 2) 草稿卡（Draft Cards）能力
- 拖拽排序：改变草稿卡顺序；最终输出数组顺序必须与当前顺序一致。
- 删除：删除的草稿卡不应出现在最终输出中。
- 命名：编辑草稿卡的 `title`；默认空字符串。
- 草稿卡 id：存在“临时 id（tempId）”，用于插入目标定位与状态查询。

## 3) 状态查询（MsgCenter → Planner）

### 3.1 需求
MsgCenter 请求查询当前新卡片情况时，响应必须包含“当前选中的卡片”信息（不再仅返回 id 数组）。

### 3.2 建议响应结构
```json
{
  "draftCardTempIds": ["temp-1", "temp-2"],
  "selectedTempId": "temp-2"
}
```
- `selectedTempId`：string 或 null（无选中时为 null）。

## 4) 插入模型抽象（不减功能，降低实现复杂度）
所有“插入方式/粘贴/消息驱动插入”统一抽象为一个意图：`InsertIntent`，由两部分组合：

### 4.1 Target（目标卡片解析）
- `new`：创建新卡片并作为目标。
- `last`：上一张卡片作为目标（语义见 4.3）。
- `newIndex(x)`：第 x 个新卡片作为目标。
  - `x` 从 0 开始。
  - 若第 x 个不存在：直接报错（Fail‑Fast，不自动补齐创建）。
- `cardId(tempId)`：指定草稿卡临时 id（id 类型为临时 id）。

### 4.2 Distribution（分配策略）
- `allToOne(face=Q|A)`：把全部 `annotation-id` 追加到同一张卡的同一面。
- `onePerNew(face=Q|A)`：每个 `annotation-id` 创建一张新卡，并追加到该新卡的同一面。
- `alternateFaces(startFace=Q)`：按 Q/A 交替写入（默认 QAQAQA…）；必要时自动创建新卡。

### 4.3 last 语义（已确认）
- 若当前没有选中卡片：
  - 若草稿卡存在：`last = 最近创建的卡片`；
  - 若草稿卡不存在：创建新卡并作为 last。
- 若当前有选中卡片：
  - `last = 选中卡片的上一张`；
  - 若选中的是第 0 张：报错（Fail‑Fast）。

## 5) 复制粘贴（Ctrl+V）插入（UI 入口）
交互：
- 复制 1+ 个 `annotation-id`（剪贴板内容以 `;` 分隔）。
- 点击某张草稿卡的 `Q` 或 `A`（设置粘贴焦点：selectedCard + face）。
- `Ctrl+V` 粘贴插入。

规则（已确认）：
- 未选中卡片时：粘贴提示无效（不自动选择、不自动创建）。
- 追加（append），不去重，保持顺序。
- 分隔符：`;`（仅此分隔符）。

## 6) MsgCenter 插入消息能力映射（需求覆盖）
- “全部 ids → 新卡 Q|A” → `Target=new` + `Distribution=allToOne(face)`
- “全部 ids → 上一张卡 Q|A” → `Target=last` + `Distribution=allToOne(face)`
- “每个 id → 各自新卡 Q|A” → `Target=new` + `Distribution=onePerNew(face)`
- “全部 ids → 第 x 个新卡 Q|A” → `Target=newIndex(x)` + `Distribution=allToOne(face)`
- “全部 ids → 按 QAQAQA 插入（无卡则自动创建）” → `Target=new` + `Distribution=alternateFaces(startFace=Q)`
- “状态请求” → `Query=listDraftCards()`（响应需含 `selectedTempId`）
- “全部 ids → 指定卡片 id” → `Target=cardId(tempId)` + `Distribution=allToOne(face)`

## 7) MsgCenter 消息契约（Draft v0，先固定语义与 payload）

说明：
- MsgCenter 路由动作由标准协议中的 `to` 字段决定：本节仅固定 `type` 与 `data` 的结构。
- 下面所有 `annotation-id` 均为原始 id 字符串。

### 7.1 Planner 接收：导入标注（Ingest）
**type**：`card-planner:ingest:requested`

**data**：
```json
{
  "op": {
    "kind": "all-to-one|one-per-new|alternate-faces",
    "target": { "kind": "new|last|new-index|card-id", "x": 0, "tempId": "temp-1" },
    "face": "Q",
    "startFace": "Q"
  },
  "annotation_ids": ["ann_1", "ann_2"]
}
```

规则：
- `op.kind=all-to-one`：必须提供 `op.face`；将全部 ids 追加到目标卡片的该面。
- `op.kind=one-per-new`：必须提供 `op.face`；每个 id 新建一张卡并写入该面。
- `op.kind=alternate-faces`：可选 `op.startFace`（默认 `Q`）；按 QAQA… 交替写入，必要时自动创建新卡；`op.face` 必须忽略。
- `op.target.kind=new-index`：必须提供 `x`（0-based）；不存在直接报错。
- `op.target.kind=card-id`：必须提供 `tempId`（草稿卡临时 id）。

响应：
- 成功：`card-planner:ingest:completed`（可选携带最新 state）
- 失败：`card-planner:ingest:failed`（Fail‑Fast，必须返回明确错误原因）

### 7.2 Planner 接收：状态查询（State）
**type**：`card-planner:state:get:requested`

**data**：空对象或缺省。

响应（必须包含 selected）：
**type**：`card-planner:state:get:completed`
```json
{
  "draftCardTempIds": ["temp-1", "temp-2"],
  "selectedTempId": "temp-2"
}
```

### 7.3 Planner 发射：最终制卡输出（Final Output）
**type**：`card-planner:final-output:requested`

**data**：
```json
{
  "cards": [
    { "title": "", "Q": "…… [[ann_test_1]] ……", "A": "…… [[ann_test_2]] ……" }
  ]
}
```

说明：
- `data.cards` 就是本文档第 1 节定义的最终制卡数组载荷；MsgCenter 转发给后端制卡程序（待实现）。

### 7.4 Planner 请求：批量获取标注元信息（Annotation Meta）
**type**：`annotation:bulk-get:requested`

**data**：
```json
{ "ann_ids": ["ann_1", "ann_2"] }
```

响应：
**type**：`annotation:bulk-get:completed`
```json
{
  "annotations": [
    { "id": "ann_1", "title": "t", "type": "note", "pageNumber": 1, "pdfId": "p1" }
  ]
}
```

## 8) 待后续补齐（实现前仍建议明确）
- `annotation-id` 的权威定义（是否等同 `annotation_uuid`）。
- `title` 的最大长度、允许字符集、是否允许仅空白字符串等。
