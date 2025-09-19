from ai_log.handlers.base import BaseHandler, TASK_DIR
from ai_log.repositories.file_finder import find_by_timestamp_or_name
from ai_log.services.atom_tasks_service import AtomTasksService


class AtomTasksHandler(BaseHandler):
    def __init__(self):
        super().__init__()
        self.service = AtomTasksService()

    def find_atom_tasks_file(self, timestamp_or_name):
        return find_by_timestamp_or_name(
            TASK_DIR,
            timestamp_or_name,
            ts_pattern="{ts}-atom-tasks*.json",
            name_pattern="*-atom-tasks-{name}.json",
        )

    def read(self, args):
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

    def read_list_status(self, args):
        atom_tasks_file = self.find_atom_tasks_file(args.atom_tasks)
        if not atom_tasks_file:
            print(f"❌ 找不到atom-tasks记录: {args.atom_tasks}")
            return
        data = self.read_json(atom_tasks_file)
        if not data:
            print("❌ 数据格式无效")
            return
        print(data.get('taskBackground', {}).get('status', None))

    def add_task(self, args):
        if not hasattr(args, 'atom_tasks') or not args.atom_tasks:
            print("❌ 必须提供atom_tasks参数")
            return
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
        try:
            idx = self.service.add_task(args.atom_tasks, task_title, content)
        except FileNotFoundError as e:
            print(f"❌ {e}")
            return
        print(f"✅ 任务项添加成功: {idx}")

    def create(self, args):
        if not hasattr(args, 'project_name') or not args.project_name:
            print("❌ 必须提供project_name参数")
            return
        description = getattr(args, 'description', '')
        total_count = getattr(args, 'totalAtomTaskCount', 0)
        refers = getattr(args, 'refers', [])
        ts_override = args.atom_tasks if hasattr(args, 'atom_tasks') and str(args.atom_tasks).isdigit() and len(str(args.atom_tasks)) == 14 else None
        ts = self.service.create(args.project_name, description, refers, total_count, ts_override)
        filename = f"{TASK_DIR}/{ts}-atom-tasks.json"
        print(f"✅ 原子任务创建成功: {filename}")

    def read_next_todo(self, args):
        atom_tasks_file = self.find_atom_tasks_file(args.atom_tasks)
        if not atom_tasks_file:
            print(f"❌ 找不到atom-tasks记录: {args.atom_tasks}")
            return
        data = self.read_json(atom_tasks_file)
        if not data or 'atomTaskList' not in data:
            print("❌ 数据格式无效")
            return
        for task in data['atomTaskList']:
            if task.get('status', 0) == 0:
                print("🎯 下一个待办任务:")
                print(f"   标题: {task.get('title', 'No title')}")
                print(f"   索引: {task.get('index', 0)}")
                if task.get('content'):
                    print(f"   描述: {task.get('content')}")
                return
        print("🎉 所有任务已完成！")

    def update_task_status(self, args):
        if not hasattr(args, 'index') or args.index is None:
            print("❌ 必须提供--index参数")
            return
        atom_tasks_file = self.find_atom_tasks_file(args.atom_tasks)
        if not atom_tasks_file:
            print(f"❌ 找不到atom-tasks记录: {args.atom_tasks}")
            return
        status_map = {"0": 0, "1": 1, "2": 2, "3": 3, "todo": 0, "doing": 1, "done": 2, "failed": 3}
        new_status = status_map.get(args.status, status_map.get(str(args.status), None)) if hasattr(args, 'status') else None
        if new_status is None:
            print("❌ 状态无效\n提示: 支持 0/1/2/3 或 todo/doing/done/failed\n示例: update --atom-tasks ts --index 1 --status done")
            return
        try:
            self.service.update_status(args.atom_tasks, args.index, new_status)
        except (FileNotFoundError, ValueError) as e:
            print(f"❌ {e}")
            return
        print(f"✅ 任务 {args.index} 状态已更新为 {args.status}")


