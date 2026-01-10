# 20260111010855-pdfviewer-search-event-subscriptions-hardening-D 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-11 01:08（本地）
### 工作内容:
- 强化 pdf-search 订阅/DOM manager 边界与 cleanup 契约，补回归测试。
### 工作步骤:
1. 阅读 `src/frontend/pdf-viewer/docs/SPEC/SPEC-HEAD-pdf-viewer.json`
2. 先写测试（≥2条）：cleanup 对称 + cleanup 后不再触发
3. 进行最小拆分/重构（仅限 pdf-search scope）
4. 跑：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath ... -i`
5. 提交 git，记录 commit hash
### 工作结果:
- [待填写]
### 存在问题:
- [待填写]
### 下一步计划:
- [待填写]

