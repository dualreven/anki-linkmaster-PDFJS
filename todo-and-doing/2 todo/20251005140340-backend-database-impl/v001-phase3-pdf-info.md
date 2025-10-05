# 后端数据库系统 - 第三期需求文档（PDFInfo表）

**期数**: 第三期 - 数据表插件实现
**文档**: v003-phase3-pdf-info.md
**版本**: v1.0
**创建日期**: 2025-10-05
**预计工期**: 1天
**依赖**: 第二期（插件架构）

---

## 📋 概述

### 目标
实现 `PDFInfoTablePlugin` 插件，管理 PDF 文件的元数据和扩展属性。

### 为什么需要此表？
1. **核心实体** - PDF 是系统的核心数据实体
2. **关联中心** - 其他表（annotation、bookmark）通过 pdf_uuid 关联
3. **高频查询** - 文件列表、搜索、排序等功能的数据源
4. **灵活扩展** - 使用 JSONB 存储扩展字段，无需改表

### 依赖关系
- **依赖**: 第二期的 `TablePlugin` 基类、`EventBus`、`TablePluginRegistry`
- **被依赖**: `pdf_annotation`、`pdf_bookmark`、`search_condition` 表

---

## 🗄️ 表结构 SQL

```sql
-- ========================================
-- PDF 信息表
-- ========================================

CREATE TABLE IF NOT EXISTS pdf_info (
    -- ========== 主键 ==========
    uuid TEXT PRIMARY KEY NOT NULL,

    -- ========== 核心字段（高频查询） ==========
    title TEXT NOT NULL DEFAULT '',
    author TEXT DEFAULT '',
    page_count INTEGER DEFAULT 0,
    file_size INTEGER DEFAULT 0,

    -- ========== 时间字段 ==========
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    visited_at INTEGER DEFAULT 0,

    -- ========== 版本控制 ==========
    version INTEGER NOT NULL DEFAULT 1,

    -- ========== 扩展数据（JSONB） ==========
    json_data TEXT NOT NULL DEFAULT '{}'
        CHECK (json_valid(json_data))
);

-- ========================================
-- 索引
-- ========================================

-- 核心字段索引
CREATE INDEX IF NOT EXISTS idx_pdf_title ON pdf_info(title);
CREATE INDEX IF NOT EXISTS idx_pdf_author ON pdf_info(author);
CREATE INDEX IF NOT EXISTS idx_pdf_created ON pdf_info(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pdf_visited ON pdf_info(visited_at DESC);

-- JSON 表达式索引（可选，高频查询字段）
CREATE INDEX IF NOT EXISTS idx_pdf_rating
    ON pdf_info(json_extract(json_data, '$.rating'));

CREATE INDEX IF NOT EXISTS idx_pdf_visible
    ON pdf_info(json_extract(json_data, '$.is_visible'));
```

---

## 📝 字段验证规则

| 字段名 | 类型 | 必填 | 约束 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| **主键** |
| `uuid` | TEXT | ✅ | PRIMARY KEY, 非空 | 无 | PDF唯一标识（12位随机字符） |
| **核心字段** |
| `title` | TEXT | ✅ | 非空 | `''` | PDF标题（来自元数据） |
| `author` | TEXT | ❌ | 无 | `''` | 作者（来自元数据） |
| `page_count` | INTEGER | ❌ | ≥ 0 | `0` | 总页数 |
| `file_size` | INTEGER | ❌ | ≥ 0 | `0` | 文件大小（字节） |
| **时间字段** |
| `created_at` | INTEGER | ✅ | 非空 | `0` | 创建时间（Unix毫秒） |
| `updated_at` | INTEGER | ✅ | 非空 | `0` | 更新时间（Unix毫秒） |
| `visited_at` | INTEGER | ❌ | 无 | `0` | 最后访问时间（Unix毫秒） |
| **版本控制** |
| `version` | INTEGER | ✅ | ≥ 1 | `1` | 乐观锁版本号 |
| **扩展数据** |
| `json_data` | TEXT | ✅ | 合法JSON | `'{}'` | JSONB扩展字段 |

### json_data 字段验证规则

| 字段路径 | 类型 | 必填 | 约束 | 默认值 | 说明 |
|----------|------|------|------|--------|------|
| `$.filename` | string | ✅ | 非空 | 无 | 文件名（uuid.pdf） |
| `$.filepath` | string | ✅ | 非空 | 无 | 完整文件路径 |
| `$.subject` | string | ❌ | 无 | `''` | PDF主题（元数据） |
| `$.keywords` | string | ❌ | 无 | `''` | 关键词（元数据） |
| `$.thumbnail_path` | string/null | ❌ | 无 | `null` | 缩略图路径 |
| `$.tags` | array | ❌ | 字符串数组 | `[]` | 用户标签 |
| `$.notes` | string | ❌ | 无 | `''` | 用户笔记 |
| `$.last_accessed_at` | integer | ❌ | ≥ 0 | `0` | 最后访问时间 |
| `$.review_count` | integer | ❌ | ≥ 0 | `0` | 复习次数 |
| `$.rating` | integer | ❌ | 0-5 | `0` | 评分（0-5星） |
| `$.is_visible` | boolean | ❌ | 无 | `true` | 是否可见 |
| `$.total_reading_time` | integer | ❌ | ≥ 0 | `0` | 总阅读时长（秒） |
| `$.due_date` | integer | ❌ | ≥ 0 | `0` | 到期日期（Unix毫秒） |

---

