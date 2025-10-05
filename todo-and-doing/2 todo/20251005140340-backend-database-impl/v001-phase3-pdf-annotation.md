# 后端数据库系统 - 第三期需求文档（PDFAnnotation表）

**期数**: 第三期 - 数据表插件实现
**文档**: v004-phase3-pdf-annotation.md
**版本**: v1.0
**创建日期**: 2025-10-05
**预计工期**: 1天
**依赖**: 第二期（插件架构）+ pdf_info 表

---

## 📋 概述

### 目标
实现 `PDFAnnotationTablePlugin` 插件，管理 PDF 标注数据（截图、文本高亮、批注）。

### 为什么需要此表？
1. **核心功能** - 标注是用户阅读PDF的核心交互方式
2. **多类型支持** - 支持截图、文本高亮、批注三种标注类型
3. **灵活数据** - 使用 JSONB 存储不同类型的标注数据
4. **级联关联** - 通过 pdf_uuid 关联到 pdf_info 表

### 依赖关系
- **依赖**: `pdf_info` 表（外键约束）
- **被依赖**: 无

---

## 🗄️ 表结构 SQL

```sql
-- ========================================
-- PDF 标注表
-- ========================================

CREATE TABLE IF NOT EXISTS pdf_annotation (
    -- ========== 主键 ==========
    ann_id TEXT PRIMARY KEY NOT NULL,

    -- ========== 外键 ==========
    pdf_uuid TEXT NOT NULL,

    -- ========== 核心字段（高频查询） ==========
    page_number INTEGER NOT NULL CHECK (page_number > 0),
    type TEXT NOT NULL CHECK (type IN ('screenshot', 'text-highlight', 'comment')),

    -- ========== 时间字段 ==========
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,

    -- ========== 版本控制 ==========
    version INTEGER NOT NULL DEFAULT 1,

    -- ========== 扩展数据（JSONB） ==========
    json_data TEXT NOT NULL DEFAULT '{}'
        CHECK (json_valid(json_data)),

    -- ========== 外键约束 ==========
    FOREIGN KEY (pdf_uuid) REFERENCES pdf_info(uuid) ON DELETE CASCADE
);

-- ========================================
-- 索引
-- ========================================

-- 基础索引
CREATE INDEX IF NOT EXISTS idx_ann_pdf_uuid ON pdf_annotation(pdf_uuid);
CREATE INDEX IF NOT EXISTS idx_ann_page ON pdf_annotation(page_number);
CREATE INDEX IF NOT EXISTS idx_ann_type ON pdf_annotation(type);
CREATE INDEX IF NOT EXISTS idx_ann_created ON pdf_annotation(created_at DESC);

-- 复合索引（常用查询：按PDF+页码查标注）
CREATE INDEX IF NOT EXISTS idx_ann_pdf_page
    ON pdf_annotation(pdf_uuid, page_number);
```

---

## 📝 字段验证规则

| 字段名 | 类型 | 必填 | 约束 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| **主键** |
| `ann_id` | TEXT | ✅ | PRIMARY KEY, 非空 | 无 | 标注ID（ann_{timestamp}_{random}） |
| **外键** |
| `pdf_uuid` | TEXT | ✅ | FOREIGN KEY, 非空 | 无 | 关联的PDF UUID |
| **核心字段** |
| `page_number` | INTEGER | ✅ | > 0 | 无 | 页码（从1开始） |
| `type` | TEXT | ✅ | 枚举值 | 无 | 标注类型（screenshot/text-highlight/comment） |
| **时间字段** |
| `created_at` | INTEGER | ✅ | 非空 | `0` | 创建时间（Unix毫秒） |
| `updated_at` | INTEGER | ✅ | 非空 | `0` | 更新时间（Unix毫秒） |
| **版本控制** |
| `version` | INTEGER | ✅ | ≥ 1 | `1` | 乐观锁版本号 |
| **扩展数据** |
| `json_data` | TEXT | ✅ | 合法JSON | `'{}'` | JSONB扩展字段 |

### json_data 字段验证规则（根据 type 不同）

#### Type: screenshot

