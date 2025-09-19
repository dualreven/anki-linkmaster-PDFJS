from pathlib import Path


def glob_first(base_dir: Path, pattern: str) -> Path | None:
    for file_path in base_dir.glob(pattern):
        if file_path.is_file():
            return file_path
    return None


def find_by_timestamp_or_name(base_dir: Path, timestamp_or_name: str, ts_pattern: str, name_pattern: str) -> Path | None:
    if not base_dir.exists():
        return None
    if timestamp_or_name.isdigit() and len(timestamp_or_name) == 14:
        pattern = ts_pattern.format(ts=timestamp_or_name)
    else:
        pattern = name_pattern.format(name=timestamp_or_name)
    return glob_first(base_dir, pattern)


