# 后端数据库系统 - 第三期需求文档（PDFBookmark表）

**期数**: 第三期 - 数据表插件实现
**文档**: v005-phase3-pdf-bookmark.md
**版本**: v1.0
**创建日期**: 2025-10-05
**预计工期**: 1天
**依赖**: 第二期（插件架构）+ pdf_info 表

---

## 📋 概述

### 目标
实现 `PDFBookmarkTablePlugin` 插件，管理 PDF 书签数据（支持层级结构）。

### 为什么需要此表？
1. **快速导航** - 书签是 PDF 快速定位的核心功能
2. **层级支持** - 支持父子书签的递归结构
3. **精确定位** - 支持页面书签和区域书签（包含滚动位置和缩放）
4. **灵活存储** - 使用 JSONB 存储递归的 children 数组

### 依赖关系
- **依赖**: `pdf_info` 表（外键约束）
- **被依赖**: 无

---

## 🗄️ 表结构 SQL

```sql
CREATE TABLE IF NOT EXISTS pdf_bookmark (
    -- ========== 主键 ==========
    bookmark_id TEXT PRIMARY KEY NOT NULL,

    -- ========== 外键 ==========
    pdf_uuid TEXT NOT NULL,

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

-- 索引
CREATE INDEX IF NOT EXISTS idx_bookmark_pdf_uuid ON pdf_bookmark(pdf_uuid);
CREATE INDEX IF NOT EXISTS idx_bookmark_created ON pdf_bookmark(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookmark_page
    ON pdf_bookmark(json_extract(json_data, '$.pageNumber'));
```

---

## 📝 字段验证规则

| 字段名 | 类型 | 必填 | 约束 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| `bookmark_id` | TEXT | ✅ | PRIMARY KEY | 无 | 书签ID（bookmark-{timestamp}-{random}） |
| `pdf_uuid` | TEXT | ✅ | FOREIGN KEY | 无 | 关联的PDF UUID |
| `created_at` | INTEGER | ✅ | 非空 | `0` | 创建时间（Unix毫秒） |
| `updated_at` | INTEGER | ✅ | 非空 | `0` | 更新时间（Unix毫秒） |
| `version` | INTEGER | ✅ | ≥ 1 | `1` | 乐观锁版本号 |
| `json_data` | TEXT | ✅ | 合法JSON | `'{}'` | JSONB扩展字段 |

### json_data 字段验证规则

| 字段路径 | 类型 | 必填 | 约束 | 说明 |
|----------|------|------|------|------|
| `$.name` | string | ✅ | 非空 | 书签名称 |
| `$.type` | string | ✅ | 'page' / 'region' | 书签类型 |
| `$.pageNumber` | integer | ✅ | ≥ 1 | 目标页码 |
| `$.region` | object/null | ❌ | 无 | 区域信息（type=region时使用） |
| `$.region.scrollX` | number | ✅* | 无 | 水平滚动位置 |
| `$.region.scrollY` | number | ✅* | 无 | 垂直滚动位置 |
| `$.region.zoom` | number | ✅* | > 0 | 缩放级别 |
| `$.children` | array | ❌ | 书签数组 | 子书签（递归结构） |
| `$.parentId` | string/null | ❌ | 无 | 父书签ID |
| `$.order` | integer | ❌ | ≥ 0 | 排序序号 |

*注：当 type='region' 时必填

---

## 🔧 json_data Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["name", "type", "pageNumber"],
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1,
      "description": "书签名称"
    },
    "type": {
      "type": "string",
      "enum": ["page", "region"],
      "description": "书签类型"
    },
    "pageNumber": {
      "type": "integer",
      "minimum": 1,
      "description": "目标页码"
    },
    "region": {
      "type": ["object", "null"],
      "description": "区域信息（type=region时必须）",
      "properties": {
        "scrollX": {"type": "number"},
        "scrollY": {"type": "number"},
        "zoom": {"type": "number", "exclusiveMinimum": 0}
      },
      "required": ["scrollX", "scrollY", "zoom"]
    },
    "children": {
      "type": "array",
      "description": "子书签数组（递归结构）",
      "items": {"$ref": "#"},
      "default": []
    },
    "parentId": {
      "type": ["string", "null"],
      "description": "父书签ID",
      "default": null
    },
    "order": {
      "type": "integer",
      "minimum": 0,
      "description": "排序序号",
      "default": 0
    }
  }
}
```

---

## 💻 完整类实现（核心部分）

```python
# src/backend/database/plugins/pdf_bookmark_plugin.py

