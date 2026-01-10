# 20260111005401-ncs-main-export-and-autoboot-guard-H 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-11 00:54
### 工作内容:
- 把 `main.js` 从“脚本式自启动装配”改为“可导出、可调用、可卸载”的模块，供 feature-based bootstrap 调用。
### 工作步骤:
1. 提取/导出 createApp/legacyBootstrap API，返回 `{ destroy() }`。
2. 移除/关闭自启动（避免双启动）。
3. 新增 Jest：`main-export.contract.test.js`。
### 工作结果:
- （待实现）
### 下一步计划:
- 提交 commit hash + 贴出 lint/jest 通过结论。

