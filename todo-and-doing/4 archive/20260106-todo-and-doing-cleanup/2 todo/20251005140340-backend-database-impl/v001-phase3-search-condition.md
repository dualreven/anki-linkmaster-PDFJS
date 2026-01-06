# 后端数据库系统 - 第三期需求文档（SearchCondition表）

**期数**: 第三期 - 数据表插件实现
**文档**: v006-phase3-search-condition.md
**版本**: v1.0
**创建日期**: 2025-10-05
**预计工期**: 1.5天
**依赖**: 第二期（插件架构）

---

## 📋 概述

### 目标
实现 `SearchConditionTablePlugin` 插件，管理 PDF 搜索条件和排序配置。

### 为什么需要此表？
1. **保存搜索** - 用户可以保存常用的搜索条件，快速复用
2. **复杂筛选** - 支持三种条件类型（关键词、字段筛选、组合条件）
3. **排序集成** - 与 pdf-sorter 功能集成，支持4种排序模式
4. **使用统计** - 记录使用次数和最后使用时间，优化用户体验

### 依赖关系
- **依赖**: 无（独立表）
- **被依赖**: 无

---

## 🗄️ 表结构 SQL

```sql
CREATE TABLE IF NOT EXISTS search_condition (
    -- ========== 主键 ==========
    uuid TEXT PRIMARY KEY NOT NULL,

    -- ========== 核心字段 ==========
    name TEXT NOT NULL UNIQUE,

    -- ========== 时间字段 ==========
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,

    -- ========== 版本控制 ==========
    version INTEGER NOT NULL DEFAULT 1,

    -- ========== 扩展数据（JSONB） ==========
    json_data TEXT NOT NULL DEFAULT '{}'
        CHECK (json_valid(json_data))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_search_name ON search_condition(name);
CREATE INDEX IF NOT EXISTS idx_search_created ON search_condition(created_at DESC);
```

---

## 📝 字段验证规则

| 字段名 | 类型 | 必填 | 约束 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| `uuid` | TEXT | ✅ | PRIMARY KEY | 无 | 搜索条件UUID |
| `name` | TEXT | ✅ | UNIQUE, 非空 | 无 | 搜索条件名称 |
| `created_at` | INTEGER | ✅ | 非空 | `0` | 创建时间（Unix毫秒） |
| `updated_at` | INTEGER | ✅ | 非空 | `0` | 更新时间（Unix毫秒） |
| `version` | INTEGER | ✅ | ≥ 1 | `1` | 乐观锁版本号 |
| `json_data` | TEXT | ✅ | 合法JSON | `'{}'` | JSONB扩展字段 |

### json_data 字段验证规则

| 字段路径 | 类型 | 必填 | 约束 | 说明 |
|----------|------|------|------|------|
| `$.description` | string | ❌ | 无 | 搜索条件描述 |
| `$.condition` | object | ✅ | 三种类型之一 | 筛选条件 |
| `$.use_count` | integer | ❌ | ≥ 0 | 使用次数 |
| `$.last_used_at` | integer | ❌ | ≥ 0 | 最后使用时间 |
| `$.sort_config` | object | ❌ | 无 | 排序配置 |

### condition 字段（三种类型）

**类型1：关键词搜索（fuzzy）**

| 字段路径 | 类型 | 必填 | 说明 |
|----------|------|------|------|
| `$.condition.type` | string | ✅ | 'fuzzy' |
| `$.condition.keywords` | array | ✅ | 关键词数组 |
| `$.condition.searchFields` | array | ❌ | 搜索字段列表 |
| `$.condition.matchMode` | string | ❌ | 'any' / 'all' |

**类型2：字段筛选（field）**

| 字段路径 | 类型 | 必填 | 说明 |
|----------|------|------|------|
| `$.condition.type` | string | ✅ | 'field' |
| `$.condition.field` | string | ✅ | 字段名 |
| `$.condition.operator` | string | ✅ | 操作符（eq/ne/gt/lt/...） |
| `$.condition.value` | any | ✅ | 筛选值 |

