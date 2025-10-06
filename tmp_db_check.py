import sqlite3
from backend.database.config import get_db_path
p = get_db_path()
conn = sqlite3.connect(str(p)); conn.row_factory = sqlite3.Row
for uuid in ('abcdef123456','a7a8bbd39787'):
    c = conn.execute('SELECT COUNT(*) AS c FROM pdf_bookmark WHERE pdf_uuid=?', (uuid,)).fetchone()['c']
    print(uuid, c)
conn.close()