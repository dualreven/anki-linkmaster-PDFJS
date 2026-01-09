# 任务说明（E）- PDFUrlLoaderFeature.install 职责收敛（P2）

## 0. 任务目标
对 `PDFUrlLoaderFeature.install` 做一次“小步收敛”，把明显的职责混杂拆成可测的小函数/小对象：
- `install()` 只做 wiring（订阅/注入/启动），不要把参数解析、网络调用、事件发射全部塞在一个大函数里。

## 1. 范围限制
- 仅允许修改：
  - `src/frontend/pdf-viewer/features/pdf-url-loader/**`
  - 对应测试目录（如不存在可新建 `__tests__`）
- 不要跨目录改 infra-nav 等其他 feature（避免冲突）。
- **不要修改** `.kilocode/rules/memory-bank/**`。

## 2. 交付标准（DoD）
- `install()` 内部逻辑拆成 2~3 个纯函数/小模块（例如：依赖解析、URL 参数解析、文件加载协调）。
- 新增回归测试：至少覆盖“缺少必要依赖/参数非法”时 **明确 throw**（禁止兜底），以及“合法参数”时发射预期事件/调用预期依赖。
- 门禁通过：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath <测试> -i`

## 3. 提交要求
- 提交 1 个 commit（重构 + 测试）。
- 更新 `todo-and-doing/1 doing/20260109175640-pdf-url-loader-install-slim-E/working-log.md`。

