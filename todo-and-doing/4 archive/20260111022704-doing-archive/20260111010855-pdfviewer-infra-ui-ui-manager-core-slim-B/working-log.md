# 20260111010855-pdfviewer-infra-ui-ui-manager-core-slim-B 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-11 01:08（本地）
### 工作内容:
- infra-ui `ui-manager-core.js` 进一步瘦身：抽出独立域模块，并补装配层回归测试。
### 工作步骤:
1. 阅读 `src/frontend/pdf-viewer/docs/SPEC/SPEC-HEAD-pdf-viewer.json`
2. 先写测试（≥2条）：装配层调用 + destroy 清理
3. 抽模块并保持依赖注入清晰（禁止跨域 import 内部实现）
4. 跑：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath ... -i`
5. 提交 git，记录 commit hash
### 工作结果:
- [待填写]
### 存在问题:
- [待填写]
### 下一步计划:
- [待填写]

