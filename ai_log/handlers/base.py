from pathlib import Path
from ai_log.repositories.json5_store import read_json as store_read_json, write_json as store_write_json


DATA_DIR = Path("AI-communication")
FORUM_DIR = DATA_DIR
SOLUTION_DIR = DATA_DIR
TASK_DIR = DATA_DIR


class BaseHandler:
    def __init__(self):
        self.ensure_directories()

    def ensure_directories(self):
        DATA_DIR.mkdir(exist_ok=True)
        FORUM_DIR.mkdir(exist_ok=True)
        TASK_DIR.mkdir(exist_ok=True)

    def write_json(self, filepath, data):
        store_write_json(filepath, data)

    def read_json(self, filepath):
        return store_read_json(filepath)


