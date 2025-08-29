1) 避免在子组件中清空宿主容器：不要使用 container.innerHTML = '' 来处理空/错状态，改为在组件的内部插槽（如 tableWrapper）中更新内容，或用显示/隐藏而非移除 DOM 元素。

2) 明确容器职责边界：将 container（外壳）与 tableWrapper（内容插槽）职责区分开，所有渲染器只向 tableWrapper 写入内容，所有外壳级别的结构变更要通过公有方法（如 setupContainer 或 getOrCreateWrapper）完成并同时更新内部引用。

3) 事件监听管理：在组件的初始化阶段注册一次必要事件，确保不会在每次渲染或数据刷新时重复注册；在 destroy 时清理监听器。

4) 渲染器防御性设计：渲染器在写入前应检查目标插槽是否仍挂载到期望的容器，若发现异常应尝试重建或重新挂载，并记录足够的调试信息便于回溯。

5) 日志与快照策略：在重要步骤（初始化、收到数据、渲染前、渲染后）输出一致格式的快照信息（包括 container selector、container.innerHTML 前若干字符、子元素数量、渲染器的 rowCount）。这有助于快速判断是数据问题、渲染问题还是 DOM 操作问题。

6) 测试覆盖：为 PDFTable 编写集成测试用例，覆盖以下场景：
   - 初始化后调用 displayEmptyState 多次，再 loadData，验证 tableWrapper 始终存在并被正确填充。
   - 在重复发布 pdf:list:updated 时，确保 UIManager 不会重复注册事件（可通过断言事件处理器调用次数）。

7) 代码审查规范：在 PR checklist 中加入禁止随意清空宿主容器的条目，以及要求对所有 DOM 结构修改写明恢复策略（如果删除了子元素，需要说明如何恢复内部引用）。

参考位置

- displayEmptyState / displayErrorState 修复： src/frontend/common/pdf-table/pdf-table.js
- renderer 防御与诊断： src/frontend/common/pdf-table/pdf-table-renderer.js
- UI 事件注册与渲染调用： src/frontend/pdf-home/modules/ui-manager.js
- 现场诊断日志示例： debug-console-at-9222.log（包含 DIAGNOSTICS、DEBUG_RENDERER 与“渲染后立即检查”快照）
