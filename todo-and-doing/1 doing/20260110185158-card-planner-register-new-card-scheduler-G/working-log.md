# 20260110185158-card-planner-register-new-card-scheduler-G 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 18:51
### 工作内容:
-（待执行）为 new-card-scheduler 增加 MsgCenter 注册（新协议），修复 Step3 pending-forward 不 flush。
### 工作步骤:
1) 新增 ws-registration wiring：连接建立后发送 `client:register:requested`
2) main.js 安装 wiring（避免堆逻辑）
3) Jest：断言注册消息结构与 no-`to`
### 工作结果:
-（待执行）
### 存在问题:
-（待执行）
### 下一步计划:
-（待执行）提交 commit hash + 测试命令

