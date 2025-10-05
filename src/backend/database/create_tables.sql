-- ============================================================
-- Anki LinkMaster PDF 数据库表结构
-- ============================================================
-- 版本: v1.0
-- 目标环境: Python 3.13 + SQLite 3.45+
-- 兼容环境: Python 3.9+ + SQLite 3.39+
-- 创建日期: 2025-10-05
-- ============================================================

-- ============================================================
-- 1. pdf_info - PDF 基本信息表
-- ============================================================
CREATE TABLE IF NOT EXISTS pdf_info (
    -- 主键
    uuid TEXT PRIMARY KEY NOT NULL,

    -- 核心字段（高频查询）
    title TEXT NOT NULL DEFAULT '',
    author TEXT DEFAULT '',
    filename TEXT NOT NULL UNIQUE,
    filepath TEXT NOT NULL,

    -- 文件属性
    file_size INTEGER NOT NULL DEFAULT 0,
    page_count INTEGER NOT NULL DEFAULT 0,

    -- 学习管理字段
    last_accessed_at INTEGER DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    rating INTEGER DEFAULT 0
        CHECK (rating >= 0 AND rating <= 5),
    total_reading_time INTEGER DEFAULT 0,
    due_date INTEGER DEFAULT 0,

    -- 状态标记
    is_visible INTEGER NOT NULL DEFAULT 1
        CHECK (is_visible IN (0, 1)),
    is_deleted INTEGER NOT NULL DEFAULT 0
        CHECK (is_deleted IN (0, 1)),

    -- 扩展数据（JSON 格式）
    json_data TEXT DEFAULT '{}'
        CHECK (json_valid(json_data)),

    -- 审计字段
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    -- 版本控制（乐观锁）
    version INTEGER NOT NULL DEFAULT 1
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_pdf_title ON pdf_info(title);
CREATE INDEX IF NOT EXISTS idx_pdf_author ON pdf_info(author);
CREATE INDEX IF NOT EXISTS idx_pdf_created_at ON pdf_info(created_at);
CREATE INDEX IF NOT EXISTS idx_pdf_last_accessed ON pdf_info(last_accessed_at);
CREATE INDEX IF NOT EXISTS idx_pdf_rating ON pdf_info(rating);
CREATE INDEX IF NOT EXISTS idx_pdf_is_visible ON pdf_info(is_visible);
CREATE INDEX IF NOT EXISTS idx_pdf_is_deleted ON pdf_info(is_deleted);

-- 复合索引
CREATE INDEX IF NOT EXISTS idx_pdf_visible_deleted
    ON pdf_info(is_visible, is_deleted);

CREATE INDEX IF NOT EXISTS idx_pdf_rating_review
    ON pdf_info(rating DESC, review_count DESC);

-- ============================================================
-- 2. pdf_tags - PDF 标签表
-- ============================================================
CREATE TABLE IF NOT EXISTS pdf_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    pdf_uuid TEXT NOT NULL,
    tag TEXT NOT NULL,

    -- 审计字段
    created_at INTEGER NOT NULL,

    -- 外键约束
    FOREIGN KEY (pdf_uuid)
        REFERENCES pdf_info(uuid)
        ON DELETE CASCADE,

    -- 唯一约束
    UNIQUE(pdf_uuid, tag)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_tag_pdf_uuid ON pdf_tags(pdf_uuid);
CREATE INDEX IF NOT EXISTS idx_tag_name ON pdf_tags(tag);

-- ============================================================
-- 3. pdf_annotation - PDF 标注表
-- ============================================================
CREATE TABLE IF NOT EXISTS pdf_annotation (
    -- 主键
    ann_id TEXT PRIMARY KEY NOT NULL,

    -- 关联字段
    pdf_uuid TEXT NOT NULL,

    -- 核心字段
    type TEXT NOT NULL
        CHECK (type IN ('screenshot', 'text-highlight', 'comment')),
    page_number INTEGER NOT NULL
        CHECK (page_number > 0),

    -- 快速预览字段
    preview_text TEXT DEFAULT '',

    -- 类型特定数据（JSON 格式）
    json_data TEXT NOT NULL DEFAULT '{}'
        CHECK (json_valid(json_data)),

    -- 审计字段
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    -- 版本控制
    version INTEGER NOT NULL DEFAULT 1,

    -- 外键约束
    FOREIGN KEY (pdf_uuid)
        REFERENCES pdf_info(uuid)
        ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ann_pdf_uuid ON pdf_annotation(pdf_uuid);
CREATE INDEX IF NOT EXISTS idx_ann_type ON pdf_annotation(type);
CREATE INDEX IF NOT EXISTS idx_ann_page ON pdf_annotation(page_number);
CREATE INDEX IF NOT EXISTS idx_ann_created ON pdf_annotation(created_at DESC);

-- 复合索引
CREATE INDEX IF NOT EXISTS idx_ann_pdf_page
    ON pdf_annotation(pdf_uuid, page_number);

-- ============================================================
-- 4. pdf_comment - 标注评论表
-- ============================================================
CREATE TABLE IF NOT EXISTS pdf_comment (
    -- 主键
    comment_id TEXT PRIMARY KEY NOT NULL,

    -- 关联字段
    ann_id TEXT NOT NULL,

    -- 核心字段
    content TEXT NOT NULL,

    -- 审计字段
    created_at INTEGER NOT NULL,

    -- 外键约束
    FOREIGN KEY (ann_id)
        REFERENCES pdf_annotation(ann_id)
        ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_comment_ann_id ON pdf_comment(ann_id);
CREATE INDEX IF NOT EXISTS idx_comment_created ON pdf_comment(created_at DESC);

-- ============================================================
-- 5. pdf_bookmark - PDF 书签表
-- ============================================================
CREATE TABLE IF NOT EXISTS pdf_bookmark (
    -- 主键
    bookmark_id TEXT PRIMARY KEY NOT NULL,

    -- 关联字段
    pdf_uuid TEXT NOT NULL,
    parent_id TEXT DEFAULT NULL,

    -- 核心字段
    name TEXT NOT NULL,
    type TEXT NOT NULL
        CHECK (type IN ('page', 'region')),
    page_number INTEGER NOT NULL
        CHECK (page_number > 0),

    -- 排序字段
    order_index INTEGER NOT NULL DEFAULT 0,

    -- 区域信息（JSON 格式）
    json_data TEXT DEFAULT NULL
        CHECK (json_data IS NULL OR json_valid(json_data)),

    -- 审计字段
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    -- 版本控制
    version INTEGER NOT NULL DEFAULT 1,

    -- 外键约束
    FOREIGN KEY (pdf_uuid)
        REFERENCES pdf_info(uuid)
        ON DELETE CASCADE,

    FOREIGN KEY (parent_id)
        REFERENCES pdf_bookmark(bookmark_id)
        ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_bookmark_pdf_uuid ON pdf_bookmark(pdf_uuid);
CREATE INDEX IF NOT EXISTS idx_bookmark_parent ON pdf_bookmark(parent_id);
CREATE INDEX IF NOT EXISTS idx_bookmark_order ON pdf_bookmark(order_index);

-- 复合索引
CREATE INDEX IF NOT EXISTS idx_bookmark_pdf_parent
    ON pdf_bookmark(pdf_uuid, parent_id, order_index);

-- ============================================================
-- 6. search_condition - 搜索条件构建器表
-- ============================================================
CREATE TABLE IF NOT EXISTS search_condition (
    -- 主键
    uuid TEXT PRIMARY KEY NOT NULL,

    -- 核心字段
    name TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',

    -- 搜索条件（JSON 格式）
    json_data TEXT NOT NULL DEFAULT '{}'
        CHECK (json_valid(json_data)),

    -- 使用统计
    use_count INTEGER NOT NULL DEFAULT 0,
    last_used_at INTEGER DEFAULT 0,

    -- 审计字段
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    -- 版本控制
    version INTEGER NOT NULL DEFAULT 1
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_search_name ON search_condition(name);
CREATE INDEX IF NOT EXISTS idx_search_use_count ON search_condition(use_count DESC);
CREATE INDEX IF NOT EXISTS idx_search_last_used ON search_condition(last_used_at DESC);

-- ============================================================
-- 7. reading_session - 阅读会话表
-- ============================================================
CREATE TABLE IF NOT EXISTS reading_session (
    -- 主键
    session_id TEXT PRIMARY KEY NOT NULL,

    -- 关联字段
    pdf_uuid TEXT NOT NULL,

    -- 会话信息
    start_time INTEGER NOT NULL,
    end_time INTEGER DEFAULT NULL,
    duration INTEGER DEFAULT 0,

    -- 阅读进度
    start_page INTEGER DEFAULT 1,
    end_page INTEGER DEFAULT 1,
    pages_read INTEGER DEFAULT 0,

    -- 外键约束
    FOREIGN KEY (pdf_uuid)
        REFERENCES pdf_info(uuid)
        ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_session_pdf_uuid ON reading_session(pdf_uuid);
CREATE INDEX IF NOT EXISTS idx_session_start_time ON reading_session(start_time DESC);

-- ============================================================
-- 8. fts_pdf - 全文搜索表（FTS5）
-- ============================================================
CREATE VIRTUAL TABLE IF NOT EXISTS fts_pdf USING fts5(
    uuid UNINDEXED,
    title,
    author,
    content,
    tags,
    tokenize = 'porter unicode61'
);

-- ============================================================
-- 9. 触发器 - 自动同步 FTS 表
-- ============================================================

-- 插入触发器
CREATE TRIGGER IF NOT EXISTS fts_pdf_insert
AFTER INSERT ON pdf_info
BEGIN
    INSERT INTO fts_pdf (uuid, title, author, tags)
    SELECT
        NEW.uuid,
        NEW.title,
        NEW.author,
        COALESCE((SELECT GROUP_CONCAT(tag, ' ') FROM pdf_tags WHERE pdf_uuid = NEW.uuid), '')
    ;
END;

-- 更新触发器
CREATE TRIGGER IF NOT EXISTS fts_pdf_update
AFTER UPDATE ON pdf_info
BEGIN
    UPDATE fts_pdf
    SET
        title = NEW.title,
        author = NEW.author,
        tags = COALESCE((SELECT GROUP_CONCAT(tag, ' ') FROM pdf_tags WHERE pdf_uuid = NEW.uuid), '')
    WHERE uuid = NEW.uuid;
END;

-- 删除触发器
CREATE TRIGGER IF NOT EXISTS fts_pdf_delete
AFTER DELETE ON pdf_info
BEGIN
    DELETE FROM fts_pdf WHERE uuid = OLD.uuid;
END;

-- 标签更新触发器
CREATE TRIGGER IF NOT EXISTS fts_pdf_tag_update
AFTER INSERT ON pdf_tags
BEGIN
    UPDATE fts_pdf
    SET tags = (SELECT GROUP_CONCAT(tag, ' ') FROM pdf_tags WHERE pdf_uuid = NEW.pdf_uuid)
    WHERE uuid = NEW.pdf_uuid;
END;

CREATE TRIGGER IF NOT EXISTS fts_pdf_tag_delete
AFTER DELETE ON pdf_tags
BEGIN
    UPDATE fts_pdf
    SET tags = COALESCE((SELECT GROUP_CONCAT(tag, ' ') FROM pdf_tags WHERE pdf_uuid = OLD.pdf_uuid), '')
    WHERE uuid = OLD.pdf_uuid;
END;

-- ============================================================
-- 10. 数据库元信息表
-- ============================================================
CREATE TABLE IF NOT EXISTS db_metadata (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 插入版本信息
INSERT OR REPLACE INTO db_metadata (key, value, updated_at)
VALUES ('schema_version', '1.0', (strftime('%s', 'now') * 1000));

INSERT OR REPLACE INTO db_metadata (key, value, updated_at)
VALUES ('created_at', datetime('now'), (strftime('%s', 'now') * 1000));

-- ============================================================
-- 建表脚本结束
-- ============================================================
