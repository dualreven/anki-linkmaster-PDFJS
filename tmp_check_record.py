import time
from backend.api.pdf_library_api import PDFLibraryAPI
api = PDFLibraryAPI()
uid='a1b2c3d4e5f6'
rec=api.get_record(uid)
print('before create, get_record:', rec)

try:
    rid = api.create_record({
        'uuid': uid,
        'title':'T',
        'author':'A',
        'page_count':1,
        'file_size':0,
        'created_at': int(time.time()),
        'updated_at': int(time.time()),
    })
    print('create_record returned:', rid)
except Exception as e:
    print('create_record error:', e)

rec=api.get_record(uid)
print('after create, get_record:', rec)