from pathlib import Path
from typing import Dict, Any, Optional
from ai_log.repositories.json5_store import read_json, write_json
from ai_log.repositories.file_finder import find_by_timestamp_or_name


DATA_DIR = Path("AI-communication")
FORUM_DIR = DATA_DIR


class SolutionRepository:
    def __init__(self) -> None:
        FORUM_DIR.mkdir(exist_ok=True)

    def build_new(self, initiator: str, summary: str, user_input: str, forum_reference: str, role: str | None, creation_time: str) -> Dict[str, Any]:
        return {
            "solution": {
                "initiator": initiator,
                "status": 0,  # 0:draft,1:final
                "role": role or "方案规划师 (agent-planner)",
                "summary": summary or "",
                "userInput": user_input or "",
                "creationTime": creation_time,
                "forumReference": forum_reference or "",
                "fact": {"summary": "", "details": ""},
                "dilemma": {"summary": "", "details": ""},
                "hypothesis": {"summary": "", "details": ""},
                "validation": {"summary": "", "details": ""},
                "execution": {"summary": "", "details": ""},
                "references": [],
            }
        }

    def save_new(self, timestamp: str, data: Dict[str, Any]) -> Path:
        filename = FORUM_DIR / f"{timestamp}-solution.json"
        write_json(filename, data)
        return filename

    def find_file(self, key: str) -> Optional[Path]:
        # 先匹配新规范，再兼容旧命名
        path = find_by_timestamp_or_name(
            FORUM_DIR,
            key,
            ts_pattern="{ts}-solution.json",
            name_pattern="*-solution-{name}.json",
        )
        if path:
            return path
        return find_by_timestamp_or_name(
            FORUM_DIR,
            key,
            ts_pattern="{ts}-solution-*.json",
            name_pattern="*-solution-{name}.json",
        )

    def load(self, file_path: Path) -> Optional[Dict[str, Any]]:
        return read_json(file_path)

    def save(self, file_path: Path, data: Dict[str, Any]) -> None:
        write_json(file_path, data)


