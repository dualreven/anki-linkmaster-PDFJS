import pytest

from src.backend.msgCenter_server.standard_server import StandardWebSocketServer


class FakePDFLibraryAPI:
    def __init__(self):
        self.calls = []
        self.return_value = {
            "success": True,
            "uuid": "fake-uuid",
            "filename": "demo.pdf",
            "file_size": 1024,
        }

    def add_pdf_from_file(self, filepath: str):
        self.calls.append(filepath)
        return self.return_value


class FakePDFManager:
    def __init__(self):
        self.last_path = None

    def add_file(self, filepath: str):
        self.last_path = filepath
        return True

    def get_files(self):
        if self.last_path is None:
            return []
        return [
            {
                "id": "fake-uuid",
                "filename": "demo.pdf",
                "size": 1024,
                "original_path": self.last_path,
            }
        ]

    def get_file_count(self):
        return 1 if self.last_path else 0


@pytest.fixture()
def server_with_fakes():
    server = StandardWebSocketServer()
    server.pdf_library_api = FakePDFLibraryAPI()
    server.pdf_manager = FakePDFManager()
    return server


def test_handle_pdf_upload_request_uses_api_and_returns_new_type(server_with_fakes):
    payload = {
        "type": "pdf-library:add:requested",
        "request_id": "req-upload",
        "data": {
            "filepath": "C:/fake/path/sample.pdf"
        }
    }

    response = server_with_fakes.handle_message(payload)

    assert response["type"] == "pdf-library:add:completed"
    assert response["request_id"] == "req-upload"
    assert response["status"] == "success"
    assert response["data"]["file"]["id"] == "fake-uuid"
    assert response["data"]["file"]["filename"] == "demo.pdf"
    assert server_with_fakes.pdf_library_api.calls == ["C:/fake/path/sample.pdf"]
