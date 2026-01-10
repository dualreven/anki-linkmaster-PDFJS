# 20260111015251-doing-archive

## 归档内容（v006：NCS 启动范式对齐）

- 任务目录：
  - `20260111005401-ncs-bootstrap-entrypoint-and-index-html-F`
  - `20260111005401-ncs-bootstrap-feature-runner-G`
  - `20260111005401-ncs-main-export-and-autoboot-guard-H`
  - `20260111005401-ncs-bootstrap-lifecycle-tests-I`
- 合并方式：已在 `main` 通过 cherry-pick 合入（保留原提交信息）。
- 回归测试：已新增并通过（见各任务目录的 `working-log.md` 与 `src/frontend/new-card-scheduler/__tests__/`）。

## 验收命令（本次归档对应）

- `pnpm -s run lint`
- `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/entrypoint-index-html.contract.test.js src/frontend/new-card-scheduler/__tests__/bootstrap-runner.contract.test.js src/frontend/new-card-scheduler/__tests__/main-export.contract.test.js src/frontend/new-card-scheduler/__tests__/bootstrap-lifecycle.contract.test.js -i`

