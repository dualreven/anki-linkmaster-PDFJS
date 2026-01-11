# NCS - 修复 legacy feature 安装失败（context.eventBus 缺失）

**功能ID**: 20260111131008-ncs-legacy-feature-context-eventbus-F  
**优先级**: P0（当前窗口功能不可用）  
**版本**: v001  
**创建时间**: 2026-01-11 13:10  
**状态**: doing  

## 用户现象（已截图）
- 控制台日志：
  - `[new-card-scheduler.bootstrap] Feature installation failed: new-card-scheduler.legacy`
  - `LegacyNewCardSchedulerFeature.install: context.eventBus 缺失`
- 结果：Installed 0/1 features，新卡片规划器只剩基础布局、功能不可用、无法注册。
- 404（favicon）用户说明可忽略，本任务不处理。

## 根因判断（对齐现有框架契约）
- `FeatureRegistry` 传入的 FeatureContext 字段为 `context.globalEventBus`（项目内已有大量 Feature 这么用）。
- 但 `src/frontend/new-card-scheduler/features/legacy/legacy-feature.js` 当前错误地检查/使用 `context.eventBus`，导致 install fail。

## 需求 / 交付
1) 修复 `LegacyNewCardSchedulerFeature.install(context)`：
   - 以 `context.globalEventBus` 为准（必要时同步更新错误信息文案）。
   - Fail-fast：若 `context.globalEventBus` 缺失应抛错（禁止兜底）。
2) 必须补一条防回归测试，锁住“legacy feature 在 FeatureRegistry 上下文中可成功安装”。
   - 重点：这次 bug 之所以漏掉，是因为现有 `bootstrap-runner.contract.test.js` 只断言 `destroy()` 存在，并不要求 feature 安装成功。

## 约束（隔离 scope，禁止重叠）
### 允许修改/新增（仅限）
- 修改：`src/frontend/new-card-scheduler/features/legacy/legacy-feature.js`
- 新增或修改测试（任选其一，建议新增以减少冲突）：
  - `src/frontend/new-card-scheduler/__tests__/bootstrap-runner.install-legacy.contract.test.js`
  - 或修改现有：`src/frontend/new-card-scheduler/__tests__/bootstrap-runner.contract.test.js`（增加“安装成功”的断言）

### 禁止修改
- 禁止修改：`src/frontend/new-card-scheduler/index.js`、`src/frontend/new-card-scheduler/main.js`
- 禁止修改：`.kilocode/rules/memory-bank/**`

## 测试建议（DoD 必须满足）
- `pnpm -s run lint`
- Jest（定向，至少其一）：
  - `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/bootstrap-runner.install-legacy.contract.test.js -i`
  - 或 `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/bootstrap-runner.contract.test.js -i`
- “安装成功”的断言建议：
  - 传入 `notification={ showInfo: jest.fn(), showError: jest.fn() }`
  - 断言 `showInfo` 至少被调用一次（legacy feature install 末尾会 toast “窗口已启动”）

## 完成定义（DoD）
- 必须提交 git，并在 `working-log.md` 写明 **commit hash**（没有 hash 不算完成）。
- 必须补回归测试（修过的 bug 必须写测试）。

