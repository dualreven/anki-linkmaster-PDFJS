#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import argparse
import sys
from ai_log.handlers import ForumHandler, SolutionHandler, AtomTasksHandler


def main():
    parser = argparse.ArgumentParser(
        description="AI Agent Communication Script - 用户期望格式完全实现",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
运行方式（任选其一）:
- python -m ai_log ...
- python AIscripts/AI-log.py ...

📝 创建 Forum（自动时间戳 或 显式时间戳）
- 自动: python -m ai_log create --forum "技术讨论" --user "agent-planner"
- 显式: python -m ai_log create --forum 20250101010101 --user "agent-planner"

💬 Forum 添加评论
- 文本: python -m ai_log add --forum 20250101010101 --content "很好的一点建议" --user "agent-review"
- 文件: python -m ai_log add --forum 20250101010101 --content-from-file notes.txt --user u
- 可选同意/资源: --agree true --resource https://a.com docs/ref.md

📖 Forum 读取
- 最新回复: python -m ai_log read --forum 20250101010101 --latest-reply
- 指定消息: python -m ai_log read --forum 20250101010101 --message-id 001
- 讨论状态: python -m ai_log read --forum 20250101010101 --status
- 更新状态: python -m ai_log update --forum 20250101010101 --status 1 --user u

🔍 Solution 创建与添加
- 创建（自动或显式时间戳）:
  python -m ai_log create --solution 20250101020202 --initiator agent-planner --summary s --userInput ui --forumReference ref
- 添加段落（fact/dilemma/hypothesis/validation/execution/reference）:
  python -m ai_log add --solution 20250101020202 --hypothesis --summary s --detals d
  python -m ai_log add --solution 20250101020202 --reference https://ref

🎯 Atom-tasks 创建与读取
- 创建（自动或显式时间戳）:
  python -m ai_log create --atom-tasks 20250101030303 --project-name P --description D --totalAtomTaskCount 10 --user u
- 添加任务项:
  python -m ai_log add --atom-tasks 20250101030303 --title "完成代码审查" --task-content "描述" --user u
- 读取列表级状态:
  python -m ai_log read --atom-tasks 20250101030303 --status
- 更新任务项状态（0/1/2/3 或 todo/doing/done/failed）:
  python -m ai_log update --atom-tasks 20250101030303 --index 1 --status done --user u
        """
    )
    subparsers = parser.add_subparsers(dest='action', help='可用操作')

    create_parser = subparsers.add_parser('create', help='创建新的记录')
    create_group = create_parser.add_mutually_exclusive_group(required=True)
    create_group.add_argument('--forum', type=str, help='创建forum记录（支持14位时间戳）')
    create_group.add_argument('--solution', type=str, help='创建solution记录')
    create_group.add_argument('--atom-tasks', type=str, help='atom-tasks时间戳')
    create_parser.add_argument('--project-name', type=str, help='atom-tasks项目名称 / forum项目名（v2）')
    create_parser.add_argument('--description', type=str, help='atom-tasks项目描述')
    create_parser.add_argument('--totalAtomTaskCount', type=int, default=0, help='atom-tasks原子任务总数')
    create_parser.add_argument('--refers', type=str, nargs='*', help='atom-tasks参考文档列表')
    create_parser.add_argument('--user', help='创建者用户名（可选）')
    create_parser.add_argument('--model', type=str, help='使用的模型（兼容旧 solution，已不再需要）')
    create_parser.add_argument('--initiator', type=str, help='forum发起人（v2）/ solution 发起人')
    create_parser.add_argument('--summary', type=str, help='solution 摘要（solution 专用）')
    create_parser.add_argument('--userInput', type=str, help='solution 用户输入（solution 专用）')
    create_parser.add_argument('--forumReference', type=str, help='solution 关联的 forum 引用（solution 专用）')
    create_parser.add_argument('--role', type=str, help='solution 角色，默认 方案规划师 (agent-planner)')

    read_parser = subparsers.add_parser('read', help='读取内容')
    read_group = read_parser.add_mutually_exclusive_group(required=True)
    read_group.add_argument('--forum', type=str, help='从forum读取')
    read_group.add_argument('--solution', type=str, help='从solution读取')
    read_group.add_argument('--atom-tasks', type=str, help='从atom-tasks读取')
    read_parser.add_argument('--latest-reply', action='store_true', help='读取最新回复')
    read_parser.add_argument('--message-id', type=str, help='读取指定编号回复（forum专用）')
    read_parser.add_argument('--is-agree', action='store_true', help='查询是否同意方案（forum专用）')
    read_parser.add_argument('--status', action='store_true', help='读取讨论/方案/任务状态')
    read_parser.add_argument('--next-todo', action='store_true', help='读取下一个待办任务（atom-tasks专用）')

    update_parser = subparsers.add_parser('update', help='更新记录')
    update_group = update_parser.add_mutually_exclusive_group(required=True)
    update_group.add_argument('--forum', type=str, help='更新forum状态')
    update_group.add_argument('--solution', type=str, help='更新solution')
    update_group.add_argument('--atom-tasks', type=str, help='更新atom-tasks状态')
    update_parser.add_argument('--status', type=str, help='新的状态')
    update_parser.add_argument('--index', type=int, help='任务索引（atom-tasks专用）')
    update_parser.add_argument('--user', required=True, help='操作用户名')

    add_parser = subparsers.add_parser('add', help='添加内容')
    add_group = add_parser.add_mutually_exclusive_group(required=True)
    add_group.add_argument('--forum', type=str, help='添加到forum')
    add_group.add_argument('--solution', type=str, help='添加到solution')
    add_group.add_argument('--atom-tasks', type[str], help='添加到atom-tasks')
    add_parser.add_argument('--content', type=str, help='追加到forum的评论内容（与--multiline互斥）')
    add_parser.add_argument('--content-from-file', dest='content_from_file', type=str, help='从文件读取评论内容（与--content互斥）')
    add_parser.add_argument('--multiline', action='store_true', help='进入交互式多行文本输入模式')
    add_parser.add_argument('--agree', type=str, choices=['true','false','null'], help='同意状态')
    add_parser.add_argument('--resource', nargs='*', help='资源列表')
    add_parser.add_argument('--title', type=str, help='原子任务标题')
    add_parser.add_argument('--task-content', type=str, help='原子任务描述内容')
    add_group2 = add_parser.add_mutually_exclusive_group()
    add_group2.add_argument('--fact', type=str, help='添加事实')
    add_group2.add_argument('--dilemma', type=str, help='添加困境')
    add_group2.add_argument('--hypothesis', action='store_true', help='添加/更新假设')
    add_group2.add_argument('--validation', action='store_true', help='添加/更新验证')
    add_group2.add_argument('--execution', action='store_true', help='添加/更新执行')
    add_group2.add_argument('--reference', type=str, help='添加参考')
    add_group2.add_argument('--task', type=str, help='添加任务项标题（atom-tasks专用，已废弃，使用--title代替）')
    add_parser.add_argument('--summary', type=str, help='solution段落摘要')
    add_parser.add_argument('--detals', type=str, help='solution段落详情')
    add_parser.add_argument('--user', required=True, help='用户名')

    args = parser.parse_args()
    if not args.action:
        parser.print_help()
        return

    handlers = {
        'forum': ForumHandler(),
        'solution': SolutionHandler(),
        'atom-tasks': AtomTasksHandler()
    }

    try:
        if args.action == 'create':
            if hasattr(args, 'forum') and args.forum:
                args.forum_name = args.forum
                handlers['forum'].create(args)
            elif hasattr(args, 'solution') and args.solution:
                args.solution_name = args.solution
                handlers['solution'].create(args)
            elif hasattr(args, 'atom_tasks') and args.atom_tasks:
                if hasattr(args, 'project_name') and args.project_name:
                    handlers['atom-tasks'].create(args)
                else:
                    print("❌ 创建atom_tasks必须提供--project-name参数")
                    return
        elif args.action == 'read':
            if hasattr(args, 'forum') and args.forum:
                if hasattr(args, 'message_id') and args.message_id:
                    handlers['forum'].read_by_message_id(args)
                elif hasattr(args, 'latest_reply') and args.latest_reply:
                    handlers['forum'].read_latest_reply(args)
                elif hasattr(args, 'is_agree') and args.is_agree:
                    handlers['forum'].read_is_agree(args)
                elif hasattr(args, 'status') and args.status:
                    handlers['forum'].read_status(args)
            elif hasattr(args, 'solution') and args.solution:
                if hasattr(args, 'status') and args.status:
                    handlers['solution'].read_status(args)
            elif hasattr(args, 'atom_tasks') and args.atom_tasks:
                if hasattr(args, 'next_todo') and args.next_todo:
                    handlers['atom-tasks'].read_next_todo(args)
                elif hasattr(args, 'status') and args.status:
                    handlers['atom-tasks'].read_list_status(args)
                else:
                    handlers['atom-tasks'].read(args)
        elif args.action == 'add':
            if hasattr(args, 'forum') and args.forum:
                handlers['forum'].write_comment(args)
            elif hasattr(args, 'solution') and args.solution:
                if hasattr(args, 'fact') and args.fact:
                    handlers['solution'].add_fact(args)
                elif hasattr(args, 'dilemma') and args.dilemma:
                    handlers['solution'].add_dilemma(args)
                elif hasattr(args, 'hypothesis') and args.hypothesis:
                    handlers['solution'].add_hypothesis(args)
                elif hasattr(args, 'validation') and args.validation:
                    handlers['solution'].add_validation(args)
                elif hasattr(args, 'execution') and args.execution:
                    handlers['solution'].add_execution(args)
                elif hasattr(args, 'reference') and args.reference:
                    handlers['solution'].add_reference(args)
            elif hasattr(args, 'atom_tasks') and args.atom_tasks:
                if hasattr(args, 'title') and args.title:
                    handlers['atom-tasks'].add_task(args)
                elif hasattr(args, 'task') and args.task:
                    handlers['atom-tasks'].add_task(args)
        elif args.action == 'update':
            if hasattr(args, 'forum') and args.forum:
                handlers['forum'].update_status(args)
            elif hasattr(args, 'solution') and args.solution:
                handlers['solution'].update_status(args)
            elif hasattr(args, 'atom_tasks') and args.atom_tasks:
                if hasattr(args, 'index') and args.index is not None:
                    handlers['atom-tasks'].update_task_status(args)
                else:
                    print("❌ 更新atom-tasks必须提供--index参数")
                    return
            else:
                print("❌ 暂不支持该资源的update")
                return
    except Exception as e:
        print(f"❌ 执行出错: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()


