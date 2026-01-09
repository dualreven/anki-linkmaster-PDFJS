# 任务说明（F）- DOMElementManager 缺失元素报错契约（P2）

## 0. 任务目标
为 `DOMElementManager` 增加“缺失元素”时的清晰报错契约，减少 silent null 传播导致的面条式 NPE：
- 在初始化阶段集中校验关键元素是否存在；缺失时抛出明确错误信息（Fail-Fast）。

## 1. 范围限制
- 仅允许修改：
  - `src/frontend/pdf-viewer/ui/dom-element-manager.js`（或同目录相关文件）
  - `src/frontend/pdf-viewer/ui/__tests__/**`
- 不要修改 `.kilocode/rules/memory-bank/**`。

## 2. 交付标准（DoD）
- 新增测试：构造最小 DOM（故意缺一个元素），断言抛出包含元素 id 的错误信息。
- 不影响现有正常初始化路径（在完整 DOM 下不应抛错）。
- 门禁：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath <测试> -i`

## 3. 提交要求
- 1 个 commit（代码+测试）。
- 更新 `todo-and-doing/1 doing/20260109191340-dom-element-manager-contract-F/working-log.md`。

