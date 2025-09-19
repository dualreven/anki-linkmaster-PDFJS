#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI Agent Communication Script
用户完全按期望格式实现，动作作为顶级参数，资源作为旗标

使用示例:
1. 创建Forum记录（简化版，无需title）
   python AI-log.py create --forum "讨论主题" --user "agent-planner"

2. 添加评论到Forum（从write改为add）
   python AI-log.py add --forum 20250919015147 --content "很好的一点建议" --user "agent-review"

3. 读取最新回复
   python AI-log.py read --forum 20250919015147 --latest-reply

4. 创建Solution并添加内容
   python AI-log.py create --solution "问题分析" --user "agent-analyzer"
   python AI-log.py add --solution 20250919014641 --fact "关键原因已确认" --user "agent-analyzer"
   python AI-log.py add --solution 20250919014641 --dilemma "资源分配有挑战" --user "agent-analyzer"

5. 创建原子任务
   python AI-log.py create --atom-tasks "功能实现任务" --user "agent-executor"

json5格式的优势：
- 支持注释：/* .... */ 或 //
- 支持多行字符串（不转义）
- 支持尾随逗号
- 支持单引号字符串

多行文本输入：
- 使用 --multiline 参数将进入交互式输入模式
- 支持多行文本，不需要转义
"""

import argparse
import json5 as json
import os
import sys
from datetime import datetime
from pathlib import Path

# 全局配置
DATA_DIR = Path("AI-communication")
FORUM_DIR = DATA_DIR
SOLUTION_DIR = DATA_DIR
TASK_DIR = DATA_DIR

class BaseHandler:
    """基础处理类"""

    def __init__(self):
        self.ensure_directories()

    def ensure_directories(self):
        """确保目录存在"""
        DATA_DIR.mkdir(exist_ok=True)
        FORUM_DIR.mkdir(exist_ok=True)
        TASK_DIR.mkdir(exist_ok=True)

    def write_json(self, filepath, data):
        """写入JSON文件，使用json5支持未转义多行字符串"""
        filepath.parent.mkdir(parents=True, exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, allow_nan=False)

    def read_json(self, filepath):
        """读取JSON文件"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            return None
        except json.JSONDecodeError as e:
            print(f"❌ JSON解析错误: {e}")
            return None