## 🔧 json_data Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["filename", "filepath"],
  "properties": {
    "filename": {
      "type": "string",
      "description": "文件名（uuid.pdf）",
      "pattern": "^[a-f0-9]{12}\\.pdf$",
      "example": "0c251de0e2ac.pdf"
    },
    "filepath": {
      "type": "string",
      "description": "文件完整路径",
      "minLength": 1,
      "example": "C:\\Users\\napretep\\PycharmProjects\\anki-linkmaster-PDFJS\\data\\pdfs\\0c251de0e2ac.pdf"
    },
    "subject": {
      "type": "string",
      "description": "PDF 主题（来自 PDF 元数据）",
      "default": ""
    },
    "keywords": {
      "type": "string",
      "description": "PDF 关键词（来自 PDF 元数据）",
      "default": ""
    },
    "thumbnail_path": {
      "type": ["string", "null"],
      "description": "缩略图路径",
      "default": null
    },
    "tags": {
      "type": "array",
      "description": "标签数组",
      "items": {
        "type": "string",
        "minLength": 1
      },
      "default": [],
      "example": ["Python", "机器学习"]
    },
    "notes": {
      "type": "string",
      "description": "用户笔记",
      "default": ""
    },
    "last_accessed_at": {
      "type": "integer",
      "description": "最后访问时间（Unix 毫秒）",
      "minimum": 0,
      "default": 0
    },
    "review_count": {
      "type": "integer",
      "description": "复习次数",
      "minimum": 0,
      "default": 0
    },
    "rating": {
      "type": "integer",
      "description": "评分（0-5）",
      "minimum": 0,
      "maximum": 5,
      "default": 0
    },
    "is_visible": {
      "type": "boolean",
      "description": "是否可见",
      "default": true
    },
    "total_reading_time": {
      "type": "integer",
      "description": "总阅读时长（秒）",
      "minimum": 0,
      "default": 0
    },
    "due_date": {
      "type": "integer",
      "description": "到期日期（Unix 毫秒）",
      "minimum": 0,
      "default": 0
    }
  }
}
```

---

## 💻 完整类实现

```python
# src/backend/database/plugins/pdf_info_plugin.py

"""
PDFInfoTablePlugin - PDF 信息表插件

职责:
1. 管理 pdf_info 表的 CRUD 操作
2. 验证 PDF 元数据的合法性
3. 发布表相关事件（create/update/delete）
4. 提供高级查询方法（搜索、过滤、统计）

Author: AI Assistant
Created: 2025-10-05
"""

from typing import Dict, List, Optional, Any
import time
import json
import re

from ..plugin.base_table_plugin import TablePlugin
from ..exceptions import DatabaseValidationError, DatabaseConstraintError


