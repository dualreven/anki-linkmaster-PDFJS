# 20260111010855-pdfviewer-ui-keyboard-handler-uninstall-A 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-11 01:08（本地）
### 工作内容:
- 建立 KeyboardHandler install/uninstall 契约与回归测试。
### 工作步骤:
1. 阅读 `src/frontend/pdf-viewer/docs/SPEC/SPEC-HEAD-pdf-viewer.json`
2. 先补测试（≥2条）：覆盖 install/uninstall 幂等与解绑对称
3. 再做最小代码改动以通过测试
4. 跑：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath ... -i`
5. 提交 git，记录 commit hash
### 工作结果:
- [待填写]
### 存在问题:
- [待填写]
### 下一步计划:
- [待填写]

