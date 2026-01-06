# 并行合入 Fastlane（B）

**功能ID**: 20260106232020-refactor-merge-fastlane-B  
**优先级**: 高  
**版本**: v001  
**创建时间**: 2026-01-06 23:20:20  
**预计完成**: 2026-01-07  
**状态**: 设计完成 / 待开发  

## 提出需求
- 把“并行开发→合入 main”的沟通与操作标准化，目标是把合入耗时从“几十分钟”压到“几分钟”。

## 交付内容
- 增加一个集成脚本（PowerShell）：
  - 输入：A/B/C/D 的 commit hash（或一个 merge-queue 文件）
  - 动作：创建 integration 分支 → 批量 cherry-pick → 跑 lint → 跑指定测试文件集合 → 输出报告
- 增加一个 merge-queue 文档模板（可选），用于 AI 填写 DoD 信息。

## 约束条件
- 仅改动 `scripts/` 与 `todo-and-doing/` 文档（如需），不触碰业务代码。
- 脚本输出必须 UTF-8，换行 `\n`，失败必须 fail-fast（退出码非 0）。

## 可行验收标准
- `pnpm -s run lint` 通过
- 脚本在本机可运行，且对无冲突的 commit 列表能一键完成合入验证（dry-run 模式加分）

## 协作协议（并行开发提速版，必须遵守）
见 `todo-and-doing/3 template/v001-spec-template.md` 的“协作协议”章节。

