import os
from pathlib import Path

from src.backend.database.config import compute_component_root, compute_data_dir, compute_db_path, PROJECT_ROOT


def test_single_mode_returns_repo_root():
    base = compute_component_root('single', project_root=PROJECT_ROOT)
    assert base == PROJECT_ROOT


def test_anki_mode_uses_plugin_root_pdf_sys():
    addon_root = Path(os.getcwd()).resolve() / 'fake_addon_root'
    base = compute_component_root('anki', ankiaddon_root_path=str(addon_root))
    assert base == addon_root / 'lib' / 'pdf_sys'

    data_dir = compute_data_dir('anki', ankiaddon_root_path=str(addon_root))
    assert data_dir == addon_root / 'lib' / 'pdf_sys' / 'data'

    db_path = compute_db_path('anki', ankiaddon_root_path=str(addon_root))
    assert db_path.name == 'anki_linkmaster.db'
