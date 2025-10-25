# -*- coding: utf-8 -*-
"""
最小测试（占位）：验证 BackendLauncher 能读取 logs/debug-info.json 中的 outline 标志。
说明：
- 由于当前测试环境可能缺少 PyQt/运行上下文，标记为 skip；
- 仅校验工具方法 _is_outline_enabled_flag 的读取逻辑。
"""
import json
from pathlib import Path
import pytest


@pytest.mark.skip(reason="依赖实际运行目录与 PyQt 环境，此处仅为占位/契约测试")
def test_outline_flag_read_from_debug_info(tmp_path, monkeypatch):
    # 构造临时 logs 目录与 debug-info.json
    logs_dir = tmp_path / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    debug_path = logs_dir / "debug-info.json"
    content = {"outline": 1, "_metadata": {"updated_by": "test"}}
    debug_path.write_text(json.dumps(content, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # 覆盖 backend.launcher 的 project_root 到临时目录
    import src.backend.launcher as launcher
    monkeypatch.setattr(launcher, "project_root", tmp_path)

    # 实例化 BackendLauncher 并检测读取标志
    inst = launcher.BackendLauncher(parent_app=None)
    assert inst._is_outline_enabled_flag() is True

