# -*- coding: utf-8 -*-
from __future__ import annotations

from src.backend.msgCenter_server.handlers.anki.create_cards import anki_create_cards


def test_anki_create_cards_accepts_valid_payload():
    resp = anki_create_cards(
        ctx=None,
        request_id="rid_1",
        data={
            "schemaVersion": 1,
            "cards": [
                {"Q": ["[[a]]"], "A": []},
                {"Q": ["[[b]]", "[[c]]"], "A": ["[[d]]"]},
            ],
        },
    )
    assert resp["type"] == "anki:create-cards:completed"
    assert resp["request_id"] == "rid_1"
    assert resp["status"] == "accepted"
    assert resp["code"] == 202
    assert resp["data"]["count"] == 2


def test_anki_create_cards_rejects_invalid_payload():
    resp = anki_create_cards(
        ctx=None,
        request_id="rid_2",
        data={
            "schemaVersion": 1,
            "cards": [
                {"Q": [], "A": []},
            ],
        },
    )
    assert resp["type"] == "anki:create-cards:failed"
    assert resp["request_id"] == "rid_2"
    assert resp["code"] == 400

