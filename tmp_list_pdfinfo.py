import sqlite3
from backend.database.config import get_db_path
p = get_db_path()
print('DB:', p)
conn = sqlite3.connect(str(p))
conn.row_factory = sqlite3.Row
cur = conn.cursor()
cur.execute("SELECT uuid, title, json_extract(json_data,'$.filename') AS filename FROM pdf_info LIMIT 20")
rows = cur.fetchall()
for r in rows:
    print(r['uuid'], r['title'], r['filename'])
print('\nTotal count:')
cur2 = conn.cursor()
cur2.execute('SELECT COUNT(*) AS c FROM pdf_info')
print(cur2.fetchone()['c'])
conn.close()