# 20260111160726-pdfviewer-ai-assistant-sidebar-no-eventbus-on-B 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-11 16:07
### 工作内容:
- ai-assistant sidebar UI 从 EventBus 事件驱动改为 store 驱动，并补回归测试。
### 工作步骤:
1. 定位组件内 `eventBus.on/off` 订阅
2. 设计 store 订阅与 dropdown 刷新策略（destroy 必须对称 unsubscribe）
3. 先写回归测试，再改实现
4. 跑 `pnpm -s run lint` 与定向 Jest
### 工作结果:
- [待填写]
### 存在问题:
- [待填写]
### 下一步计划:
- [待填写]

