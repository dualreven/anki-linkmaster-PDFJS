# 并行开发合并流程优化方案 (2026-01-07)

## 1. 现状分析
- **架构**: 1 Main + 4 Workers (A/B/C/D) 基于 `git worktree` 并行。
- **流程**: 分发任务 -> 并行开发 -> Main AI 逐个/批量 Cherry-pick -> 测试 -> 合入。
- **痛点**: "Cherry-pick 回来最花时间"。
  - **操作繁琐**: Main AI 需要收集 4 个 Worktree 的 Commit Hash 和对应的测试文件。
  - **重复构建**: 如果分 4 次合入，需要跑 4 次 Lint + Test + Build。
  - **冲突处理**: 并行修改同一文件（如 `todo-and-doing`）导致 cherry-pick 冲突中断。

## 2. 优化策略

### A. 自动化收集 (The Harvester)
不再依赖人工/AI 手动上报 Hash 和 TestPath。开发一个脚本自动扫描所有 Worktree：
1. **自动发现**: 识别所有领先于 `main` 的 Worktree。
2. **智能关联**:
   - 提取最新 Commit Hash。
   - **自动推断测试**:
     - 若提交包含 `*.test.js`，直接加入测试集合。
     - 若提交包含 `src/feature/X.js`，自动检查 `src/feature/X.test.js` 是否存在并加入。
     - 若无法推断，发出警告但继续。
   
### B. 批量车道 (The Batch Lane)
利用 `scripts/merge-fastlane.ps1` 的批量能力，但由“自动化收集”脚本驱动：
- **一次集成**: 将 A+B+C+D 的提交一次性 Cherry-pick 到同一个 `integration` 分支。
- **一次验证**: 运行一次 Lint，运行一次测试集合（去重后的并集）。
- **原子合入**: 要么全过，要么全不过（Fail Fast）。

### C. 冲突规避协议
- **文档分离**: Worker **禁止**在功能 Commit 中修改 `todo-and-doing/` 下的主文件（这会导致 cherry-pick 冲突）。
  - *替代方案*: Worker 仅在本地更新状态，或写入 `AItemp/signals/`（非 Git 追踪）来通知进度。
- **代码隔离**: 尽量确保 A/B/C/D 修改不同模块。

## 3. 新工具：`scripts/sweep_and_merge.ps1`
该脚本将实现上述 A+B 策略。

### 用法
```powershell
./scripts/sweep_and_merge.ps1
```
### 行为
1. 扫描 `../anki-linkmaster-A`, `B`, `C`, `D` 等同级目录（或根据 `git worktree list`）。
2. 发现 A, C 有新提交。
3. 分析 A 的变更：`src/foo.js` -> 自动找到 `src/foo.test.js`。
4. 分析 C 的变更：`src/bar.js` + `src/bar.test.js` -> 加入测试。
5. 生成命令：`./scripts/merge-fastlane.ps1 -Commits HashA,HashC -TestPaths src/foo.test.js,src/bar.test.js`。
6. 执行并输出结果。

## 4. 下一步
我将编写 `scripts/sweep_and_merge.ps1` 并更新开发文档。
