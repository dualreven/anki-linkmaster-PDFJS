import os, sys, time, json
import pytest

PROJECT_ROOT = os.getcwd()
SRC = os.path.join(PROJECT_ROOT, 'src')
if SRC not in sys.path:
    sys.path.insert(0, SRC)

from backend.api.pdf_library_api import PDFLibraryAPI


def make_pdf_record(uuid: str) -> dict:
    now = int(time.time())
    return {
        'uuid': uuid,
        'title': 'T',
        'author': 'A',
        'page_count': 1,
        'file_size': 0,
        'created_at': now,
        'updated_at': now,
        'filename': f'{uuid}.pdf',
        'file_path': f'/tmp/{uuid}.pdf',
    }


def test_bookmark_persist_and_list_roundtrip():
    api = PDFLibraryAPI()
    uuid = 'abcdef123456'
    try:
        api.create_record(make_pdf_record(uuid))
    except Exception:
        pass

    bookmarks = [
        {
            'id': 'bookmark-1-abc',
            'name': 'Root',
            'pageAt': 1,
            'children': [
                {
                    'id': 'bookmark-2-def',
                    'name': 'Child',
                    'pageAt': 2,
                    'parentId': 'bookmark-1-abc',
                    'order': 0,
                }
            ],
            'order': 0,
        }
    ]

    saved = api.save_bookmarks(uuid, bookmarks, root_ids=['bookmark-1-abc'])
    assert saved >= 1

    res = api.list_bookmarks(uuid)
    assert res['root_ids'] == ['bookmark-1-abc']
    # flatten check
    ids = {node['id'] for node in res['bookmarks']}
    assert {'bookmark-1-abc', 'bookmark-2-def'} <= ids


def test_bookmark_save_with_pageAt():
    api = PDFLibraryAPI()
    uuid = '112233aabbcc'
    try:
        api.create_record(make_pdf_record(uuid))
    except Exception:
        pass

    bookmarks = [
        {
            'id': 'bookmark-1728123460000-root',
            'name': 'RootByPageAt',
            'pageAt': 3,
            'children': [
                {'id': 'bookmark-1728123460001-child', 'name': 'ChildByPageAt', 'pageAt': 5, 'parentId': 'bookmark-1728123460000-root', 'order': 0}
            ],
            'order': 0,
        }
    ]
    saved = api.save_bookmarks(uuid, bookmarks, root_ids=['bookmark-1728123460000-root'])
    assert saved >= 1
    res = api.list_bookmarks(uuid)
    assert res['root_ids'] == ['bookmark-1728123460000-root']
    ids = {node['id'] for node in res['bookmarks']}
    assert {'bookmark-1728123460000-root', 'bookmark-1728123460001-child'} <= ids
