import sys
from pathlib import Path


def check_file(path: Path, must_include: list[str]) -> list[str]:
    errors: list[str] = []
    if not path.exists():
        return [f"[ERROR] Missing file: {path}"]
    try:
        text = path.read_text(encoding="utf-8")
    except Exception as e:
        return [f"[ERROR] Read failed (utf-8): {path}: {e}"]

    if "\r" in text:
        errors.append(f"[ERROR] Found CR (\\r) characters in: {path}")

    for key in must_include:
        if key not in text:
            errors.append(f"[ERROR] Missing key '{key}' in {path}")

    return errors


def main() -> int:
    repo = Path(__file__).resolve().parents[1]

    ai_readme = repo / "README.ai_launcher.md"
    backend_readme = repo / "src" / "backend" / "README.md"

    ai_keys = [
        "功能概览",
        "start 执行流程",
        "stop 命令",
        "status 命令",
    ]
    backend_keys = [
        "职责概览",
        "端口识别策略",
        "状态文件",
    ]

    errors: list[str] = []
    errors += check_file(ai_readme, ai_keys)
    errors += check_file(backend_readme, backend_keys)

    if errors:
        for line in errors:
            print(line)
        print("[RESULT] README tests: FAIL")
        return 1

    print("[RESULT] README tests: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())

