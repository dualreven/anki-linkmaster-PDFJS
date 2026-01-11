# 20260111160726-pdfviewer-annotation-sidebar-no-eventbus-on-C 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-11 16:07
### 工作内容:
- 将 annotation sidebar 的 EventBus 订阅从 components 目录迁移到装配层或 store 驱动，并补回归测试。
### 工作步骤:
1. 定位 `components/annotation-sidebar-ui` 的订阅点与触发路径
2. 迁移订阅到 Feature install/uninstall 或改为 store 驱动
3. 先写回归测试，再改实现
4. 跑 `pnpm -s run lint` 与定向 Jest
### 工作结果:
- [待填写]
### 存在问题:
- [待填写]
### 下一步计划:
- [待填写]

