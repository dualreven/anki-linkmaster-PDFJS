# 任务说明（E）- pdf-url-loader URL 参数纯函数化（P2）

## 0. 任务目标
继续把 `pdf-url-loader` 的入口逻辑去面条化：
- 把 “读取 URL 参数 → parse/validate → 生成标准化请求对象” 抽成纯函数（无 eventBus/无 DOM/无 wsClient）。
- `install()` 只负责 wiring；纯函数负责决定“要不要触发加载/触发什么”。

## 1. 范围限制
- 仅允许修改：
  - `src/frontend/pdf-viewer/features/pdf-url-loader/**`
- 不要修改 `.kilocode/rules/memory-bank/**`。

## 2. 交付标准（DoD）
- 新增纯函数模块（例如 `url-params/parse-url-load-request.js`，命名不限，但要表达清楚）。
- 单测覆盖：
  - 合法参数产出标准对象
  - 参数缺失/非法必须 throw（Fail-Fast）
- 门禁：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/features/pdf-url-loader/__tests__/url-navigation-feature.test.js -i`（或你的新测试路径）

## 3. 提交要求
- 1 个 commit（代码+测试）。
- 更新 `todo-and-doing/1 doing/20260109223455-pdf-url-loader-params-pure-E/working-log.md`。

