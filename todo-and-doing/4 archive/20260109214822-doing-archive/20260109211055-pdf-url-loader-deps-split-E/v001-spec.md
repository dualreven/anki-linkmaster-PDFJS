# 任务说明（E）- PDFUrlLoaderFeature 依赖解析/安装拆分（P2）

## 0. 任务目标
继续把 `pdf-url-loader` 的 `install()` 收敛为 wiring：
- 把依赖解析（eventBus/navigationService/wsClient 等）抽成独立函数/模块；
- `install()` 只做：解析依赖 → 注册订阅 → 启动必要流程；
- 保持 Fail-Fast：缺必要依赖直接 throw。

## 1. 范围限制
- 仅允许修改：
  - `src/frontend/pdf-viewer/features/pdf-url-loader/**`
- 不要改 `.kilocode/rules/memory-bank/**`。

## 2. 交付标准（DoD）
- 拆出 `resolveDependencies(...)`（或等价命名），并补单测覆盖：
  - 缺 eventBus / 缺 navigationService 等关键依赖必须 throw（消息清晰）
  - 正常路径能返回一致结构并被 install 使用
- 门禁：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/features/pdf-url-loader/__tests__/url-navigation-feature.test.js -i`

## 3. 提交要求
- 1 个 commit（代码+测试）。
- 更新 `todo-and-doing/1 doing/20260109211055-pdf-url-loader-deps-split-E/working-log.md`。

