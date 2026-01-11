# Report - 20260111144355-ncs-bootstrap-install-summary-H

## Scope（按 v001-spec，严格隔离）
- 修改：`src/frontend/new-card-scheduler/bootstrap/app-bootstrap-feature.js`
- 新增：`src/frontend/new-card-scheduler/__tests__/bootstrap-install-summary.contract.test.js`

## 交付
- 交付 commit：`ac87790a`

## 自检
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/bootstrap-install-summary.contract.test.js -i` ✅

## 结果摘要
- `installAll()` 后输出人类可读安装摘要（registered/installed/failed）。
- 若存在失败 feature：toast `有 feature 安装失败（详见日志）`（不改变“失败不影响其他 feature”的策略）。

