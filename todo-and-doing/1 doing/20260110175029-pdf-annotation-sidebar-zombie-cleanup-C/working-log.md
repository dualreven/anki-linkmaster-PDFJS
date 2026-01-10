# 20260110175029-pdf-annotation-sidebar-zombie-cleanup-C 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 17:50:29
### 工作内容:
- 清理 sidebar Zombie Code，并补回归测试保证“仅 store 驱动”。
### 工作步骤:
1. 定位 sidebar 当前真实使用的订阅入口（store subscribe）
2. 移除 subscriptions.js 中无效 CRUD handlers 或彻底删除文件并修正引用
3. 新增 Jest：更新 store → 断言 sidebar render 更新
### 工作结果:
- 待开始
### 存在问题:
- 待开始
### 下一步计划:
- 实现并提交（附测试路径）

