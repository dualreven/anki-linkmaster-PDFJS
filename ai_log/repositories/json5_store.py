from pathlib import Path
import json5 as json


def ensure_parent(filepath: Path) -> None:
    filepath.parent.mkdir(parents=True, exist_ok=True)


def read_json(filepath: Path):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return None


def write_json(filepath: Path, data) -> None:
    ensure_parent(filepath)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2, allow_nan=False)


