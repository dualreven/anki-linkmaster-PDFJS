# [card-planner][F] gui_launcher：修复注入测试（to=forward list + 不重复打开窗口）

**功能ID**: 20260110125102-card-planner-gui-launcher-inject-fix-F  
**优先级**: P0（阻塞人工验收）  
**版本**: v001  
**创建时间**: 2026-01-10 12:51:02  
**预计完成**: 2026-01-10  
**状态**: 开发中  
**负责分支**: `worker/refactor-F`（worktree：`C:\Users\napretep\PycharmProjects\anki-linkmaster-F`）

## 背景（已复现）
gui_launcher 注入按钮目前发送：
- `type=card-planner:ingest:requested`
- `to="new-card-scheduler"`（字符串）

被 MsgCenter 拒绝：`to 字符串只能是 'backend'`，导致注入不生效。

另外：点击注入按钮会重复触发打开 new-card-scheduler，出现多窗口（期望全局唯一）。

## 目标
1) 注入消息改为 **forward 路由**：
   - `to=[{"client_id":"new-card-scheduler"}]`
   - MsgCenter 返回 `card-planner:ingest:completed`（“消息已转发…”）即视为注入请求发送成功；
2) 注入按钮不应导致新卡片规划器多开：
   - 允许在 planner 未打开时先发送 `app-window:open:requested`；
   - 但在 planner 已存在时必须仅激活（由 I 的单例任务保障）；F 侧不得制造新的随机 client_id；
3) 更新/新增测试，覆盖 `to` 字段为列表且包含 client_id。

## 约束
- 仅修改：`gui_launcher.py`、`src/gui_launcher/**`
- Fail-Fast：MsgCenter 未监听 / 未找到目标客户端（404: NO_TARGET_FOUND）必须明确日志与弹窗提示。

## 关键实现点
在 `gui_launcher.py::_card_planner_manual_test_inject_sample_draft_cards`：
- 将两条 ingest 消息的 `to` 改为：
  - `to=[{"client_id":"new-card-scheduler"}]`
- 保持 `expect_types=("card-planner:ingest:completed","card-planner:ingest:failed")`（MsgCenter forward 会回 completed/failed）

## 必须新增/更新测试（至少 1 条）
更新现有 pytest：
- `src/gui_launcher/__tests__/test_gui_launcher_card_planner_manual_inject.py`
断言：
- payload `to` 为 list，且首元素包含 `client_id=="new-card-scheduler"`

## 验收（DoD）
- `pnpm -s run lint` ✅（main 侧统一跑）
- `python -m pytest -q src/gui_launcher/__tests__/test_gui_launcher_card_planner_manual_inject.py` ✅
- 手工点检：
  1) `python gui_launcher.py` → 启动后端(Hosted) → 启动新卡片规划器(Hosted)
  2) 点击“Card Planner 测试：注入样例草稿卡”
  3) gui_launcher 日志应出现 `card-planner:ingest:completed`（code=200，消息已转发）
  4) planner 窗口出现卡片且 Q/A 计数变化

*** Add File: todo-and-doing/1 doing/20260110125102-card-planner-gui-launcher-inject-fix-F/working-log.md
# 20260110125102-card-planner-gui-launcher-inject-fix-F 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 12:51:02
### 工作内容:
- 初始化任务（修复注入 to 字段与多窗口问题入口）
### 工作步骤:
1) 注入消息 `to` 改为 `[{client_id:\"new-card-scheduler\"}]`
2) pytest 覆盖 `to` 列表结构
3) 验收：lint + pytest by path
### 工作结果:
- 待执行

*** Add File: todo-and-doing/1 doing/20260110125102-card-planner-new-card-scheduler-singleton-I/v001-spec.md
# [card-planner][I] 后端 Launcher：new-card-scheduler 全局唯一（ensure_* 单例激活）

**功能ID**: 20260110125102-card-planner-new-card-scheduler-singleton-I  
**优先级**: P0（阻塞人工验收；避免多窗口污染）  
**版本**: v001  
**创建时间**: 2026-01-10 12:51:02  
**预计完成**: 2026-01-10  
**状态**: 开发中  
**负责分支**: `worker/feature-I`（worktree：`C:\Users\napretep\PycharmProjects\anki-linkmaster-I`）

## 背景（已复现）
重复触发 `app-window:open:requested`（window_type=new-card-scheduler）会打开第二个窗口。

根因：`src/launcher/runner.py::ensure_new_card_scheduler_hosted()` 当前不做“已存在则激活”的单例逻辑。

## 目标
让 new-card-scheduler 全局唯一（与 pdf-viewer 的 ensure 逻辑一致风格）：
1) 若 `window_lifecycle` 已注册 `client_id="new-card-scheduler"` 且窗口仍有效：
   - 仅激活窗口（bring-to-front），返回 rc=0；
2) 否则：走创建新实例路径，并注册到 `window_lifecycle`；
3) 必须新增单测覆盖“第二次 ensure 不应创建新实例”。

## 约束
- 仅修改：`src/launcher/**`、必要时 `src/backend/launcher_core/**`
- Fail-Fast：重复注册指向不同窗口应仍抛错（保持 WindowLifecycleManager 约束）。

