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
- 6. 如果任务步骤有多步,你必须考虑任务的工作量,按照原子任务的拆分原则(基于事实,任务简单且不可拆分),拆分成多个步骤, 将新步骤更新到 `.kilocode\rules\memory-bank\context.md`
- 7. 如果拆解出的任务和当前任务的关系不大, (例如:1更新多个文档,文档之间没有联系,2修复次生bug,和主要bug无关,3这个任务我们只需要知道结果), 你必须启动一个 subagent  执行子任务
- 8. 执行原子步骤的任务, 你必须先设计测试代码, 然后开发, 开发结束后, 再调用测试代码, 测试代码通过才能交付.
- 8.1 开发时,你必须了解整个模块是否已有相关代码, 如果有, 必须先阅读相关代码, 理解其实现原理, 才能进行开发.
- 9. 执行结束后,你必须更新下面的文档:
- 9.0 必须更新 `AItemp/[YYYYMMDDhhmmss]-AI-Working-log.md`, 记录任务的执行结果.
- 9.1 必须更新 `.kilocode\rules\memory-bank\context.md` , 记录对后续任务有帮助的信息.
- 9.2 如果架构改动, 则必须更新 `.kilocode\rules\memory-bank\architecture.md` , 记录架构的改动的细节(如模块变更,代码拆分).
- 9.3 如果使用方法改动, 则必须更新 `.kilocode\rules\memory-bank\tech.md`, 记录用法变动的细节(如函数参数变更, 调用方式变更, 执行脚本用法变更等).

# 开发原则

- 你开发前必须先理解模块中的规范头文件`[模块根目录]/docs/SPEC/SPEC-HEAD-[模块].json` 中定义的规范, 以及readme中介绍的模块使用说明, 才能进行代码开发
- 你在掌握了规范限定后, 必须先编写你想要开发的内容的测试文件.
- 你思考问题的流程应当是(基于事实->存在困境->提出猜想->进行验证->合理执行)
- 当你缺乏事实依据时, 你应当收集依据, 协助思考而非立即执行任务.
- 你必须全过程加载memory bank全部信息.
- 你每次执行代码修改,包括任务完成时,必须更新 `AItemp/[YYYYMMDDhhmmss]-AI-Working-log.md` 文件, 其中 YYYYMMDDhhmmss 总是取最新时间.
- 你必须追溯必要的 `AI-Working-log.md`文件收集足够的信息, 查看上次的目标和结果, 并根据上次的结果, 确定本次的目标和实现方法.

# 一致性原则

- 你必须了解整个模块是否有相关代码,不可重复实现功能, 造轮子, 造成代码碎片化.
- 比如我们前端已经有了日志系统,就不要再独立做一个日志系统, 而是使用前端已有的日志系统.

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