| 字段路径 | 类型 | 必填 | 约束 | 说明 |
|----------|------|------|------|------|
| `$.data.rect.x` | number | ✅ | ≥ 0 | 矩形X坐标 |
| `$.data.rect.y` | number | ✅ | ≥ 0 | 矩形Y坐标 |
| `$.data.rect.width` | number | ✅ | > 0 | 矩形宽度 |
| `$.data.rect.height` | number | ✅ | > 0 | 矩形高度 |
| `$.data.imagePath` | string | ✅* | 非空 | 图片文件路径（v003规范） |
| `$.data.imageHash` | string | ✅* | 非空 | 图片MD5哈希（v003规范） |
| `$.data.imageData` | string | ❌ | base64 | Base64图片数据（旧版兼容） |
| `$.data.description` | string | ❌ | 无 | 描述 |
| `$.comments` | array | ❌ | 评论数组 | 评论列表 |

*注：imagePath和imageHash为v003规范字段，imageData为兼容旧版

#### Type: text-highlight

| 字段路径 | 类型 | 必填 | 约束 | 说明 |
|----------|------|------|------|------|
| `$.data.selectedText` | string | ✅ | 非空 | 选中的文本 |
| `$.data.textRanges` | array | ✅ | 非空数组 | 文本范围（PDF.js格式） |
| `$.data.highlightColor` | string | ✅ | HEX颜色 | 高亮颜色（如#ffff00） |
| `$.data.note` | string | ❌ | 无 | 笔记 |
| `$.comments` | array | ❌ | 评论数组 | 评论列表 |

#### Type: comment

| 字段路径 | 类型 | 必填 | 约束 | 说明 |
|----------|------|------|------|------|
| `$.data.position.x` | number | ✅ | ≥ 0 | 位置X坐标 |
| `$.data.position.y` | number | ✅ | ≥ 0 | 位置Y坐标 |
| `$.data.content` | string | ✅ | 非空 | 批注内容 |
| `$.comments` | array | ❌ | 评论数组 | 评论列表 |

#### 公共字段：comments 数组

| 字段路径 | 类型 | 必填 | 说明 |
|----------|------|------|------|
| `$.comments[].id` | string | ✅ | 评论ID（comment_{timestamp}_{random}） |
| `$.comments[].content` | string | ✅ | 评论内容 |
| `$.comments[].createdAt` | string | ✅ | 创建时间（ISO 8601） |

---

## 🔧 json_data Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["data"],
  "properties": {
    "data": {
      "type": "object",
      "description": "类型特定数据（根据 type 字段不同）",
      "oneOf": [
        {
          "title": "Screenshot Data",
          "required": ["rect"],
          "properties": {
            "rect": {
              "type": "object",
              "required": ["x", "y", "width", "height"],
              "properties": {
                "x": {"type": "number", "minimum": 0},
                "y": {"type": "number", "minimum": 0},
                "width": {"type": "number", "exclusiveMinimum": 0},
                "height": {"type": "number", "exclusiveMinimum": 0}
              }
            },
            "imagePath": {
              "type": "string",
              "description": "图片文件路径（v003规范）",
              "minLength": 1
            },
            "imageHash": {
              "type": "string",
              "description": "图片MD5哈希（v003规范）",
              "pattern": "^[a-f0-9]{32}$"
            },
            "imageData": {
              "type": "string",
              "description": "Base64图片数据（兼容旧版）",
              "pattern": "^data:image/"
            },
            "description": {
              "type": "string",
              "description": "截图描述"
            }
          }
        },
        {
          "title": "Text Highlight Data",
          "required": ["selectedText", "textRanges", "highlightColor"],
          "properties": {
            "selectedText": {
              "type": "string",
              "minLength": 1
            },
            "textRanges": {
              "type": "array",
              "minItems": 1
            },
            "highlightColor": {
              "type": "string",
              "pattern": "^#[0-9a-fA-F]{6}$"
            },
            "note": {
              "type": "string"
            }
          }
        },
        {
          "title": "Comment Data",
          "required": ["position", "content"],
          "properties": {
            "position": {
              "type": "object",
              "required": ["x", "y"],
              "properties": {
                "x": {"type": "number", "minimum": 0},
                "y": {"type": "number", "minimum": 0}
              }
            },
            "content": {
              "type": "string",
              "minLength": 1
            }
          }
        }
      ]
    },
    "comments": {
      "type": "array",
      "description": "评论数组",
      "items": {
        "type": "object",
        "required": ["id", "content", "createdAt"],
        "properties": {
          "id": {"type": "string"},
          "content": {"type": "string"},
          "createdAt": {"type": "string", "format": "date-time"}
        }
      },
      "default": []
    }
  }
}
```

---

## 💻 完整类实现

```python
# src/backend/database/plugins/pdf_annotation_plugin.py

