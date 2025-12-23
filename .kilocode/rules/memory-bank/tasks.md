## PDF.js 集成到前端架构
**上次执行：** 2025-09-14
**需修改文件：**
- `src/frontend/pdf-viewer/pdf-manager.js`
- `src/frontend/pdf-viewer/page-transfer-manager.js`
- `src/frontend/common/event/pdf-viewer-constants.js`
- `vite.config.js`
- `babel.config.js`
- `src/frontend/pdf-viewer/index.html`

**步骤：**
1. 引入 PDF.js CDN 并配置 worker
2. 实现 LRU 页面缓存（page-transfer-manager.js）
3. 集成 WebGL 检测与 Canvas 回退（webgl-detector.js）
4. 通过 EventBus 发布 `FILE.LOAD.SUCCESS/ERROR` 事件
5. 配置 Babel 支持私有字段（`#setupResizeObserver`）
6. 编写测试：`qtwebengine-compatibility.test.js`、`webgl-integration.test.js`

**重要说明：**
- 必须使用 `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/` 版本
- 所有事件必须使用命名导入，禁止默认导入
- 所有 `emit(undefined)` 必须替换为 `emit(null)`
- 必须通过 `qtwebengine-compatibility.test.js` 验证 QtWebEngine 环境兼容性

---

## 标注管理器 v1 开发 TODO（后端 + 前端 + 对外契约）
**创建时间：** 2025-12-23  
**目标：** 将标注管理器（anno-manager）打磨到一个“接口稳定、可被其他模块安全调用”的 v1 版本，优先保证标注查询与引用能力，而不是一次性完成所有高级视图（导图、多布局）。

### 一、后端领域能力（Annotation Domain）

**A. 统一的标注查询 API 套件**
1. 设计并固化标注查询事件族（常量与命名）  
   - 在 `src/frontend/common/event/pdf-viewer-constants.js` 或专用常量文件中，补充 `ANNOTATION_QUERY_EVENTS` 命名空间，至少包含：  
     - `ANNOTATION_QUERY_EVENTS.SEARCH.REQUESTED`  
     - `ANNOTATION_QUERY_EVENTS.SEARCH.COMPLETED`  
     - `ANNOTATION_QUERY_EVENTS.SEARCH.FAILED`  
     - `ANNOTATION_QUERY_EVENTS.RELATED.REQUESTED`  
     - `ANNOTATION_QUERY_EVENTS.RELATED.COMPLETED`  
     - `ANNOTATION_QUERY_EVENTS.RELATED.FAILED`  
   - 在 `event-constants.js` 与 `global-event-registry.js` 中登记这些事件，遵守三段式命名和白名单规则。  
   - 为事件常量新增最小单元测试，确保命名空间和白名单注册不会被后续改动破坏。

2. 定义统一的查询入参与返回结构（契约文档 + 类型约定）  
   - 在 docs 或 `context.md/tech.md` 中写清：  
     - `search` 请求 payload：  
       - `filters`: `{ pdf_ids?: string[], tags?: string[], has_card?: boolean, is_key?: boolean, importance_min?: number, importance_max?: number, created_at_from?: string, created_at_to?: string }`  
       - `pagination`: `{ page: number, page_size: number }`  
       - `sort_by`: 枚举，如 `"created_at" | "updated_at" | "importance" | "has_card" | "pdf_title"`；  
       - `sort_direction`: `"asc" | "desc"`  
     - `search` 返回：  
       - `items`: 标准化标注对象数组（见 A.3）；  
       - `total`: 匹配总数；  
       - `page` / `page_size`。  
     - `related` 请求 payload：  
       - `annotation_id: string`，可选 `depth?: number`（默认 1）；  
     - `related` 返回：  
       - `nodes`: 包括 `annotation` / `pdf` / `card` 三类节点（统一结构）；  
       - `edges`: 来自 `pdf_annotation_relation` 的边集合。  
   - 尽量保持入参与返回结构稳定，为规划器与复习器预留空间。

