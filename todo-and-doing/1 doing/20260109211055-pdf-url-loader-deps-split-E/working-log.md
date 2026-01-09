# Working Log（E）- 20260109211055-pdf-url-loader-deps-split-E

## 1. 结论摘要
- 拆分点：`install` 现在先通过 `#resolveContainer` 获取 container，再由 `#resolveDependencies` 返回包含 `eventBus` 与 `navigationService` 的结构体；`install` 只负责 wiring（设置 log、解析依赖、注册订阅、触发流程），实现与测试中一致的依赖约束。  
- 行为变化：依赖解析集中在 helper，缺失 `eventBus` 与 `navigationService` 会被 helper 立即抛出，避免后续逻辑进入不完整状态；`install` 本体只关心“依赖准备完毕后”的 payload 处理。  
- 回归测试：继续执行包括“缺少 EventBus”、“缺少 NavigationService”、“参数非法”、“卸载后清理”等用例，包装依赖 fail-fast 场景。

## 2. 验证记录
- [x] `pnpm -s run lint`
- [x] `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/features/pdf-url-loader/__tests__/url-navigation-feature.test.js -i`

## 3. 交付信息
- commit：待补充
