#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI助手上下文同步工具
用于在Claude Code和Kilocode之间同步项目状态和工作进展
"""

import os
import sys
import argparse
from datetime import datetime
from pathlib import Path


class AIContextSyncer:
    """AI助手上下文同步器"""

    def __init__(self):
        self.project_root = Path.cwd()
        self.claude_md = self.project_root / "CLAUDE.md"
        self.kilocode_context = self.project_root / ".kilocode" / "rules" / "memory-bank" / "context.md"
        self.working_logs_dir = self.project_root / "AItemp"
        self.ai_comm_dir = self.project_root / "AI-communication"

        # 确保目录存在
        self.working_logs_dir.mkdir(exist_ok=True)
        self.ai_comm_dir.mkdir(exist_ok=True)

    def sync_progress(self, progress_description, task_type="协作", priority="normal"):
        """
        同步工作进展到所有AI助手

        Args:
            progress_description: 工作进展描述
            task_type: 任务类型 (协作/开发/调试/测试/文档)
            priority: 优先级 (low/normal/high/urgent)
        """
        timestamp = datetime.now()
        timestamp_str = timestamp.strftime('%Y%m%d%H%M%S')

        print(f"🔄 开始同步工作进展：{progress_description}")

        # 1. 更新Claude的上下文
        self._update_claude_context(progress_description, timestamp, task_type, priority)
        print("✅ 已更新Claude Code上下文")

        # 2. 更新Kilocode的memory-bank
        self._update_kilocode_context(progress_description, timestamp, task_type, priority)
        print("✅ 已更新Kilocode memory-bank")

        # 3. 创建工作日志
        self._create_working_log(progress_description, timestamp_str, task_type)
        print("✅ 已创建工作日志")

        # 4. 记录到ai-log系统
        self._log_to_ai_communication(progress_description, timestamp_str)
        print("✅ 已记录到AI通信系统")

        print(f"🎉 同步完成！时间戳：{timestamp_str}")

    def _update_claude_context(self, description, timestamp, task_type, priority):
        """更新CLAUDE.md文件"""

        # 读取现有内容
        if self.claude_md.exists():
            content = self.claude_md.read_text(encoding='utf-8')
        else:
            content = ""

        # 检查是否已有AI协作记录部分
        ai_section_start = "# AI助手协作记录 (自动维护)"

        if ai_section_start in content:
            # 更新现有部分
            parts = content.split(ai_section_start)
            base_content = parts[0].rstrip()
        else:
            # 添加新部分
            base_content = content.rstrip()

        # 生成新的协作记录部分
        priority_emoji = {"low": "🔵", "normal": "🟢", "high": "🟡", "urgent": "🔴"}
        new_section = f"""
# AI助手协作记录 (自动维护)

## 最近工作进展 [{timestamp.strftime('%Y-%m-%d %H:%M')}]
{priority_emoji.get(priority, '🟢')} **{task_type}**: {description}

## 当前项目状态
- 最后更新: {timestamp.strftime('%Y年%m月%d日 %H:%M')}
- 工作重心: {description}
- 优先级: {priority}

## Kilocode协作状态
- 上下文已同步: ✅
- 工作日志已创建: ✅
- 可以无缝接管任务

## 下次AI助手启动提醒
- 请检查最新的工作进展
- 关注当前任务的优先级
- 如有疑问可查看AItemp/目录下的详细工作日志
"""

        # 写入更新后的内容
        updated_content = base_content + new_section
        self.claude_md.write_text(updated_content, encoding='utf-8')

    def _update_kilocode_context(self, description, timestamp, task_type, priority):
        """更新Kilocode的memory-bank/context.md - 采用追加方式"""

        # 确保目录存在
        self.kilocode_context.parent.mkdir(parents=True, exist_ok=True)

        # 读取现有内容
        if self.kilocode_context.exists():
            existing_content = self.kilocode_context.read_text(encoding='utf-8')
        else:
            existing_content = ""

        # 生成要追加的内容
        new_sync_entry = f"""

---
## AI助手协作同步 [{timestamp.strftime('%Y-%m-%d %H:%M')}]

**同步信息**：
- 来源：Claude Code 协作交接
- 任务：{description}
- 类型：{task_type}
- 优先级：{priority}
- 同步时间：{timestamp.strftime('%Y年%m月%d日 %H:%M')}

**Claude Code工作成果**：
- 任务描述：{description}
- 状态：已完成分析和准备工作，交接给Kilocode继续处理

