# -*- coding: utf-8 -*-
from __future__ import annotations

from src.backend.msgCenter_server.handlers.card_planner.final_output import (
    card_planner_final_output,
)


def test_card_planner_final_output_success():
    cards = [
        {"title": "", "Q": ["ann_1"], "A": ["ann_2"]},
        {"title": "t", "Q": ["ann_3"], "A": []},
    ]
    resp = card_planner_final_output(
        ctx=None,
        request_id="rid_1",
        data={
            "cards": cards
        },
    )
    assert resp["type"] == "card-planner:final-output:completed"
    assert resp["request_id"] == "rid_1"
    assert resp["status"] == "success"
    assert resp["code"] == 200
    assert resp["data"]["count"] == 2
    assert resp["data"]["cards"] == cards


def test_card_planner_final_output_invalid_payload():
    resp = card_planner_final_output(
        ctx=None,
        request_id="rid_2",
        data={"cards": [{"title": 1, "Q": [], "A": []}]},
    )
    assert resp["type"] == "card-planner:final-output:failed"
    assert resp["request_id"] == "rid_2"
    assert resp["code"] == 400
    assert "title" in resp["error"]["message"]
