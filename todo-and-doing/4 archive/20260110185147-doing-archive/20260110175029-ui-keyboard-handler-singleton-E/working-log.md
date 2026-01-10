# 20260110175029-ui-keyboard-handler-singleton-E 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 17:50:29
### 工作内容:
- KeyboardHandler 防重复注册与 destroy 清理，补回归测试。
### 工作步骤:
1. 梳理 setup/destroy 路径与现有 DOM 监听注册点
2. 增加 guard + 明确 cleanup
3. 新增 Jest：重复 setup 仅注册一次；destroy 后移除监听
### 工作结果:
- 待开始
### 存在问题:
- 待开始
### 下一步计划:
- 实现并提交（附测试路径）

## 工作记录2
**时间**: 2026-01-10 18:15
### 工作内容:
- 增加全局单例守卫：不允许多个 `KeyboardHandler` 同时占用全局 keydown 监听（第二个实例 `setupEventListener()` 直接 throw，Fail-Fast 暴露生命周期错误）。
- 保持清理对称：`removeEventListener()` / `destroy()` 解除监听后释放全局占用，允许后续实例重新 setup。
- 新增回归测试覆盖“多实例 setup 必 throw；destroy 后允许再次 setup”。

### 改动范围:
- `src/frontend/pdf-viewer/ui/keyboard-handler.js`
- `src/frontend/pdf-viewer/ui/__tests__/keyboard-handler.leak-guard.test.js`

### 自验:
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/ui/__tests__/keyboard-handler.leak-guard.test.js -i` ✅

### 工作结果:
- 已完成：`4525a3b37b6be21f78f92a22ab927cacd43fe606`
