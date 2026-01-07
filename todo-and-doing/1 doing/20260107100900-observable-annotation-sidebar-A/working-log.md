# 20260107100900-observable-annotation-sidebar-A - 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-07 10:09:00
### 工作内容:
- 下达任务：将 Annotation Sidebar UI 从 EventBus 驱动切换为订阅 AnnotationManager.store 的数据驱动模式。
### 工作步骤:
1. 阅读 `v001-spec.md` 与 `docs/SPEC/SPEC-HEAD-pdf-viewer.json` 相关规范
2. 先补测试（UI 订阅 store / destroy 解绑）
3. 再改实现（注入 manager + store.subscribe + render）
4. 清理旧 EventBus CRUD 监听路径
5. 跑 `pnpm -s run lint` + 目标 Jest 用例
### 工作结果:
- （待执行）
### 存在问题:
- （待记录）
### 下一步计划:
- 在 `worker/refactor-A` 上实现并提交（交付 commit hash）

