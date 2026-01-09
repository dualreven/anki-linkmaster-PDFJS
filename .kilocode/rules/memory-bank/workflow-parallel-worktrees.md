# 并行开发与调度流程（A~F worktree）

目的：把“并行开发 + 快速验收合入”的协作方式标准化，减少冲突、减少重复沟通、提升合并速度。

## 1. 角色与职责

### 1.1 调度者（main 侧验收合入的人）
- 维护唯一基线：`main` 永远是最新可运行基线；旧分支/旧 worktree 允许被单向覆写（`reset --hard main`）。
- 下发任务：在 `todo-and-doing/1 doing/<YYYYMMDDhhmmss>-<topic>-<Owner>/` 生成任务文档（`v001-spec.md` + `working-log.md`），并提交到 `main`。
- 同步任务：把 `main` 的任务/规范同步到所有 worktree（通常用 `git reset --hard main`）。
- 验收合入：收集各 worktree 的提交 → 按 worktree 分批 `cherry-pick` 合入 → 跑门禁 → 归档 doing → 同步回 worktree。
- 统一写 memory-bank：验收合入时在 `main` 统一更新 `.kilocode/rules/memory-bank/**`（避免多人同时改导致冲突）。
- 过程留痕：每轮必须写 `AItemp/*-AI-Working-log.md`，并在结束时 `notify-tts "…已完成,请检查结果"`。

### 1.2 执行者（A/B/C/D/E/F worktree 的 AI）
- 只做自己任务范围内的改动（任务文档明确的目录/文件）。
- 必须补一条防回归测试（除非任务明确“只读扫描/只产出报告”）。
- 必须本地自验：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath <测试文件> -i`。
- 只更新自己的 `todo-and-doing/.../working-log.md`，**不要修改** `.kilocode/rules/memory-bank/**`（由 main 侧统一更新）。
- 交付时回报：commit hash + 测试命令 + 是否需要手工点检项。

## 2. 任务拆分原则（让并行真正不互相干扰）
- **按目录边界拆分**：一个 worktree 只改一个 feature 或一个子目录（例如 `infra-nav-core`、`pdf-outline`、`pdf-url-loader`）。
- **控制任务颗粒度**：目标 10~20 分钟可完成；若超过，拆为两轮任务（先止血/加测试，再重构）。
- **P0 单点负责**：严重 bug（P0）只给一个 worktree（例如 D）负责，其他 worktree 不碰相关代码，避免交叉修改。
- **避免共享文件冲突**：默认禁止多 worktree 同时改：
  - `.kilocode/rules/memory-bank/**`
  - `todo-and-doing/**`（除“自己任务目录的 working-log”）
  - 全局常量/白名单/基础设施文件（如必须改，先单独立任务并冻结其他改动）

## 3. 提交流程（执行者侧）
1. 从最新 `main` 开始（若不是，先同步：`git reset --hard main`）。
2. 完成任务代码 + 单测（严格 Fail-Fast，不做兜底）。
3. 跑门禁：
   - `pnpm -s run lint`
   - `pnpm exec jest --runTestsByPath <新增/修改测试文件> -i`
4. 提交 1~2 个 commit（尽量：一个 commit 即包含修复 + 测试）。
5. 更新自己任务目录的 `working-log.md`（写根因/修复点/测试命令/commit hash）。

## 4. 验收合入流程（调度者侧）
1. 收集差异：
   - `git -C <worktree> log --oneline main..HEAD`
2. 按 worktree 分批合入（可回溯）：
   - `git cherry-pick <hashes...>`
3. 只在 `main` 跑门禁（最小集合）：
   - `pnpm -s run lint`
   - `pnpm exec jest --runTestsByPath <本轮相关测试> -i`
4. 归档已完成 doing：
   - `git mv todo-and-doing/1 doing/<task> todo-and-doing/4 archive/<ts>-doing-archive/`
5. 同步各 worktree 到 `main`：
   - `git -C <worktree> reset --hard main`
6. 统一更新 memory-bank（只在 `main`）：
   - `context.md` 记录本轮合入摘要、门禁结果、手工点检发现
   - 如涉及架构/用法变更，再更新 `architecture.md` / `tech.md`

## 5. 手工点检协作（最小闭环）
- 调度者提供“点检清单”（3~6 条具体操作路径）。
- 用户点检后只反馈“复现步骤 + 报错文本/截图”。
- 调度者据此生成下一轮任务（优先 P0 单点负责），并再次同步到各 worktree。

## 6. 常见提速点（经验）
- 大多数冲突来自多人同时改 `memory-bank` 与 `todo-and-doing`：因此本流程强制“执行者不改 memory-bank”。
- 合并不要 rebase：执行者提交即可；调度者按 worktree `cherry-pick`，保持可回溯与可定位。
- 门禁跑最小集合：`lint` + `jest --runTestsByPath`，避免全量测试拖慢合入节奏。

