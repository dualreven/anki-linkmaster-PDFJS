from ai_log.repositories.atom_tasks_repository import AtomTasksRepository
from ai_log.utils.time_id import now_compact_ts


class AtomTasksService:
    def __init__(self, repo: AtomTasksRepository | None = None) -> None:
        self.repo = repo or AtomTasksRepository()

    def create(self, project_name: str, description: str, refers: list, total_count: int, ts: str | None = None) -> str:
        ts = ts or now_compact_ts()
        data = self.repo.build_new(project_name, description, refers, total_count)
        self.repo.save_new(ts, data)
        return ts

    def add_task(self, key: str, title: str, content: str) -> int:
        file_path = self.repo.find_file(key)
        if not file_path:
            raise FileNotFoundError(f"找不到atom-tasks记录: {key}")
        data = self.repo.load(file_path)
        if not data:
            raise FileNotFoundError(f"找不到atom-tasks文件: {file_path}")
        new_task = {
            "title": title,
            "content": content,
            "status": 0,
            "index": len(data['atomTaskList']) + 1,
            "feedback": "[待完成任务反馈填写]",
        }
        data['atomTaskList'].append(new_task)
        self.repo.save(file_path, data)
        return new_task["index"]

    def update_status(self, key: str, index: int, status: int) -> None:
        file_path = self.repo.find_file(key)
        if not file_path:
            raise FileNotFoundError(f"找不到atom-tasks记录: {key}")
        data = self.repo.load(file_path)
        if not data:
            raise FileNotFoundError(f"找不到atom-tasks文件: {file_path}")
        for task in data['atomTaskList']:
            if task.get('index') == index:
                task['status'] = status
                self.repo.save(file_path, data)
                return
        raise ValueError(f"找不到任务索引 {index}")


