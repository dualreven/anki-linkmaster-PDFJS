# 20260111010855-pdfviewer-annotation-toggle-button-uninstall-C 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-11 01:08（本地）
### 工作内容:
- 为 pdf-annotation ToggleButton 增加对称 install/uninstall，并补回归测试。
### 工作步骤:
1. 阅读 `src/frontend/pdf-viewer/docs/SPEC/SPEC-HEAD-pdf-viewer.json`
2. 先写测试（≥2条）：卸载后不触发 + 幂等防重复
3. 改造 `annotation-feature-toggle-button.js`（最小改动，保持外部 API 兼容）
4. 在 `pdf-annotation/index.js` 对接 uninstall（仅限必要改动）
5. 跑：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath ... -i`
6. 提交 git，记录 commit hash
### 工作结果:
- [待填写]
### 存在问题:
- [待填写]
### 下一步计划:
- [待填写]

