# Card Planner - Final Output Handler（I）规格说明

**功能ID**: 20260110033316-card-planner-final-output-handler-I  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-10 03:33:16  
**预计完成**: 2026-01-10  
**状态**: 开发中  
**负责分支**: `worker/feature-I`

## 真源（必须对齐）
- `docs/contracts/card-planner.md`（7.3 节：Final Output）

## 目标
在 MsgCenter 后端增加一个最小 handler，用于接收并验证 `card-planner:final-output:requested`：
1) 校验 payload：`data.cards` 必须为数组；每项含 `title:string`、`Q:string[]`、`A:string[]`（Fail-Fast）。
2) 返回明确响应：
   - 成功：`card-planner:final-output:completed`
   - 失败：`card-planner:final-output:failed`（含错误原因）
3) 补一条 unit test 覆盖成功/失败分支。

## 约束条件
- 仅修改：`src/backend/msgCenter_server/**`
- 禁止修改：`.kilocode/rules/memory-bank/**`
- 禁止兜底：非法输入必须 failed（400）。

## 验收（DoD）
- `pnpm -s run lint` ✅
- `python -m pytest -q <本任务新增测试文件路径>` ✅

*** Add File: todo-and-doing/1 doing/20260110033316-card-planner-final-output-handler-I/working-log.md
# 20260110033316-card-planner-final-output-handler-I 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 03:33:16
### 工作内容:
- 初始化任务（未开始编码）。
### 工作步骤:
1. 对齐 `docs/contracts/card-planner.md` 7.3
2. 新增 handler + message types + router 绑定
3. 新增 unit test 覆盖成功/失败
4. 验收：lint + pytest by path
### 工作结果:
- 待执行
### 存在问题:
- 待记录
### 下一步计划:
- 完成交付并回填 commit hash