**类型3：组合条件（composite）**

| 字段路径 | 类型 | 必填 | 说明 |
|----------|------|------|------|
| `$.condition.type` | string | ✅ | 'composite' |
| `$.condition.operator` | string | ✅ | 'AND' / 'OR' / 'NOT' |
| `$.condition.conditions` | array | ✅ | 子条件数组（递归） |

### sort_config 字段

| 字段路径 | 类型 | 必填 | 说明 |
|----------|------|------|------|
| `$.sort_config.mode` | integer | ❌ | 排序模式（0-3） |
| `$.sort_config.multi_sort` | array | ❌* | 多级排序配置（mode=2） |
| `$.sort_config.weighted_sort` | object | ❌* | 加权排序配置（mode=3） |
| `$.sort_config.manual_order` | array | ❌* | 手动排序（mode=1） |

*根据 mode 不同，对应字段必填

---

## 🔧 json_data Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "description": {
      "type": "string",
      "description": "搜索条件描述"
    },
    "condition": {
      "description": "筛选条件（三种类型之一）",
      "oneOf": [
        {
          "title": "Fuzzy Search Condition",
          "type": "object",
          "required": ["type", "keywords"],
          "properties": {
            "type": {"const": "fuzzy"},
            "keywords": {
              "type": "array",
              "items": {"type": "string"},
              "minItems": 1
            },
            "searchFields": {
              "type": "array",
              "items": {"type": "string"},
              "default": ["filename", "tags", "notes"]
            },
            "matchMode": {
              "type": "string",
              "enum": ["any", "all"],
              "default": "any"
            }
          }
        },
        {
          "title": "Field Condition",
          "type": "object",
          "required": ["type", "field", "operator", "value"],
          "properties": {
            "type": {"const": "field"},
            "field": {"type": "string"},
            "operator": {
              "type": "string",
              "enum": ["eq", "ne", "gt", "lt", "gte", "lte",
                       "contains", "not_contains",
                       "starts_with", "ends_with",
                       "in_range", "has_tag", "not_has_tag"]
            },
            "value": {}
          }
        },
        {
          "title": "Composite Condition",
          "type": "object",
          "required": ["type", "operator", "conditions"],
          "properties": {
            "type": {"const": "composite"},
            "operator": {
              "type": "string",
              "enum": ["AND", "OR", "NOT"]
            },
            "conditions": {
              "type": "array",
              "items": {"$ref": "#/properties/condition/oneOf"},
              "minItems": 1
            }
          }
        }
      ]
    },
    "use_count": {
      "type": "integer",
      "minimum": 0,
      "default": 0
    },
    "last_used_at": {
      "type": "integer",
      "minimum": 0,
      "default": 0
    },
    "sort_config": {
      "type": "object",
      "properties": {
        "mode": {
          "type": "integer",
          "enum": [0, 1, 2, 3],
          "default": 2
        },
        "multi_sort": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["field", "direction"],
            "properties": {
              "field": {
                "type": "string",
                "enum": ["filename", "size", "modified_time", "created_time", "page_count", "star"]
              },
              "direction": {
                "type": "string",
                "enum": ["asc", "desc"]
              }
            }
          },
          "maxItems": 3
        },
        "weighted_sort": {
          "type": "object",
          "properties": {
            "formula": {"type": "string"}
          }
        },
        "manual_order": {
          "type": "array",
          "items": {"type": "string"}
        }
      }
    }
  }
}
```

---

## 💻 完整类实现（核心部分）

```python
# src/backend/database/plugins/search_condition_plugin.py

from typing import Dict, List, Optional, Any
import time
import json

from ..plugin.base_table_plugin import TablePlugin
from ..exceptions import DatabaseValidationError, DatabaseConstraintError


