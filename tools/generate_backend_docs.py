"""
生成后端 API 文档的辅助脚本（基于 pdoc）

使用方式（在虚拟环境中）：

    python -m pip install pdoc
    python tools/generate_backend_docs.py

生成结果默认输出到 AItemp/docs/backend-api 下，不污染项目正式 docs 结构。
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def get_project_root() -> Path:
    this_file = Path(__file__).resolve()
    return this_file.parent.parent


def main() -> int:
    project_root = get_project_root()
    output_dir = project_root / "AItemp" / "docs" / "backend-api"

    # 要生成文档的模块列表（首批）
    modules = [
        "src.backend.msgCenter_server.standard_server",
        "src.backend.pdfFile_server.embed_fileserver",
        "src.backend.launcher",
    ]

    # 构造 pdoc 命令
    cmd = [
        sys.executable,
        "-m",
        "pdoc",
        *modules,
        "--html",
        "--output-dir",
        str(output_dir),
        "--force",
    ]

    print("[generate_backend_docs] project_root:", project_root)
    print("[generate_backend_docs] output_dir:", output_dir)
    print("[generate_backend_docs] running:", " ".join(cmd))

    try:
        result = subprocess.run(cmd, cwd=str(project_root))
    except FileNotFoundError:
        print("[generate_backend_docs] 错误：未找到 Python 解释器，请在虚拟环境中运行此脚本。")
        return 1

    if result.returncode != 0:
        print(
            "[generate_backend_docs] pdoc 执行失败，"
            "请确认已在虚拟环境中安装： python -m pip install pdoc"
        )
    else:
        print("[generate_backend_docs] 文档生成完成。可以在浏览器中打开 AItemp/docs/backend-api 下的 HTML 文件。")

    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())

