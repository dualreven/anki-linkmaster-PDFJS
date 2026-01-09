# Working Log（E）- 20260109175640-pdf-url-loader-install-slim-E

## 1. 结论摘要
- 拆分点：`install` 现在只做日志配置、依赖解析与事件监听注册，其余职责由 `#resolveDependencies`、`#processUrlParams` 与 `#maybeEmitFileLoad` 等私有方法负责，保证每个函数保持单一职责。
- 行为变化：缺少 EventBus/NavigationService 会立即抛错；当 URL 参数验证失败时会 emit `URL_PARAMS.FAILED` 并抛出错误（禁止静默兜底），`PDF.LOAD.REQUESTED` 只在合法参数下触发。
- 回归测试：新增 “参数非法时应该拒绝安装” 用例，验证 validation 失败会 reject，同时保持 “有 pdf-id 参数时” 的加载路径回归。

## 2. 验证记录
- [x] `pnpm -s run lint`
- [x] `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/features/pdf-url-loader/__tests__/url-navigation-feature.test.js -i`

## 3. 交付信息
- commit：待补充
