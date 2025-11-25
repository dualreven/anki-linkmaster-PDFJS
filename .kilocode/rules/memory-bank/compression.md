# Memory Bank 压缩机制规范（v1）

## 1. 目标与适用范围

- 控制 memory-bank 体积，保持高信噪比，避免上下文被无用历史信息淹没。
- 保证**关键决策 / 规范 / 架构信息不可丢失**，压缩只能改变表现形式，不改变事实本身。
- 为 AI 在执行“压缩 / 整理 memory-bank”类任务时提供统一、可检查的操作步骤。
- 适用范围：
  - `.kilocode/rules/memory-bank/*.md`（brief/context/architecture/tech/product/rules/tasks 等）；
  - `AItemp/*-AI-Working-log.md`、`AItemp/reports/*.md`；
  - `docs/context-archive/*` 相关归档文件。

> 本规范是对 `context.md` 现有“保留最近7天 + docs/context-archive/ 归档”规则的抽象与扩展。

## 2. 信息分层与保留级别

为方便压缩与归档，memory-bank 中的信息按层级划分：

- **L0 永久层（不可压缩，只能演进）**
  - 含义：长期有效的项目“事实与规则”，变更通常意味着项目本身的演进。
  - 文件：`architecture.md`、`tech.md`、`product.md`、`rules.md`、`tasks.md`、`brief.md` 中的稳定规范。
  - 处理原则：
    - 不做“删除式压缩”，只能通过正常的“更新 / 替换规范”方式演进；
    - 变更必须在 `context.md` 的“最近7天变更记录”中留痕。

- **L1 上下文层（近7日高频背景）**
  - 含义：最近 7 天内的变更记录、问题背景、关键决策过程。
  - 文件：`.kilocode/rules/memory-bank/context.md` 中“最近7天变更记录”等章节。
  - 处理原则：
    - 只保留最近 7 天的记录；
    - 超过 7 天的内容**必须**按周 / 月度移动到 `docs/context-archive/`，不得直接删除。

- **L2 工作过程层（可压缩 / 可归档）**
  - 含义：AI 工作日志、详细执行过程、一次性调研记录等。
  - 文件：
    - `AItemp/*-AI-Working-log.md`
    - `AItemp/reports/*.md`
    - `docs/context-archive/*.md`（已经归档的旧 context）
  - 处理原则：
    - 允许通过“归档 + 总结”的方式压缩；
    - 删除原始细节前，必须确认**所有长期有价值的信息已经被提升**到 L0/L1。

## 3. 压缩触发条件（When）

### 3.1 context.md 压缩触发

- 任何一天新增变更记录前，AI 应检查：
  - `context.md` 中“最近7天变更记录”里最早一条记录的日期距当前日期是否 > 7 天；
  - `context.md` 总行数是否 > 200 行。
- 满足任一条件时，必须执行**context 归档压缩**：
  1. 按天/周将超出 7 天范围的记录移动到 `docs/context-archive/` 下对应周文件（如 `2025-11/context-2025-11-week2.md`）；
  2. 在 `docs/context-archive/README.md` 中更新索引与简要说明；
  3. 确认压缩后 `context.md` 行数重新回到合理区间（建议 < 200 行）。

> `docs/context-archive/README.md` 已定义周归档 / 月度维护规则，本规范只是将其纳入 memory-bank 总体压缩机制。

### 3.2 AItemp 工作日志压缩触发

- 至少满足下列任一条件时，必须评估是否执行 AItemp 压缩：
  - `AItemp/*-AI-Working-log.md` 文件数量 > 256 个；
  - 存在距离当前日期 **超过 30 天** 的工作日志；
  - 单个工作日志文件行数 > 500 行，且已被标记为“过程性记录”而非“规范/决策沉淀”。

### 3.3 报告与归档文件压缩触发

- `AItemp/reports/*.md` 或 `docs/context-archive/*` 出现以下情况之一时，可以考虑二次压缩：
  - 同一主题在多份报告中反复出现，且已经在 L0/L1 中形成统一规范；
  - 某个月的归档文件数量过多（> 8 个），但内容高度重复。
- 此类压缩应以“合并 + 梳理索引”为主，不鼓励频繁删除原始报告。

## 4. 压缩执行流程（How）

