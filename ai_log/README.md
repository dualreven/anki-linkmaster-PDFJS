# AI-Log 模块

AI Agent 通信日志管理系统，用于记录和管理AI代理之间的论坛讨论、解决方案和原子任务。

## 概述

AI-Log 是一个基于命令行的工具，支持三种核心数据结构的管理：

- **Forum（论坛讨论）**: 用于记录多用户之间的讨论过程，支持回复、同意状态、资源引用
- **Solution（解决方案）**: 用于记录问题解决的结构化过程，包括事实、困境、假设、验证、执行等阶段
- **Atom-tasks（原子任务）**: 用于管理项目中的细粒度任务列表，支持任务状态跟踪

## 项目结构

```
ai_log/
├── handlers/          # 处理器模块 - 命令行操作的具体实现
│   ├── base.py            # 基础处理器类
│   ├── forum_handler.py   # 论坛讨论处理器
│   ├── solution_handler.py # 解决方案处理器
│   └── atom_tasks_handler.py # 原子任务处理器
├── models/            # 数据模型
│   └── forum_v2.py        # 论坛讨论数据结构v2
├── repositories/      # 数据访问层
│   ├── json5_store.py     # JSON5文件存储
│   ├── file_finder.py     # 文件查找工具
│   ├── forum_repository.py # 论坛数据仓库
│   ├── solution_repository.py # 解决方案数据仓库
│   └── atom_tasks_repository.py # 原子任务数据仓库
├── services/          # 业务逻辑层
│   ├── forum_service.py   # 论坛服务
│   ├── solution_service.py # 解决方案服务
│   └── atom_tasks_service.py # 原子任务服务
├── utils/             # 工具模块
│   ├── time_id.py         # 时间戳生成工具
│   └── text_input.py      # 文本输入处理
├── main.py            # 主程序入口
└── __main__.py        # 模块执行入口
```

## 安装和使用

### 运行方式

支持两种运行方式：

```bash
# 方式1：作为Python模块运行
python -m ai_log [命令参数]

# 方式2：通过启动脚本运行
python AIscripts/AI-log.py [命令参数]
```

### 数据存储

所有数据默认存储在项目根目录的 `AI-communication/` 文件夹中，采用JSON5格式存储。

## 功能特性

### 1. Forum（论坛讨论）

用于管理多用户讨论过程，支持树状回复结构。

#### 创建论坛
```bash
# 自动生成时间戳
python -m ai_log create --forum "技术讨论" --user "agent-planner"

# 使用指定时间戳
python -m ai_log create --forum 20250101010101 --user "agent-planner"
```

#### 添加评论
```bash
# 文本评论
python -m ai_log add --forum 20250101010101 --content "很好的一点建议" --user "agent-review"

# 从文件读取评论
python -m ai_log add --forum 20250101010101 --content-from-file notes.txt --user u

# 带同意状态和资源的评论
python -m ai_log add --forum 20250101010101 --content "同意此方案" --user u --agree true --resource https://a.com docs/ref.md
```

#### 读取论坛内容
```bash
# 读取最新回复
python -m ai_log read --forum 20250101010101 --latest-reply

# 读取指定消息
python -m ai_log read --forum 20250101010101 --message-id 001

# 查看讨论状态
python -m ai_log read --forum 20250101010101 --status

# 更新讨论状态
python -m ai_log update --forum 20250101010101 --status 1 --user u
```

### 2. Solution（解决方案）

用于记录结构化的问题解决过程，支持六个阶段的内容管理。

#### 创建解决方案
```bash
python -m ai_log create --solution 20250101020202 --initiator agent-planner --summary "问题摘要" --userInput "用户输入" --forumReference "论坛引用"
```

#### 添加各阶段内容
```bash
# 添加事实
python -m ai_log add --solution 20250101020202 --fact "观察到的事实"

# 添加困境
python -m ai_log add --solution 20250101020202 --dilemma "面临的困境"

# 添加假设
python -m ai_log add --solution 20250101020202 --hypothesis --summary "假设摘要" --detals "假设详情"

# 添加验证
python -m ai_log add --solution 20250101020202 --validation --summary "验证摘要" --detals "验证详情"

# 添加执行
python -m ai_log add --solution 20250101020202 --execution --summary "执行摘要" --detals "执行详情"

# 添加参考
python -m ai_log add --solution 20250101020202 --reference https://reference-url
```

### 3. Atom-tasks（原子任务）

用于管理项目中的细粒度任务，支持任务状态跟踪。

#### 创建任务列表
```bash
python -m ai_log create --atom-tasks 20250101030303 --project-name "项目名称" --description "项目描述" --totalAtomTaskCount 10 --user u
```

#### 添加任务项
```bash
python -m ai_log add --atom-tasks 20250101030303 --title "完成代码审查" --task-content "审查代码质量和安全性" --user u
```

#### 读取任务状态
```bash
# 读取列表级状态
python -m ai_log read --atom-tasks 20250101030303 --status

# 读取下一个待办任务
python -m ai_log read --atom-tasks 20250101030303 --next-todo
```

#### 更新任务状态
```bash
# 使用状态名称
python -m ai_log update --atom-tasks 20250101030303 --index 1 --status done --user u

# 使用状态编号 (0=todo, 1=doing, 2=done, 3=failed)
python -m ai_log update --atom-tasks 20250101030303 --index 1 --status 2 --user u
```

## 状态管理

### Forum 状态
- `0`: 讨论中
- `1`: 已结束

### Atom-tasks 任务状态
- `0` / `todo`: 待办
- `1` / `doing`: 进行中
- `2` / `done`: 已完成
- `3` / `failed`: 失败

## 时间戳格式

系统支持14位时间戳格式：`YYYYMMDDHHMMSS`
- 如果提供的不是14位数字，会被当作项目名称处理
- 可以让系统自动生成当前时间戳

## 技术架构

采用分层架构设计：

- **Handlers层**: 处理命令行参数解析和用户交互
- **Services层**: 实现业务逻辑和数据处理
- **Repositories层**: 提供数据访问和持久化
- **Models层**: 定义数据结构和验证规则
- **Utils层**: 提供通用工具和辅助功能

## 数据格式

所有数据采用JSON5格式存储，支持注释和更灵活的语法。文件命名规则：
- Forum: `forum-{timestamp}.json5`
- Solution: `solution-{timestamp}.json5`
- Atom-tasks: `atom-tasks-{timestamp}.json5`

## 依赖要求

- Python 3.7+
- 支持JSON5格式的解析库
- 标准库模块：argparse, pathlib, typing

## 开发规范

- 所有函数必须包含类型注解和文档字符串
- 使用工厂模式创建数据结构
- 统一的错误处理和用户反馈
- 支持多行文本输入和文件内容读取
- 遵循单一职责原则，各层职责明确分离