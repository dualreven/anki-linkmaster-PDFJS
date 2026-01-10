# 20260111005401-ncs-bootstrap-entrypoint-and-index-html-F 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-11 00:54
### 工作内容:
- 为 new-card-scheduler 增加统一入口 `index.js`，并切换 `index.html` 引用以对齐 bootstrap 范式。
### 工作步骤:
1. 新增 `src/frontend/new-card-scheduler/index.js`（只负责启动/错误处理/调用 bootstrap runner）。
2. 修改 `src/frontend/new-card-scheduler/index.html` 指向 `./index.js`。
3. 新增 Jest：`entrypoint-index-html.contract.test.js`。
### 工作结果:
- （待实现）
### 下一步计划:
- 提交 commit hash + 贴出 lint/jest 通过结论。