class PDFInfoTablePlugin(TablePlugin):
    """PDF 信息表插件"""

    # ==================== 必须实现的属性 ====================

    @property
    def table_name(self) -> str:
        """表名"""
        return 'pdf_info'

    @property
    def version(self) -> str:
        """插件版本"""
        return '1.0.0'

    @property
    def dependencies(self) -> List[str]:
        """无依赖（是基础表）"""
        return []

    # ==================== 必须实现的方法（建表） ====================

    def create_table(self) -> None:
        """
        建表（如果表不存在）

        创建 pdf_info 表和索引
        """
        sql = '''
        -- ========================================
        -- PDF 信息表
        -- ========================================

        CREATE TABLE IF NOT EXISTS pdf_info (
            -- ========== 主键 ==========
            uuid TEXT PRIMARY KEY NOT NULL,

            -- ========== 核心字段（高频查询） ==========
            title TEXT NOT NULL DEFAULT '',
            author TEXT DEFAULT '',
            page_count INTEGER DEFAULT 0,
            file_size INTEGER DEFAULT 0,

            -- ========== 时间字段 ==========
            created_at INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL DEFAULT 0,
            visited_at INTEGER DEFAULT 0,

            -- ========== 版本控制 ==========
            version INTEGER NOT NULL DEFAULT 1,

            -- ========== 扩展数据（JSONB） ==========
            json_data TEXT NOT NULL DEFAULT '{}'
                CHECK (json_valid(json_data))
        );

        -- ========================================
        -- 索引
        -- ========================================

        -- 核心字段索引
        CREATE INDEX IF NOT EXISTS idx_pdf_title ON pdf_info(title);
        CREATE INDEX IF NOT EXISTS idx_pdf_author ON pdf_info(author);
        CREATE INDEX IF NOT EXISTS idx_pdf_created ON pdf_info(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_pdf_visited ON pdf_info(visited_at DESC);

        -- JSON 表达式索引（可选，高频查询字段）
        CREATE INDEX IF NOT EXISTS idx_pdf_rating
            ON pdf_info(json_extract(json_data, '$.rating'));

        CREATE INDEX IF NOT EXISTS idx_pdf_visible
            ON pdf_info(json_extract(json_data, '$.is_visible'));
        '''

        self._executor.execute_script(sql)
        self._emit_event('create', 'completed')
        self._logger.info(f"{self.table_name} table and indexes created")

    # ==================== 必须实现的方法（数据验证） ====================

    def validate_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        字段合规性检查

        Args:
            data: 待验证的数据字典

        Returns:
            验证并清洗后的数据

        Raises:
            DatabaseValidationError: 数据不合规
        """
        # 1. 必填字段检查
        if 'uuid' not in data:
            raise DatabaseValidationError("uuid is required")

        uuid = data['uuid']
        if not isinstance(uuid, str) or not uuid.strip():
            raise DatabaseValidationError("uuid must be a non-empty string")

        # 验证 UUID 格式（12位十六进制）
        if not re.match(r'^[a-f0-9]{12}$', uuid):
            raise DatabaseValidationError(
                f"uuid must be 12 hex characters, got: {uuid}"
            )

        # 2. 核心字段验证
        title = data.get('title', '')
        if not isinstance(title, str):
            raise DatabaseValidationError("title must be a string")

        author = data.get('author', '')
        if not isinstance(author, str):
            raise DatabaseValidationError("author must be a string")

        page_count = data.get('page_count', 0)
        if not isinstance(page_count, int) or page_count < 0:
            raise DatabaseValidationError("page_count must be a non-negative integer")

        file_size = data.get('file_size', 0)
        if not isinstance(file_size, int) or file_size < 0:
            raise DatabaseValidationError("file_size must be a non-negative integer")

        # 3. 时间字段验证
        current_time = int(time.time() * 1000)

        created_at = data.get('created_at', current_time)
        if not isinstance(created_at, int):
            raise DatabaseValidationError("created_at must be an integer")

        updated_at = data.get('updated_at', current_time)
        if not isinstance(updated_at, int):
            raise DatabaseValidationError("updated_at must be an integer")

        visited_at = data.get('visited_at', 0)
        if not isinstance(visited_at, int):
            raise DatabaseValidationError("visited_at must be an integer")

        # 4. 版本字段验证
        version = data.get('version', 1)
        if not isinstance(version, int) or version < 1:
            raise DatabaseValidationError("version must be a positive integer")

        # 5. JSON 字段验证
        json_data = self._validate_json_data(data.get('json_data', {}))

        # 6. 返回验证后的数据
        return {
            'uuid': uuid,
            'title': title,
            'author': author,
            'page_count': page_count,
            'file_size': file_size,
            'created_at': created_at,
            'updated_at': updated_at,
            'visited_at': visited_at,
            'version': version,
            'json_data': json.dumps(json_data, ensure_ascii=False)
        }

    def _validate_json_data(self, json_data: Any) -> Dict:
        """
        验证 json_data 字段

        Args:
            json_data: JSON 数据（字典或字符串）

        Returns:
            验证后的 JSON 对象

        Raises:
            DatabaseValidationError: JSON 格式错误
        """
        # 解析 JSON 字符串
        if isinstance(json_data, str):
            try:
                json_data = json.loads(json_data)
            except json.JSONDecodeError as e:
                raise DatabaseValidationError(f"Invalid JSON: {e}") from e

        if not isinstance(json_data, dict):
            raise DatabaseValidationError("json_data must be an object")

        # 必填字段检查
        if 'filename' not in json_data:
            raise DatabaseValidationError("json_data.filename is required")

        if 'filepath' not in json_data:
            raise DatabaseValidationError("json_data.filepath is required")

        filename = json_data['filename']
        if not isinstance(filename, str) or not filename.strip():
            raise DatabaseValidationError("json_data.filename must be a non-empty string")

        # 验证文件名格式（uuid.pdf）
        if not re.match(r'^[a-f0-9]{12}\.pdf$', filename):
            raise DatabaseValidationError(
                f"json_data.filename must match pattern 'uuid.pdf', got: {filename}"
            )

        filepath = json_data['filepath']
        if not isinstance(filepath, str) or not filepath.strip():
            raise DatabaseValidationError("json_data.filepath must be a non-empty string")

        # 验证可选字段
        validated = {
            'filename': filename,
            'filepath': filepath,
            'subject': str(json_data.get('subject', '')),
            'keywords': str(json_data.get('keywords', '')),
            'thumbnail_path': json_data.get('thumbnail_path'),
            'tags': self._validate_tags(json_data.get('tags', [])),
            'notes': str(json_data.get('notes', '')),
            'last_accessed_at': self._validate_timestamp(json_data.get('last_accessed_at', 0)),
            'review_count': self._validate_non_negative_int(json_data.get('review_count', 0)),
            'rating': self._validate_rating(json_data.get('rating', 0)),
            'is_visible': bool(json_data.get('is_visible', True)),
            'total_reading_time': self._validate_non_negative_int(json_data.get('total_reading_time', 0)),
            'due_date': self._validate_timestamp(json_data.get('due_date', 0))
        }

        return validated

    def _validate_tags(self, tags: Any) -> List[str]:
        """验证标签数组"""
        if not isinstance(tags, list):
            raise DatabaseValidationError("json_data.tags must be an array")

        validated_tags = []
        for tag in tags:
            if not isinstance(tag, str):
                raise DatabaseValidationError("json_data.tags items must be strings")
            if tag.strip():  # 过滤空字符串
                validated_tags.append(tag)

        return validated_tags

    def _validate_timestamp(self, value: Any) -> int:
        """验证时间戳"""
        if not isinstance(value, int):
            raise DatabaseValidationError("Timestamp must be an integer")
        if value < 0:
            raise DatabaseValidationError("Timestamp must be non-negative")
        return value

    def _validate_non_negative_int(self, value: Any) -> int:
        """验证非负整数"""
        if not isinstance(value, int):
            raise DatabaseValidationError("Value must be an integer")
        if value < 0:
            raise DatabaseValidationError("Value must be non-negative")
        return value

    def _validate_rating(self, value: Any) -> int:
        """验证评分（0-5）"""
        if not isinstance(value, int):
            raise DatabaseValidationError("Rating must be an integer")
        if not 0 <= value <= 5:
            raise DatabaseValidationError("Rating must be between 0 and 5")
        return value

    # ==================== 必须实现的方法（CRUD） ====================

    def insert(self, data: Dict[str, Any]) -> str:
        """
        插入一条记录

        Args:
            data: 数据字典

        Returns:
            插入记录的 uuid

        Raises:
            DatabaseConstraintError: UUID 冲突
            DatabaseValidationError: 数据验证失败
        """
        # 1. 验证数据
        validated = self.validate_data(data)

        # 2. 检查 UUID 是否已存在
        existing = self.query_by_id(validated['uuid'])
        if existing:
            raise DatabaseConstraintError(
                f"PDF with uuid '{validated['uuid']}' already exists"
            )

        # 3. 执行插入
        sql = '''
        INSERT INTO pdf_info (
            uuid, title, author, page_count, file_size,
            created_at, updated_at, visited_at, version, json_data
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, jsonb(?))
        '''

        self._executor.execute_update(sql, (
            validated['uuid'],
            validated['title'],
            validated['author'],
            validated['page_count'],
            validated['file_size'],
            validated['created_at'],
            validated['updated_at'],
            validated['visited_at'],
            validated['version'],
            validated['json_data']
        ))

        # 4. 触发事件
        self._emit_event('create', 'completed', {'uuid': validated['uuid']})

        self._logger.info(f"Inserted PDF: {validated['uuid']}")
        return validated['uuid']

    def update(self, primary_key: str, data: Dict[str, Any]) -> bool:
        """
        更新记录

        Args:
            primary_key: PDF UUID
            data: 要更新的字段（不包含 uuid）

        Returns:
            是否成功更新

        Raises:
            DatabaseValidationError: 数据验证失败
        """
        # 1. 检查记录是否存在
        existing = self.query_by_id(primary_key)
        if not existing:
            return False

        # 2. 合并数据（保留 uuid）
        full_data = {**existing, **data, 'uuid': primary_key}

        # 3. 更新 updated_at 和 version
        full_data['updated_at'] = int(time.time() * 1000)
        full_data['version'] = existing['version'] + 1

        # 4. 验证数据
        validated = self.validate_data(full_data)

        # 5. 执行更新
        sql = '''
        UPDATE pdf_info
        SET
            title = ?,
            author = ?,
            page_count = ?,
            file_size = ?,
            updated_at = ?,
            visited_at = ?,
            version = ?,
            json_data = jsonb(?)
        WHERE uuid = ?
        '''

        rows = self._executor.execute_update(sql, (
            validated['title'],
            validated['author'],
            validated['page_count'],
            validated['file_size'],
            validated['updated_at'],
            validated['visited_at'],
            validated['version'],
            validated['json_data'],
            primary_key
        ))

        # 6. 触发事件
        if rows > 0:
            self._emit_event('update', 'completed', {'uuid': primary_key})
            self._logger.info(f"Updated PDF: {primary_key}")

        return rows > 0

    def delete(self, primary_key: str) -> bool:
        """
        删除记录

        Args:
            primary_key: PDF UUID

        Returns:
            是否成功删除
        """
        sql = "DELETE FROM pdf_info WHERE uuid = ?"
        rows = self._executor.execute_update(sql, (primary_key,))

        if rows > 0:
            self._emit_event('delete', 'completed', {'uuid': primary_key})
            self._logger.info(f"Deleted PDF: {primary_key}")

        return rows > 0

    def query_by_id(self, primary_key: str) -> Optional[Dict[str, Any]]:
        """
        根据主键查询单条记录

        Args:
            primary_key: PDF UUID

        Returns:
            记录字典（包含解析后的 json_data），不存在则返回 None
        """
        sql = "SELECT * FROM pdf_info WHERE uuid = ?"
        results = self._executor.execute_query(sql, (primary_key,))

        if not results:
            return None

        return self._parse_row(results[0])

    def query_all(
        self,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        查询所有记录（分页）

        Args:
            limit: 限制数量
            offset: 偏移量

        Returns:
            记录列表
        """
        sql = "SELECT * FROM pdf_info ORDER BY created_at DESC"

        if limit is not None:
            sql += f" LIMIT {int(limit)}"

        if offset is not None:
            sql += f" OFFSET {int(offset)}"

        results = self._executor.execute_query(sql)
        return [self._parse_row(row) for row in results]

    def _parse_row(self, row: Dict) -> Dict:
        """
        解析数据库行（合并 json_data 字段）

        Args:
            row: 数据库原始行

        Returns:
            解析后的完整数据
        """
        # 解析 JSON 字段
        try:
            json_data = json.loads(row.get('json_data', '{}'))
        except json.JSONDecodeError:
            json_data = {}

        # 合并字段
        parsed = {
            'uuid': row['uuid'],
            'title': row['title'],
            'author': row['author'],
            'page_count': row['page_count'],
            'file_size': row['file_size'],
            'created_at': row['created_at'],
            'updated_at': row['updated_at'],
            'visited_at': row['visited_at'],
            'version': row['version'],
            **json_data  # 展开 json_data
        }

        return parsed

    # ==================== 扩展方法 ====================

    def query_by_filename(self, filename: str) -> Optional[Dict[str, Any]]:
        """
        根据文件名查询 PDF

        Args:
            filename: 文件名（如 'abc123.pdf'）

        Returns:
            记录字典，不存在则返回 None
        """
        sql = '''
        SELECT * FROM pdf_info
        WHERE json_extract(json_data, '$.filename') = ?
        '''
        results = self._executor.execute_query(sql, (filename,))

        if not results:
            return None

        return self._parse_row(results[0])

    def search(
        self,
        keyword: str,
        fields: Optional[List[str]] = None,
        limit: Optional[int] = 50
    ) -> List[Dict[str, Any]]:
        """
        搜索 PDF（模糊搜索）

        Args:
            keyword: 关键词
            fields: 搜索字段列表（默认：['title', 'author', 'filename', 'notes']）
            limit: 结果数量限制

        Returns:
            匹配的记录列表
        """
        if fields is None:
            fields = ['title', 'author', 'filename', 'notes']

        # 构建 WHERE 子句
        conditions = []
        params = []

        if 'title' in fields:
            conditions.append("title LIKE ?")
            params.append(f'%{keyword}%')

        if 'author' in fields:
            conditions.append("author LIKE ?")
            params.append(f'%{keyword}%')

        if 'filename' in fields:
            conditions.append("json_extract(json_data, '$.filename') LIKE ?")
            params.append(f'%{keyword}%')

        if 'notes' in fields:
            conditions.append("json_extract(json_data, '$.notes') LIKE ?")
            params.append(f'%{keyword}%')

        if not conditions:
            return []

        sql = f'''
        SELECT * FROM pdf_info
        WHERE ({' OR '.join(conditions)})
        ORDER BY updated_at DESC
        LIMIT ?
        '''
        params.append(limit)

        results = self._executor.execute_query(sql, tuple(params))
        return [self._parse_row(row) for row in results]

    def filter_by_tags(
        self,
        tags: List[str],
        match_mode: str = 'any'
    ) -> List[Dict[str, Any]]:
        """
        根据标签过滤 PDF

        Args:
            tags: 标签列表
            match_mode: 匹配模式（'any'=任一匹配, 'all'=全部匹配）

        Returns:
            匹配的记录列表
        """
        if not tags:
            return []

        if match_mode == 'all':
            # 全部匹配：所有标签都必须存在
            sql = f'''
            SELECT * FROM pdf_info
            WHERE json_data LIKE ?
            '''
            # 简化实现：要求 JSON 中包含所有标签
            results = []
            for row in self.query_all():
                row_tags = row.get('tags', [])
                if all(tag in row_tags for tag in tags):
                    results.append(row)
            return results
        else:
            # 任一匹配：至少一个标签匹配
            conditions = []
            params = []

            for tag in tags:
                conditions.append("json_data LIKE ?")
                params.append(f'%"{tag}"%')

            sql = f'''
            SELECT * FROM pdf_info
            WHERE ({' OR '.join(conditions)})
            ORDER BY updated_at DESC
            '''

            results = self._executor.execute_query(sql, tuple(params))
            return [self._parse_row(row) for row in results]

    def filter_by_rating(
        self,
        min_rating: int = 0,
        max_rating: int = 5
    ) -> List[Dict[str, Any]]:
        """
        根据评分过滤 PDF

        Args:
            min_rating: 最低评分（0-5）
            max_rating: 最高评分（0-5）

        Returns:
            匹配的记录列表
        """
        sql = '''
        SELECT * FROM pdf_info
        WHERE json_extract(json_data, '$.rating') BETWEEN ? AND ?
        ORDER BY json_extract(json_data, '$.rating') DESC
        '''

        results = self._executor.execute_query(sql, (min_rating, max_rating))
        return [self._parse_row(row) for row in results]

    def get_visible_pdfs(self) -> List[Dict[str, Any]]:
        """
        获取所有可见的 PDF

        Returns:
            可见的记录列表
        """
        sql = '''
        SELECT * FROM pdf_info
        WHERE json_extract(json_data, '$.is_visible') = true
        ORDER BY updated_at DESC
        '''

        results = self._executor.execute_query(sql)
        return [self._parse_row(row) for row in results]

    def update_reading_stats(
        self,
        uuid: str,
        reading_time_delta: int
    ) -> bool:
        """
        更新阅读统计（访问时间、阅读时长、复习次数）

        Args:
            uuid: PDF UUID
            reading_time_delta: 本次阅读时长增量（秒）

        Returns:
            是否成功更新
        """
        pdf = self.query_by_id(uuid)
        if not pdf:
            return False

        current_time = int(time.time() * 1000)
        total_reading_time = pdf.get('total_reading_time', 0) + reading_time_delta
        review_count = pdf.get('review_count', 0) + 1

        sql = '''
        UPDATE pdf_info
        SET
            visited_at = ?,
            json_data = json_set(
                json_data,
                '$.last_accessed_at', ?,
                '$.total_reading_time', ?,
                '$.review_count', ?
            ),
            updated_at = ?,
            version = version + 1
        WHERE uuid = ?
        '''

        rows = self._executor.execute_update(sql, (
            current_time,
            current_time,
            total_reading_time,
            review_count,
            current_time,
            uuid
        ))

        if rows > 0:
            self._emit_event('update', 'completed', {'uuid': uuid})
            self._logger.info(f"Updated reading stats for PDF: {uuid}")

        return rows > 0

    def add_tag(self, uuid: str, tag: str) -> bool:
        """
        添加标签

        Args:
            uuid: PDF UUID
            tag: 标签名

        Returns:
            是否成功添加
        """
        pdf = self.query_by_id(uuid)
        if not pdf:
            return False

        tags = pdf.get('tags', [])
        if tag in tags:
            return False  # 标签已存在

        tags.append(tag)

        sql = '''
        UPDATE pdf_info
        SET
            json_data = json_set(json_data, '$.tags', json(?)),
            updated_at = ?,
            version = version + 1
        WHERE uuid = ?
        '''

        current_time = int(time.time() * 1000)
        rows = self._executor.execute_update(sql, (
            json.dumps(tags),
            current_time,
            uuid
        ))

        if rows > 0:
            self._emit_event('update', 'completed', {'uuid': uuid})
            self._logger.info(f"Added tag '{tag}' to PDF: {uuid}")

        return rows > 0

    def remove_tag(self, uuid: str, tag: str) -> bool:
        """
        移除标签

        Args:
            uuid: PDF UUID
            tag: 标签名

        Returns:
            是否成功移除
        """
        pdf = self.query_by_id(uuid)
        if not pdf:
            return False

        tags = pdf.get('tags', [])
        if tag not in tags:
            return False  # 标签不存在

        tags.remove(tag)

        sql = '''
        UPDATE pdf_info
        SET
            json_data = json_set(json_data, '$.tags', json(?)),
            updated_at = ?,
            version = version + 1
        WHERE uuid = ?
        '''

        current_time = int(time.time() * 1000)
        rows = self._executor.execute_update(sql, (
            json.dumps(tags),
            current_time,
            uuid
        ))

        if rows > 0:
            self._emit_event('update', 'completed', {'uuid': uuid})
            self._logger.info(f"Removed tag '{tag}' from PDF: {uuid}")

        return rows > 0

    def get_statistics(self) -> Dict[str, Any]:
        """
        获取统计信息

        Returns:
            统计数据（总数、总大小、平均页数等）
        """
        sql = '''
        SELECT
            COUNT(*) as total_count,
            SUM(file_size) as total_size,
            AVG(page_count) as avg_pages,
            MAX(created_at) as latest_created,
            COUNT(CASE WHEN json_extract(json_data, '$.is_visible') = true THEN 1 END) as visible_count
        FROM pdf_info
        '''

        result = self._executor.execute_query(sql)[0]

        return {
            'total_count': result['total_count'],
            'total_size': result['total_size'] or 0,
            'avg_pages': round(result['avg_pages'], 2) if result['avg_pages'] else 0,
            'latest_created': result['latest_created'] or 0,
            'visible_count': result['visible_count']
        }
