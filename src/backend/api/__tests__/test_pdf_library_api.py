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


def _insert_sample(
    api: PDFLibraryAPI,
    *,
    uuid: str,
    title: str,
    author: str = "",
    notes: str = "",
    tags=None,
    rating: int = 0,
    is_visible: bool = True,
    subject: str = "",
    keywords: str = "",
    created_at_ms: int = 1730726400000,
    total_reading_time: int = 0,
):
    sample = make_pdf_info_sample(uuid=uuid)
    sample["title"] = title
    sample["author"] = author
    sample["created_at"] = created_at_ms
    sample["updated_at"] = created_at_ms
    sample["json_data"]["tags"] = tags or []
    sample["json_data"]["rating"] = rating
    sample["json_data"]["is_visible"] = is_visible
    sample["json_data"]["notes"] = notes
    sample["json_data"]["subject"] = subject
    sample["json_data"]["keywords"] = keywords
    sample["json_data"]["total_reading_time"] = total_reading_time
    api.create_record(sample)


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


def test_search_records_returns_scored_results(api):
    _insert_sample(
        api,
        uuid="aaaa00000001",
        title="Deep Learning Basics",
        notes="A concise guide to deep learning algorithms.",
        tags=["ml", "ai"],
        rating=4,
        subject="Machine Learning",
        keywords="deep,learning,neural",
        created_at_ms=1730726400000,
    )
    _insert_sample(
        api,
        uuid="aaaa00000002",
        title="Shallow Networks Overview",
        notes="Comparison between shallow and deep models.",
        tags=["ml"],
        rating=3,
        created_at_ms=1730812800000,
    )

    payload = {
        "query": "deep",
        "tokens": ["deep"],
        "filters": None,
        "sort": [
            {"field": "match_score", "direction": "desc"},
            {"field": "updated_at", "direction": "desc"},
        ],
        "pagination": {"limit": 10, "offset": 0, "need_total": True},
    }

    result = api.search_records(payload)

    assert result["total"] == 2
    assert result["page"] == {"limit": 10, "offset": 0}
    records = result["records"]
    assert len(records) == 2
    assert records[0]["id"] == "aaaa00000001"
    assert records[0]["match_score"] >= records[1]["match_score"]
    assert "matched_fields" in records[0]


def test_search_records_requires_all_tokens(api):
    _insert_sample(
        api,
        uuid="bbbb00000001",
        title="Deep Learning in Practice",
        notes="Tips for practitioners.",
        tags=["ai"],
        rating=5,
    )
    _insert_sample(
        api,
        uuid="bbbb00000002",
        title="Learning Systems",
        notes="Deep integration strategies.",
        tags=["systems"],
        rating=4,
    )

    payload = {
        "query": "deep learning",
        "tokens": ["deep", "learning"],
        "filters": None,
        "sort": None,
        "pagination": {"limit": 10, "offset": 0, "need_total": False},
    }

    result = api.search_records(payload)
    ids = [item["id"] for item in result["records"]]

    assert ids == ["bbbb00000001"]
    assert result["total"] == 1


def test_search_records_applies_filters(api):
    _insert_sample(
        api,
        uuid="cccc00000001",
        title="Reinforcement Learning",
        rating=5,
        tags=["rl", "ai"],
        is_visible=True,
        total_reading_time=120,
    )
    _insert_sample(
        api,
        uuid="cccc00000002",
        title="Hidden Reinforcement",
        rating=2,
        tags=["rl"],
        is_visible=False,
    )

    filter_payload = {
        "type": "composite",
        "operator": "AND",
        "conditions": [
            {"type": "field", "field": "rating", "operator": "gte", "value": 4},
            {"type": "field", "field": "is_visible", "operator": "eq", "value": True},
            {"type": "field", "field": "tags", "operator": "has_any", "value": ["ai"]},
        ],
    }

    payload = {
        "query": "reinforcement",
        "tokens": ["reinforcement"],
        "filters": filter_payload,
        "sort": None,
        "pagination": {"limit": 10, "offset": 0, "need_total": True},
    }

    result = api.search_records(payload)
    ids = [item["id"] for item in result["records"]]

    assert ids == ["cccc00000001"]
    assert result["total"] == 1


def test_search_records_supports_pagination(api):
    for idx in range(5):
        _insert_sample(
            api,
            uuid=f"dddd0000000{idx}",
            title=f"Graph Theory {idx}",
            notes="Graph based algorithms",
            rating=3,
            created_at_ms=1730726400000 + idx * 1000,
        )

    payload = {
        "query": "graph",
        "tokens": ["graph"],
        "filters": None,
        "sort": [
            {"field": "match_score", "direction": "desc"},
            {"field": "updated_at", "direction": "asc"},
        ],
        "pagination": {"limit": 2, "offset": 2, "need_total": True},
    }

    result = api.search_records(payload)

    assert result["total"] == 5
    assert result["page"] == {"limit": 2, "offset": 2}
    assert len(result["records"]) == 2


def test_search_records_without_tokens_uses_default_sort(api):
    _insert_sample(
        api,
        uuid="eeee00000001",
        title="Alpha Notes",
        created_at_ms=1730726400000,
    )
    _insert_sample(
        api,
        uuid="eeee00000002",
        title="Beta Notes",
        created_at_ms=1730812800000,
    )

    payload = {
        "query": "",
        "tokens": [],
        "filters": None,
        "sort": None,
        "pagination": {"limit": 10, "offset": 0, "need_total": False},
    }

    result = api.search_records(payload)
    ids = [item["id"] for item in result["records"]]

    assert ids == ["eeee00000002", "eeee00000001"]


def test_search_records_returns_empty_when_no_match(api):
    _insert_sample(
        api,
        uuid="ffff00000001",
        title="Quantum Computing",
        notes="Qubits and superposition",
    )

    payload = {
        "query": "classical mechanics",
        "tokens": ["classical", "mechanics"],
        "filters": None,
        "sort": None,
        "pagination": {"limit": 10, "offset": 0, "need_total": True},
    }

    result = api.search_records(payload)
    assert result["records"] == []
    assert result["total"] == 0
