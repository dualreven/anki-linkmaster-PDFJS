# 20260111005401-ncs-bootstrap-entrypoint-and-index-html-F 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-11 00:54
### 工作内容:
- 为 new-card-scheduler 增加统一入口 `index.js`，并切换 `index.html` 引用以对齐 bootstrap 范式。
### 工作步骤:
1. 新增 `src/frontend/new-card-scheduler/index.js`（只负责启动/错误处理/调用 bootstrap runner）。
2. 修改 `src/frontend/new-card-scheduler/index.html` 指向 `./index.js`。
3. 新增 Jest：`entrypoint-index-html.contract.test.js`。
### 工作结果:
- 已完成：新增入口 `index.js` 并切换 `index.html` 引用；新增 Jest 回归测试校验引用指向。
### 下一步计划:
- 提交 commit hash + 贴出 lint/jest 通过结论。

## 工作记录2
**时间**: 2026-01-11 01:12
### 工作内容:
- 新增 `src/frontend/new-card-scheduler/index.js` 作为启动入口，并将 `index.html` 的 module script 从 `./main.js` 切换为 `./index.js`；补齐回归测试。
### 关键变更:
- `src/frontend/new-card-scheduler/index.js`：按统一范式处理 DOM readiness，并在失败时 logger+toast fail-fast
- `src/frontend/new-card-scheduler/index.html`：引用入口改为 `./index.js`
- `src/frontend/new-card-scheduler/__tests__/entrypoint-index-html.contract.test.js`：断言 index.html 指向 `./index.js`
### 验收命令与结果:
1) `pnpm -s run lint` ✅
2) `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/entrypoint-index-html.contract.test.js -i` ✅
### 提交:
- commit: `9265acf6`
