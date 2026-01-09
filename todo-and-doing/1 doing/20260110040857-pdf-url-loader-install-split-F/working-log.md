# 20260110040857-pdf-url-loader-install-split-F 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 04:08:57
### 工作内容:
- 初始化任务（未开始编码）。
### 工作步骤:
1. 先写 parse-url-load-request 的最小回归测试（非法参数必须 throw）
2. 拆分 install：deps 解析 / 纯函数解析 / coordinator 调度
3. 确保 destroy/uninstall 对称清理（不残留订阅/监听）
4. 自验：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath ... -i`
### 工作结果:
- 待执行
### 存在问题:
- 待记录
### 下一步计划:
- 交付 commit hash

