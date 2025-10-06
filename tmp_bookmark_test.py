import os, json, time
from backend.api.pdf_library_api import PDFLibraryAPI

api = PDFLibraryAPI()
# create a record to attach bookmarks to
uuid = 'a1b2c3d4e5f6'
try:
    api.create_record({
        'uuid': uuid,
        'title': 'Test PDF',
        'author': 'Me',
        'page_count': 10,
        'file_size': 1234,
        'created_at': int(time.time()),
        'updated_at': int(time.time()),
    })
except Exception as e:
    pass

bookmarks = [
  {
    'id': 'bookmark-1-abc',
    'name': 'Root',
    'type': 'page',
    'pageNumber': 1,
    'children': [
      {
        'id': 'bookmark-2-def',
        'name': 'Child',
        'type': 'page',
        'pageNumber': 2,
        'parentId': 'bookmark-1-abc',
        'order': 0
      }
    ],
    'order': 0,
  }
]

saved = api.save_bookmarks(uuid, bookmarks, root_ids=['bookmark-1-abc'])
print('saved:', saved)
res = api.list_bookmarks(uuid)
print('list.count:', len(res.get('bookmarks', [])), 'root_ids:', res.get('root_ids'))
print(json.dumps(res, ensure_ascii=False)[:300])