class SearchConditionTablePlugin(TablePlugin):
    """搜索条件表插件"""

    # 有效的操作符
    VALID_OPERATORS = [
        'eq', 'ne', 'gt', 'lt', 'gte', 'lte',
        'contains', 'not_contains',
        'starts_with', 'ends_with',
        'in_range', 'has_tag', 'not_has_tag'
    ]

    # 有效的排序字段
    VALID_SORT_FIELDS = [
        'filename', 'size', 'modified_time',
        'created_time', 'page_count', 'star'
    ]

    @property
    def table_name(self) -> str:
        return 'search_condition'

    @property
    def version(self) -> str:
        return '1.0.0'

    @property
    def dependencies(self) -> List[str]:
        return []  # 无依赖

    def create_table(self) -> None:
        """建表（如果表不存在）"""
        sql = '''
        CREATE TABLE IF NOT EXISTS search_condition (
            uuid TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL UNIQUE,
            created_at INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL DEFAULT 0,
            version INTEGER NOT NULL DEFAULT 1,
            json_data TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(json_data))
        );

        CREATE INDEX IF NOT EXISTS idx_search_name ON search_condition(name);
        CREATE INDEX IF NOT EXISTS idx_search_created ON search_condition(created_at DESC);
        '''

        self._executor.execute_script(sql)
        self._emit_event('create', 'completed')
        self._logger.info(f"{self.table_name} table created")

    def validate_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """字段合规性检查"""
        # 1. 主键检查
        if 'uuid' not in data:
            raise DatabaseValidationError("uuid is required")

        uuid = data['uuid']
        if not isinstance(uuid, str) or not uuid.strip():
            raise DatabaseValidationError("uuid must be a non-empty string")

        # 2. name 检查（必填且唯一）
        if 'name' not in data:
            raise DatabaseValidationError("name is required")

        name = data['name']
        if not isinstance(name, str) or not name.strip():
            raise DatabaseValidationError("name must be a non-empty string")

        # 3. 时间字段
        current_time = int(time.time() * 1000)
        created_at = data.get('created_at', current_time)
        updated_at = data.get('updated_at', current_time)

        # 4. 版本字段
        version = data.get('version', 1)

        # 5. JSON 字段验证
        json_data = self._validate_json_data(data.get('json_data', {}))

        return {
            'uuid': uuid,
            'name': name,
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

        validated = {}

        # description（可选）
        if 'description' in json_data:
            validated['description'] = str(json_data['description'])

        # condition（必填，三种类型之一）
        if 'condition' not in json_data:
            raise DatabaseValidationError("json_data.condition is required")

        condition = json_data['condition']
        validated['condition'] = self._validate_condition(condition)

        # use_count（可选）
        use_count = json_data.get('use_count', 0)
        if not isinstance(use_count, int) or use_count < 0:
            raise DatabaseValidationError("use_count must be a non-negative integer")
        validated['use_count'] = use_count

        # last_used_at（可选）
        last_used_at = json_data.get('last_used_at', 0)
        if not isinstance(last_used_at, int) or last_used_at < 0:
            raise DatabaseValidationError("last_used_at must be a non-negative integer")
        validated['last_used_at'] = last_used_at

        # sort_config（可选）
        if 'sort_config' in json_data:
            validated['sort_config'] = self._validate_sort_config(json_data['sort_config'])

        return validated

    def _validate_condition(self, condition: Any) -> Dict:
        """验证 condition 字段（递归处理组合条件）"""
        if not isinstance(condition, dict):
            raise DatabaseValidationError("condition must be an object")

        if 'type' not in condition:
            raise DatabaseValidationError("condition.type is required")

        cond_type = condition['type']

        if cond_type == 'fuzzy':
            return self._validate_fuzzy_condition(condition)
        elif cond_type == 'field':
            return self._validate_field_condition(condition)
        elif cond_type == 'composite':
            return self._validate_composite_condition(condition)
        else:
            raise DatabaseValidationError(
                f"Invalid condition type: {cond_type}. Must be 'fuzzy', 'field', or 'composite'"
            )

    def _validate_fuzzy_condition(self, condition: Dict) -> Dict:
        """验证关键词搜索条件"""
        if 'keywords' not in condition:
            raise DatabaseValidationError("fuzzy condition requires keywords")

        keywords = condition['keywords']
        if not isinstance(keywords, list) or len(keywords) == 0:
            raise DatabaseValidationError("keywords must be a non-empty array")

        for keyword in keywords:
            if not isinstance(keyword, str):
                raise DatabaseValidationError("keywords items must be strings")

        # searchFields（可选）
        search_fields = condition.get('searchFields', ['filename', 'tags', 'notes'])
        if not isinstance(search_fields, list):
            raise DatabaseValidationError("searchFields must be an array")

        # matchMode（可选）
        match_mode = condition.get('matchMode', 'any')
        if match_mode not in ['any', 'all']:
            raise DatabaseValidationError("matchMode must be 'any' or 'all'")

        return {
            'type': 'fuzzy',
            'keywords': keywords,
            'searchFields': search_fields,
            'matchMode': match_mode
        }

    def _validate_field_condition(self, condition: Dict) -> Dict:
        """验证字段筛选条件"""
        if 'field' not in condition:
            raise DatabaseValidationError("field condition requires field")

        if 'operator' not in condition:
            raise DatabaseValidationError("field condition requires operator")

        if 'value' not in condition:
            raise DatabaseValidationError("field condition requires value")

        field = condition['field']
        operator = condition['operator']
        value = condition['value']

        if not isinstance(field, str):
            raise DatabaseValidationError("field must be a string")

        if operator not in self.VALID_OPERATORS:
            raise DatabaseValidationError(
                f"Invalid operator: {operator}. Must be one of {self.VALID_OPERATORS}"
            )

        # 验证 in_range 的 value 格式
        if operator == 'in_range':
            if not isinstance(value, list) or len(value) != 2:
                raise DatabaseValidationError("in_range value must be an array of 2 numbers")

        return {
            'type': 'field',
            'field': field,
            'operator': operator,
            'value': value,
            'dataType': condition.get('dataType', 'auto')
        }

    def _validate_composite_condition(self, condition: Dict) -> Dict:
        """验证组合条件（递归）"""
        if 'operator' not in condition:
            raise DatabaseValidationError("composite condition requires operator")

        if 'conditions' not in condition:
            raise DatabaseValidationError("composite condition requires conditions array")

        operator = condition['operator']
        if operator not in ['AND', 'OR', 'NOT']:
            raise DatabaseValidationError("composite operator must be 'AND', 'OR', or 'NOT'")

        sub_conditions = condition['conditions']
        if not isinstance(sub_conditions, list) or len(sub_conditions) == 0:
            raise DatabaseValidationError("conditions must be a non-empty array")

        # 递归验证子条件
        validated_conditions = []
        for sub_condition in sub_conditions:
            validated_conditions.append(self._validate_condition(sub_condition))

        return {
            'type': 'composite',
            'operator': operator,
            'conditions': validated_conditions
        }

    def _validate_sort_config(self, sort_config: Any) -> Dict:
        """验证排序配置"""
        if not isinstance(sort_config, dict):
            raise DatabaseValidationError("sort_config must be an object")

        mode = sort_config.get('mode', 2)
        if not isinstance(mode, int) or mode not in [0, 1, 2, 3]:
            raise DatabaseValidationError("sort_config.mode must be 0, 1, 2, or 3")

        validated = {'mode': mode}

        # 根据 mode 验证对应字段
        if mode == 1:  # 手动排序
            if 'manual_order' not in sort_config:
                raise DatabaseValidationError("mode=1 requires manual_order")

            manual_order = sort_config['manual_order']
            if not isinstance(manual_order, list):
                raise DatabaseValidationError("manual_order must be an array")

            validated['manual_order'] = manual_order

        elif mode == 2:  # 多级排序
            if 'multi_sort' not in sort_config:
                raise DatabaseValidationError("mode=2 requires multi_sort")

            multi_sort = sort_config['multi_sort']
            if not isinstance(multi_sort, list) or len(multi_sort) == 0:
                raise DatabaseValidationError("multi_sort must be a non-empty array")

            if len(multi_sort) > 3:
                raise DatabaseValidationError("multi_sort supports max 3 levels")

            validated_multi_sort = []
            for sort_item in multi_sort:
                if 'field' not in sort_item or 'direction' not in sort_item:
                    raise DatabaseValidationError("multi_sort item requires field and direction")

                field = sort_item['field']
                direction = sort_item['direction']

                if field not in self.VALID_SORT_FIELDS:
                    raise DatabaseValidationError(
                        f"Invalid sort field: {field}. Must be one of {self.VALID_SORT_FIELDS}"
                    )

                if direction not in ['asc', 'desc']:
                    raise DatabaseValidationError("direction must be 'asc' or 'desc'")

                validated_multi_sort.append({
                    'field': field,
                    'direction': direction
                })

            validated['multi_sort'] = validated_multi_sort

        elif mode == 3:  # 加权排序
            if 'weighted_sort' not in sort_config:
                raise DatabaseValidationError("mode=3 requires weighted_sort")

            weighted_sort = sort_config['weighted_sort']
            if not isinstance(weighted_sort, dict):
                raise DatabaseValidationError("weighted_sort must be an object")

            if 'formula' not in weighted_sort:
                raise DatabaseValidationError("weighted_sort requires formula")

            validated['weighted_sort'] = {
                'formula': str(weighted_sort['formula'])
            }

        return validated

    def insert(self, data: Dict[str, Any]) -> str:
        """插入一条记录"""
        validated = self.validate_data(data)

        # 检查重复 uuid
        existing = self.query_by_id(validated['uuid'])
        if existing:
            raise DatabaseConstraintError(f"Search condition '{validated['uuid']}' already exists")

        # 检查重复 name
        existing_name = self.query_by_name(validated['name'])
        if existing_name:
            raise DatabaseConstraintError(f"Search condition name '{validated['name']}' already exists")

        sql = '''
        INSERT INTO search_condition (uuid, name, created_at, updated_at, version, json_data)
        VALUES (?, ?, ?, ?, ?, jsonb(?))
        '''

        self._executor.execute_update(sql, (
            validated['uuid'],
            validated['name'],
            validated['created_at'],
            validated['updated_at'],
            validated['version'],
            validated['json_data']
        ))

        self._emit_event('create', 'completed', {'uuid': validated['uuid']})
        self._logger.info(f"Inserted search condition: {validated['uuid']}")
        return validated['uuid']

    def update(self, primary_key: str, data: Dict[str, Any]) -> bool:
        """更新记录"""
        existing = self.query_by_id(primary_key)
        if not existing:
            return False

        full_data = {**existing, **data, 'uuid': primary_key}
        full_data['updated_at'] = int(time.time() * 1000)
        full_data['version'] = existing['version'] + 1

        validated = self.validate_data(full_data)

        sql = '''
        UPDATE search_condition
        SET name = ?, updated_at = ?, version = ?, json_data = jsonb(?)
        WHERE uuid = ?
        '''

        rows = self._executor.execute_update(sql, (
            validated['name'],
            validated['updated_at'],
            validated['version'],
            validated['json_data'],
            primary_key
        ))

        if rows > 0:
            self._emit_event('update', 'completed', {'uuid': primary_key})

        return rows > 0

    def delete(self, primary_key: str) -> bool:
        """删除记录"""
        sql = "DELETE FROM search_condition WHERE uuid = ?"
        rows = self._executor.execute_update(sql, (primary_key,))

        if rows > 0:
            self._emit_event('delete', 'completed', {'uuid': primary_key})

        return rows > 0

    def query_by_id(self, primary_key: str) -> Optional[Dict[str, Any]]:
        """根据主键查询"""
        sql = "SELECT * FROM search_condition WHERE uuid = ?"
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
        sql = "SELECT * FROM search_condition ORDER BY created_at DESC"

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
            'uuid': row['uuid'],
            'name': row['name'],
            'created_at': row['created_at'],
            'updated_at': row['updated_at'],
            'version': row['version'],
            **json_data
        }

    # ==================== 扩展方法 ====================

    def query_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """根据名称查询"""
        sql = "SELECT * FROM search_condition WHERE name = ?"
        results = self._executor.execute_query(sql, (name,))

        if not results:
            return None

        return self._parse_row(results[0])

    def query_frequently_used(self, limit: int = 10) -> List[Dict[str, Any]]:
        """查询最常用的搜索条件（按使用次数排序）"""
        sql = '''
        SELECT * FROM search_condition
        ORDER BY json_extract(json_data, '$.use_count') DESC, name
        LIMIT ?
        '''

        results = self._executor.execute_query(sql, (limit,))
        return [self._parse_row(row) for row in results]

    def query_recently_used(self, limit: int = 10) -> List[Dict[str, Any]]:
        """查询最近使用的搜索条件（按最后使用时间排序）"""
        sql = '''
        SELECT * FROM search_condition
        WHERE json_extract(json_data, '$.last_used_at') > 0
        ORDER BY json_extract(json_data, '$.last_used_at') DESC
        LIMIT ?
        '''

        results = self._executor.execute_query(sql, (limit,))
        return [self._parse_row(row) for row in results]

    def increment_use_count(self, uuid: str) -> bool:
        """增加使用次数（并更新最后使用时间）"""
        condition = self.query_by_id(uuid)
        if not condition:
            return False

        current_time = int(time.time() * 1000)
        use_count = condition.get('use_count', 0) + 1

        sql = '''
        UPDATE search_condition
        SET
            json_data = json_set(
                json_data,
                '$.use_count', ?,
                '$.last_used_at', ?
            ),
            updated_at = ?,
            version = version + 1
        WHERE uuid = ?
        '''

        rows = self._executor.execute_update(sql, (
            use_count,
            current_time,
            current_time,
            uuid
        ))

        if rows > 0:
            self._emit_event('update', 'completed', {'uuid': uuid})

        return rows > 0

    def query_by_sort_mode(self, mode: int) -> List[Dict[str, Any]]:
        """查询使用特定排序模式的搜索条件"""
        sql = '''
        SELECT * FROM search_condition
        WHERE json_extract(json_data, '$.sort_config.mode') = ?
        '''

        results = self._executor.execute_query(sql, (mode,))
        return [self._parse_row(row) for row in results]

    def update_sort_config(self, uuid: str, sort_config: Dict) -> bool:
        """更新搜索条件的排序配置"""
        condition = self.query_by_id(uuid)
        if not condition:
            return False

        # 验证排序配置
        validated_sort_config = self._validate_sort_config(sort_config)

        sql = '''
        UPDATE search_condition
        SET
            json_data = json_set(json_data, '$.sort_config', json(?)),
            updated_at = ?,
            version = version + 1
        WHERE uuid = ?
        '''

        current_time = int(time.time() * 1000)
        rows = self._executor.execute_update(sql, (
            json.dumps(validated_sort_config),
            current_time,
            uuid
        ))

        if rows > 0:
            self._emit_event('update', 'completed', {'uuid': uuid})

        return rows > 0

    def get_statistics(self) -> Dict[str, Any]:
        """获取统计信息"""
        sql = '''
        SELECT
            COUNT(*) as total_count,
            SUM(json_extract(json_data, '$.use_count')) as total_uses,
            AVG(json_extract(json_data, '$.use_count')) as avg_uses
        FROM search_condition
        '''

        result = self._executor.execute_query(sql)[0]

        return {
            'total_count': result['total_count'],
            'total_uses': result['total_uses'] or 0,
            'avg_uses': round(result['avg_uses'], 2) if result['avg_uses'] else 0
        }