class ForumHandler(BaseHandler):
    """Forum讨论记录处理器"""

    def find_forum_file(self, timestamp_or_name):
        """查找forum文件，支持时间戳或名称查找"""
        if not FORUM_DIR.exists():
            return None

        # 如果是时间戳，精确匹配
        if timestamp_or_name.isdigit() and len(timestamp_or_name) == 14:
            pattern = f"{timestamp_or_name}-forum*.json"
        else:
            # 否则通过名称匹配
            pattern = f"*-forum-{timestamp_or_name}.json"

        for file_path in FORUM_DIR.glob(pattern):
            if file_path.is_file():
                return file_path

        return None

    def create(self, args):
        """创建forum记录"""
        if not hasattr(args, 'forum_name') or not args.forum_name:
            print("❌ 必须提供forum_name参数")
            return

        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        filename = f"{FORUM_DIR}/{timestamp}-forum.json"

        data = {
            "metadata": {
                "id": f"FORUM-{timestamp}",
                "type": "forum",
                "name": args.forum_name,
                "created_at": datetime.now().isoformat(),
                "status": "🔓 Open",
                "version": "1",
                "consensus_status": "❌ Not Achieved"
            },
            "participants": [
                args.user if hasattr(args, 'user') and args.user else "creator"
            ],
            "discussion_topic": args.forum_name,
            "discussion_content": []
        }

        self.write_json(Path(filename), data)
        print(f"✅ Forum记录创建成功: {filename}")

    def write_comment(self, args):
        """写评论给forum"""
        # 处理多行文本输入
        if hasattr(args, 'multiline') and args.multiline:
            print("🔄 请输入多行评论内容（按 Ctrl+D 或输入 'EOF' 结束）:")
            lines = []
            try:
                while True:
                    line = input()
                    if line.strip().upper() == 'EOF':
                        break
                    lines.append(line)
            except EOFError:
                pass  # Ctrl+D pressed
            content = '\n'.join(lines)
        else:
            content = args.content.replace('\\n', '\n')

        if not content or not content.strip():
            print("❌ 评论内容不能为空")
            return

        forum_file = self.find_forum_file(args.forum)
        if not forum_file:
            print(f"❌ 找不到forum记录: {args.forum}")
            print("请确认文件ID是否正确，若未创建请先使用create命令创建")
            return

        data = self.read_json(forum_file)
        if not data:
            print(f"❌ 找不到forum文件: {forum_file}")
            return None

        timestamp = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        message_id = f"#{len(data['discussion_content']) + 1:03d}"

        # 多行内容处理：字符串转数组
        content_lines = content.split('\n') if '\n' in content else [content]

        message = {
            "message_id": message_id,
            "user": args.user if hasattr(args, 'user') else "anonymous",
            "time": timestamp,
            "content": content_lines
        }

        # 如果是回复其他消息
        if hasattr(args, 'reply_to') and args.reply_to:
            message["reply_to"] = args.reply_to

        data['discussion_content'].append(message)

        # 更新状态和版本
        data['metadata']['version'] = str(int(data['metadata']['version']) + 1)

        self.write_json(forum_file, data)
        print(f"✅ 评论添加成功: {message_id}")

    def read_latest_reply(self, args):
        """读取最新回复"""
        forum_file = self.find_forum_file(args.forum)
        if not forum_file:
            print(f"❌ 找不到forum记录: {args.forum}")
            print("请确认文件ID是否正确，若未创建请先使用create命令创建")
            return

        data = self.read_json(forum_file)
        if not data or not data['discussion_content']:
            print("❌ 没有找到回复内容")
            return

        # 获取最新回复 (数组最后一条)
        latest_reply = data['discussion_content'][-1]

        print(f"📄 最新回复 #{latest_reply['message_id']}:")
        print(f"   👤 {latest_reply['user']}")
        print(f"   🕒 {latest_reply['time']}")
        print("   💬 多行内容:")
        if isinstance(latest_reply['content'], list):
            for i, line in enumerate(latest_reply['content'], 1):
                print(f"      {i}. {line}")
        else:
            print(f"      {latest_reply['content']}")

