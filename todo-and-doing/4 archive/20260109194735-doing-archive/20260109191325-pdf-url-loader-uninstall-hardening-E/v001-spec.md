# 任务说明（E）- PDFUrlLoaderFeature uninstall/cleanup 加固（P2）

## 0. 任务目标
补齐 `pdf-url-loader` 的卸载清理，确保 uninstall 后不会残留订阅/重复响应：
- uninstall 必须对称解除 install 中注册的所有 EventBus 订阅。
- uninstall 后再 emit 相关事件，不应触发 url-loader 的 handler。

## 1. 范围限制
- 仅允许修改：
  - `src/frontend/pdf-viewer/features/pdf-url-loader/**`
- 不要修改 `.kilocode/rules/memory-bank/**`。

## 2. 交付标准（DoD）
- 新增回归测试：install -> uninstall -> emit（URL_PARAMS.REQUESTED / FILE.LOAD.SUCCESS 等），断言 handler 不再执行。
- 门禁：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath <测试> -i`

## 3. 提交要求
- 1 个 commit（代码+测试）。
- 更新 `todo-and-doing/1 doing/20260109191325-pdf-url-loader-uninstall-hardening-E/working-log.md`。

