# PDF Viewer - 已知问题（Known Issues）

最后更新：2026-01-10

## KI-20260110-01：outline/search 组合操作触发爆栈日志（延期）

### 状态
- 状态：Deferred（已记录，暂不修复）
- 严重性：低（主要是日志污染；用户确认“不太重要”）
- 影响范围：`pdf-viewer`（outline + search 的组合场景）

### 复现步骤（最短路径）
1) 打开 PDF Viewer
2) 打开搜索栏（`pdf-search`）
3) 点击大纲项跳转（`pdf-outline`）

### 实际行为
- 偶发出现错误日志：
  - `Maximum call stack size exceeded`
- 通常不阻断核心功能，但会产生噪声日志，干扰排障与观测。

### 期望行为
- 不应出现递归爆栈或序列化爆栈相关错误日志。
- outline 导航与 search UI 状态切换应互不触发“循环链路”。

### 临时规避（Workaround）
- 复现后重开 viewer（或先关闭 search 再做 outline 跳转）。

### 后续修复验收标准（未来任务 DoD）
- 新增最小回归测试：模拟“search 打开 + outline 点击导航”的关键事件链路，断言：
  - 不抛异常；
  - 不出现递归循环（可用 spy/计数器断言关键 handler 不被重入调用）。
- `pnpm -s run lint` 通过。

### 关联
- 后续计划任务：`todo-and-doing/2 todo/20260110014111-outline-search-callstack-overflow-deferred-D/`

