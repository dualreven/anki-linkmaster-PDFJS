# OutlineFeature 装配层减肥规格说明

**功能ID**: 20260107015710-outline-decompose-D  
**优先级**: 低  
**版本**: v001  
**创建时间**: 2026-01-07 01:57:10  
**状态**: 设计中

## 现状说明
- `src/frontend/pdf-viewer/features/pdf-outline/index.js` 仍包含较多装配细节（WS 消费、初始化流程、CRUD、导航等多个职责混在一个文件中）。

## 存在问题
- 职责集中导致阅读/修改成本高，容易引入回归（面条风险）。

## 提出需求
- 仅做“装配层减肥”：把长函数/长流程拆到 `services/` 或 `outline-*.js`，让 `index.js` 更像 composition root。
- 行为保持不变，现有测试必须继续通过；如拆分引入行为变化，必须新增回归测试。

## 解决方案
- 提取/拆分方向（示例）：
  - `outline-ws-consumer.js`：只负责消费 WS message 并更新 manager + 触发 refresh；
  - `outline-lifecycle.js`：install/uninstall 生命周期与 container 注册；
  - 保留对外入口：`index.js` 导出 `OutlineFeature` 不变。

## 约束条件
### 仅修改本模块代码
仅修改 `src/frontend/pdf-viewer/features/pdf-outline/**`。

## 可行验收标准
- `pnpm -s run lint` 通过
- `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/features/pdf-outline/__tests__/init-import.mock.test.js src/frontend/pdf-viewer/features/pdf-outline/__tests__/outline-load-success-dedupe.test.js -i` 通过（必要时补充本任务新增测试并一并执行）

## 协作协议（并行开发提速版，必须遵守）
（见 `todo-and-doing/3 template/v001-spec-template.md` 的同名章节；本任务必须完整遵守）