```

---

## ✅ 单元测试用例清单

```python
# test_search_condition_plugin.py

# 1. 表创建测试（2个）
def test_create_table()
def test_indexes_created()

# 2. 条件验证测试（18个）
def test_validate_fuzzy_condition()
def test_validate_fuzzy_missing_keywords()
def test_validate_fuzzy_invalid_match_mode()
def test_validate_field_condition()
def test_validate_field_missing_field()
def test_validate_field_invalid_operator()
def test_validate_field_in_range_value()
def test_validate_composite_condition_and()
def test_validate_composite_condition_or()
def test_validate_composite_condition_not()
def test_validate_composite_nested()
def test_validate_composite_missing_operator()
def test_validate_composite_invalid_operator()
def test_validate_invalid_condition_type()
def test_validate_missing_condition()
def test_validate_missing_name()
def test_validate_name_uniqueness()
def test_validate_uuid()

# 3. 排序配置验证测试（10个）
def test_validate_sort_config_mode_0()
def test_validate_sort_config_mode_1()
def test_validate_sort_config_mode_2()
def test_validate_sort_config_mode_3()
def test_validate_multi_sort_max_3_levels()
def test_validate_multi_sort_invalid_field()
def test_validate_multi_sort_invalid_direction()
def test_validate_weighted_sort_missing_formula()
def test_validate_manual_order()
def test_validate_invalid_mode()