```

---

## ✅ 单元测试用例

```python
# src/backend/database/plugins/__tests__/test_pdf_info_plugin.py

"""
PDFInfoTablePlugin 单元测试

测试覆盖:
1. 表创建
2. 数据验证
3. CRUD 操作
4. JSON 字段操作
5. 扩展查询方法
"""

import pytest
import time
from typing import Dict

from ..pdf_info_plugin import PDFInfoTablePlugin
from ...exceptions import DatabaseValidationError, DatabaseConstraintError


# ==================== Fixtures ====================

@pytest.fixture
def sample_pdf_data() -> Dict:
    """生成示例 PDF 数据"""
    return {
        'uuid': '0c251de0e2ac',
        'title': '测试PDF文档',
        'author': '测试作者',
        'page_count': 10,
        'file_size': 1024000,
        'created_at': int(time.time() * 1000),
        'updated_at': int(time.time() * 1000),
        'visited_at': 0,
        'version': 1,
        'json_data': {
            'filename': '0c251de0e2ac.pdf',
            'filepath': '/data/pdfs/0c251de0e2ac.pdf',
            'subject': 'Test Subject',
            'keywords': 'test, pdf',
            'thumbnail_path': None,
            'tags': ['测试', 'Python'],
            'notes': '这是测试笔记',
            'last_accessed_at': 0,
            'review_count': 0,
            'rating': 4,
            'is_visible': True,
            'total_reading_time': 0,
            'due_date': 0
        }
    }