3. 后端实现 `annotation_query:search` 处理逻辑  
   - 在后端（建议新建 `annotation_query_service` 或等价模块）实现搜索：  
     - 优先复用现有 `PDFAnnotationTablePlugin` / `PDFAnnotationTagsTablePlugin`，避免重复封装 SQL；  
     - 通过 JOIN/子查询支持 tags / has_card / importance / 时间区间等过滤；  
     - 对常用过滤维度（如 pdf_id、is_key、importance、created_at）添加合理索引（如尚未存在）；  
     - Fail-Fast：任何非法筛选条件（如 importance 区间错误）直接抛错，不兜底。  
   - 新增后端测试：  
     - 覆盖至少 3 类场景：  
       1) 仅按 `pdf_id` + 分页；  
       2) 组合条件筛选（`pdf_id + tag + has_card`）；  
       3) importance/时间区间边界情况。  
     - 确保结果中 meta 字段（title/is_key/importance）与现有插件行为一致。

4. 后端实现 `annotation_query:related` 处理逻辑  
   - 基于 `PDFAnnotationRelationTablePlugin` 提供“1 跳/多跳邻居”查询：  
     - 入参 `annotation_id` 必须验证存在性，不存在时直接报错；  
     - 根据 `depth` 决定探索层数（v1 可仅支持 1 跳，但要在契约中写明）；  
     - 输出 `nodes` + `edges`，节点类型至少包含：  
       - `annotation`（标注）  
       - `pdf`（PDF 文档）  
       - `card`（卡片或草稿）  
   - 新增测试：  
     - 简单三角结构（标注A→标注B→卡片C）与 PDF 关联；  
     - 确认重复边去重、非法 target_type 拒绝等行为。  

5. WebSocket/MsgCenter 接入与错误处理  
   - 在 WS 消息层为 `annotation_query:*` 增加类型常量（如 `WEBSOCKET_MESSAGE_TYPES.ANNOTATION_QUERY_REQUESTED/COMPLETED/FAILED`），遵守现有规范。  
   - 实现 MsgCenter → 后端 service 的路由逻辑：  
     - 仅接受来自允许的 client_id（如 `anno-manager`），其余请求拒绝并记录日志；  
     - 错误通过统一错误辅助工具抛给前端（禁止 alert/静默失败）。  
   - 增加最小集成测试或契约测试，验证 MsgCenter 收到请求后能正确调用后端并返回数据。

### 二、前端 anno-manager v1 能力

**B. 内部数据层与领域客户端**
1. 创建 `annotation-domain-client`（前端）  
   - 新增模块（例如 `src/frontend/common/domain/annotation-domain-client.js`）：  
     - 封装向 `annotation_query:search` / `annotation_query:related` 发送事件或 WS 请求的逻辑；  
     - 统一处理 loading/错误状态与重试策略；  
     - 输出标准化的标注数据结构供 UI 使用。  
   - 为该模块新增 Jest 测试：  
     - 模拟 EventBus/WS 返回数据，验证成功/失败路径下的行为；  
     - 确保 Fail-Fast：非法参数直接抛错。

2. anno-manager 内部状态管理与分页  
   - 在 `src/frontend/anno-manager/main.js` 或拆分出的 store 模块中：  
     - 使用领域客户端加载当前查询结果与分页信息；  
     - 维护当前 `filters` / `sort` / `pagination` 状态；  
     - 提供刷新/切换页/修改筛选条件的公开函数，供 UI 调用。  
   - 测试：  
     - 至少覆盖初始查询、修改筛选条件后重新查询、翻页三类行为。

**C. 列表视图 v1（单 PDF 优先）**
1. 单 PDF 视角下的标注列表 UI  
   - 在现有布局基础上：  
     - 对 URL 携带 `pdf-id` 的情况，默认按该 PDF 过滤并查询；  
     - 列表项展示：标题、所在 PDF（可选）、页码、标签、是否已有卡片、更新时间等关键字段；  
     - 空状态文案区分“该 PDF 无标注”和“查询条件下无结果”。  
   - 新增 Jest 测试：  
     - 渲染含多条标注的列表，验证字段展示；  
     - 在 `pdf-id` 存在/不存在两种情况下行为是否符合预期。

