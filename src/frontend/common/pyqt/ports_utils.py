#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PyQt 前端端口解析工具

职责：
- 基于 LaunchConfig.logs_dir + launcher.ports.read_runtime_ports 统一解析 runtime-ports.json；
- 提供 resolve_frontend_ports，供 pdf-home / pdf-viewer / simple_web_window_app 复用；
- 严格校验必需端口（url_port/msgCenter_port/pdfFile_port），不做静默兜底。
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, Any, Optional, Tuple

from src.launcher.ports import read_runtime_ports as _read_runtime_ports  # type: ignore
from src.frontend.common.launch_config import LaunchConfig


def _pick_int(data: Dict[str, Any], keys: list[str]) -> Optional[int]:
  """
  从 dict 中按 keys 顺序挑出首个可转为 int 的值。

  Args:
      data: 源字典
      keys: 候选键列表
  """
  for key in keys:
    if key in data and data[key] is not None:
      try:
        return int(data[key])
      except Exception:  # pragma: no cover - 容错
        continue
  return None


def resolve_frontend_ports(config: LaunchConfig) -> Tuple[int, int, int, Dict[str, Any]]:
  """
  解析前端运行所需的 url_port/msgCenter_port/pdfFile_port。

  优先级：
  - 若 LaunchConfig 中显式指定 url_port/msgCenter_port/pdfFile_port，则优先使用；
  - 否则从 logs_dir/runtime-ports.json 中读取；
  - 若仍缺失，则抛出 RuntimeError（Fail-Fast）。
  """
  logs_dir = getattr(config, "logs_dir", None)
  if not logs_dir:
    raise RuntimeError("缺少 logs_dir：请在 LaunchConfig.logs_dir 指定或通过 CLI --logs-dir 传入")

  base = Path(logs_dir)
  data = _read_runtime_ports(base) or {}

  vite_port = _pick_int(data, ["vite_port", "npm_port"])
  msg_port_json = _pick_int(data, ["msgCenter_port", "ws_port"])
  pdf_port_json = _pick_int(data, ["pdfFile_port", "pdf_port"])

  extras: Dict[str, Any] = {
    k: v
    for k, v in data.items()
    if k not in ("vite_port", "npm_port", "msgCenter_port", "ws_port", "pdfFile_port", "pdf_port")
  }

  # 统一 url_port 解析：CLI / LaunchConfig 参数优先；否则从 extras.url_port / vite_port 读取
  url_port_json = extras.get("url_port")

  def _to_int_or_none(v: Any) -> Optional[int]:
    try:
      return int(v) if v is not None else None
    except Exception:
      return None

  url_port = _to_int_or_none(
    config.url_port
    if config.url_port is not None
    else (url_port_json or config.vite_port or vite_port)
  )
  msgCenter_port = _to_int_or_none(
    config.msgCenter_port if config.msgCenter_port is not None else msg_port_json
  )
  pdfFile_port = _to_int_or_none(
    config.pdfFile_port if config.pdfFile_port is not None else pdf_port_json
  )

  missing = []
  if url_port is None:
    missing.append("url_port (或 vite_port)")
  if msgCenter_port is None:
    missing.append("msgCenter_port")
  if pdfFile_port is None:
    missing.append("pdfFile_port")

  if missing:
    runtime_data = {
      "vite": vite_port,
      "msgCenter": msg_port_json,
      "pdfFile": pdfFile_port,
      "url": url_port_json,
    }
    where = f"{base}/runtime-ports.json"
    raise RuntimeError(
      "启动前端失败，端口缺失：{missing}\n"
      "runtime-ports.json: {runtime_data}\n"
      "位置：{where}".format(
        missing=", ".join(missing),
        runtime_data=runtime_data,
        where=where,
      )
    )

  return int(url_port), int(msgCenter_port), int(pdfFile_port), extras

