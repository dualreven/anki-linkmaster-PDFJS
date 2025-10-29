import os
from typing import Any


def get_pdf_home_config_path(pdf_manager: Any) -> str:
    try:
        data_dir = getattr(pdf_manager, "data_dir", "data") or "data"
    except Exception:
        data_dir = "data"
    os.makedirs(data_dir, exist_ok=True)
    return os.path.join(data_dir, "pdf-home-config.json")