# ==================== 测试：表创建 ====================

def test_create_table(plugin, executor):
    """测试：建表成功"""
    plugin.create_table()

    # 验证表存在
    result = executor.execute_query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='pdf_info'"
    )
    assert len(result) == 1

    # 验证索引存在
    result = executor.execute_query(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='pdf_info'"
    )
    assert len(result) >= 4  # 至少有4个索引


# ==================== 测试：数据验证 ====================

def test_validate_data_success(plugin, sample_pdf_data):
    """测试：数据验证通过"""
    validated = plugin.validate_data(sample_pdf_data)

    assert validated['uuid'] == '0c251de0e2ac'
    assert validated['title'] == '测试PDF文档'
    assert validated['page_count'] == 10
    assert 'json_data' in validated


def test_validate_data_missing_uuid(plugin, sample_pdf_data):
    """测试：缺少 uuid 字段"""
    del sample_pdf_data['uuid']

    with pytest.raises(DatabaseValidationError, match="uuid is required"):
        plugin.validate_data(sample_pdf_data)


def test_validate_data_invalid_uuid_format(plugin, sample_pdf_data):
    """测试：uuid 格式错误"""
    sample_pdf_data['uuid'] = 'invalid_uuid'

    with pytest.raises(DatabaseValidationError, match="12 hex characters"):
        plugin.validate_data(sample_pdf_data)


