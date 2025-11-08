#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试：services.* 启动函数转发到 src.launcher.runner
"""
from __future__ import annotations

import types
import sys
from pathlib import Path

import importlib


def _install_fake_runner():
    fake = types.ModuleType("runner")
    calls = []

    def rec(name, *args, **kwargs):
        calls.append((name, args, kwargs))
        # 返回一些可断言的值
        if name.endswith("_hosted"):
            return 0 if "pdf_home" in name else 1
        if name.endswith("_cli"):
            return True
        return None

    def start_backend_cli(cfg, *, on_log=None):
        return rec("start_backend_cli", cfg, on_log=on_log)

    def start_backend_hosted(cfg, *, parent_app, on_log=None):
        return rec("start_backend_hosted", cfg, parent_app=parent_app, on_log=on_log)

    def start_pdf_home_hosted(cfg, *, parent_app, on_log=None):
        return rec("start_pdf_home_hosted", cfg, parent_app=parent_app, on_log=on_log)

    def start_pdf_viewer_hosted(cfg, *, parent_app, pdf_id=None, page_at=None, position=None,
                                anchor_id=None, annotation_id=None, outline_item_id=None, enable_outline=None, on_log=None):
        return rec("start_pdf_viewer_hosted", cfg, parent_app=parent_app, pdf_id=pdf_id, page_at=page_at,
                   position=position, anchor_id=anchor_id, annotation_id=annotation_id,
                   outline_item_id=outline_item_id, enable_outline=enable_outline, on_log=on_log)

    def start_pdf_home_cli(cfg, *, is_prod: bool, on_log=None):
        return rec("start_pdf_home_cli", cfg, is_prod=is_prod, on_log=on_log)

    def start_pdf_viewer_cli(cfg, *, is_prod: bool, pdf_id=None, page_at=None, position=None,
                             anchor_id=None, annotation_id=None, outline_item_id=None, on_log=None):
        return rec("start_pdf_viewer_cli", cfg, is_prod=is_prod, pdf_id=pdf_id, page_at=page_at,
                   position=position, anchor_id=anchor_id, annotation_id=annotation_id,
                   outline_item_id=outline_item_id, on_log=on_log)

    fake.start_backend_cli = start_backend_cli
    fake.start_backend_hosted = start_backend_hosted
    fake.start_pdf_home_hosted = start_pdf_home_hosted
    fake.start_pdf_viewer_hosted = start_pdf_viewer_hosted
    fake.start_pdf_home_cli = start_pdf_home_cli
    fake.start_pdf_viewer_cli = start_pdf_viewer_cli
    fake._calls = calls
    sys.modules['src.launcher.runner'] = fake
    return fake


def test_services_delegate_to_runner():
    fake = _install_fake_runner()
    services = importlib.import_module("src.gui_launcher.services")

    # Backend CLI
    assert services.start_backend_cli(object(), on_log=None) is True
    # Backend Hosted
    assert services.start_backend_hosted(object(), parent_app=None, on_log=None) == 1
    # pdf-home Hosted
    assert services.start_pdf_home_hosted(object(), parent_app=None, on_log=None) == 0
    # pdf-viewer Hosted
    assert services.start_pdf_viewer_hosted(object(), parent_app=None, pdf_id="x", page_at=2, position=50.0,
                                            anchor_id=None, annotation_id=None, outline_item_id="o1",
                                            enable_outline=True, on_log=None) == 1
    # pdf-home CLI
    assert services.start_pdf_home_cli(object(), is_prod=True, on_log=None) is True
    # pdf-viewer CLI
    assert services.start_pdf_viewer_cli(object(), is_prod=False, pdf_id="x", page_at=3, position=10.0,
                                         anchor_id="a", annotation_id="b", outline_item_id="c", on_log=None) is True

    names = [n for (n, *_rest) in fake._calls]
    # 基本覆盖断言
    for expected in ["start_backend_cli", "start_backend_hosted", "start_pdf_home_hosted",
                     "start_pdf_viewer_hosted", "start_pdf_home_cli", "start_pdf_viewer_cli"]:
        assert expected in names

