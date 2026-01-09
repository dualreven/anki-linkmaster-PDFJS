# 任务说明（C）- NavigationService options 接线收敛（P2）

## 0. 任务目标
第5轮已经把 `post-ready delay` 做成 `NavigationService` 的 options。本任务要把 options 的来源“接线收敛”，避免散落魔法默认值：
- 在 infra-nav-core 的 feature/安装入口统一构建 `NavigationService` options（集中一处）。
- 为测试提供可注入的 options（让测试不用靠 monkey patch）。

## 1. 范围限制
- 仅允许修改：
  - `src/frontend/pdf-viewer/features/infra-nav-core/**`
- 不要修改 `.kilocode/rules/memory-bank/**`。

## 2. 交付标准（DoD）
- options 构建集中到一个函数/模块（例如 `createNavigationOptions(context)`）。
- 新增回归测试：注入 `postPageReadyDelayMs=0` 时，相关流程仍稳定（可直接复用现有测试或新增一个小测试）。
- 门禁：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath <你新增/修改的测试> -i`

## 3. 提交要求
- 1 个 commit（代码+测试）。
- 更新 `todo-and-doing/1 doing/20260109223435-navigation-options-wiring-C/working-log.md`。