def test_validate_data_invalid_page_count(plugin, sample_pdf_data):
    """测试：page_count 为负数"""
    sample_pdf_data['page_count'] = -1

    with pytest.raises(DatabaseValidationError, match="non-negative integer"):
        plugin.validate_data(sample_pdf_data)


def test_validate_json_data_missing_filename(plugin, sample_pdf_data):
    """测试：json_data 缺少 filename"""
    del sample_pdf_data['json_data']['filename']

    with pytest.raises(DatabaseValidationError, match="filename is required"):
        plugin.validate_data(sample_pdf_data)


def test_validate_json_data_invalid_filename_format(plugin, sample_pdf_data):
    """测试：filename 格式错误"""
    sample_pdf_data['json_data']['filename'] = 'invalid.txt'

    with pytest.raises(DatabaseValidationError, match="must match pattern"):
        plugin.validate_data(sample_pdf_data)


def test_validate_json_data_invalid_rating(plugin, sample_pdf_data):
    """测试：rating 超出范围"""
    sample_pdf_data['json_data']['rating'] = 10

    with pytest.raises(DatabaseValidationError, match="between 0 and 5"):
        plugin.validate_data(sample_pdf_data)


def test_validate_json_data_invalid_tags(plugin, sample_pdf_data):
    """测试：tags 不是数组"""
    sample_pdf_data['json_data']['tags'] = "not an array"

    with pytest.raises(DatabaseValidationError, match="must be an array"):
        plugin.validate_data(sample_pdf_data)