# 4. CRUD 测试（8个）
def test_insert_fuzzy_condition()
def test_insert_field_condition()
def test_insert_composite_condition()
def test_insert_duplicate_uuid()
def test_insert_duplicate_name()
def test_update_search_condition()
def test_delete_search_condition()
def test_query_by_id()

# 5. 扩展查询测试（8个）
def test_query_by_name()
def test_query_frequently_used()
def test_query_recently_used()
def test_query_by_sort_mode()
def test_increment_use_count()
def test_update_sort_config()
def test_get_statistics()
def test_query_all()

# 6. 复杂条件测试（5个）
def test_nested_composite_conditions()
def test_mixed_condition_types()
def test_deep_nesting_limit()
def test_complex_multi_sort()
def test_weighted_formula_validation()

# 7. 事件测试（3个）
def test_event_emission_on_insert()
def test_event_emission_on_update()
def test_event_emission_on_delete()
```

**测试总数**: 54个

---

## 📦 交付标准清单

### 代码完成
- [ ] `search_condition_plugin.py` - SearchConditionTablePlugin 实现
- [ ] 所有必须方法实现（7个）
- [ ] 所有扩展方法实现（8个）
- [ ] 三种条件类型验证完整
- [ ] 四种排序模式验证完整

### 测试通过
- [ ] 所有单元测试通过（54个测试用例）
- [ ] 测试覆盖率 ≥ 90%
- [ ] 复杂嵌套条件测试完整
- [ ] 排序配置测试完整

### 代码质量
- [ ] 所有方法有 docstring
- [ ] 所有参数有类型注解
- [ ] 通过 pylint 检查（评分 ≥ 8.5）
- [ ] 通过 mypy 类型检查

### 功能验证
- [ ] name 唯一约束生效
- [ ] 三种条件类型数据验证正确
- [ ] 递归组合条件处理正确
- [ ] 四种排序模式验证正确
- [ ] 使用统计功能正常

### 与前端对齐
- [ ] 与 pdf-sorter 的排序模式完全对应
- [ ] 与 Filter 实现的条件类型完全对应
- [ ] 事件发布正确

---

**文档结束**

✅ SearchConditionTablePlugin 支持复杂的搜索条件和排序配置，与前端 pdf-sorter 和 Filter 功能完全对齐。
