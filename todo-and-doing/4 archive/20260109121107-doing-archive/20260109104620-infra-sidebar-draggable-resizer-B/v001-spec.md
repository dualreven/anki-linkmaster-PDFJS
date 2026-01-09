# infra-sidebar：抽离 DraggableResizer 组件并补泄漏回归测试

**功能ID**: 20260109104620-infra-sidebar-draggable-resizer-B  
**优先级**: 中（P1：职责拆分 + 生命周期清晰）  
**版本**: v001  
**创建时间**: 2026-01-09 10:46:20  
**状态**: 设计中

## 现状说明
- `infra-sidebar` 目前已具备全局 mousemove/mouseup 清理兜底，但 `SidebarManagerFeature` 仍承担较多 DOM 拖拽细节。

## 提出需求
- 抽离一个可复用的 `DraggableResizer`（或同名）组件：
  - 封装 mousedown/mousemove/mouseup 绑定/解绑；
  - 对外只回调 `onResize(delta)` 或 `onWidth(newWidth)`；
  - `destroy()` 必须保证“拖拽中途销毁也能清理 document 监听器”。
- `SidebarManagerFeature` 只负责：更新 store 宽度 + 触发布局重算。

## 约束条件
- 只允许修改：`src/frontend/pdf-viewer/features/infra-sidebar/**`
- 必须新增回归测试：模拟 mousedown 后立刻 destroy，断言 removeEventListener 被调用。

## 可行验收标准
- `pnpm -s run lint`
- `jest --runTestsByPath <new test>` 通过

## 协作协议
- 提交到 `worker/refactor-B`，提供 commit hash。

