from dataclasses import dataclass
from ai_log.repositories.solution_repository import SolutionRepository
from ai_log.utils.time_id import now_compact_ts, now_iso


class SolutionService:
    def __init__(self, repo: SolutionRepository | None = None) -> None:
        self.repo = repo or SolutionRepository()

    def create(self, initiator: str, summary: str, user_input: str, forum_reference: str, role: str | None = None, ts: str | None = None) -> str:
        ts = ts or now_compact_ts()
        data = self.repo.build_new(
            initiator=initiator,
            summary=summary,
            user_input=user_input,
            forum_reference=forum_reference,
            role=role,
            creation_time=now_iso(),
        )
        self.repo.save_new(ts, data)
        return ts

    def _get_solution(self, solution_key: str) -> tuple:
        file_path = self.repo.find_file(solution_key)
        if not file_path:
            raise FileNotFoundError(f"找不到solution文件: {solution_key}")
        data = self.repo.load(file_path)
        if not data or 'solution' not in data:
            raise FileNotFoundError(f"找不到solution内容: {file_path}")
        return file_path, data

    def set_section(self, solution_key: str, section: str, summary: str, details: str) -> str:
        file_path, data = self._get_solution(solution_key)
        solution = data.setdefault('solution', {})
        solution.setdefault(section, {})
        solution[section] = {"summary": summary or "", "details": details or ""}
        self.repo.save(file_path, data)
        return section

    def add_reference(self, solution_key: str, reference: str) -> str:
        file_path, data = self._get_solution(solution_key)
        solution = data.setdefault('solution', {})
        refs = solution.setdefault('references', [])
        refs.append(reference)
        self.repo.save(file_path, data)
        return "reference"