class SolutionHandler(BaseHandler):
    """Solution问题解决处理器"""

    def find_solution_file(self, timestamp_or_name):
        """查找solution文件"""
        if not FORUM_DIR.exists():
            return None

        # 如果是时间戳，精确匹配
        if timestamp_or_name.isdigit() and len(timestamp_or_name) == 14:
            pattern = f"{timestamp_or_name}-solution-*.json"
        else:
            # 否则通过名称匹配
            pattern = f"*-solution-{timestamp_or_name}.json"

        for file_path in FORUM_DIR.glob(pattern):
            if file_path.is_file():
                return file_path

        return None

    def create(self, args):
        """创建solution记录"""
        if not hasattr(args, 'solution_name') or not args.solution_name:
            print("❌ 必须提供solution_name参数")
            return

        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        filename = f"{FORUM_DIR}/{timestamp}-solution-{args.solution_name}.json"

        data = {
            "metadata": {
                "id": f"SOLUTION-{timestamp}",
                "solution_name": args.solution_name,
                "created_at": datetime.now().isoformat(),
                "status": "active",
                "model_used": args.model if hasattr(args, 'model') else "unknown"
            },
            "user_input": args.solution_name,
            "facts": [],
            "dilemmas": [],
            "hypothesis": "",
            "validation_results": "",
            "final_answer": "",
            "chain_of_thought": []
        }

        self.write_json(Path(filename), data)
        print(f"✅ Solution记录创建成功: {filename}")

    def add_fact(self, args):
        """添加事实"""
        if not hasattr(args, 'solution') or not args.solution:
            print("❌ 必须提供solution参数")
            return

        # 处理多行文本输入
        if hasattr(args, 'multiline') and args.multiline:
            print("🔄 请输入多行事实内容（按 Ctrl+D 或输入 'EOF' 结束）:")
            lines = []
            try:
                while True:
                    line = input()
                    if line.strip().upper() == 'EOF':
                        break
                    lines.append(line)
            except EOFError:
                pass
            fact_content = '\n'.join(lines)
        else:
            fact_content = args.fact

        if not fact_content or not fact_content.strip():
            print("❌ 事实内容不能为空")
            return

        solution_file = self.find_solution_file(args.solution)
        if not solution_file:
            print(f"❌ 找不到solution文件: {args.solution}")
            print("请确认文件ID是否正确，若未创建请先使用create命令创建")
            return

        data = self.read_json(solution_file)
        if not data:
            print(f"❌ 找不到solution文件: {solution_file}")
            return

        new_fact = {
            "id": f"fact_{len(data['facts'])+1}",
            "content": fact_content,
            "timestamp": datetime.now().isoformat(),
            "user": args.user if hasattr(args, 'user') else "system"
        }

        data['facts'].append(new_fact)
        self.write_json(solution_file, data)
        print(f"✅ 事实添加成功: {new_fact['id']}")

    def add_dilemma(self, args):
        """添加困境"""
        if not hasattr(args, 'solution') or not args.solution:
            print("❌ 必须提供solution参数")
            return

        # 处理多行文本输入
        if hasattr(args, 'multiline') and args.multiline:
            print("🔄 请输入多行困境内容（按 Ctrl+D 或输入 'EOF' 结束）:")
            lines = []
            try:
                while True:
                    line = input()
                    if line.strip().upper() == 'EOF':
                        break
                    lines.append(line)
            except EOFError:
                pass
            dilemma_content = '\n'.join(lines)
        else:
            dilemma_content = args.dilemma

        if not dilemma_content or not dilemma_content.strip():
            print("❌ 困境内容不能为空")
            return

        solution_file = self.find_solution_file(args.solution)
        if not solution_file:
            print(f"❌ 找不到solution文件: {args.solution}")
            print("请确认文件ID是否正确，若未创建请先使用create命令创建")
            return

        data = self.read_json(solution_file)
        if not data:
            print(f"❌ 找不到solution文件: {solution_file}")
            return

        new_dilemma = {
            "id": f"dilemma_{len(data['dilemmas'])+1}",
            "content": dilemma_content,
            "timestamp": datetime.now().isoformat(),
            "user": args.user if hasattr(args, 'user') else "system"
        }

        data['dilemmas'].append(new_dilemma)
        self.write_json(solution_file, data)
        print(f"✅ 困境添加成功: {new_dilemma['id']}")