from typing import Dict, List, Optional, Any
import time
import json
import re

from ..plugin.base_table_plugin import TablePlugin
from ..exceptions import DatabaseValidationError, DatabaseConstraintError


class PDFBookmarkTablePlugin(TablePlugin):
    """PDF 书签表插件"""

    @property
    def table_name(self) -> str:
        return 'pdf_bookmark'

    @property
    def version(self) -> str:
        return '1.0.0'

    @property
    def dependencies(self) -> List[str]:
        return ['pdf_info']

    def create_table(self) -> None:
        """建表（如果表不存在）"""
        sql = '''
        CREATE TABLE IF NOT EXISTS pdf_bookmark (
            bookmark_id TEXT PRIMARY KEY NOT NULL,
            pdf_uuid TEXT NOT NULL,
            created_at INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL DEFAULT 0,
            version INTEGER NOT NULL DEFAULT 1,
            json_data TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(json_data)),
            FOREIGN KEY (pdf_uuid) REFERENCES pdf_info(uuid) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_bookmark_pdf_uuid ON pdf_bookmark(pdf_uuid);
        CREATE INDEX IF NOT EXISTS idx_bookmark_created ON pdf_bookmark(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_bookmark_page
            ON pdf_bookmark(json_extract(json_data, '$.pageNumber'));
        '''

        self._executor.execute_script(sql)
        self._emit_event('create', 'completed')
        self._logger.info(f"{self.table_name} table created")

    def validate_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """字段合规性检查"""
        # 1. 主键检查
        if 'bookmark_id' not in data:
            raise DatabaseValidationError("bookmark_id is required")

        bookmark_id = data['bookmark_id']
        if not isinstance(bookmark_id, str) or not bookmark_id.strip():
            raise DatabaseValidationError("bookmark_id must be a non-empty string")

        # 验证 bookmark_id 格式
        if not re.match(r'^bookmark-\d+-[a-z0-9]+$', bookmark_id):
            raise DatabaseValidationError(
                f"bookmark_id must match pattern 'bookmark-{{timestamp}}-{{random}}'"
            )

        # 2. 外键检查
        if 'pdf_uuid' not in data:
            raise DatabaseValidationError("pdf_uuid is required")

        pdf_uuid = data['pdf_uuid']
        if not isinstance(pdf_uuid, str) or not pdf_uuid.strip():
            raise DatabaseValidationError("pdf_uuid must be a non-empty string")

        # 3. 时间字段
        current_time = int(time.time() * 1000)
        created_at = data.get('created_at', current_time)
        updated_at = data.get('updated_at', current_time)

        # 4. 版本字段
        version = data.get('version', 1)
        if not isinstance(version, int) or version < 1:
            raise DatabaseValidationError("version must be a positive integer")

        # 5. JSON 字段验证
        json_data = self._validate_json_data(data.get('json_data', {}))

        return {
            'bookmark_id': bookmark_id,
            'pdf_uuid': pdf_uuid,
            'created_at': created_at,
            'updated_at': updated_at,
            'version': version,
            'json_data': json.dumps(json_data, ensure_ascii=False)
        }

    def _validate_json_data(self, json_data: Any) -> Dict:
        """验证 json_data 字段"""
        # 解析 JSON
        if isinstance(json_data, str):
            try:
                json_data = json.loads(json_data)
            except json.JSONDecodeError as e:
                raise DatabaseValidationError(f"Invalid JSON: {e}") from e

        if not isinstance(json_data, dict):
            raise DatabaseValidationError("json_data must be an object")

        # 必填字段检查
        if 'name' not in json_data:
            raise DatabaseValidationError("json_data.name is required")
        if not isinstance(json_data['name'], str) or not json_data['name'].strip():
            raise DatabaseValidationError("json_data.name must be a non-empty string")

        if 'type' not in json_data:
            raise DatabaseValidationError("json_data.type is required")
        if json_data['type'] not in ['page', 'region']:
            raise DatabaseValidationError("json_data.type must be 'page' or 'region'")

        if 'pageNumber' not in json_data:
            raise DatabaseValidationError("json_data.pageNumber is required")
        if not isinstance(json_data['pageNumber'], int) or json_data['pageNumber'] < 1:
            raise DatabaseValidationError("json_data.pageNumber must be >= 1")

        # 验证 region（当 type='region' 时必须）
        bookmark_type = json_data['type']
        region = json_data.get('region')

        if bookmark_type == 'region':
            if not region:
                raise DatabaseValidationError("json_data.region is required for type='region'")

            if not isinstance(region, dict):
                raise DatabaseValidationError("json_data.region must be an object")

            # 验证 region 的三个必填字段
            for field in ['scrollX', 'scrollY', 'zoom']:
                if field not in region:
                    raise DatabaseValidationError(f"json_data.region.{field} is required")
                if not isinstance(region[field], (int, float)):
                    raise DatabaseValidationError(f"json_data.region.{field} must be a number")

            if region['zoom'] <= 0:
                raise DatabaseValidationError("json_data.region.zoom must be positive")

        # 验证 children（递归）
        children = json_data.get('children', [])
        if not isinstance(children, list):
            raise DatabaseValidationError("json_data.children must be an array")

        validated_children = []
        for child in children:
            # 递归验证子书签
            validated_child = self._validate_bookmark_object(child)
            validated_children.append(validated_child)

        # 返回验证后的数据
        return {
            'name': json_data['name'],
            'type': bookmark_type,
            'pageNumber': json_data['pageNumber'],
            'region': region,
            'children': validated_children,
            'parentId': json_data.get('parentId'),
            'order': json_data.get('order', 0)
        }

    def _validate_bookmark_object(self, bookmark: Dict) -> Dict:
        """验证单个书签对象（递归验证子书签）"""
        if not isinstance(bookmark, dict):
            raise DatabaseValidationError("Bookmark must be an object")

        # 必填字段
        if 'name' not in bookmark or not bookmark['name']:
            raise DatabaseValidationError("Bookmark.name is required")

        if 'type' not in bookmark or bookmark['type'] not in ['page', 'region']:
            raise DatabaseValidationError("Bookmark.type must be 'page' or 'region'")

        if 'pageNumber' not in bookmark or bookmark['pageNumber'] < 1:
            raise DatabaseValidationError("Bookmark.pageNumber must be >= 1")

        # 验证 region
        if bookmark['type'] == 'region' and not bookmark.get('region'):
            raise DatabaseValidationError("Region bookmark requires region data")

        # 验证子书签
        children = bookmark.get('children', [])
        validated_children = []
        for child in children:
            validated_children.append(self._validate_bookmark_object(child))

        return {
            'name': bookmark['name'],
            'type': bookmark['type'],
            'pageNumber': bookmark['pageNumber'],
            'region': bookmark.get('region'),
            'children': validated_children,
            'parentId': bookmark.get('parentId'),
            'order': bookmark.get('order', 0)
        }

    def insert(self, data: Dict[str, Any]) -> str:
        """插入一条记录"""
        validated = self.validate_data(data)

        # 检查重复
        existing = self.query_by_id(validated['bookmark_id'])
        if existing:
            raise DatabaseConstraintError(
                f"Bookmark '{validated['bookmark_id']}' already exists"
            )

        sql = '''
        INSERT INTO pdf_bookmark (
            bookmark_id, pdf_uuid, created_at, updated_at, version, json_data
        )
        VALUES (?, ?, ?, ?, ?, jsonb(?))
        '''

        self._executor.execute_update(sql, (
            validated['bookmark_id'],
            validated['pdf_uuid'],
            validated['created_at'],
            validated['updated_at'],
            validated['version'],
            validated['json_data']
        ))

        self._emit_event('create', 'completed', {'bookmark_id': validated['bookmark_id']})
        self._logger.info(f"Inserted bookmark: {validated['bookmark_id']}")
        return validated['bookmark_id']

    def update(self, primary_key: str, data: Dict[str, Any]) -> bool:
        """更新记录"""
        existing = self.query_by_id(primary_key)
        if not existing:
            return False

        full_data = {**existing, **data, 'bookmark_id': primary_key}
        full_data['updated_at'] = int(time.time() * 1000)
        full_data['version'] = existing['version'] + 1

        validated = self.validate_data(full_data)

        sql = '''
        UPDATE pdf_bookmark
        SET updated_at = ?, version = ?, json_data = jsonb(?)
        WHERE bookmark_id = ?
        '''

        rows = self._executor.execute_update(sql, (
            validated['updated_at'],
            validated['version'],
            validated['json_data'],
            primary_key
        ))

        if rows > 0:
            self._emit_event('update', 'completed', {'bookmark_id': primary_key})

        return rows > 0

    def delete(self, primary_key: str) -> bool:
        """删除记录"""
        sql = "DELETE FROM pdf_bookmark WHERE bookmark_id = ?"
        rows = self._executor.execute_update(sql, (primary_key,))

        if rows > 0:
            self._emit_event('delete', 'completed', {'bookmark_id': primary_key})

        return rows > 0

    def query_by_id(self, primary_key: str) -> Optional[Dict[str, Any]]:
        """根据主键查询"""
        sql = "SELECT * FROM pdf_bookmark WHERE bookmark_id = ?"
        results = self._executor.execute_query(sql, (primary_key,))

        if not results:
            return None

        return self._parse_row(results[0])

    def query_all(
        self,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """查询所有记录"""
        sql = "SELECT * FROM pdf_bookmark ORDER BY created_at DESC"

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

        return {
            'bookmark_id': row['bookmark_id'],
            'pdf_uuid': row['pdf_uuid'],
            'created_at': row['created_at'],
            'updated_at': row['updated_at'],
            'version': row['version'],
            **json_data  # 展开 JSON 字段
        }

    # ==================== 扩展方法 ====================

    def query_by_pdf(self, pdf_uuid: str) -> List[Dict[str, Any]]:
        """查询某个 PDF 的所有书签"""
        sql = '''
        SELECT * FROM pdf_bookmark
        WHERE pdf_uuid = ?
        ORDER BY json_extract(json_data, '$.order')
        '''

        results = self._executor.execute_query(sql, (pdf_uuid,))
        return [self._parse_row(row) for row in results]

    def query_root_bookmarks(self, pdf_uuid: str) -> List[Dict[str, Any]]:
        """查询根书签（parentId 为 null）"""
        sql = '''
        SELECT * FROM pdf_bookmark
        WHERE pdf_uuid = ?
          AND (json_extract(json_data, '$.parentId') IS NULL
               OR json_extract(json_data, '$.parentId') = 'null')
        ORDER BY json_extract(json_data, '$.order')
        '''

        results = self._executor.execute_query(sql, (pdf_uuid,))
        return [self._parse_row(row) for row in results]

    def query_by_page(self, pdf_uuid: str, page_number: int) -> List[Dict[str, Any]]:
        """查询指向某页的所有书签"""
        sql = '''
        SELECT * FROM pdf_bookmark
        WHERE pdf_uuid = ?
          AND json_extract(json_data, '$.pageNumber') = ?
        '''

        results = self._executor.execute_query(sql, (pdf_uuid, page_number))
        return [self._parse_row(row) for row in results]

    def count_by_pdf(self, pdf_uuid: str) -> int:
        """统计某个 PDF 的书签数量"""
        sql = "SELECT COUNT(*) as count FROM pdf_bookmark WHERE pdf_uuid = ?"
        result = self._executor.execute_query(sql, (pdf_uuid,))[0]
        return result['count']

    def delete_by_pdf(self, pdf_uuid: str) -> int:
        """删除某个 PDF 的所有书签"""
        sql = "DELETE FROM pdf_bookmark WHERE pdf_uuid = ?"
        rows = self._executor.execute_update(sql, (pdf_uuid,))

        if rows > 0:
            self._emit_event('delete', 'completed', {
                'pdf_uuid': pdf_uuid,
                'count': rows
            })

        return rows

    def add_child_bookmark(
        self,
        parent_id: str,
        child_bookmark: Dict[str, Any]
    ) -> Optional[str]:
        """
        添加子书签到父书签的 children 数组

        Args:
            parent_id: 父书签ID
            child_bookmark: 子书签数据

        Returns:
            子书签ID，失败则返回 None
        """
        parent = self.query_by_id(parent_id)
        if not parent:
            return None

        # 验证子书签数据
        validated_child = self._validate_bookmark_object(child_bookmark)

        # 设置 parentId 和 order
        children = parent.get('children', [])
        validated_child['parentId'] = parent_id
        validated_child['order'] = len(children)

        # 添加到 children 数组
        children.append(validated_child)

        # 更新父书签
        success = self.update(parent_id, {'children': children})

        if success:
            return f"child-{len(children)-1}"  # 返回子书签的临时ID

        return None

    def remove_child_bookmark(
        self,
        parent_id: str,
        child_index: int
    ) -> bool:
        """
        从父书签的 children 数组中移除子书签

        Args:
            parent_id: 父书签ID
            child_index: 子书签索引

        Returns:
            是否成功移除
        """
        parent = self.query_by_id(parent_id)
        if not parent:
            return False

        children = parent.get('children', [])
        if child_index < 0 or child_index >= len(children):
            return False

        # 移除子书签
        del children[child_index]

        # 重新排序
        for i, child in enumerate(children):
            child['order'] = i

        # 更新父书签
        return self.update(parent_id, {'children': children})

    def reorder_bookmarks(
        self,
        pdf_uuid: str,
        ordered_ids: List[str]
    ) -> bool:
        """
        重新排序书签

        Args:
            pdf_uuid: PDF UUID
            ordered_ids: 排序后的书签ID列表

        Returns:
            是否成功更新
        """
        for order, bookmark_id in enumerate(ordered_ids):
            bookmark = self.query_by_id(bookmark_id)
            if bookmark and bookmark['pdf_uuid'] == pdf_uuid:
                self.update(bookmark_id, {'order': order})

        return True

    def flatten_bookmarks(self, pdf_uuid: str) -> List[Dict[str, Any]]:
        """
        扁平化书签树（递归展开所有子书签）

        Args:
            pdf_uuid: PDF UUID

        Returns:
            扁平化的书签列表（包含 level 字段表示层级）
        """
        bookmarks = self.query_by_pdf(pdf_uuid)

        def flatten(bookmark_list: List[Dict], level: int = 0) -> List[Dict]:
            result = []
            for bookmark in bookmark_list:
                # 添加当前书签
                result.append({
                    **bookmark,
                    'level': level
                })

                # 递归处理子书签
                children = bookmark.get('children', [])
                if children:
                    result.extend(flatten(children, level + 1))

            return result

        return flatten(bookmarks)

    def register_events(self) -> None:
        """注册事件监听器（监听 PDF 删除）"""
        self._event_bus.on(
            'table:pdf_info:delete:completed',
            self._handle_pdf_deleted
        )

    def _handle_pdf_deleted(self, data: Dict) -> None:
        """处理 PDF 删除事件（级联删除书签）"""
        pdf_uuid = data.get('uuid')
        if pdf_uuid:
            self.delete_by_pdf(pdf_uuid)
```

---

## ✅ 单元测试用例清单

```python
# test_pdf_bookmark_plugin.py

# 1. 表创建测试（2个）
def test_create_table()
def test_indexes_created()

# 2. 数据验证测试（12个）
def test_validate_page_bookmark()
def test_validate_region_bookmark()
def test_validate_missing_name()
def test_validate_invalid_type()
def test_validate_invalid_page_number()
def test_validate_region_missing_region_data()
def test_validate_region_invalid_zoom()
def test_validate_children_array()
def test_validate_recursive_children()
def test_validate_invalid_bookmark_id_format()
def test_validate_parent_id()
def test_validate_order()

# 3. CRUD 测试（8个）
def test_insert_page_bookmark()
def test_insert_region_bookmark()
def test_insert_bookmark_with_children()
def test_insert_duplicate_id()
def test_update_bookmark()
def test_delete_bookmark()
def test_query_by_id()
def test_query_all()

# 4. 扩展查询测试（10个）
def test_query_by_pdf()
def test_query_root_bookmarks()
def test_query_by_page()
def test_count_by_pdf()
def test_delete_by_pdf()
def test_add_child_bookmark()
def test_remove_child_bookmark()
def test_reorder_bookmarks()
def test_flatten_bookmarks()
def test_flatten_nested_bookmarks()

# 5. 级联测试（2个）
def test_cascade_delete_on_pdf_delete()
def test_foreign_key_constraint()

# 6. 事件测试（3个）
def test_event_emission_on_insert()
def test_event_emission_on_update()
def test_event_emission_on_delete()
```

**测试总数**: 37个

---

## 📦 交付标准清单

### 代码完成
- [ ] `pdf_bookmark_plugin.py` - PDFBookmarkTablePlugin 实现
- [ ] 所有必须方法实现（7个）
- [ ] 所有扩展方法实现（10个）
- [ ] 递归验证逻辑完整

### 测试通过
- [ ] 所有单元测试通过（37个测试用例）
- [ ] 测试覆盖率 ≥ 90%
- [ ] 递归子书签测试完整

### 代码质量
- [ ] 所有方法有 docstring
- [ ] 所有参数有类型注解
- [ ] 通过 pylint 检查（评分 ≥ 8.5）
- [ ] 通过 mypy 类型检查

### 功能验证
- [ ] 外键约束生效
- [ ] 级联删除正常
- [ ] 两种书签类型验证正确
- [ ] 递归子书签处理正确
- [ ] 扁平化功能正常

---

**文档结束**

✅ PDFBookmarkTablePlugin 支持层级书签结构，与前端 Bookmark 模型完全对齐。