"""
PDFAnnotationTablePlugin - PDF 标注表插件

职责:
1. 管理 pdf_annotation 表的 CRUD 操作
2. 验证不同类型标注的数据合法性
3. 支持评论管理（添加/删除评论）
4. 提供按PDF、页码、类型查询标注的方法

Author: AI Assistant
Created: 2025-10-05
"""

from typing import Dict, List, Optional, Any
import time
import json
import re

from ..plugin.base_table_plugin import TablePlugin
from ..exceptions import DatabaseValidationError, DatabaseConstraintError


class PDFAnnotationTablePlugin(TablePlugin):
    """PDF 标注表插件"""

    # ==================== 必须实现的属性 ====================

    @property
    def table_name(self) -> str:
        """表名"""
        return 'pdf_annotation'

    @property
    def version(self) -> str:
        """插件版本"""
        return '1.0.0'

    @property
    def dependencies(self) -> List[str]:
        """依赖 pdf_info 表"""
        return ['pdf_info']

    # ==================== 必须实现的方法（建表） ====================

    def create_table(self) -> None:
        """建表（如果表不存在）"""
        sql = '''
        -- ========================================
        -- PDF 标注表
        -- ========================================

        CREATE TABLE IF NOT EXISTS pdf_annotation (
            -- ========== 主键 ==========
            ann_id TEXT PRIMARY KEY NOT NULL,

            -- ========== 外键 ==========
            pdf_uuid TEXT NOT NULL,

            -- ========== 核心字段（高频查询） ==========
            page_number INTEGER NOT NULL CHECK (page_number > 0),
            type TEXT NOT NULL CHECK (type IN ('screenshot', 'text-highlight', 'comment')),

            -- ========== 时间字段 ==========
            created_at INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL DEFAULT 0,

            -- ========== 版本控制 ==========
            version INTEGER NOT NULL DEFAULT 1,

            -- ========== 扩展数据（JSONB） ==========
            json_data TEXT NOT NULL DEFAULT '{}'
                CHECK (json_valid(json_data)),

            -- ========== 外键约束 ==========
            FOREIGN KEY (pdf_uuid) REFERENCES pdf_info(uuid) ON DELETE CASCADE
        );

        -- ========================================
        -- 索引
        -- ========================================

        CREATE INDEX IF NOT EXISTS idx_ann_pdf_uuid ON pdf_annotation(pdf_uuid);
        CREATE INDEX IF NOT EXISTS idx_ann_page ON pdf_annotation(page_number);
        CREATE INDEX IF NOT EXISTS idx_ann_type ON pdf_annotation(type);
        CREATE INDEX IF NOT EXISTS idx_ann_created ON pdf_annotation(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_ann_pdf_page
            ON pdf_annotation(pdf_uuid, page_number);
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
        if 'ann_id' not in data:
            raise DatabaseValidationError("ann_id is required")

        ann_id = data['ann_id']
        if not isinstance(ann_id, str) or not ann_id.strip():
            raise DatabaseValidationError("ann_id must be a non-empty string")

        # 验证 ann_id 格式（ann_{timestamp}_{random}）
        if not re.match(r'^ann_\d+_[a-z0-9]+$', ann_id):
            raise DatabaseValidationError(
                f"ann_id must match pattern 'ann_{{timestamp}}_{{random}}', got: {ann_id}"
            )

        # 2. 外键检查
        if 'pdf_uuid' not in data:
            raise DatabaseValidationError("pdf_uuid is required")

        pdf_uuid = data['pdf_uuid']
        if not isinstance(pdf_uuid, str) or not pdf_uuid.strip():
            raise DatabaseValidationError("pdf_uuid must be a non-empty string")

        # 3. page_number 检查
        if 'page_number' not in data:
            raise DatabaseValidationError("page_number is required")

        page_number = data['page_number']
        if not isinstance(page_number, int) or page_number < 1:
            raise DatabaseValidationError("page_number must be a positive integer")

        # 4. type 检查
        if 'type' not in data:
            raise DatabaseValidationError("type is required")

        ann_type = data['type']
        valid_types = ['screenshot', 'text-highlight', 'comment']
        if ann_type not in valid_types:
            raise DatabaseValidationError(
                f"type must be one of {valid_types}, got: {ann_type}"
            )

        # 5. 时间字段验证
        current_time = int(time.time() * 1000)

        created_at = data.get('created_at', current_time)
        if not isinstance(created_at, int):
            raise DatabaseValidationError("created_at must be an integer")

        updated_at = data.get('updated_at', current_time)
        if not isinstance(updated_at, int):
            raise DatabaseValidationError("updated_at must be an integer")

        # 6. 版本字段验证
        version = data.get('version', 1)
        if not isinstance(version, int) or version < 1:
            raise DatabaseValidationError("version must be a positive integer")

        # 7. JSON 字段验证（根据 type 不同）
        json_data = self._validate_json_data(ann_type, data.get('json_data', {}))

        # 8. 返回验证后的数据
        return {
            'ann_id': ann_id,
            'pdf_uuid': pdf_uuid,
            'page_number': page_number,
            'type': ann_type,
            'created_at': created_at,
            'updated_at': updated_at,
            'version': version,
            'json_data': json.dumps(json_data, ensure_ascii=False)
        }

    def _validate_json_data(self, ann_type: str, json_data: Any) -> Dict:
        """
        验证 json_data 字段（根据标注类型）

        Args:
            ann_type: 标注类型
            json_data: JSON 数据

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

        # 必须有 data 字段
        if 'data' not in json_data:
            raise DatabaseValidationError("json_data.data is required")

        data = json_data['data']
        if not isinstance(data, dict):
            raise DatabaseValidationError("json_data.data must be an object")

        # 根据类型验证 data 字段
        if ann_type == 'screenshot':
            validated_data = self._validate_screenshot_data(data)
        elif ann_type == 'text-highlight':
            validated_data = self._validate_text_highlight_data(data)
        elif ann_type == 'comment':
            validated_data = self._validate_comment_data(data)
        else:
            raise DatabaseValidationError(f"Unknown annotation type: {ann_type}")

        # 验证 comments 字段
        comments = self._validate_comments(json_data.get('comments', []))

        return {
            'data': validated_data,
            'comments': comments
        }

    def _validate_screenshot_data(self, data: Dict) -> Dict:
        """验证截图标注数据"""
        # rect 字段必须存在
        if 'rect' not in data:
            raise DatabaseValidationError("Screenshot annotation requires rect")

        rect = data['rect']
        if not isinstance(rect, dict):
            raise DatabaseValidationError("rect must be an object")

        # 验证 rect 的四个属性
        for field in ['x', 'y', 'width', 'height']:
            if field not in rect:
                raise DatabaseValidationError(f"rect.{field} is required")
            if not isinstance(rect[field], (int, float)):
                raise DatabaseValidationError(f"rect.{field} must be a number")

        if rect['x'] < 0 or rect['y'] < 0:
            raise DatabaseValidationError("rect.x and rect.y must be non-negative")

        if rect['width'] <= 0 or rect['height'] <= 0:
            raise DatabaseValidationError("rect.width and rect.height must be positive")

        # v003规范：支持 imagePath/imageHash（优先）或 imageData（兼容）
        has_path = 'imagePath' in data and 'imageHash' in data
        has_data = 'imageData' in data

        if not has_path and not has_data:
            raise DatabaseValidationError(
                "Screenshot annotation requires imagePath+imageHash or imageData"
            )

        validated = {'rect': rect}

        # 验证 imagePath 和 imageHash
        if has_path:
            if not isinstance(data['imagePath'], str) or not data['imagePath'].strip():
                raise DatabaseValidationError("imagePath must be a non-empty string")

            if not isinstance(data['imageHash'], str):
                raise DatabaseValidationError("imageHash must be a string")

            # 验证 MD5 格式（32位十六进制）
            if not re.match(r'^[a-f0-9]{32}$', data['imageHash']):
                raise DatabaseValidationError("imageHash must be 32 hex characters")

            validated['imagePath'] = data['imagePath']
            validated['imageHash'] = data['imageHash']

        # 验证 imageData（兼容旧版）
        if has_data:
            if not isinstance(data['imageData'], str):
                raise DatabaseValidationError("imageData must be a string")

            if not data['imageData'].startswith('data:image/'):
                raise DatabaseValidationError("imageData must be valid base64")

            validated['imageData'] = data['imageData']

        # 可选字段：description
        if 'description' in data:
            validated['description'] = str(data['description'])

        return validated

    def _validate_text_highlight_data(self, data: Dict) -> Dict:
        """验证文本高亮标注数据"""
        # selectedText 必填
        if 'selectedText' not in data:
            raise DatabaseValidationError("Text highlight requires selectedText")

        if not isinstance(data['selectedText'], str) or not data['selectedText'].strip():
            raise DatabaseValidationError("selectedText must be a non-empty string")

        # textRanges 必填
        if 'textRanges' not in data:
            raise DatabaseValidationError("Text highlight requires textRanges")

        if not isinstance(data['textRanges'], list) or len(data['textRanges']) == 0:
            raise DatabaseValidationError("textRanges must be a non-empty array")

        # highlightColor 必填
        if 'highlightColor' not in data:
            raise DatabaseValidationError("Text highlight requires highlightColor")

        color = data['highlightColor']
        if not isinstance(color, str):
            raise DatabaseValidationError("highlightColor must be a string")

        # 验证 HEX 颜色格式
        if not re.match(r'^#[0-9a-fA-F]{6}$', color):
            raise DatabaseValidationError(
                f"highlightColor must be HEX format (e.g., #ffff00), got: {color}"
            )

        validated = {
            'selectedText': data['selectedText'],
            'textRanges': data['textRanges'],
            'highlightColor': color
        }

        # 可选字段：note
        if 'note' in data:
            validated['note'] = str(data['note'])

        return validated

    def _validate_comment_data(self, data: Dict) -> Dict:
        """验证批注标注数据"""
        # position 必填
        if 'position' not in data:
            raise DatabaseValidationError("Comment annotation requires position")

        position = data['position']
        if not isinstance(position, dict):
            raise DatabaseValidationError("position must be an object")

        # 验证 position.x 和 position.y
        for field in ['x', 'y']:
            if field not in position:
                raise DatabaseValidationError(f"position.{field} is required")
            if not isinstance(position[field], (int, float)):
                raise DatabaseValidationError(f"position.{field} must be a number")
            if position[field] < 0:
                raise DatabaseValidationError(f"position.{field} must be non-negative")

        # content 必填
        if 'content' not in data:
            raise DatabaseValidationError("Comment annotation requires content")

        if not isinstance(data['content'], str) or not data['content'].strip():
            raise DatabaseValidationError("content must be a non-empty string")

        return {
            'position': position,
            'content': data['content']
        }

    def _validate_comments(self, comments: Any) -> List[Dict]:
        """验证评论数组"""
        if not isinstance(comments, list):
            raise DatabaseValidationError("comments must be an array")

        validated = []
        for comment in comments:
            if not isinstance(comment, dict):
                raise DatabaseValidationError("comment item must be an object")

            # 必填字段
            if 'id' not in comment:
                raise DatabaseValidationError("comment.id is required")
            if 'content' not in comment:
                raise DatabaseValidationError("comment.content is required")
            if 'createdAt' not in comment:
                raise DatabaseValidationError("comment.createdAt is required")

            # 验证 ISO 8601 时间格式
            try:
                from datetime import datetime
                datetime.fromisoformat(comment['createdAt'].replace('Z', '+00:00'))
            except ValueError as e:
                raise DatabaseValidationError(
                    f"comment.createdAt must be ISO 8601 format: {e}"
                ) from e

            validated.append({
                'id': str(comment['id']),
                'content': str(comment['content']),
                'createdAt': comment['createdAt']
            })

        return validated

    # ==================== 必须实现的方法（CRUD） ====================

    def insert(self, data: Dict[str, Any]) -> str:
        """插入一条记录"""
        # 1. 验证数据
        validated = self.validate_data(data)

        # 2. 检查 ann_id 是否已存在
        existing = self.query_by_id(validated['ann_id'])
        if existing:
            raise DatabaseConstraintError(
                f"Annotation with ann_id '{validated['ann_id']}' already exists"
            )

        # 3. 执行插入
        sql = '''
        INSERT INTO pdf_annotation (
            ann_id, pdf_uuid, page_number, type,
            created_at, updated_at, version, json_data
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, jsonb(?))
        '''

        self._executor.execute_update(sql, (
            validated['ann_id'],
            validated['pdf_uuid'],
            validated['page_number'],
            validated['type'],
            validated['created_at'],
            validated['updated_at'],
            validated['version'],
            validated['json_data']
        ))

        # 4. 触发事件
        self._emit_event('create', 'completed', {'ann_id': validated['ann_id']})

        self._logger.info(f"Inserted annotation: {validated['ann_id']}")
        return validated['ann_id']

    def update(self, primary_key: str, data: Dict[str, Any]) -> bool:
        """更新记录"""
        # 1. 检查记录是否存在
        existing = self.query_by_id(primary_key)
        if not existing:
            return False

        # 2. 合并数据
        full_data = {**existing, **data, 'ann_id': primary_key}

        # 3. 更新 updated_at 和 version
        full_data['updated_at'] = int(time.time() * 1000)
        full_data['version'] = existing['version'] + 1

        # 4. 验证数据
        validated = self.validate_data(full_data)

        # 5. 执行更新
        sql = '''
        UPDATE pdf_annotation
        SET
            page_number = ?,
            type = ?,
            updated_at = ?,
            version = ?,
            json_data = jsonb(?)
        WHERE ann_id = ?
        '''

        rows = self._executor.execute_update(sql, (
            validated['page_number'],
            validated['type'],
            validated['updated_at'],
            validated['version'],
            validated['json_data'],
            primary_key
        ))

        if rows > 0:
            self._emit_event('update', 'completed', {'ann_id': primary_key})
            self._logger.info(f"Updated annotation: {primary_key}")

        return rows > 0

    def delete(self, primary_key: str) -> bool:
        """删除记录"""
        sql = "DELETE FROM pdf_annotation WHERE ann_id = ?"
        rows = self._executor.execute_update(sql, (primary_key,))

        if rows > 0:
            self._emit_event('delete', 'completed', {'ann_id': primary_key})
            self._logger.info(f"Deleted annotation: {primary_key}")

        return rows > 0

    def query_by_id(self, primary_key: str) -> Optional[Dict[str, Any]]:
        """根据主键查询单条记录"""
        sql = "SELECT * FROM pdf_annotation WHERE ann_id = ?"
        results = self._executor.execute_query(sql, (primary_key,))

        if not results:
            return None

        return self._parse_row(results[0])

    def query_all(
        self,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """查询所有记录（分页）"""
        sql = "SELECT * FROM pdf_annotation ORDER BY created_at DESC"

        if limit is not None:
            sql += f" LIMIT {int(limit)}"

        if offset is not None:
            sql += f" OFFSET {int(offset)}"

        results = self._executor.execute_query(sql)
        return [self._parse_row(row) for row in results]

    def _parse_row(self, row: Dict) -> Dict:
        """解析数据库行"""
        try:
            json_data = json.loads(row.get('json_data', '{}'))
        except json.JSONDecodeError:
            json_data = {}

        parsed = {
            'ann_id': row['ann_id'],
            'pdf_uuid': row['pdf_uuid'],
            'page_number': row['page_number'],
            'type': row['type'],
            'created_at': row['created_at'],
            'updated_at': row['updated_at'],
            'version': row['version'],
            'data': json_data.get('data', {}),
            'comments': json_data.get('comments', [])
        }

        return parsed

    # ==================== 扩展方法 ====================

    def query_by_pdf(self, pdf_uuid: str) -> List[Dict[str, Any]]:
        """
        查询某个 PDF 的所有标注

        Args:
            pdf_uuid: PDF UUID

        Returns:
            标注列表
        """
        sql = '''
        SELECT * FROM pdf_annotation
        WHERE pdf_uuid = ?
        ORDER BY page_number, created_at
        '''

        results = self._executor.execute_query(sql, (pdf_uuid,))
        return [self._parse_row(row) for row in results]

    def query_by_page(
        self,
        pdf_uuid: str,
        page_number: int
    ) -> List[Dict[str, Any]]:
        """
        查询某个 PDF 某页的所有标注

        Args:
            pdf_uuid: PDF UUID
            page_number: 页码

        Returns:
            标注列表
        """
        sql = '''
        SELECT * FROM pdf_annotation
        WHERE pdf_uuid = ? AND page_number = ?
        ORDER BY created_at
        '''

        results = self._executor.execute_query(sql, (pdf_uuid, page_number))
        return [self._parse_row(row) for row in results]

    def query_by_type(
        self,
        pdf_uuid: str,
        ann_type: str
    ) -> List[Dict[str, Any]]:
        """
        查询某个 PDF 某种类型的所有标注

        Args:
            pdf_uuid: PDF UUID
            ann_type: 标注类型

        Returns:
            标注列表
        """
        sql = '''
        SELECT * FROM pdf_annotation
        WHERE pdf_uuid = ? AND type = ?
        ORDER BY page_number, created_at
        '''

        results = self._executor.execute_query(sql, (pdf_uuid, ann_type))
        return [self._parse_row(row) for row in results]

    def count_by_pdf(self, pdf_uuid: str) -> int:
        """
        统计某个 PDF 的标注数量

        Args:
            pdf_uuid: PDF UUID

        Returns:
            标注数量
        """
        sql = "SELECT COUNT(*) as count FROM pdf_annotation WHERE pdf_uuid = ?"
        result = self._executor.execute_query(sql, (pdf_uuid,))[0]
        return result['count']

    def count_by_type(self, pdf_uuid: str, ann_type: str) -> int:
        """
        统计某个 PDF 某种类型的标注数量

        Args:
            pdf_uuid: PDF UUID
            ann_type: 标注类型

        Returns:
            标注数量
        """
        sql = '''
        SELECT COUNT(*) as count FROM pdf_annotation
        WHERE pdf_uuid = ? AND type = ?
        '''
        result = self._executor.execute_query(sql, (pdf_uuid, ann_type))[0]
        return result['count']

    def delete_by_pdf(self, pdf_uuid: str) -> int:
        """
        删除某个 PDF 的所有标注

        Args:
            pdf_uuid: PDF UUID

        Returns:
            删除的标注数量
        """
        sql = "DELETE FROM pdf_annotation WHERE pdf_uuid = ?"
        rows = self._executor.execute_update(sql, (pdf_uuid,))

        if rows > 0:
            self._emit_event('delete', 'completed', {
                'pdf_uuid': pdf_uuid,
                'count': rows
            })
            self._logger.info(f"Deleted {rows} annotations for PDF: {pdf_uuid}")

        return rows

    def add_comment(
        self,
        ann_id: str,
        comment_content: str
    ) -> Optional[Dict]:
        """
        添加评论到标注

        Args:
            ann_id: 标注ID
            comment_content: 评论内容

        Returns:
            新增的评论对象，失败则返回 None
        """
        annotation = self.query_by_id(ann_id)
        if not annotation:
            return None

        # 生成评论ID
        timestamp = int(time.time() * 1000)
        random_str = str(timestamp)[-6:]
        comment_id = f"comment_{timestamp}_{random_str}"

        # 创建评论对象
        from datetime import datetime
        new_comment = {
            'id': comment_id,
            'content': comment_content,
            'createdAt': datetime.utcnow().isoformat() + 'Z'
        }

        # 添加到 comments 数组
        comments = annotation.get('comments', [])
        comments.append(new_comment)

        # 更新标注
        success = self.update(ann_id, {'comments': comments})

        if success:
            self._logger.info(f"Added comment to annotation: {ann_id}")
            return new_comment

        return None

    def remove_comment(
        self,
        ann_id: str,
        comment_id: str
    ) -> bool:
        """
        从标注中删除评论

        Args:
            ann_id: 标注ID
            comment_id: 评论ID

        Returns:
            是否成功删除
        """
        annotation = self.query_by_id(ann_id)
        if not annotation:
            return False

        # 过滤掉要删除的评论
        comments = annotation.get('comments', [])
        filtered = [c for c in comments if c['id'] != comment_id]

        if len(filtered) == len(comments):
            return False  # 评论不存在

        # 更新标注
        success = self.update(ann_id, {'comments': filtered})

        if success:
            self._logger.info(f"Removed comment {comment_id} from annotation: {ann_id}")

        return success

    def register_events(self) -> None:
        """注册事件监听器（监听 pdf_info 删除事件）"""
        # 监听 PDF 删除事件，级联删除标注
        self._event_bus.on(
            'table:pdf_info:delete:completed',
            self._handle_pdf_deleted
        )

    def _handle_pdf_deleted(self, data: Dict) -> None:
        """处理 PDF 删除事件（级联删除标注）"""
        pdf_uuid = data.get('uuid')
        if pdf_uuid:
            self.delete_by_pdf(pdf_uuid)
```

---

## ✅ 单元测试用例

由于篇幅限制，这里仅列出测试用例清单：

```python
# test_pdf_annotation_plugin.py

# 1. 表创建测试
def test_create_table()
def test_indexes_created()

# 2. 数据验证测试（15个）
def test_validate_screenshot_data_success()
def test_validate_screenshot_missing_rect()
def test_validate_screenshot_invalid_image_path()
def test_validate_text_highlight_data_success()
def test_validate_text_highlight_missing_selected_text()
def test_validate_text_highlight_invalid_color()
def test_validate_comment_data_success()
def test_validate_comment_missing_position()
def test_validate_comment_missing_content()
def test_validate_comments_array()
def test_validate_invalid_type()
def test_validate_invalid_page_number()
def test_validate_missing_pdf_uuid()
def test_validate_invalid_ann_id_format()
def test_validate_foreign_key_constraint()

# 3. CRUD 测试（10个）
def test_insert_screenshot_annotation()
def test_insert_text_highlight_annotation()
def test_insert_comment_annotation()
def test_insert_duplicate_ann_id()
def test_update_annotation()
def test_delete_annotation()
def test_query_by_id()
def test_query_all()
def test_query_all_pagination()
def test_parse_row()

# 4. 扩展查询测试（8个）
def test_query_by_pdf()
def test_query_by_page()
def test_query_by_type()
def test_count_by_pdf()
def test_count_by_type()
def test_delete_by_pdf()
def test_delete_by_pdf_cascade()
def test_query_empty_results()

# 5. 评论管理测试（5个）
def test_add_comment()
def test_add_comment_to_nonexistent_annotation()
def test_remove_comment()
def test_remove_nonexistent_comment()
def test_multiple_comments()

# 6. 事件测试（3个）
def test_event_emission_on_insert()
def test_event_emission_on_update()
def test_event_emission_on_delete()
```

---

## 📦 交付标准清单

### 代码完成
- [ ] `pdf_annotation_plugin.py` - PDFAnnotationTablePlugin 实现
- [ ] 所有必须方法实现（7个）
- [ ] 所有扩展方法实现（10个）
- [ ] 级联删除事件监听

### 测试通过
- [ ] 所有单元测试通过（41+个测试用例）
- [ ] 测试覆盖率 ≥ 90%
- [ ] 三种标注类型测试完整

### 代码质量
- [ ] 所有方法有 docstring
- [ ] 所有参数有类型注解
- [ ] 通过 pylint 检查（评分 ≥ 8.5）
- [ ] 通过 mypy 类型检查

### 功能验证
- [ ] 外键约束生效
- [ ] 级联删除正常
- [ ] 三种标注类型数据验证正确
- [ ] 评论管理功能正常
- [ ] 事件发布正确

---

**文档结束**

✅ PDFAnnotationTablePlugin 支持三种标注类型，与前端 Annotation 模型完全对齐。
