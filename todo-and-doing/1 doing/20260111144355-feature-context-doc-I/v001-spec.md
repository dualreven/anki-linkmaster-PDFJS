# Docs - FeatureContext 字段约定与任务报告规范（补文档）

**功能ID**: 20260111144355-feature-context-doc-I  
**优先级**: P2（避免重复踩坑，提升协作一致性）  
**版本**: v001  
**创建时间**: 2026-01-11 14:43  
**状态**: doing  

## 需求
1) 新增一份短文档，明确 FeatureContext 的字段约定：
   - `globalEventBus`（标准字段）
   - `eventBus`（别名字段，若存在应等同 globalEventBus）
   - 其他常见字段（container/scopedEventBus/logger/config）
2) 文档中明确“worktree 任务必须提交 report.md（含 commit hash + lint/test 结果）”的规范。

## 约束（严格隔离 scope）
### 允许修改/新增（仅限）
- 新增：`docs/standards/feature-context.md`

### 禁止修改
- 禁止修改：`src/**`
- 禁止修改：`.kilocode/rules/memory-bank/**`

## 交付物（必须提交到 git）
- 文档文件
- `report.md`（必须提交）：含 scope、lint 结果、commit hash

## 验收标准（DoD）
- `pnpm -s run lint` ✅（只要能跑就跑，记录到 report）
- git 提交：提供 **commit hash**，工作区干净