# ==================== 测试：CRUD 操作 ====================

def test_insert_success(plugin, sample_pdf_data):
    """测试：插入成功"""
    uuid = plugin.insert(sample_pdf_data)

    assert uuid == '0c251de0e2ac'

    # 验证插入
    pdf = plugin.query_by_id(uuid)
    assert pdf is not None
    assert pdf['title'] == '测试PDF文档'
    assert pdf['tags'] == ['测试', 'Python']


def test_insert_duplicate_uuid(plugin, sample_pdf_data):
    """测试：重复 UUID 插入失败"""
    plugin.insert(sample_pdf_data)

    with pytest.raises(DatabaseConstraintError, match="already exists"):
        plugin.insert(sample_pdf_data)


def test_query_by_id_not_found(plugin):
    """测试：查询不存在的记录"""
    result = plugin.query_by_id('nonexistent')

    assert result is None


def test_update_success(plugin, sample_pdf_data):
    """测试：更新成功"""
    uuid = plugin.insert(sample_pdf_data)

    # 更新标题
    success = plugin.update(uuid, {'title': '更新后的标题'})
    assert success is True

    # 验证更新
    pdf = plugin.query_by_id(uuid)
    assert pdf['title'] == '更新后的标题'
    assert pdf['version'] == 2  # 版本号递增


def test_update_not_found(plugin):
    """测试：更新不存在的记录"""
    success = plugin.update('nonexistent', {'title': 'New Title'})

    assert success is False


def test_delete_success(plugin, sample_pdf_data):
    """测试：删除成功"""
    uuid = plugin.insert(sample_pdf_data)

    success = plugin.delete(uuid)
    assert success is True

    # 验证删除
    pdf = plugin.query_by_id(uuid)
    assert pdf is None


def test_delete_not_found(plugin):
    """测试：删除不存在的记录"""
    success = plugin.delete('nonexistent')

    assert success is False


def test_query_all(plugin, sample_pdf_data):
    """测试：查询所有记录"""
    # 插入3条记录
    for i in range(3):
        data = sample_pdf_data.copy()
        data['uuid'] = f'{i:012x}'
        data['json_data'] = {
            **sample_pdf_data['json_data'],
            'filename': f'{i:012x}.pdf'
        }
        plugin.insert(data)

    results = plugin.query_all()
    assert len(results) == 3


def test_query_all_with_pagination(plugin, sample_pdf_data):
    """测试：分页查询"""
    # 插入5条记录
    for i in range(5):
        data = sample_pdf_data.copy()
        data['uuid'] = f'{i:012x}'
        data['json_data'] = {
            **sample_pdf_data['json_data'],
            'filename': f'{i:012x}.pdf'
        }
        plugin.insert(data)

    # 查询第1页（2条记录）
    page1 = plugin.query_all(limit=2, offset=0)
    assert len(page1) == 2

    # 查询第2页（2条记录）
    page2 = plugin.query_all(limit=2, offset=2)
    assert len(page2) == 2


# ==================== 测试：扩展查询方法 ====================

def test_query_by_filename(plugin, sample_pdf_data):
    """测试：根据文件名查询"""
    plugin.insert(sample_pdf_data)

    pdf = plugin.query_by_filename('0c251de0e2ac.pdf')
    assert pdf is not None
    assert pdf['uuid'] == '0c251de0e2ac'


def test_search(plugin, sample_pdf_data):
    """测试：搜索功能"""
    plugin.insert(sample_pdf_data)

    # 搜索标题
    results = plugin.search('测试', fields=['title'])
    assert len(results) == 1
    assert results[0]['title'] == '测试PDF文档'

    # 搜索不存在的关键词
    results = plugin.search('不存在的关键词')
    assert len(results) == 0


def test_filter_by_tags_any(plugin, sample_pdf_data):
    """测试：按标签过滤（任一匹配）"""
    plugin.insert(sample_pdf_data)

    results = plugin.filter_by_tags(['Python'], match_mode='any')
    assert len(results) == 1


def test_filter_by_tags_all(plugin, sample_pdf_data):
    """测试：按标签过滤（全部匹配）"""
    plugin.insert(sample_pdf_data)

    # 全部匹配
    results = plugin.filter_by_tags(['测试', 'Python'], match_mode='all')
    assert len(results) == 1

    # 部分匹配（应返回0）
    results = plugin.filter_by_tags(['测试', '不存在'], match_mode='all')
    assert len(results) == 0


