# -*- coding: utf-8 -*-
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from src.backend.msgCenter_server.standard_protocol import StandardMessageHandler


_TOKEN_RE = re.compile(r"^\[\[[^\r\n\[\]]+\]\]$")


def _is_valid_token(token: Any) -> bool:
    if not isinstance(token, str):
        return False
    if "\n" in token or "\r" in token:
        return False
    if not _TOKEN_RE.fullmatch(token):
        return False
    inner = token[2:-2]
    # Fail-fast：内部不允许出现 "]]"
    if "]]" in inner:
        return False
    return True


def _validate_payload_or_raise(data: Dict[str, Any]) -> Dict[str, Any]:
    schema_version = data.get("schemaVersion")
    if schema_version != 1:
        raise ValueError(f"schemaVersion 必须为 1，当前={schema_version!r}")

    cards = data.get("cards")
    if not isinstance(cards, list) or len(cards) == 0:
        raise ValueError("cards 必须是非空数组")

    for idx, card in enumerate(cards):
        if not isinstance(card, dict):
            raise ValueError(f"cards[{idx}] 必须是对象")
        q = card.get("Q")
        a = card.get("A")
        if not isinstance(q, list) or not isinstance(a, list):
            raise ValueError(f"cards[{idx}] 必须包含数组字段 Q/A")
        if len(q) == 0:
            raise ValueError(f"cards[{idx}].Q 不能为空")
        for t in q:
            if not _is_valid_token(t):
                raise ValueError(f"cards[{idx}].Q 存在非法 token: {t!r}")
        for t in a:
            if not _is_valid_token(t):
                raise ValueError(f"cards[{idx}].A 存在非法 token: {t!r}")

    return {"schemaVersion": 1, "cards": cards}


def anki_create_cards(ctx: Any, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Anki 制卡请求（本仓仅做协议接收与严格校验）

    - 本处理器返回 202 accepted，表示消息中心已接收并发射 message_received 信号；
    - 实际制卡执行应由外层宿主（Anki 插件环境）或 BackendLauncher 的集成逻辑处理。
    """
    try:
        payload = _validate_payload_or_raise(data or {})
        count = len(payload["cards"])
        return StandardMessageHandler.build_response(
            "anki:create-cards:completed",
            request_id or StandardMessageHandler.generate_request_id(),
            status="accepted",
            code=202,
            message=f"制卡请求已接收（cards={count}）。实际制卡由后端/插件处理。",
            data={"count": count},
        )
    except Exception as exc:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "ANKI_CREATE_CARDS_INVALID",
            f"制卡请求校验失败: {exc}",
            message_type="anki:create-cards:failed",
            code=400,
        )
