import os
import sys

import pytest

# Ensure 'src' is on sys.path so that 'backend.*' imports resolve.
PROJECT_ROOT = os.getcwd()
SRC_PATH = os.path.join(PROJECT_ROOT, "src")
if SRC_PATH not in sys.path:
    sys.path.insert(0, SRC_PATH)

from backend.api.pdf_library_api import PDFLibraryAPI
from backend.api.service_registry import (
    ServiceRegistry,
    SERVICE_PDF_HOME_SEARCH,
    SERVICE_PDF_HOME_ADD,
    SERVICE_PDF_VIEWER_BOOKMARK,
)


class FakeSearchService:
    def __init__(self, marker: str = "search-marker") -> None:
        self.marker = marker
        self.calls = []

    def search_records(self, payload, *, context=None):  # noqa: ANN001
        # record call for assertion
        self.calls.append((payload, context is not None))
        return {
            "records": [{"id": "abc", "title": "Hello"}],
            "total": 1,
            "page": {"limit": 10, "offset": 0},
            "meta": {"marker": self.marker},
        }


class FakeAddService:
    def __init__(self) -> None:
        self.registered = []
        self.added = []

    def register_file_info(self, file_info, *, context=None):  # noqa: ANN001
        self.registered.append((file_info, context is not None))
        return file_info.get("id") or file_info.get("uuid") or "fake-uuid"

    def add_pdf_from_file(self, filepath: str, *, context=None):
        self.added.append((filepath, context is not None))
        return {"success": True, "uuid": "fake-uuid", "filename": "fake.pdf", "file_size": 0}


class FakeBookmarkService:
    def __init__(self) -> None:
        self.calls = []

    def list_bookmarks(self, pdf_uuid: str, *, context=None):
        self.calls.append(("list", pdf_uuid, context is not None))
        return {"bookmarks": [], "root_ids": []}

    def save_bookmarks(self, pdf_uuid: str, bookmarks, *, root_ids=None, context=None):  # noqa: ANN001
        self.calls.append(("save", pdf_uuid, len(bookmarks), root_ids, context is not None))
        return len(bookmarks)


@pytest.fixture()
def service_registry() -> ServiceRegistry:
    return ServiceRegistry()


def test_pdf_library_api_uses_injected_search_service(service_registry: ServiceRegistry):
    fake = FakeSearchService(marker="t1")
    service_registry.register(SERVICE_PDF_HOME_SEARCH, fake)
    api = PDFLibraryAPI(service_registry=service_registry)

    payload = {"tokens": ["hello"], "pagination": {"limit": 10, "offset": 0}}
    result = api.search_records(payload)

    assert result["meta"].get("marker") == "t1"
    assert fake.calls and fake.calls[0][0] is payload


def test_pdf_library_api_uses_injected_add_service(service_registry: ServiceRegistry):
    fake = FakeAddService()
    service_registry.register(SERVICE_PDF_HOME_ADD, fake)
    api = PDFLibraryAPI(service_registry=service_registry)

    # register_file_info
    uuid = api.register_file_info({"id": "X123"})
    assert uuid == "X123"
    assert fake.registered and fake.registered[0][0]["id"] == "X123"

    # add_pdf_from_file
    added = api.add_pdf_from_file("/no/such/file.pdf")
    assert added.get("success") is True
    assert fake.added and fake.added[0][0].endswith("file.pdf")


def test_pdf_library_api_uses_injected_bookmark_service(service_registry: ServiceRegistry):
    fake = FakeBookmarkService()
    service_registry.register(SERVICE_PDF_VIEWER_BOOKMARK, fake)
    api = PDFLibraryAPI(service_registry=service_registry)

    result = api.list_bookmarks("uuid-1")
    assert result == {"bookmarks": [], "root_ids": []}
    assert fake.calls and fake.calls[0][0] == "list"

    saved = api.save_bookmarks("uuid-1", [{"id": "b1", "name": "A", "type": "page", "pageNumber": 1}])
    assert saved == 1
    assert fake.calls[-1][0] == "save"
