from __future__ import annotations

def get_create_table_script() -> str:
    return """
    CREATE TABLE IF NOT EXISTS pdf_info (
        uuid TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        author TEXT DEFAULT '',
        page_count INTEGER DEFAULT 0,
        file_size INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0,
        visited_at INTEGER DEFAULT 0,
        version INTEGER NOT NULL DEFAULT 1,
        json_data TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(json_data))
    );

    CREATE INDEX IF NOT EXISTS idx_pdf_title ON pdf_info(title);
    CREATE INDEX IF NOT EXISTS idx_pdf_author ON pdf_info(author);
    CREATE INDEX IF NOT EXISTS idx_pdf_created ON pdf_info(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_pdf_visited ON pdf_info(visited_at DESC);
    CREATE INDEX IF NOT EXISTS idx_pdf_rating
        ON pdf_info(json_extract(json_data, '$.rating'));
    CREATE INDEX IF NOT EXISTS idx_pdf_visible
        ON pdf_info(json_extract(json_data, '$.is_visible'));
    """

