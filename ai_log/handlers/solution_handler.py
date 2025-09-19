from ai_log.handlers.base import BaseHandler, FORUM_DIR
from ai_log.repositories.file_finder import find_by_timestamp_or_name
from ai_log.services.solution_service import SolutionService


class SolutionHandler(BaseHandler):
    def __init__(self):
        super().__init__()
        self.service = SolutionService()

    def find_solution_file(self, timestamp_or_name):
        path = find_by_timestamp_or_name(
            FORUM_DIR,
            timestamp_or_name,
            ts_pattern="{ts}-solution.json",
            name_pattern="*-solution-{name}.json",
        )
        if path:
            return path
        return find_by_timestamp_or_name(
            FORUM_DIR,
            timestamp_or_name,
            ts_pattern="{ts}-solution-*.json",
            name_pattern="*-solution-{name}.json",
        )

    def create(self, args):
        if not hasattr(args, 'solution_name') or not args.solution_name:
            print("❌ 必须提供solution参数")
            return
        initiator = getattr(args, 'initiator', None)
        summary = getattr(args, 'summary', None)
        user_input = getattr(args, 'userInput', None)
        forum_ref = getattr(args, 'forumReference', None)
        role = getattr(args, 'role', None)
        if not all([initiator, summary, user_input, forum_ref]):
            print("❌ 创建 solution 需要 --initiator --summary --userInput --forumReference")
            return
        ts_override = args.solution if hasattr(args, 'solution') and str(args, 'solution').isdigit() and len(str(args.solution)) == 14 else None
        ts = self.service.create(initiator=initiator, summary=summary, user_input=user_input, forum_reference=forum_ref, role=role, ts=ts_override)
        filename = f"{FORUM_DIR}/{ts}-solution.json"
        print(f"✅ Solution记录创建成功: {filename}")

    def add_fact(self, args):
        if not hasattr(args, 'solution') or not args.solution:
            print("❌ 必须提供solution参数")
            return
        summary = getattr(args, 'summary', '')
        details = getattr(args, 'detals', '')
        if not summary and not details:
            print("❌ 缺少 --summary/--detals")
            return
        try:
            self.service.set_section(args.solution, 'fact', summary, details)
        except FileNotFoundError as e:
            print(f"❌ {e}")
            return
        print("ok")

    def add_dilemma(self, args):
        if not hasattr(args, 'solution') or not args.solution:
            print("❌ 必须提供solution参数")
            return
        summary = getattr(args, 'summary', '')
        details = getattr(args, 'detals', '')
        if not summary and not details:
            print("❌ 缺少 --summary/--detals")
            return
        try:
            self.service.set_section(args.solution, 'dilemma', summary, details)
        except FileNotFoundError as e:
            print(f"❌ {e}")
            return
        print("ok")

    def add_hypothesis(self, args):
        summary = getattr(args, 'summary', '')
        details = getattr(args, 'detals', '')
        if not summary and not details:
            print("❌ 缺少 --summary/--detals")
            return
        try:
            self.service.set_section(args.solution, 'hypothesis', summary, details)
        except FileNotFoundError as e:
            print(f"❌ {e}")
            return
        print("ok")

    def add_validation(self, args):
        summary = getattr(args, 'summary', '')
        details = getattr(args, 'detals', '')
        if not summary and not details:
            print("❌ 缺少 --summary/--detals")
            return
        try:
            self.service.set_section(args.solution, 'validation', summary, details)
        except FileNotFoundError as e:
            print(f"❌ {e}")
            return
        print("ok")

    def add_execution(self, args):
        summary = getattr(args, 'summary', '')
        details = getattr(args, 'detals', '')
        if not summary and not details:
            print("❌ 缺少 --summary/--detals")
            return
        try:
            self.service.set_section(args.solution, 'execution', summary, details)
        except FileNotFoundError as e:
            print(f"❌ {e}")
            return
        print("ok")

    def add_reference(self, args):
        try:
            self.service.add_reference(args.solution, args.reference)
        except FileNotFoundError as e:
            print(f"❌ {e}")
            return
        print("ok")

    def read_status(self, args):
        solution_file = self.find_solution_file(args.solution)
        if not solution_file:
            print(f"❌ 找不到solution记录: {args.solution}")
            return
        data = self.read_json(solution_file)
        if not data:
            print("❌ 数据格式无效")
            return
        solution = data.get('solution')
        if solution and isinstance(solution, dict):
            print(solution.get('status', None))
            return
        print("❌ solution 文件结构不符合规范（缺少 solution 根对象）")

    def update_status(self, args):
        solution_file = self.find_solution_file(args.solution)
        if not solution_file:
            print(f"❌ 找不到solution记录: {args.solution}")
            return
        data = self.read_json(solution_file)
        if not data:
            print("❌ 数据格式无效")
            return
        try:
            new_status = int(args.status) if hasattr(args, 'status') else None
        except Exception:
            print("❌ 状态无效，需为 0 或 1")
            return
        solution = data.setdefault('solution', {})
        solution['status'] = new_status
        self.write_json(solution_file, data)
        print("ok")


