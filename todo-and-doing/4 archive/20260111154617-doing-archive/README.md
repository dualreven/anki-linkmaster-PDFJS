# Doing Archive - 20260111154617

本目录归档了 v009 批次中已完成并合入 `main` 的 G/H/I 任务（仅归档任务文档与记录）。

## 合入清单（main）
- G：`b2d77737`（feat: FeatureContext 增加 `eventBus` alias + test）
- H：`98744313`（ncs: bootstrap install summary + contract test）
- I：`eb01c8d2`（docs: FeatureContext 字段约定）
- 任务文档：`5f97a444` `8b2432bf` `e6612b7d` `998fab2a`

## main 门禁（规划者统一复验）
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath src/frontend/common/micro-service/__tests__/feature-context.eventbus-alias.test.js src/frontend/new-card-scheduler/__tests__/bootstrap-install-summary.contract.test.js -i` ✅

