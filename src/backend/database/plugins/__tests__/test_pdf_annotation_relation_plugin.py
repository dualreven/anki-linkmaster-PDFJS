"""PDFAnnotationRelationTablePlugin 行为测试"""

from __future__ import annotations

import logging
from typing import Dict

import pytest

from ...connection import DatabaseConnectionManager
from ...executor import SQLExecutor
from ...exceptions import DatabaseConstraintError, DatabaseValidationError
from ..pdf_info_plugin import PDFInfoTablePlugin
from ..pdf_annotation_plugin import PDFAnnotationTablePlugin
from ..pdf_annotation_relation_plugin import PDFAnnotationRelationTablePlugin
from ...plugin.event_bus import EventBus
from .fixtures.pdf_info_samples import make_pdf_info_sample
from .fixtures.pdf_annotation_samples import make_annotation_sample


@pytest.fixture
def connection_manager(tmp_path):
    DatabaseConnectionManager._instance = None  # type: ignore[attr-defined]
    db_path = tmp_path / "annotation_relation_test.db"
    manager = DatabaseConnectionManager(str(db_path))
    yield manager
    manager.close_all()
    DatabaseConnectionManager._instance = None  # type: ignore[attr-defined]


@pytest.fixture
def connection(connection_manager):
    return connection_manager.get_connection()


@pytest.fixture
def executor(connection):
    return SQLExecutor(connection)


@pytest.fixture
def event_bus():
    return EventBus()


@pytest.fixture
def pdf_info_plugin(executor, event_bus):
    plugin = PDFInfoTablePlugin(executor, event_bus, logging.getLogger("test.pdf_info"))
    plugin.enable()
    return plugin


@pytest.fixture
def annotation_plugin(executor, event_bus, pdf_info_plugin):
    plugin = PDFAnnotationTablePlugin(executor, event_bus, logging.getLogger("test.annotation"))
    plugin.enable()
    return plugin


@pytest.fixture
def relation_plugin(executor, event_bus, annotation_plugin):  # noqa: ARG001
    plugin = PDFAnnotationRelationTablePlugin(executor, event_bus, logging.getLogger("test.annotation_relation"))
    plugin.enable()
    return plugin


@pytest.fixture
def pdf_uuid(pdf_info_plugin):
    sample = make_pdf_info_sample()
    pdf_info_plugin.insert(sample)
    return sample["uuid"]


def _make_annotation(pdf_uuid: str, idx: int) -> Dict:
    sample = make_annotation_sample()
    sample["pdf_uuid"] = pdf_uuid
    sample["ann_id"] = f"ann_2000000000{idx:02d}_{idx:06d}"
    return sample


def test_link_annotation_to_annotation(annotation_plugin, relation_plugin, pdf_uuid):
    ann1 = annotation_plugin.insert(_make_annotation(pdf_uuid, 1))
    ann2 = annotation_plugin.insert(_make_annotation(pdf_uuid, 2))

    relation_id = relation_plugin.insert(
        {
            "source_ann_id": ann1,
            "target_type": "annotation",
            "target_ann_id": ann2,
            "relation_type": "related_to",
        }
    )
    assert relation_id

    outgoing = relation_plugin.get_outgoing(ann1)
    assert len(outgoing) == 1
    assert outgoing[0]["target_ann_id"] == ann2

    incoming = relation_plugin.get_incoming_for_annotation(ann2)
    assert len(incoming) == 1
    assert incoming[0]["source_ann_id"] == ann1


def test_link_annotation_invalid_target_combination_raises(relation_plugin):
    with pytest.raises(DatabaseValidationError):
        relation_plugin.insert(
            {
                "source_ann_id": "ann_invalid",
                "target_type": "annotation",
                # 缺少 target_ann_id
                "relation_type": "explains",
            }
        )


def test_unique_constraint_on_same_relation(annotation_plugin, relation_plugin, pdf_uuid):
    ann1 = annotation_plugin.insert(_make_annotation(pdf_uuid, 1))
    ann2 = annotation_plugin.insert(_make_annotation(pdf_uuid, 2))

    payload = {
        "source_ann_id": ann1,
        "target_type": "annotation",
        "target_ann_id": ann2,
        "relation_type": "explains",
    }
    relation_plugin.insert(payload)
    with pytest.raises(DatabaseConstraintError):
        relation_plugin.insert(payload)


def test_link_annotation_to_pdf_and_card(annotation_plugin, relation_plugin, pdf_uuid):
    ann1 = annotation_plugin.insert(_make_annotation(pdf_uuid, 1))

    # 链接到 PDF
    relation_plugin.insert(
        {
            "source_ann_id": ann1,
            "target_type": "pdf",
            "target_pdf_uuid": pdf_uuid,
            "relation_type": "located_in",
        }
    )
    pdf_relations = relation_plugin.get_relations_for_pdf(pdf_uuid)
    assert any(row["source_ann_id"] == ann1 for row in pdf_relations)

    # 链接到 card（不校验 card 是否真实存在，这里只验证写入与查询行为）
    card_id = "card-123"
    relation_plugin.insert(
        {
            "source_ann_id": ann1,
            "target_type": "card",
            "target_card_id": card_id,
            "relation_type": "tests",
        }
    )
    card_relations = relation_plugin.get_relations_for_card(card_id)
    assert any(row["source_ann_id"] == ann1 for row in card_relations)