## 建议实现
参考 `ensure_pdf_viewer_hosted()` 的模式，在 `ensure_new_card_scheduler_hosted()` 增加：
- 从 `window_lifecycle` 查询已存在条目（必要时为 WindowLifecycleManager 增加只读 getter API）
- 使用 `activate_window(win)` 激活

## 必须新增回归测试（至少 1 条）
在 `src/launcher/__tests__/` 新增 pytest：
- 构造 stub window_lifecycle，第一次 ensure 注册；第二次 ensure 应走激活分支且不再创建/注册新窗口。

## 验收（DoD）
- `pnpm -s run lint` ✅
- `python -m pytest -q <你新增的 test 路径>` ✅
- 手工点检：重复点击 gui_launcher “启动 新卡片规划器 (Hosted)”或注入按钮，不应出现第二个窗口。

*** Add File: todo-and-doing/1 doing/20260110125102-card-planner-new-card-scheduler-singleton-I/working-log.md
# 20260110125102-card-planner-new-card-scheduler-singleton-I 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 12:51:02
### 工作内容:
- 初始化任务（未开始编码）
### 工作步骤:
1) ensure_new_card_scheduler_hosted 增加单例激活逻辑
2) 新增 pytest 覆盖二次 ensure 不创建新实例
3) 验收：lint + pytest by path
### 工作结果:
- 待执行

*** Add File: todo-and-doing/1 doing/20260110125102-card-planner-reset-draft-cards-G/v001-spec.md
# [card-planner][G] 新卡片规划器：增加“清空草稿卡”能力（便于反复手工测试）

**功能ID**: 20260110125102-card-planner-reset-draft-cards-G  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-10 12:51:02  
**预计完成**: 2026-01-10  
**状态**: 开发中  
**负责分支**: `worker/feature-G`（worktree：`C:\Users\napretep\PycharmProjects\anki-linkmaster-G`）

## 背景
手工测试需要频繁回到“空状态”，当前只能手动删除/重启窗口。

## 目标
1) 在 UI 顶部增加按钮 `清空草稿卡`：
   - 清空所有草稿卡，并清空 selected/pasteFocus；
2) 引擎接口对齐：
   - `CardsEngine` 与 `FakeEngine` 增加同名方法 `resetDraftCardsOrThrow()`
3) 必须新增回归测试覆盖按钮行为与接口一致性。

## 约束
- 仅修改：`src/frontend/new-card-scheduler/**`
- Fail-Fast：缺失方法/DOM 节点必须抛错。

## 验收（DoD）
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath <你新增/修改的测试路径> -i` ✅

*** Add File: todo-and-doing/1 doing/20260110125102-card-planner-reset-draft-cards-G/working-log.md
# 20260110125102-card-planner-reset-draft-cards-G 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 12:51:02
### 工作内容:
- 初始化任务（未开始编码）
### 工作步骤:
1) Engines：新增 resetDraftCardsOrThrow
2) UI：新增“清空草稿卡”按钮并 render
3) Jest：覆盖 reset + 计数/选中清理
### 工作结果:
- 待执行

*** Add File: todo-and-doing/1 doing/20260110125102-card-planner-ingest-visual-feedback-H/v001-spec.md
# [card-planner][H] 新卡片规划器：注入/ingest 的可视化反馈（toast + render）

**功能ID**: 20260110125102-card-planner-ingest-visual-feedback-H  
**优先级**: 中（提升人工验收可见性）  
**版本**: v001  
**创建时间**: 2026-01-10 12:51:02  
**预计完成**: 2026-01-10  
**状态**: 开发中  
**负责分支**: `worker/feature-H`（worktree：`C:\Users\napretep\PycharmProjects\anki-linkmaster-H`）

## 背景
当 gui_launcher forward 注入 `card-planner:ingest:requested` 时，planner 侧虽然会应用到引擎，但人工难以确认“是否已注入成功/失败”。

另外：该消息是 forward 路由，MsgCenter 已向发送方返回 completed/failed；planner 无法可靠回执给发送方（缺少 sender 信息），因此不应尝试“回写响应给 MsgCenter”。

## 目标
1) planner 收到 `card-planner:ingest:requested` 后：
   - 成功：toast `已注入 N 个标注到 Q/A`（或类似）并立即刷新 UI
   - 失败：toast 明确错误原因
2) 不再尝试向 MsgCenter `wsClient.send` 返回 ingest completed/failed（避免缺少 `to` 导致后端报错/污染日志）。
3) 必须新增回归测试覆盖：收到 ingest requested → render + toast 调用。

## 约束
- 仅修改：`src/frontend/new-card-scheduler/**`
- Fail-Fast：非法 payload 仍应抛错或明确失败 toast（不得静默吞掉）。

## 验收（DoD）
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath <你新增/修改的测试路径> -i` ✅

*** Add File: todo-and-doing/1 doing/20260110125102-card-planner-ingest-visual-feedback-H/working-log.md
# 20260110125102-card-planner-ingest-visual-feedback-H 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 12:51:02
### 工作内容:
- 初始化任务（未开始编码）
### 工作步骤:
1) 调整 msgcenter-wiring：ingest requested 成功/失败 toast + render
2) 移除无法路由的 respond 回执发送
3) Jest：覆盖注入可见性
### 工作结果:
- 待执行

