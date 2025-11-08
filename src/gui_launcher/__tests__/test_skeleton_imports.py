#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试：gui_launcher 骨架模块可导入，且暴露关键占位 API
"""
from __future__ import annotations


def test_imports_and_symbols() -> None:
    import importlib
    ui = importlib.import_module("src.gui_launcher.ui")
    services = importlib.import_module("src.gui_launcher.services")
    controller = importlib.import_module("src.gui_launcher.controller")

    assert hasattr(ui, "get_version")
    assert callable(ui.get_version)
    assert ui.get_version() == "0.1-skeleton"

    assert hasattr(services, "ensure_vite")
    assert hasattr(services, "read_runtime_ports")
    assert hasattr(services, "merge_runtime_ports")

    assert hasattr(controller, "Controller")
