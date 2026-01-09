# 任务说明（C）- NavigationService “魔法延时”可配置化（P2）

## 0. 任务目标
把 `NavigationService.navigateTo()` 里的固定等待（例如 `setTimeout(100)`）改成可配置参数：
- 默认行为不变（仍等 100ms），但通过 options 可调整/在测试中设为 0；
- 避免把这种“等待 hack”散落为魔法数字，降低面条化风险。

## 1. 范围限制
- 仅允许修改：
  - `src/frontend/pdf-viewer/features/infra-nav-core/services/navigation-service.js`
  - `src/frontend/pdf-viewer/features/infra-nav-core/__tests__/**`
- 不要改 `.kilocode/rules/memory-bank/**`。

## 2. 交付标准（DoD）
- 新增 options（例如 `postPageReadyDelayMs`）并使用默认值 100。
- 新增回归测试：把 delay 设为 0，验证 `navigateTo` 不依赖真实等待也能通过关键流程（可用 fake timers）。
- 门禁：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath <测试> -i`

## 3. 提交要求
- 1 个 commit（代码+测试）。
- 更新 `todo-and-doing/1 doing/20260109211040-navigation-magic-delay-config-C/working-log.md`。

