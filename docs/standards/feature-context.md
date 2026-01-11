# FeatureContext 字段约定

目的：统一各 feature 在装配/注入时的上下文字段命名，避免重复踩坑（尤其是 event bus 命名混乱导致的订阅遗漏与调试困难）。

## 字段约定（推荐最小集）

### `globalEventBus`（标准字段）
- **含义**：全局事件总线（跨 feature 通信、全局事件白名单/Tracing 等依赖的那一个）。
- **要求**：应当在 FeatureContext 中作为**唯一真源**被传递与使用。

### `eventBus`（别名字段）
- **含义**：历史/兼容字段。
- **约束**：若存在，必须与 `globalEventBus` **完全等同**（同一对象引用），不得指向不同实例。
- **建议**：新增代码优先使用 `globalEventBus`；仅在兼容旧接口时保留 `eventBus`。

### 其他常见字段（按需）
- `container`
  - 典型用途：承载 UI/组件的根 DOM 容器（或 mount point）。
- `scopedEventBus`
  - 典型用途：feature 内部作用域事件总线（避免污染 global）。
  - 注意：其生命周期应与 feature 安装/卸载绑定，避免订阅泄漏。
- `logger`
  - 典型用途：统一日志输出；应携带 feature 标识/traceId 等上下文信息。
- `config`
  - 典型用途：feature 运行期开关与配置集合（建议结构化，避免散落的可选参数）。

## 约束与排雷
- **禁止“兜底”**：缺少必须字段应直接抛错（Fail-Fast），不要静默降级为 `undefined` 或新建默认对象。
- **一致性优先**：同一 feature 内不要混用 `eventBus` 与 `globalEventBus` 指向不同对象。
- **生命周期要可卸载**：凡是基于 EventBus 的订阅/副作用，应当能在卸载时清理。

## worktree 任务报告规范（report.md）
每个 worktree 任务必须在对应任务目录提交 `report.md`，至少包含：
- **scope**：本次允许修改的目录/文件范围（写死，避免与其他任务冲突）。
- **commands & results**：`pnpm -s run lint` + 定向测试命令与结果摘要（能跑就跑，并记录）。
- **commit hash**：最终交付的 git 提交 hash（必填）。

