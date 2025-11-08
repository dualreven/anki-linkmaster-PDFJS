#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UI Layer (Skeleton)

目标：
- 提供 GUI 启动器的“纯 UI 构建”骨架，避免在导入阶段引入 PyQt 依赖与副作用；
- 后续将从 gui_launcher.py 逐步迁移控件构建与布局代码至此模块；
- 当前仅提供占位 API，确保可 import 与后续可演进。

注意：
- 本模块不直接导入 PyQt6；测试环境可能缺少 GUI 依赖。
- 所有 I/O 与外部调用应位于 services/controller 层，本模块保持纯视图职责。
"""

from __future__ import annotations

def get_version() -> str:
    """
    返回 UI 层骨架版本号，便于在测试与诊断输出中识别。
    """
    return "0.1-skeleton"


# 未来迁移方向（仅注释，不执行）：
# class GUILauncherUI:
#     def __init__(self) -> None: ...
#     def build(self) -> "QWidget": ...
#     def bind(self, controller: "Controller") -> None: ...

