from pathlib import Path
from typing import Dict, Any, Optional
from ai_log.repositories.json5_store import read_json, write_json
from ai_log.repositories.file_finder import find_by_timestamp_or_name


DATA_DIR = Path("AI-communication")
TASK_DIR = DATA_DIR


class AtomTasksRepository:
    def __init__(self) -> None:
        TASK_DIR.mkdir(exist_ok=True)

    def build_new(self, project_name: str, description: str, refers: list, total_count: int) -> Dict[str, Any]:
        return {
            "taskBackground": {
                "status": 0,
                "projectName": project_name,
                "description": description,
                "refers": refers,
                "totalAtomTaskCount": total_count,
            },
            "atomTaskList": [],
        }

    def save_new(self, timestamp: str, data: Dict[str, Any]) -> Path:
        filename = TASK_DIR / f"{timestamp}-atom-tasks.json"
        write_json(filename, data)
        return filename

    def find_file(self, key: str) -> Optional[Path]:
        return find_by_timestamp_or_name(
            TASK_DIR,
            key,
            ts_pattern="{ts}-atom-tasks*.json",
            name_pattern="*-atom-tasks-{name}.json",
        )

    def load(self, file_path: Path) -> Optional[Dict[str, Any]]:
        return read_json(file_path)

    def save(self, file_path: Path, data: Dict[str, Any]) -> None:
        write_json(file_path, data)


