# Working Log - 20260111144355-ncs-bootstrap-install-summary-H

## 目标
- NCS bootstrap 输出安装摘要，并对失败进行 toast 提示（不改变“失败不阻塞其他 feature”）。

## 交付
- Commit: （必填）

## 自检
- `pnpm -s run lint`：
- `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/bootstrap-install-summary.contract.test.js -i`：

