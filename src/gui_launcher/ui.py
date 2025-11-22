#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UI Layer

说明：
- 仍遵循：模块导入阶段不直接依赖 PyQt6（在函数内部延迟导入）；
- 提供可折叠的 PDF‑Home/Viewer 参数面板与日志面板构建器；
- 仅负责视图构建与输入收集，业务与启动逻辑位于 controller/services。
"""
from __future__ import annotations

from typing import Any, Dict


def get_version() -> str:
    return "0.2-collapsible"


def build_param_panels(parent: Any) -> Dict[str, Any]:
    """
    构建参数与日志的可折叠面板（延迟导入 PyQt6）。
    返回一个 dict：
    - view: 根 QWidget，可直接添加到上层布局
    - inputs: 访问控件的句柄
    - append_log(msg:str), clear_log() 方法
    """
    # 延迟导入 PyQt6，避免测试环境在 import 阶段报缺依赖
    from PyQt6.QtWidgets import QWidget, QVBoxLayout, QGroupBox, QFormLayout, QLineEdit, QSpinBox, QDoubleSpinBox, QPlainTextEdit, QPushButton, QHBoxLayout
    from PyQt6.QtCore import Qt

    root = QWidget(parent)
    lay = QVBoxLayout(root)
    lay.setContentsMargins(0, 0, 0, 0)
    lay.setSpacing(8)

    # ---- PDF-Home（占位参数，可扩展） ----
    home_box = QGroupBox("PDF‑Home 参数（可折叠）")
    home_box.setCheckable(True); home_box.setChecked(False)
    home_lay = QFormLayout(home_box)
    home_lay.setLabelAlignment(Qt.AlignmentFlag.AlignRight)
    home_lay.setFormAlignment(Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignTop)
    # 目前无额外参数，占位一行
    _home_placeholder = QLineEdit(); _home_placeholder.setPlaceholderText("（当前无额外参数）")
    _home_placeholder.setEnabled(False)
    home_lay.addRow("备注:", _home_placeholder)
    lay.addWidget(home_box)

    # ---- PDF-Viewer 参数 ----
    viewer_box = QGroupBox("PDF‑Viewer 参数（可折叠）")
    viewer_box.setCheckable(True); viewer_box.setChecked(False)
    fv = QFormLayout(viewer_box)
    fv.setLabelAlignment(Qt.AlignmentFlag.AlignRight)
    fv.setFormAlignment(Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignTop)
    viewer_pdf_id = QLineEdit(); viewer_pdf_id.setText("c83c60c58ad2")
    viewer_page = QSpinBox(); viewer_page.setRange(0, 100000); viewer_page.setValue(0)
    viewer_position = QDoubleSpinBox(); viewer_position.setRange(0.0, 100.0); viewer_position.setDecimals(2); viewer_position.setValue(0.0)
    viewer_anchor = QLineEdit(); viewer_anchor.setText("pdfanchor-44e42f698f9a")
    viewer_annot = QLineEdit(); viewer_annot.setText("pdfannotation-Be5k52a7Nhowwoy8")
    viewer_outline = QLineEdit(); viewer_outline.setText("outlineItem-E4QkTr7F")
    fv.addRow("pdf_id:", viewer_pdf_id)
    fv.addRow("page_at:", viewer_page)
    fv.addRow("position%:", viewer_position)
    fv.addRow("anchor_id:", viewer_anchor)
    fv.addRow("annotation_id:", viewer_annot)
    fv.addRow("outline_item_id:", viewer_outline)
    lay.addWidget(viewer_box)

    # ---- 日志面板 ----
    log_box = QGroupBox("日志输出（可折叠）")
    log_box.setCheckable(True); log_box.setChecked(True)
    log_lay = QVBoxLayout(log_box)
    log_view = QPlainTextEdit(); log_view.setReadOnly(True); log_view.setMinimumHeight(120)
    log_buttons = QHBoxLayout()
    btn_clear = QPushButton("清空")
    log_buttons.addStretch(1); log_buttons.addWidget(btn_clear)
    log_lay.addWidget(log_view); log_lay.addLayout(log_buttons)
    lay.addWidget(log_box)

    def append_log(msg: str) -> None:
        try:
            log_view.appendPlainText(str(msg))
        except Exception:
            pass

    def clear_log() -> None:
        try:
            log_view.clear()
        except Exception:
            pass

    btn_clear.clicked.connect(clear_log)  # type: ignore[arg-type]

    return {
        "view": root,
        "inputs": {
            "viewer_pdf_id": viewer_pdf_id,
            "viewer_page": viewer_page,
            "viewer_position": viewer_position,
            "viewer_anchor_id": viewer_anchor,
            "viewer_annotation_id": viewer_annot,
            "viewer_outline_item_id": viewer_outline,
        },
        "append_log": append_log,
        "clear_log": clear_log,
    }
