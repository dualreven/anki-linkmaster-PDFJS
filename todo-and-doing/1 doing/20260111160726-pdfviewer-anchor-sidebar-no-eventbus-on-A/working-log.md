# 20260111160726-pdfviewer-anchor-sidebar-no-eventbus-on-A 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-11 16:07
### 工作内容:
- 移除 pdf-anchor 组件内 EventBus 订阅，收敛到装配层，并补回归测试。
### 工作步骤:
1. 定位 `AnchorSidebarUI` 中所有 `eventBus.on` 订阅点
2. 将订阅上移到 Feature install/uninstall 或用 store 驱动替代
3. 先写回归测试（保证组件不再订阅 eventBus）
4. 跑 `pnpm -s run lint` 与定向 Jest
### 工作结果:
- [待填写]
### 存在问题:
- [待填写]
### 下一步计划:
- [待填写]

