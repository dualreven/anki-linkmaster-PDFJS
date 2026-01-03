# FeatureRegistry（前端 micro-service）

相关源码：
- `src/frontend/common/micro-service/feature-registry.js`：对外入口（注册/安装/卸载/启用/禁用/状态摘要），保持单文件 ≤ 500 行。
- `src/frontend/common/micro-service/feature-record.js`：`FeatureRecord`（内部状态记录）。
- `src/frontend/common/micro-service/feature-registry-validators.js`：功能接口校验（fail-fast）。
- `src/frontend/common/micro-service/feature-registry-deps.js`：依赖检查与安装顺序（拓扑排序/循环检测）。
- `src/frontend/common/micro-service/feature-registry-context.js`：FeatureContext 的创建与清理（ScopedEventBus / scopeId）。

## 对外 API（来自 `feature-registry.js`）

- `FeatureStatus`：注册/安装/禁用/失败等状态枚举
- `class FeatureRegistry`
  - `register(feature)`
  - `has(name)` / `get(name)`
  - `install(name)` / `installAll()`
  - `uninstall(name)`
  - `enable(name)` / `disable(name)`
  - `getRegisteredFeatures()` / `getInstalledFeatures()`
  - `getStatus(name)`
  - `getStatusSummary()`
- `createFeatureRegistry(options)`

## 别名（aliases）

`FeatureRegistry` 内部维护 `old -> canonical` 映射：
- `register/has/get/install/installAll/getStatus/getInstalledFeatures/getStatusSummary` 会走 `#resolveName(...)` 做归一；
- 注意：`uninstall/enable/disable` 当前仍按传入 name 直接取 map（历史行为保留）。

## 安装顺序（拓扑排序）

实现位于 `feature-registry-deps.js`：
- `resolveInstallOrder({ features, resolveName })`：DFS 拓扑排序（先依赖，后被依赖）
- 若检测到循环依赖，抛错：`Circular dependency detected: <canonical>`

## FeatureContext 与 ScopedEventBus

实现位于 `feature-registry-context.js`：
- `scopeId` 优先取 Feature 的静态 `SCOPE_ID`（`constructor.SCOPE_ID` 或 `feature.SCOPE_ID`），否则回退 `featureName`
- uninstall 时会 `cleanupFeatureContext`（销毁 scoped bus + dispose 容器 scope）

## 测试

- 纯逻辑回归（拓扑排序/循环依赖）：`src/frontend/common/micro-service/__tests__/feature-registry-deps.install-order.test.js`
- 既有覆盖：`src/frontend/common/micro-service/__tests__/feature-registry.test.js`、`src/frontend/common/micro-service/__tests__/feature-registry.aliases.test.js`

