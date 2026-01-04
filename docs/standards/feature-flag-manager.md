# FeatureFlagManager 说明

目标：将 `src/frontend/common/micro-service/feature-flag-manager.js` 控制在 ≤500 行，并把长说明/示例外移到文档。

## 功能
- 从 JSON 配置加载 feature flags。
- 运行时查询 `isEnabled(flagName, context?)`，并支持按环境/用户/百分比等条件启用。

## 关联模块
- Feature 装配：`src/frontend/common/micro-service/feature-registry.js`
- 日志：`src/frontend/common/utils/logger.js`

## 用法示例（简版）
```js
import { FeatureFlagManager } from "src/frontend/common/micro-service/feature-flag-manager.js";

const flagManager = new FeatureFlagManager();
await flagManager.loadFromConfig("./feature-flags.json");
if (flagManager.isEnabled("pdf-sorter")) {
  // register feature...
}
```

