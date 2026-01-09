# 任务说明（F）- TextLayerManager 容器切换重绑 selectionchange（P1）

## 0. 任务目标
修复 `TextLayerManager` 在容器替换/多实例场景下的事件耦合风险：
- 容器变更后，`selectionchange` 派发目标必须始终指向“当前容器”，不能继续发给旧节点。
- 必须确保 destroy/uninstall 清理监听器。

## 1. 范围限制
- 仅允许修改：
  - `src/frontend/pdf-viewer/ui/text-layer-manager.js`
  - `src/frontend/pdf-viewer/ui/__tests__/**`
- **不要修改** `.kilocode/rules/memory-bank/**`。

## 2. 交付标准（DoD）
- 修复容器切换后事件仍投递到旧 DOM 的问题（可通过保存当前容器引用并在 setContainer 时重绑/更新派发）。
- 新增回归测试：容器 A → 切换到 B 后触发 selectionchange，断言事件只派发到 B（A 不再收到）。
- 门禁通过：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath <测试> -i`

## 3. 提交要求
- 提交 1 个 commit（修复 + 测试）。
- 更新 `todo-and-doing/1 doing/20260109175650-ui-text-layer-manager-container-rebind-F/working-log.md`。

