from pathlib import Path
from typing import Dict, Any, Optional
from ai_log.repositories.json5_store import read_json, write_json
from ai_log.repositories.file_finder import find_by_timestamp_or_name


DATA_DIR = Path("AI-communication")
FORUM_DIR = DATA_DIR


class ForumRepository:
    def __init__(self) -> None:
        FORUM_DIR.mkdir(exist_ok=True)

    def build_new(self, name: str, user: str, timestamp: str) -> Dict[str, Any]:
        # v1 已废弃，不再使用
        return {}

    def save_new(self, timestamp: str, data: Dict[str, Any]) -> Path:
        filename = FORUM_DIR / f"{timestamp}-forum.json"
        write_json(filename, data)
        return filename

    def find_file(self, key: str) -> Optional[Path]:
        return find_by_timestamp_or_name(
            FORUM_DIR,
            key,
            ts_pattern="{ts}-forum*.json",
            name_pattern="*-forum-{name}.json",
        )

    def load(self, file_path: Path) -> Optional[Dict[str, Any]]:
        return read_json(file_path)

    def save(self, file_path: Path, data: Dict[str, Any]) -> None:
        write_json(file_path, data)