### 4.1 总体流程（三阶段）

1. **标注 / 分类阶段**
   - 按 L0/L1/L2 层级对即将处理的内容进行分类；
   - 对 L2 中包含重要结论 / 规范的部分打上“需提升”标记（在工作日志中显式写明）。
2. **信息提升阶段**
   - 将“需提升”的信息按内容类型写入对应文件：
     - 规则 / 技术约定 → `tech.md` 或 `rules.md`；
     - 架构 / 模块关系变更 → `architecture.md`；
     - 具体问题+解决方案 → `context.md` 的“最近7天变更记录”；
   - 确保**所有后续任务需要依赖的信息**都能在 L0/L1 找到，而不是只存在于旧日志中。
3. **归档 / 清理阶段**
   - 对 L1（context）执行“移动到 `docs/context-archive` + 更新索引”的归档；
   - 对 L2（AItemp 日志）执行“移动到归档目录 + 可选的周/月度总结报告”的归档；
   - 任何删除操作必须在 AI 工作日志中记录原因和目标文件。

### 4.2 AItemp 日志归档建议目录结构

- 原始工作日志（最近 30 天）继续保留在：
  - `AItemp/[YYYYMMDDhhmmss]-AI-Working-log.md`
- 30 天前的日志建议移动到：
  - `AItemp/archive/YYYY/MM/[YYYYMMDDhhmmss]-AI-Working-log.md`
- 可选：为每个月创建一份总结报告：
  - `AItemp/reports/memory-bank-archive-YYYY-MM-summary.md`
  - 内容：当月关键决策汇总、引入/废弃的规范列表、与 memory-bank 相关的结构变更。

> 注意：本规范只定义目录与命名规则，不要求在本次任务中立即重构现有文件布局。

## 5. AI 执行“压缩 memory-bank”任务时的 Checklist

1. **前置步骤（遵守 brief.md 流程）**
   - 读取最近 8 个 `AItemp/*-AI-Working-log.md`；
   - 创建新的本次任务的工作日志；
   - 阅读 `context.md` / `architecture.md` / `tech.md` 与相关归档文件。
2. **确认压缩范围**
   - 明确本次压缩仅作用于哪些文件（context / AItemp / reports）；
   - 在工作日志中写明“压缩范围 + 触发原因（时间 / 数量 / 行数）”。
3. **执行前提检查**
   - 对拟删除或移动的工作日志，逐个确认是否包含尚未写入 L0/L1 的长期信息；
   - 如无法判断某条信息是否可丢弃，必须按 **Fail‑Fast 原则：不删除，仅标记待人工确认**。
4. **执行压缩 / 归档**
   - 严格按照本规范第4章的三阶段流程操作；
   - 所有移动 / 删除均使用明确的文件路径与操作描述，避免“批量模糊清理”。
5. **收尾与记录**
   - 在 `context.md` 的“最近7天变更记录”中添加一条“memory-bank 压缩 / 归档操作”的简要记录；
   - 在当前 `AItemp/*-AI-Working-log.md` 中记录：
     - 被归档的文件列表；
     - 新增的归档/总结文件；
     - 是否存在“保留待人工确认”的内容；
   - 调用 `notify-tts` 提醒用户检查结果。

## 6. 不允许的操作（Fail‑Fast 约束）

- 禁止直接删除任何 `AItemp/*-AI-Working-log.md`，必须先归档再视情况做二次压缩。
- 禁止在未检查内容的情况下批量删除历史归档文件。
- 禁止仅在归档中保留“模糊结论”，而丢失具体前提条件和约束（会导致后续误用结论）。
- 禁止为了“减小文件体积”而改写历史记录的事实（只能追加说明或纠错，不允许无痕篡改）。

## 7. 与现有规则的关系

- 与 `docs/context-archive/README.md`：
  - 本规范将其中的“每周 / 每月维护”上升为 memory-bank 总体压缩策略的一部分；
  - 若两处描述存在歧义，应以 **更严格** 的约束为准，并在 `context.md` 中记录修正说明。
- 与 `tech.md` / `architecture.md`：
  - `tech.md` 作为技术规范索引，应链接到本文件；
  - `architecture.md` 的“架构要点”中可以简要提及“memory-bank 采用分层 + 归档的压缩机制”。

