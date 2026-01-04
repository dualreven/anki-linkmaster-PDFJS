# PDFHomeAppV2（pdf-home 应用装配层）说明

目的：让 `src/frontend/pdf-home/core/pdf-home-app-v2.js` 保持为“装配/生命周期/对外 API”文件，避免继续面条化；细节集中在可复用的小模块中。

## 设计边界（必须遵守）
- `PDFHomeAppV2`：只负责创建核心组件、注册全局服务、安装/卸载 features、暴露启动/销毁生命周期方法。
- Feature 列表：由工厂函数集中返回，避免主文件堆积 import 与长数组。
- Fail-Fast：关键依赖缺失/初始化失败应明确报错，不做静默兜底。

## 关键文件（从这里开始看）
- 主入口：`src/frontend/pdf-home/core/pdf-home-app-v2.js`
- Feature 列表工厂：`src/frontend/pdf-home/core/pdf-home-app-v2-features.js`
- 回归测试（锁定 features 组成）：`src/frontend/pdf-home/__tests__/pdf-home.app-v2.features-factory.test.js`

## 为什么要把 features 抽离成工厂
- 让主文件的“启动流程”可一眼读完（减少面条度与 diff 噪声）。
- 让 features 列表变更具备稳定测试锚点（防止误删/误加）。
- 便于未来按场景（开发/生产/能力集）分组生成 features，而不污染主入口。

