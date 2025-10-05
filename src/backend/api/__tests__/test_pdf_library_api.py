import pytest
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[4]))

from src.backend.api.pdf_library_api import PDFLibraryAPI
from src.backend.database.connection import DatabaseConnectionManager
from src.backend.database.plugin.plugin_registry import TablePluginRegistry
from src.backend.database.exceptions import DatabaseValidationError
from src.backend.database.plugins.__tests__.fixtures.pdf_info_samples import make_pdf_info_sample
from src.backend.database.plugins.__tests__.fixtures.pdf_annotation_samples import make_annotation_sample
from src.backend.database.plugins.__tests__.fixtures.pdf_bookmark_samples import make_bookmark_sample
from test_message_schemas import PDF_RECORD_SCHEMA


@pytest.fixture
def api(tmp_path):
    DatabaseConnectionManager._instance = None
    TablePluginRegistry.reset_instance()

    db_path = tmp_path / "library.db"
    service = PDFLibraryAPI(db_path=str(db_path))

    yield service

    # 清理单例与连接
    service.shutdown()
    TablePluginRegistry.reset_instance()
    DatabaseConnectionManager._instance = None


def _assert_record_schema(record):
    for field, expected_type in PDF_RECORD_SCHEMA.items():
        assert field in record, f"缺少字段 {field}"
        assert isinstance(record[field], expected_type), (
            f"字段 {field} 类型错误: 期望 {expected_type.__name__}, 实际 {type(record[field]).__name__}"
        )


def test_list_records_returns_frontend_schema(api):
    sample = make_pdf_info_sample(uuid="111111111111")
    sample["title"] = "Alpha"
    sample["created_at"] = 1730726400000
    sample["updated_at"] = 1730726400000
    sample["json_data"]["tags"] = ["tag-a"]
    sample["json_data"]["rating"] = 2
    sample["json_data"]["is_visible"] = True
    sample["json_data"]["total_reading_time"] = 90

    api.create_record(sample)

    records = api.list_records()
    assert len(records) == 1

    record = records[0]
    _assert_record_schema(record)

    assert record["created_at"] == sample["created_at"] // 1000
    assert record["last_accessed_at"] == 0
    assert record["rating"] == 2
    assert record["tags"] == ["tag-a"]
    assert record["file_path"] == sample["json_data"]["filepath"]


def test_get_record_detail_includes_counts(api):
    pdf_uuid = "222222222222"
    sample = make_pdf_info_sample(uuid=pdf_uuid)
    sample["title"] = "Beta"
    api.create_record(sample)

    annotation = make_annotation_sample('screenshot', pdf_uuid=pdf_uuid)
    bookmark = make_bookmark_sample('page', pdf_uuid=pdf_uuid)

    api._annotation_plugin.insert(annotation)
    api._bookmark_plugin.insert(bookmark)

    detail = api.get_record_detail(pdf_uuid)
    assert detail["id"] == pdf_uuid
    assert detail["annotation_count"] == 1
    assert detail["bookmark_count"] == 1


def test_delete_record_cascades_related_data(api):
    pdf_uuid = "333333333333"
    sample = make_pdf_info_sample(uuid=pdf_uuid)
    sample["title"] = "Gamma"
    api.create_record(sample)

    annotation = make_annotation_sample('comment', pdf_uuid=pdf_uuid)
    bookmark = make_bookmark_sample('region', pdf_uuid=pdf_uuid)
    api._annotation_plugin.insert(annotation)
    api._bookmark_plugin.insert(bookmark)

    assert api.delete_record(pdf_uuid) is True
    assert api.get_record(pdf_uuid) is None
    assert api._annotation_plugin.query_by_pdf(pdf_uuid) == []
    assert api._bookmark_plugin.query_by_pdf(pdf_uuid) == []


def test_update_record_merges_fields(api):
    pdf_uuid = "444444444444"
    sample = make_pdf_info_sample(uuid=pdf_uuid)
    sample["title"] = "Delta"
    sample["json_data"]["rating"] = 1
    sample["json_data"]["tags"] = ["old"]
    api.create_record(sample)

    api.update_record(
        pdf_uuid,
        updates={
            "title": "Delta Updated",
            "rating": 5,
            "tags": ["new", "delta"],
            "last_accessed_at": 1730726400,
        }
    )

    detail = api.get_record_detail(pdf_uuid)
    assert detail["title"] == "Delta Updated"
    assert detail["rating"] == 5
    assert detail["tags"] == ["new", "delta"]
    assert detail["last_accessed_at"] == 1730726400


def test_create_record_requires_uuid(api):
    incomplete = make_pdf_info_sample()
    incomplete.pop("uuid")

    with pytest.raises(DatabaseValidationError):
        api.create_record(incomplete)