class AtomTasksHandler(BaseHandler):
    """Atom Tasks原子任务处理器"""

    def find_atom_tasks_file(self, timestamp_or_name):
        """查找atom-tasks文件"""
        if not TASK_DIR.exists():
            return None

        # 如果是时间戳，精确匹配
        if timestamp_or_name.isdigit() and len(timestamp_or_name) == 14:
            pattern = f"{timestamp_or_name}-atom-tasks*.json"
        else:
            # 否则通过名称匹配
            pattern = f"*-atom-tasks-{timestamp_or_name}.json"

        for file_path in TASK_DIR.glob(pattern):
            if file_path.is_file():
                return file_path

        return None

    def read(self, args):
        """读取atom-tasks记录"""
        atom_tasks_file = self.find_atom_tasks_file(args.atom_tasks)
        if not atom_tasks_file:
            print(f"❌ 找不到atom-tasks记录: {args.atom_tasks}")
            print("请确认文件ID是否正确，若未创建请先使用create命令创建")
            return

        data = self.read_json(atom_tasks_file)
        if not data:
            print(f"❌ 找不到atom-tasks文件: {atom_tasks_file}")
            return

        tb = data.get('taskBackground', {})
        print(f"📋 原子任务: {tb.get('projectName', 'Unknown')}")
        print(f"   📝 描述: {tb.get('description', 'No description')}")
        print(f"   🔄 状态: {tb.get('status', 'Unknown')}")
        print(f"   📊 总任务数: {tb.get('totalAtomTaskCount', 0)}")

        if 'atomTaskList' in data and data['atomTaskList']:
            print(f"\n🪜 原子任务列表:")
            for i, task in enumerate(data['atomTaskList'], 1):
                status_map = {0: "⏳待办", 1: "🔄进行中", 2: "✅已完成", 3: "❌失败"}
                status = status_map.get(task.get('status', 0), "未知")
                print(f"   {i}. {status} {task.get('title', 'No title')}")
                if 'content' in task and task['content']:
                    print(f"      📝 {task.get('content')}")
                if 'feedback' in task and task.get('feedback', '').strip() and task['feedback'] != "[待完成任务反馈填写]":
                    print(f"      💬 反馈: {task.get('feedback')}")
        else:
            print("   无原子任务项")

    def add_task(self, args):
        """添加任务项"""
        if not hasattr(args, 'atom_tasks') or not args.atom_tasks:
            print("❌ 必须提供atom_tasks参数")
            return

        # 支持新旧两种参数名称
        task_title = getattr(args, 'title', '') or getattr(args, 'task', '')
        if not task_title:
            print("❌ 必须提供title参数（或使用--task作为兼容参数）")
            return

        content = getattr(args, 'task_content', '') or getattr(args, 'content', '')
        atom_tasks_file = self.find_atom_tasks_file(args.atom_tasks)
        if not atom_tasks_file:
            print(f"❌ 找不到atom-tasks记录: {args.atom_tasks}")
            print("请确认文件ID是否正确，若未创建请先使用create命令创建")
            return

        data = self.read_json(atom_tasks_file)
        if not data:
            print(f"❌ 找不到atom-tasks文件: {atom_tasks_file}")
            return

        new_task = {
            "title": task_title,
            "content": content,
            "status": 0,  # 0 todo 1 doing 2 done 3 failed
            "index": len(data['atomTaskList']) + 1,
            "feedback": "[待完成任务反馈填写]"
        }

        data['atomTaskList'].append(new_task)
        self.write_json(atom_tasks_file, data)
        print(f"✅ 任务项添加成功: {new_task['index']}")

    def create(self, args):
        """创建atom-tasks记录"""
        if not hasattr(args, 'project_name') or not args.project_name:
            print("❌ 必须提供project_name参数")
            return

        description = getattr(args, 'description', '')
        total_count = getattr(args, 'totalAtomTaskCount', 0)
        refers = getattr(args, 'refers', [])

        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        filename = f"{TASK_DIR}/{timestamp}-atom-tasks.json"

        data = {
            "taskBackground": {
                "status": 0,  # 0: draft, 1: final
                "projectName": args.project_name,
                "description": description,
                "refers": refers,
                "totalAtomTaskCount": total_count
            },
            "atomTaskList": []  # 任务创建时为空，由用户通过add命令添加具体的任务项
        }

        self.write_json(Path(filename), data)
        print(f"✅ 原子任务创建成功: {filename}")

    def read_next_todo(self, args):
        """读取下一个待办任务"""
        atom_tasks_file = self.find_atom_tasks_file(args.atom_tasks)
        if not atom_tasks_file:
            print(f"❌ 找不到atom-tasks记录: {args.atom_tasks}")
            return

        data = self.read_json(atom_tasks_file)
        if not data or 'atomTaskList' not in data:
            print("❌ 数据格式无效")
            return

        # 查找下一个待办任务（状态为0）
        for task in data['atomTaskList']:
            if task.get('status', 0) == 0:  # 0: todo
                print("🎯 下一个待办任务:")
                print(f"   标题: {task.get('title', 'No title')}")
                print(f"   索引: {task.get('index', 0)}")
                if task.get('content'):
                    print(f"   描述: {task.get('content')}")
                return

        print("🎉 所有任务已完成！")

    def update_task_status(self, args):
        """更新任务状态"""
        if not hasattr(args, 'index') or args.index is None:
            print("❌ 必须提供--index参数")
            return

        atom_tasks_file = self.find_atom_tasks_file(args.atom_tasks)
        if not atom_tasks_file:
            print(f"❌ 找不到atom-tasks记录: {args.atom_tasks}")
            return

        data = self.read_json(atom_tasks_file)
        if not data or 'atomTaskList' not in data:
            print("❌ 数据格式无效")
            return

        # 查找并更新任务
        updated = False
        for task in data['atomTaskList']:
            if task.get('index') == args.index:
                # 验证状态值
                valid_statuses = [0, 1, 2, 3]  # todo, doing, done, failed
                status_map = {
                    "0": 0, "1": 1, "2": 2, "3": 3,
                    "todo": 0, "doing": 1, "done": 2, "failed": 3
                }

                if hasattr(args, 'status') and args.status is not None:
                    new_status = status_map.get(args.status, status_map.get(str(args.status), None))
                    if new_status is not None:
                        task['status'] = new_status
                        updated = True
                        break

        if updated:
            self.write_json(atom_tasks_file, data)
            print(f"✅ 任务 {args.index} 状态已更新为 {args.status}")
        else:
            print(f"❌ 找不到任务索引 {args.index} 或状态无效")