**接管提醒**：
- 请检查是否有相关的工作日志在AItemp/目录下
- 可参考Claude Code在CLAUDE.md中记录的上下文信息
- 按照标准流程进行sequentialthinking分析

**下一步建议**：
1. 分析当前任务的具体要求和背景
2. 检查Claude Code提供的前期工作成果
3. 确定具体的实施方案和测试计划
4. 开始执行任务

"""

        # 采用追加方式更新文件
        updated_content = existing_content + new_sync_entry
        self.kilocode_context.write_text(updated_content, encoding='utf-8')

    def _create_working_log(self, description, timestamp_str, task_type):
        """创建符合kilocode格式的工作日志"""

        # 获取最近的工作日志文件名
        existing_logs = list(self.working_logs_dir.glob("*-AI-Working-log.md"))
        if existing_logs:
            latest_log = max(existing_logs, key=lambda x: x.name)
            previous_log = latest_log.name
        else:
            previous_log = "无前置日志"

        log_content = f"""# 上次目标和结果(要非常具体)
## 上次记录的文件名
{previous_log}

## 执行目标
AI助手协作交接：{description}

## 后续处理
任务已通过ai-sync.py同步到所有AI助手

## 结果
✅ 协作状态同步完成，Kilocode可以无缝接管

# 本次目标和实现方法(要非常具体)
## 目标
{description}

## 任务类型({task_type.lower()}|debug|test|docs)
{task_type.lower()}

## 实现方法
1. 分析Claude Code提供的背景信息和前期工作
2. 根据任务性质制定具体的实施计划
3. 按照标准流程进行开发/调试/测试
4. 确保代码质量和功能完整性
5. 更新相关文档和配置

## 预期结果
- 任务按计划完成
- 代码质量符合项目标准
- 相关文档得到更新
- 功能经过充分测试验证
"""

        # 创建工作日志文件
        log_file = self.working_logs_dir / f"{timestamp_str}-AI-Working-log.md"
        log_file.write_text(log_content, encoding='utf-8')

    def _log_to_ai_communication(self, description, timestamp_str):
        """记录到AI通信系统"""

        # 使用ai-log系统记录这次协作
        try:
            forum_data = {
                "forumDiscussionRecord": {
                    "metadata": {
                        "project": "AI助手协作",
                        "initiator": "ai-sync",
                        "createdAt": datetime.now().isoformat(),
                        "status": 0
                    },
                    "participants": [
                        {"user": "ai-sync", "role": "coordinator"},
                        {"user": "Claude Code", "role": "contributor"},
                        {"user": "Kilocode", "role": "receiver"}
                    ],
                    "discussionTopic": "AI助手工作同步",
                    "discussionContent": [
                        {
                            "messageId": "001",
                            "user": "ai-sync",
                            "time": datetime.now().isoformat(),
                            "replyTo": None,
                            "agree": None,
                            "content": f"工作进展同步：{description}",
                            "resource": [f"AItemp/{timestamp_str}-AI-Working-log.md"]
                        }
                    ],
                    "unresolvedItems": "",
                    "consensusAgreements": "AI助手状态已同步"
                }
            }

            # 写入AI通信目录
            comm_file = self.ai_comm_dir / f"{timestamp_str}-ai-sync-forum.json"
            import json
            comm_file.write_text(json.dumps(forum_data, indent=2, ensure_ascii=False), encoding='utf-8')

        except Exception as e:
            print(f"⚠️  AI通信系统记录失败（不影响主要功能）: {e}")


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description="AI助手上下文同步工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  python ai-sync.py "完成了ai-log模块的README编写"
  python ai-sync.py "修复了PDF查看器的双击问题" --type 调试 --priority high
  python ai-sync.py "添加了新的表格导出功能" --type 开发 --priority normal
        """
    )

    parser.add_argument('description', help='工作进展描述')
    parser.add_argument('--type', default='协作',
                       choices=['协作', '开发', '调试', '测试', '文档'],
                       help='任务类型 (默认: 协作)')
    parser.add_argument('--priority', default='normal',
                       choices=['low', 'normal', 'high', 'urgent'],
                       help='优先级 (默认: normal)')

    args = parser.parse_args()

    # 创建同步器并执行同步
    syncer = AIContextSyncer()
    syncer.sync_progress(args.description, args.type, args.priority)


if __name__ == "__main__":
    main()