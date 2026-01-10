# pdf-annotation Sidebar Zombie Code 清理规格说明

**功能ID**: 20260110175029-pdf-annotation-sidebar-zombie-cleanup-C  
**优先级**: 中（P1）  
**版本**: v001  
**创建时间**: 2026-01-10 17:50:29  
**状态**: 设计中

## 现状说明
- `AnnotationSidebarUI` 已以 store 订阅驱动渲染，但仍残留历史事件驱动的 “Zombie Code”（`subscriptions.js` 中的 CRUD handlers）。

## 存在问题
- 误导维护：读代码会以为 sidebar 仍依赖 EventBus CRUD 事件，实际不会生效。
- 后续重构风险：容易被误用或重复接入，导致双驱动回到面条。

## 提出需求
1) 清理/删除无效的 sidebar CRUD 订阅代码（只保留仍然有效的非数据类事件订阅）。
2) 新增 1 条回归测试：仅通过更新 store 即可驱动 sidebar 列表更新（不依赖 CRUD 事件）。

## 解决方案
- 删除或精简：`src/frontend/pdf-viewer/features/pdf-annotation/components/annotation-sidebar-ui/subscriptions.js`
- 若存在被引用路径，统一改为 store 驱动入口（保持现有行为不变）

## 约束条件
### 仅修改本模块代码
- 仅允许修改：`src/frontend/pdf-viewer/features/pdf-annotation/**`

### Fail-Fast
- 不允许引入新的“事件兜底同步”，一律以 store 为真源。

## 可行验收标准
### 单元测试
- 新增/更新 Jest 测试通过（提交 working-log 里列出测试路径）。

