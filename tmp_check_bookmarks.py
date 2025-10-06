import sqlite3
from backend.database.config import get_db_path
p = get_db_path()
print('DB:', p)
conn = sqlite3.connect(str(p))
conn.row_factory = sqlite3.Row
cur = conn.cursor()
for uuid in ('abcdef123456','a7a8bbd39787'):
    cur.execute("SELECT COUNT(*) AS c FROM pdf_bookmark WHERE pdf_uuid=?", (uuid,))
    c = cur.fetchone()['c']
    print('uuid', uuid, 'bookmark_count', c)
    cur.execute("SELECT bookmark_id, json_extract(json_data,'$.name') AS name, json_extract(json_data,'$.order') AS ord FROM pdf_bookmark WHERE pdf_uuid=? ORDER BY ord LIMIT 5", (uuid,))
    for r in cur.fetchall():
        print('  -', r['bookmark_id'], r['name'], r['ord'])
conn.close()