# KILOCODE Agent 提示词

# 工作目录

- linkmaster-pdf: C:\Users\napretep\PycharmProjects\anki-linkmaster-PDFJS
- HJPOJ: C:\Users\napretep\PycharmProjects\HJPOJ
- todolist: C:\Users\napretep\Documents\HJP-TODOLIST

# 流程规范

- 1. 你必须先获取 距离时间最近的8个 `AItemp/[YYYYMMDDhhmmss]-AI-Working-log.md` 文件, 了解任务的历史.
- 2. 你必须创建 `AItemp/[YYYYMMDDhhmmss]-AI-Working-log.md` 文件, 记录当前的任务目标.
- 3. 你必须查看 `.kilocode\rules\memory-bank\context.md` 的内容, 理解用户的输入
- 4. 你必须更新 `.kilocode\rules\memory-bank\context.md`的内容, 如, 描述当前问题, 问题背景, 相关模块和函数等.
- 5. 如果 `.kilocode\rules\memory-bank\context.md` 有执行步骤,你必须按步骤执行
- 6. 执行结束后,你必须更新下面的文档:
- 6.0 必须更新 `AItemp/[YYYYMMDDhhmmss]-AI-Working-log.md`, 记录任务的执行结果.
- 6.1 必须更新 `.kilocode\rules\memory-bank\context.md` , 记录对后续任务有帮助的信息.
- 6.2 如果架构改动, 则必须更新 `.kilocode\rules\memory-bank\architecture.md` , 记录架构的改动的细节(如模块变更,代码拆分).
- 6.3 如果使用方法改动, 则必须更新 `.kilocode\rules\memory-bank\tech.md`, 记录用法变动的细节(如函数参数变更, 调用方式变更, 执行脚本用法变更等).
- 7 你完成任务后, 必须调用 `notify-tts "[某任务]已完成,请检查结果"` 通知用户任务完成.
- 8. 所有**会产生副作用**的操作(如修改代码/文档、创建或删除文件、运行会写入磁盘或数据库的脚本等), AI 必须先在对话中输出可审核的 Plan(包含目标、范围、步骤、测试方案等), 并在用户明确确认后, 才能执行任何实际修改或命令.

# 开发原则

- 禁止设计兜底原则,任何非预期行为均应引起错误异常.
- 修复bug后,必须添加一条防回归的测试,防止bug再次回归.
- 你必须调用 `notify-tts "[某任务]已完成,请检查结果"` 通知用户任务完成.
- 你开发前必须先理解模块中的规范头文件`[模块根目录]/docs/SPEC/SPEC-HEAD-[模块].json` 中定义的规范, 以及readme中介绍的模块使用说明, 才能进行代码开发
- 你在掌握了规范限定后, 必须先编写你想要开发的内容的测试文件.
- 你思考问题的流程应当是(基于事实->存在困境->提出猜想->进行验证->合理执行)
- 当你缺乏事实依据时, 你应当收集依据, 协助思考而非立即执行任务.
- 你必须全过程加载memory bank全部信息.
- 你每次执行代码修改,包括任务完成时,必须更新 `AItemp/[YYYYMMDDhhmmss]-AI-Working-log.md` 文件, 其中 YYYYMMDDhhmmss 总是取最新时间.
- 你必须追溯必要的 `AI-Working-log.md`文件收集足够的信息, 查看上次的目标和结果, 并根据上次的结果, 确定本次的目标和实现方法.

# 禁止污染根目录原则

- 所有的working-log都写在`AItemp/[YYYYMMDDhhmmss]-AI-Working-log.md`,禁止污染根目录.
- 试探性测试代码必须写在 `AItemp/attempts`路径下,禁止污染根目录
- 所有的报告都应该写在 `AItemp/reports`路径下,禁止污染根目录

# DRY 原则（Don't Repeat Yourself / 一致性原则）

## 强制要求
- **开发前搜索**：添加任何功能前，必须先使用 Glob/Grep 搜索项目中是否已有实现
  - 搜索相关文件名模式（Glob）
  - 搜索功能关键词（Grep）
  - 检查 `src/frontend/common/` 和 `src/backend/common/` 共享模块
- **禁止重复实现**：
  - 禁止跨模块重复（如 pdf-home 和 pdf-viewer 各自实现报错逻辑）
  - 禁止同模块内重复（如同一模块中存在两套相同逻辑）
  - 禁止复制粘贴现有代码到新位置

## 发现重复时的处理
- 如发现已有高度雷同的功能：**必须询问用户**是否将其抽象为共享模块
- **禁止**：直接复制现有代码
- **禁止**：在已有实现基础上重新实现一遍
- **建议**：使用 EventBus 或依赖注入复用功能

## 典型案例
- ❌ 错误：PDF-Home 和 PDF-Viewer 各自实现独立的错误处理逻辑
- ❌ 错误：前端已有日志系统，却独立实现新的日志系统
- ❌ 错误：PDF-Home 内部存在两套完全相同的报错逻辑
- ✅ 正确：将共用逻辑抽象到 `src/frontend/common/utils/` 或 `src/frontend/common/services/`
- ✅ 正确：使用前端已有的日志系统（Logger），而非创建新的日志系统
- ✅ 正确：通过 Feature 间事件通信复用功能，而非复制代码

# 需求文档阅读原则

- 如果你需要完成一个需求, 则必须先阅读需求文档.
- 阅读 `todo-and-doing/readme.md`
- 阅读 `templates`



# 专属提示词

## 序贯思维

- 你必须全过程使用 sequentialthinking MCP 工具进行多步基于事实依据的思考

## 基本规则

- 你必须总是牢记你的执行流程和执行原则, 任何时候都不能忘记!
- 总是使用中文回复.
- 在kilocode环境中 mode 就是 agent, 模式即是智能体, 两者等价不可区分.
- 想知道真实的时间必须用time mcp工具获取
- 你可以使用powershell命令, 注意 PowerShell 中 && 不被支持，应使用 ; 作为命令分隔符。