def main():
    """主函数 - 解析命令行参数"""
    parser = argparse.ArgumentParser(
        description="AI Agent Communication Script - 用户期望格式完全实现",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
精彩的使用示例:

📝 创建Forum记录（简化版，无需title）:
   python AI-log.py create --forum "技术讨论" --user "agent-planner"

💬 添加评论到Forum（从write改为add）:
   python AI-log.py add --forum 20250919015147 --content "很好的一点建议" --user "agent-review"

📖 读取最新回复:
   python AI-log.py read --forum 20250919015147 --latest-reply

🔍 创建Solution并添加内容:
   python AI-log.py create --solution "AI脚本功能实现" --user "agent-analyzer"
   python AI-log.py add --solution 20250919014641 --fact "需求要求实现动作作为顶级参数" --user "agent-analyzer"
   python AI-log.py add --solution 20250919014641 --dilemma "这个格式改变需要大的架构重构" --user "agent-analyzer"

🎯 创建原子任务:
   python AI-log.py create --atom-tasks "功能实现任务" --user "agent-executor"

📖 读取原子任务:
   python AI-log.py read --atom-tasks 20250919102603

➕ 添加任务项到原子任务:
   python AI-log.py add --atom-tasks 20250919102603 --task "完成代码审查" --user "代码审查员"
        """
    )

    # 定义顶级子解析器
    subparsers = parser.add_subparsers(dest='action', help='可用操作')

    # ===== CREATE 命令 =====
    create_parser = subparsers.add_parser('create', help='创建新的记录')
    create_group = create_parser.add_mutually_exclusive_group(required=True)
    create_group.add_argument('--forum', type=str, help='创建forum记录')
    create_group.add_argument('--solution', type=str, help='创建solution记录')
    create_group.add_argument('--atom-tasks', type=str, help='atom-tasks时间戳')
    create_parser.add_argument('--project-name', type=str, help='atom-tasks项目名称')
    create_parser.add_argument('--description', type=str, help='atom-tasks项目描述')
    create_parser.add_argument('--totalAtomTaskCount', type=int, default=0, help='atom-tasks原子任务总数')
    create_parser.add_argument('--refers', type=str, nargs='*', help='atom-tasks参考文档列表')
    create_parser.add_argument('--user', required=True, help='创建者用户名')
    create_parser.add_argument('--model', type=str, help='使用的模型（solution专用）')

    # ===== READ 命令 =====
    read_parser = subparsers.add_parser('read', help='读取内容')
    read_group = read_parser.add_mutually_exclusive_group(required=True)
    read_group.add_argument('--forum', type=str, help='从forum读取')
    read_group.add_argument('--solution', type=str, help='从solution读取')
    read_group.add_argument('--atom-tasks', type=str, help='从atom-tasks读取')
    read_parser.add_argument('--latest-reply', action='store_true', help='读取最新回复')
    read_parser.add_argument('--next-todo', action='store_true', help='读取下一个待办任务（atom-tasks专用）')

    # ===== UPDATE 命令 =====
    update_parser = subparsers.add_parser('update', help='更新记录')
    update_group = update_parser.add_mutually_exclusive_group(required=True)
    update_group.add_argument('--forum', type=str, help='更新forum状态')
    update_group.add_argument('--solution', type=str, help='更新solution')
    update_group.add_argument('--atom-tasks', type=str, help='更新atom-tasks状态')
    update_parser.add_argument('--status', type=str, help='新的状态')
    update_parser.add_argument('--index', type=int, help='任务索引（atom-tasks专用）')
    update_parser.add_argument('--user', required=True, help='操作用户名')

    # ===== ADD 命令 =====
    add_parser = subparsers.add_parser('add', help='添加内容')
    add_group = add_parser.add_mutually_exclusive_group(required=True)
    add_group.add_argument('--forum', type=str, help='添加到forum')
    add_group.add_argument('--solution', type=str, help='添加到solution')
    add_group.add_argument('--atom-tasks', type=str, help='添加到atom-tasks')

    add_parser.add_argument('--content', type=str, help='追加到forum的评论内容（与--multiline互斥）')
    add_parser.add_argument('--multiline', action='store_true', help='进入交互式多行文本输入模式')

    # 原子任务专用参数
    add_parser.add_argument('--title', type=str, help='原子任务标题')
    add_parser.add_argument('--task-content', type=str, help='原子任务描述内容')

    # 事实和困境选项（与forum/content互斥）
    add_group2 = add_parser.add_mutually_exclusive_group()
    add_group2.add_argument('--fact', type=str, help='添加事实')
    add_group2.add_argument('--dilemma', type=str, help='添加困境')
    add_group2.add_argument('--task', type=str, help='添加任务项标题（atom-tasks专用，已废弃，使用--title代替）')

    add_parser.add_argument('--user', required=True, help='用户名')

    # 解析参数
    args = parser.parse_args()

    if not args.action:
        parser.print_help()
        return

    # 创建处理器实例
    handlers = {
        'forum': ForumHandler(),
        'solution': SolutionHandler(),
        'atom-tasks': AtomTasksHandler()
    }

    # 执行相应操作
    try:
        if args.action == 'create':
            if hasattr(args, 'forum') and args.forum:
                args.forum_name = args.forum
                handlers['forum'].create(args)
            elif hasattr(args, 'solution') and args.solution:
                args.solution_name = args.solution
                handlers['solution'].create(args)
            elif hasattr(args, 'atom_tasks') and args.atom_tasks:
                # 对于atom-tasks，检查新的参数格式
                if hasattr(args, 'project_name') and args.project_name:
                    handlers['atom-tasks'].create(args)
                else:
                    print("❌ 创建atom_tasks必须提供--project-name参数")
                    return

        elif args.action == 'read':
            if hasattr(args, 'forum') and args.forum:
                if hasattr(args, 'latest_reply') and args.latest_reply:
                    handlers['forum'].read_latest_reply(args)
            elif hasattr(args, 'atom_tasks') and args.atom_tasks:
                if hasattr(args, 'next_todo') and args.next_todo:
                    handlers['atom-tasks'].read_next_todo(args)
                else:
                    handlers['atom-tasks'].read(args)

        elif args.action == 'add':
            if hasattr(args, 'forum') and args.forum and hasattr(args, 'content') and args.content:
                handlers['forum'].write_comment(args)  # Using existing method but called from add
            elif hasattr(args, 'solution') and args.solution:
                if hasattr(args, 'fact') and args.fact:
                    handlers['solution'].add_fact(args)
                elif hasattr(args, 'dilemma') and args.dilemma:
                    handlers['solution'].add_dilemma(args)
            elif hasattr(args, 'atom_tasks') and args.atom_tasks:
                # 支持新旧两种参数（title或task）
                if hasattr(args, 'title') and args.title:
                    handlers['atom-tasks'].add_task(args)
                elif hasattr(args, 'task') and args.task:
                    handlers['atom-tasks'].add_task(args)

        elif args.action == 'update':
            if hasattr(args, 'atom_tasks') and args.atom_tasks:
                if hasattr(args, 'index') and args.index is not None:
                    handlers['atom-tasks'].update_task_status(args)
                else:
                    print("❌ 更新atom-tasks必须提供--index参数")
                    return
            else:
                print("❌ update功能当前只支持atom-tasks")
                return

    except Exception as e:
        print(f"❌ 执行出错: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()