2. 基础筛选与排序交互  
   - 实现 header 第二行中最核心的几项功能（v1）：  
     - 按 `pdf-id` / tag / has_card 进行筛选；  
     - 按 `created_at` 或 `importance` 排序。  
   - 前端通过更新内部 `filters/sort` 状态触发重新查询，避免本地手工过滤。  
   - 测试：  
     - 模拟点击筛选控件，断言会向领域客户端发起带新条件的查询；  
     - 验证排序按钮切换时结果顺序变化。

3. 列表项的对外动作（为后续模块预留）  
   - 每个标注列表项至少预留两个动作：  
     1) “在 PDF 中查看”：发出统一事件（如 `ANNOTATION_VIEW.NAVIGATE_REQUESTED`），由 pdf-viewer 响应跳转；  
     2) “发送到卡片规划器”：发出 `ANNOTATION_MANAGER_EVENTS.EXPORT_TO_PLANNER.REQUESTED`（具体命名可后续细化），暂不实现真正调用规划器，仅保证事件契约存在。  
   - 测试：  
     - 点击操作按钮时，EventBus 被正确调用，事件名与 payload 结构符合约定。

**D. 视图模式与布局约束**
1. 明确 v1 必须支持的视图模式  
   - v1 阶段：列表视图为“强制完成”；多列布局可以只保证样式完整，但功能与单列一致；导图视图仅占位，不接线真实关系数据。  
   - 在 `context.md` 中标注：树视图/导图视图的详细行为将在后续 v2/v3 任务中实现，避免后续 AI 误认为当前 TODO 要一次性全部完成。

### 三、对外契约与与其他模块的边界

**E. 标注引用与跨模块协议**
1. 标注引用对象的统一结构  
   - 在 `tech.md` 或专门的契约文档中定义：  
     - `AnnotationRef = { kind: 'annotation', id: string, pdf_id?: string, page?: number }`  
   - 标注管理器在对外发事件时，一律通过 `AnnotationRef` 携带标注身份，不直接塞整条记录。  
   - 为该结构新增简单的运行时校验 helper（如 `validateAnnotationRef`），严格 Fail-Fast。

2. 与卡片规划器的对接预留  
   - 定义一组面向规划器的事件常量（暂不实现后端行为）：  
     - 如 `ANNOTATION_MANAGER_EVENTS.EXPORT_TO_PLANNER.REQUESTED/COMPLETED/FAILED`。  
   - 约定 payload：  
     - `requested`：`{ refs: AnnotationRef[], source: 'anno-manager' }`；  
   - 在 anno-manager UI 中预留触发这些事件的入口（参见 C.3），后续由规划器实现具体消费逻辑。  

3. 与定制复习器 / Anki 的间接关系  
   - 对定制复习器的直接 API 仍按 `tech.md` 中 `card_html:get:requested` 等定义；  
   - 标注管理器只需保证标注查询结果中包含足够信息，让后续模块能通过卡片/任务关系表间接查到相关标注。  
   - 在 `context.md` 中说明：标注管理器 v1 不直接负责复习相关操作，仅提供可靠的标注数据源。

**F. 文档与规范更新**
1. 更新 `.kilocode/rules/memory-bank/context.md`  
   - 补充“标注管理器 v1 范围说明”，明确当前 TODO 的完成标准与不在本轮范围内的部分（如导图视图详细交互）。  

2. 更新 `.kilocode/rules/memory-bank/tech.md`  
   - 将本 TODO 中涉及的事件命名、AnnotationRef 结构与 API 契约写入对应章节，供后续 AI 与人工查阅。  

3. 如后续有模块 SPEC 头文件（`docs/SPEC/SPEC-HEAD-anno-manager.json`），则需同步更新其中的接口描述与行为约束。
