# New Card Scheduler - 启动入口对齐（新增 index.js + 切换 index.html 引用）

**功能ID**: 20260111005401-ncs-bootstrap-entrypoint-and-index-html-F  
**优先级**: 高（P0：启动范式对齐的入口前置）  
**版本**: v001  
**创建时间**: 2026-01-11 00:54  
**状态**: 设计中  

## 现状说明
- `pdf-home` / `pdf-viewer` 采用 “index.js 入口 + bootstrap 模块” 的启动范式。
- `new-card-scheduler` 当前 `index.html` 直接引用 `./main.js`（脚本式手工装配），尚未迁移到统一范式。

## 提出需求
1) 新增 `src/frontend/new-card-scheduler/index.js` 作为统一入口（对齐 pdf-home/pdf-viewer）：
   - 负责：DOMContentLoaded/readyState 判定 + 调用 bootstrap runner
   - 禁止：在入口里直接手工装配 planner（应委托 bootstrap 模块）
2) 修改 `src/frontend/new-card-scheduler/index.html`：把 `<script type="module" src="./main.js">` 改为引用 `./index.js`。

## 解决方案（建议）
- 参考：`src/frontend/pdf-home/index.js` 的结构（环境判定 + startApp + DOMContentLoaded）。
- `index.js` 调用（由 G 任务提供）：
  - `bootstrapNewCardSchedulerAppFeature()`（命名可对齐 `pdf-viewer` 的 `bootstrapPDFViewerAppFeature`）
- 失败时应 fail-fast：日志 + toast（沿用现有 logger/notification 体系）。

## 约束条件（隔离：写死 scope，禁止重叠）
### 允许修改/新增（仅限）
- 修改：`src/frontend/new-card-scheduler/index.html`
- 新增：`src/frontend/new-card-scheduler/index.js`

### 禁止修改
- 禁止修改：`src/frontend/new-card-scheduler/main.js`
- 禁止修改：`src/frontend/new-card-scheduler/bootstrap/**`、`src/frontend/new-card-scheduler/features/**`（由 G/H 负责）
- 禁止修改：`.kilocode/rules/memory-bank/**`

## 完成定义（DoD）
- 必须提交 git，并提供 commit hash（没有 hash 不算完成）。
- 通过最小门禁：
  - `pnpm -s run lint`
  - Jest（本任务新增测试）：
    - 新增 `src/frontend/new-card-scheduler/__tests__/entrypoint-index-html.contract.test.js`
    - 断言 `index.html` 中 module script 指向 `./index.js`（读取文件内容即可）。

