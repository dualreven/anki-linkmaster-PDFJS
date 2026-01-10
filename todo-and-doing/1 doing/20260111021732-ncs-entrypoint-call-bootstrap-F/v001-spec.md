# New Card Scheduler - 入口必须调用 bootstrap（修复空白/未注册）

**功能ID**: 20260111021732-ncs-entrypoint-call-bootstrap-F  
**优先级**: P0（当前新卡片规划器不可用）  
**版本**: v001  
**创建时间**: 2026-01-11 02:17  
**状态**: doing  

## 用户现象（必须复现/对齐）
- 新卡片规划器窗口打开后只有基础布局，功能区不工作。
- `CardPlanner测试: 注入样例草稿卡` 返回 `202 pending-forward`：`未找到目标客户端 new-card-scheduler`（说明窗口侧未完成注册/未真正启动）。

## 根因假设（用于指导修复）
- `src/frontend/new-card-scheduler/index.js` 当前仅 `import("./main.js")`，但 `main.js` 已按 v006 改为“可导入模块、禁止自启动”，因此入口没有真正启动 bootstrap/feature，导致 UI 未 mount + WS 未 connect/注册。

## 需求 / 交付
1) 修复入口：`src/frontend/new-card-scheduler/index.js` 必须调用 v006 bootstrap：
   - 调用：`bootstrapNewCardSchedulerAppFeature(...)`（来源：`src/frontend/new-card-scheduler/bootstrap/app-bootstrap-feature.js`）
   - 入口应对齐 `pdf-home/index.js` 的启动风格：DOMContentLoaded/readyState 判定、失败 toast+日志、fail-fast。
2) 必须补回归测试：防止再次出现“入口仅 import main 导致空白”。

## 约束（隔离 scope，禁止重叠）
### 允许修改/新增（仅限）
- 修改：`src/frontend/new-card-scheduler/index.js`
- 新增测试：`src/frontend/new-card-scheduler/__tests__/entrypoint-bootstrap-mount.contract.test.js`

### 禁止修改
- 禁止修改：`src/frontend/new-card-scheduler/main.js`（H 负责）
- 禁止修改：`src/frontend/new-card-scheduler/bootstrap/**`、`features/**`（G 负责）
- 禁止修改：`.kilocode/rules/memory-bank/**`

## 回归测试建议（DoD 必须满足）
- Jest：`pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/entrypoint-bootstrap-mount.contract.test.js -i`
  - 测试目标：在 jsdom 里构造必要 DOM，加载 `index.js` 后应能把 planner UI mount 到 `#planner-workspace`（至少 `childElementCount > 0`），从而证明入口确实走 bootstrap。

## 完成定义（DoD）
- 必须提交 git，并在 `working-log.md` 写明 **commit hash**（没有 hash 不算完成）。
- `pnpm -s run lint` 必须通过。
- 上述 Jest 定向测试必须通过。

