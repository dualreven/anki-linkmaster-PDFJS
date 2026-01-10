# -*- coding: utf-8 -*-
from __future__ import annotations

from typing import Any, Dict, Optional

from src.backend.msgCenter_server.core.message_types import MessageType
from src.backend.msgCenter_server.standard_protocol import StandardMessageHandler


def _validate_payload_or_raise(data: Dict[str, Any]) -> Dict[str, Any]:
    cards = data.get("cards")
    if not isinstance(cards, list):
        raise ValueError("data.cards 必须为数组")

    for idx, card in enumerate(cards):
        if not isinstance(card, dict):
            raise ValueError(f"data.cards[{idx}] 必须为对象")

        title = card.get("title")
        q = card.get("Q")
        a = card.get("A")

        if not isinstance(title, str):
            raise ValueError(f"data.cards[{idx}].title 必须为 string")
        if not isinstance(q, list):
            raise ValueError(f"data.cards[{idx}].Q 必须为 string[]")
        if not isinstance(a, list):
            raise ValueError(f"data.cards[{idx}].A 必须为 string[]")

        for t in q:
            if not isinstance(t, str) or not t.strip():
                raise ValueError(f"data.cards[{idx}].Q 存在非法 annotation-id: {t!r}")
        for t in a:
            if not isinstance(t, str) or not t.strip():
                raise ValueError(f"data.cards[{idx}].A 存在非法 annotation-id: {t!r}")

    return {"cards": cards}


def card_planner_final_output(ctx: Any, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Card Planner 最终制卡输出（本仓仅做协议接收与严格校验）

    - 通过：返回 completed（200）
    - 失败：返回 failed（400）并携带明确原因
    """
    request_id = request_id or StandardMessageHandler.generate_request_id()
    try:
        payload = _validate_payload_or_raise(data or {})
        count = len(payload["cards"])
        return StandardMessageHandler.build_response(
            MessageType.CARD_PLANNER_FINAL_OUTPUT_COMPLETED,
            request_id,
            status="success",
            code=200,
            message=f"final-output 已接收并校验通过（cards={count}）",
            data={"count": count},
        )
    except Exception as exc:
        return StandardMessageHandler.build_error_response(
            request_id,
            "CARD_PLANNER_FINAL_OUTPUT_INVALID",
            f"final-output 校验失败: {exc}",
            message_type=MessageType.CARD_PLANNER_FINAL_OUTPUT_FAILED,
            code=400,
        )

