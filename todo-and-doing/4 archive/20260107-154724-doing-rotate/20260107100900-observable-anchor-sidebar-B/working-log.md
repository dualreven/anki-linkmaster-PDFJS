# 20260107100900-observable-anchor-sidebar-B - 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-07 10:09:00
### 工作内容:
- 下达任务：将 Anchor 相关 UI 从 EventBus 驱动迁移到 `AnchorManager.store` 驱动。
### 工作步骤:
1. 阅读 `v001-spec.md` 与 `docs/SPEC/SPEC-HEAD-pdf-viewer.json`
2. 先补测试（store 驱动 UI / destroy 解绑）
3. 再实现 `AnchorManager + store` 或补齐现有 manager
4. 清理 Feature 内部 EventBus 闭环路径
5. 跑 `pnpm -s run lint` + 目标 Jest 用例
### 工作结果:
- （待执行）
### 存在问题:
- （待记录）
### 下一步计划:
- 在 `worker/refactor-B` 上实现并提交（交付 commit hash）

