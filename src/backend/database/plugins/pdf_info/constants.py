from __future__ import annotations

import re

# 与原插件保持一致的正则与白名单
UUID_PATTERN = re.compile(r"^[a-f0-9]{12}$")
FILENAME_PATTERN = re.compile(r"^[a-f0-9]{12}\.pdf$")
ORDERABLE_COLUMNS = {"created_at", "updated_at", "title", "author", "filename", "page_count", "file_size"}

