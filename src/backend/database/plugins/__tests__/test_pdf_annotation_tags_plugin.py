"""PDFAnnotationTagsTablePlugin 行为测试"""

from __future__ import annotations

import logging
from typing import Dict

import pytest

from ...connection import DatabaseConnectionManager
from ...executor import SQLExecutor
from ...exceptions import DatabaseConstraintError
from ..pdf_info_plugin import PDFInfoTablePlugin
from ..pdf_annotation_plugin import PDFAnnotationTablePlugin
from ..pdf_annotation_tags_plugin import PDFAnnotationTagsTablePlugin
from ...plugin.event_bus import EventBus
from .fixtures.pdf_info_samples import make_pdf_info_sample
from .fixtures.pdf_annotation_samples import make_annotation_sample


@pytest.fixture
def connection_manager(tmp_path):
    DatabaseConnectionManager._instance = None  # type: ignore[attr-defined]
    db_path = tmp_path / "annotation_tags_test.db"
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
def tags_plugin(executor, event_bus, annotation_plugin):  # noqa: ARG001
    plugin = PDFAnnotationTagsTablePlugin(executor, event_bus, logging.getLogger("test.annotation_tags"))
    plugin.enable()
    return plugin


@pytest.fixture
def pdf_uuid(pdf_info_plugin):
    sample = make_pdf_info_sample()
    pdf_info_plugin.insert(sample)
    return sample["uuid"]


def _make_annotation(pdf_uuid: str) -> Dict:
    sample = make_annotation_sample()
    sample["pdf_uuid"] = pdf_uuid
    return sample


def test_add_and_list_tags(annotation_plugin, tags_plugin, pdf_uuid):
    # 准备一条标注
    ann_sample = _make_annotation(pdf_uuid)
    ann_id = annotation_plugin.insert(ann_sample)

    # 添加标签并列出
    tags_plugin.insert({"ann_id": ann_id, "tag": "tag1"})
    tags_plugin.insert({"ann_id": ann_id, "tag": "tag2"})

    tags = tags_plugin.list_tags(ann_id)
    assert tags == ["tag1", "tag2"]


def test_unique_constraint_on_same_tag(annotation_plugin, tags_plugin, pdf_uuid):
    ann_sample = _make_annotation(pdf_uuid)
    ann_id = annotation_plugin.insert(ann_sample)

    tags_plugin.insert({"ann_id": ann_id, "tag": "dup"})
    with pytest.raises(DatabaseConstraintError):
        tags_plugin.insert({"ann_id": ann_id, "tag": "dup"})


def test_cascade_delete_from_annotation(annotation_plugin, tags_plugin, pdf_uuid, executor):
    ann_sample = _make_annotation(pdf_uuid)
    ann_id = annotation_plugin.insert(ann_sample)
    tags_plugin.insert({"ann_id": ann_id, "tag": "tag-to-delete"})

    # 删除标注，应级联删除标签
    annotation_plugin.delete(ann_id)

    rows = executor.execute_query(
        "SELECT * FROM pdf_annotation_tags WHERE ann_id = ?", (ann_id,)
    )
    assert rows == []

