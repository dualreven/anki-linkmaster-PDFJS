import sys
from pathlib import Path
from pathlib import Path as _Path

# 显式确保 UTF-8 输出
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# 确保仓库根加入 sys.path，便于导入 src.*
_repo_root = _Path(__file__).resolve().parents[4]
if str(_repo_root) not in sys.path:
    sys.path.insert(0, str(_repo_root))

from src.backend.pdfFile_server.embed_fileserver import guess_mime_type


def test_js_mime_is_text_javascript():
    assert guess_mime_type(Path('app.js')) == 'text/javascript'
    assert guess_mime_type(Path('module.mjs')) == 'text/javascript'


def test_css_mime_is_text_css():
    assert guess_mime_type(Path('style.css')) == 'text/css'


def test_json_and_map_are_application_json():
    assert guess_mime_type(Path('config.json')) == 'application/json'
    assert guess_mime_type(Path('bundle.js.map')) == 'application/json'


def test_pdf_is_application_pdf():
    assert guess_mime_type(Path('doc.pdf')) == 'application/pdf'
