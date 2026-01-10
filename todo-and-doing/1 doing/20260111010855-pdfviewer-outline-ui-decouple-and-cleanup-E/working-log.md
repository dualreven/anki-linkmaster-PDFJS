# 20260111010855-pdfviewer-outline-ui-decouple-and-cleanup-E 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-11 01:37（本地）
### 工作内容:
- 固化 pdf-outline 的 UI/WS 边界与 cleanup 契约，并补回归测试（≥2条）。
### 工作步骤:
1. 阅读 `src/frontend/pdf-viewer/docs/SPEC/SPEC-HEAD-pdf-viewer.json`
2. 先写测试（≥2条）：UI 不直连 WS 门禁 + destroy/uninstall cleanup 行为
3. 做最小改造（仅限 pdf-outline scope），确保边界清晰与可卸载
4. 跑：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath ... -i`
5. 提交 git，记录 commit hash
### 工作结果:
- [待填写]
### 存在问题:
- [待填写]
### 下一步计划:
- [待填写]