def test_filter_by_rating(plugin, sample_pdf_data):
    """测试：按评分过滤"""
    plugin.insert(sample_pdf_data)

    # 评分 4-5
    results = plugin.filter_by_rating(min_rating=4, max_rating=5)
    assert len(results) == 1

    # 评分 0-2（应返回0）
    results = plugin.filter_by_rating(min_rating=0, max_rating=2)
    assert len(results) == 0


def test_get_visible_pdfs(plugin, sample_pdf_data):
    """测试：获取可见的 PDF"""
    # 插入可见的 PDF
    plugin.insert(sample_pdf_data)

    # 插入不可见的 PDF
    invisible_data = sample_pdf_data.copy()
    invisible_data['uuid'] = 'aabbccddeeff'
    invisible_data['json_data'] = {
        **sample_pdf_data['json_data'],
        'filename': 'aabbccddeeff.pdf',
        'is_visible': False
    }
    plugin.insert(invisible_data)

    # 查询可见的 PDF
    results = plugin.get_visible_pdfs()
    assert len(results) == 1
    assert results[0]['uuid'] == '0c251de0e2ac'


def test_update_reading_stats(plugin, sample_pdf_data):
    """测试：更新阅读统计"""
    uuid = plugin.insert(sample_pdf_data)

    # 更新阅读统计（阅读60秒）
    success = plugin.update_reading_stats(uuid, reading_time_delta=60)
    assert success is True

    # 验证统计更新
    pdf = plugin.query_by_id(uuid)
    assert pdf['total_reading_time'] == 60
    assert pdf['review_count'] == 1
    assert pdf['last_accessed_at'] > 0


def test_add_tag(plugin, sample_pdf_data):
    """测试：添加标签"""
    uuid = plugin.insert(sample_pdf_data)

    # 添加新标签
    success = plugin.add_tag(uuid, '新标签')
    assert success is True

    # 验证标签添加
    pdf = plugin.query_by_id(uuid)
    assert '新标签' in pdf['tags']

    # 添加重复标签（应失败）
    success = plugin.add_tag(uuid, '新标签')
    assert success is False


def test_remove_tag(plugin, sample_pdf_data):
    """测试：移除标签"""
    uuid = plugin.insert(sample_pdf_data)

    # 移除标签
    success = plugin.remove_tag(uuid, 'Python')
    assert success is True

    # 验证标签移除
    pdf = plugin.query_by_id(uuid)
    assert 'Python' not in pdf['tags']

    # 移除不存在的标签（应失败）
    success = plugin.remove_tag(uuid, '不存在的标签')
    assert success is False


def test_get_statistics(plugin, sample_pdf_data):
    """测试：获取统计信息"""
    # 插入3条记录
    for i in range(3):
        data = sample_pdf_data.copy()
        data['uuid'] = f'{i:012x}'
        data['json_data'] = {
            **sample_pdf_data['json_data'],
            'filename': f'{i:012x}.pdf'
        }
        plugin.insert(data)

    stats = plugin.get_statistics()

    assert stats['total_count'] == 3
    assert stats['total_size'] == 1024000 * 3
    assert stats['avg_pages'] == 10
    assert stats['visible_count'] == 3


# ==================== 测试：事件发布 ====================

def test_event_emission_on_insert(plugin, sample_pdf_data, event_bus):
    """测试：插入时发布事件"""
    received_events = []

    def listener(data):
        received_events.append(data)

    event_bus.on('table:pdf_info:create:completed', listener)

    plugin.insert(sample_pdf_data)

    assert len(received_events) == 1
    assert received_events[0]['uuid'] == '0c251de0e2ac'


def test_event_emission_on_update(plugin, sample_pdf_data, event_bus):
    """测试：更新时发布事件"""
    uuid = plugin.insert(sample_pdf_data)

    received_events = []

    def listener(data):
        received_events.append(data)

    event_bus.on('table:pdf_info:update:completed', listener)

    plugin.update(uuid, {'title': '新标题'})

    assert len(received_events) == 1
    assert received_events[0]['uuid'] == uuid


def test_event_emission_on_delete(plugin, sample_pdf_data, event_bus):
    """测试：删除时发布事件"""
    uuid = plugin.insert(sample_pdf_data)

    received_events = []

    def listener(data):
        received_events.append(data)

    event_bus.on('table:pdf_info:delete:completed', listener)

    plugin.delete(uuid)

    assert len(received_events) == 1
    assert received_events[0]['uuid'] == uuid
```

---

## 📦 交付标准清单

### 代码完成
- [ ] `pdf_info_plugin.py` - PDFInfoTablePlugin 实现
- [ ] 所有必须方法实现（7个）
- [ ] 所有扩展方法实现（10个）

### 测试通过
- [ ] 所有单元测试通过（30+个测试用例）
- [ ] 测试覆盖率 ≥ 90%
- [ ] 边界情况测试通过

### 代码质量
- [ ] 所有方法有 docstring
- [ ] 所有参数有类型注解
- [ ] 通过 pylint 检查（评分 ≥ 8.5）
- [ ] 通过 mypy 类型检查

### 功能验证
- [ ] 表创建成功
- [ ] 索引创建成功
- [ ] CRUD 操作正常
- [ ] JSON 字段解析正确
- [ ] 事件发布正确
- [ ] 扩展查询方法正常

### 文档完善
- [ ] 代码注释完整
- [ ] 使用示例清晰
- [ ] 异常说明明确

---

**文档结束**

✅ PDFInfoTablePlugin 是数据库系统的核心基础表，后续所有表插件都依赖它。
