# 数据表插件系统

## 概述

数据表插件系统提供了一套完整的插件化架构，用于管理数据库表的创建、数据验证和CRUD操作。该系统参考前端的 Feature 架构设计，实现了插件隔离、依赖管理和事件驱动通信。

## 核心组件

### 1. EventBus（事件总线）

事件总线实现发布-订阅模式，支持插件间的松耦合通信。

**特性：**
- 三段式事件命名验证：`table:<table-name>:<action>:<status>`
- 支持普通订阅和一次性订阅
- **订阅者ID追踪**（用于调试和日志记录）
- 自动异常处理

**示例：**

```python
from src.backend.database.plugin import EventBus

bus = EventBus(logger)

# 订阅事件（必须提供订阅者ID）
def on_create(data):
    print(f"PDF created: {data['uuid']}")

bus.on('table:pdf-info:create:completed', on_create, 'pdf-annotation-plugin')

# 发布事件
bus.emit('table:pdf-info:create:completed', {'uuid': 'abc123'})

# 一次性订阅
bus.once('table:pdf-info:delete:completed', on_delete, 'cleanup-plugin')

# 取消订阅
bus.off('table:pdf-info:create:completed', on_create, 'pdf-annotation-plugin')
```

**事件命名规范：**

```python
from src.backend.database.plugin import TableEvents, EventStatus

# 使用辅助函数生成标准事件名
event_name = TableEvents.create_event('pdf-info', EventStatus.COMPLETED)
# 结果：'table:pdf-info:create:completed'

event_name = TableEvents.update_event('pdf-annotation', EventStatus.SUCCESS)
# 结果：'table:pdf-annotation:update:success'
```

### 2. TablePlugin（抽象基类）

所有数据表插件必须继承 `TablePlugin` 并实现必要的接口。

**必须实现的属性：**
- `table_name`：表名（如 `'pdf-info'`）
- `version`：插件版本（遵循 SemVer，如 `'1.0.0'`）
- `dependencies`：依赖的其他表插件列表（可选，默认为 `[]`）

**必须实现的方法：**
- `create_table()`：建表和创建索引
- `validate_data(data)`：字段合规性检查
- `insert(data)`：插入记录
- `update(primary_key, data)`：更新记录
- `delete(primary_key)`：删除记录
- `query_by_id(primary_key)`：根据主键查询
- `query_all(limit, offset)`：查询所有记录（支持分页）

**可选实现的方法：**
- `migrate(from_version, to_version)`：表结构迁移

**生命周期方法：**
- `enable()`：启用插件（自动调用 `create_table()`）
- `disable()`：禁用插件

**示例：**

```python
from src.backend.database.plugin import TablePlugin
from src.backend.database.exceptions import DatabaseValidationError

class PDFInfoTablePlugin(TablePlugin):
    """PDF信息表插件"""

    @property
    def table_name(self) -> str:
        return 'pdf-info'

    @property
    def version(self) -> str:
        return '1.0.0'

    @property
    def dependencies(self) -> list:
        return []  # 无依赖

    def create_table(self) -> None:
        """建表"""
        sql = '''
        CREATE TABLE IF NOT EXISTS pdf_info (
            uuid TEXT PRIMARY KEY NOT NULL,
            title TEXT NOT NULL DEFAULT '',
            file_path TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
        '''
        self._executor.execute_script(sql)

        # 创建索引
        self._executor.execute_script(
            'CREATE INDEX IF NOT EXISTS idx_pdf_info_title ON pdf_info(title)'
        )

        # 触发建表完成事件
        self._emit_event('create', 'completed')

    def validate_data(self, data: dict) -> dict:
        """数据验证"""
        # 必填字段检查
        if 'uuid' not in data:
            raise DatabaseValidationError("uuid is required")
        if 'file_path' not in data:
            raise DatabaseValidationError("file_path is required")

        # 类型检查
        if not isinstance(data['uuid'], str):
            raise DatabaseValidationError("uuid must be string")

        # 返回清洗后的数据
        import time
        return {
            'uuid': data['uuid'],
            'title': data.get('title', ''),
            'file_path': data['file_path'],
            'created_at': data.get('created_at', int(time.time() * 1000)),
            'updated_at': data.get('updated_at', int(time.time() * 1000))
        }

    def insert(self, data: dict) -> str:
        """插入记录"""
        validated = self.validate_data(data)

        sql = '''
        INSERT INTO pdf_info (uuid, title, file_path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        '''
        self._executor.execute_update(sql, (
            validated['uuid'],
            validated['title'],
            validated['file_path'],
            validated['created_at'],
            validated['updated_at']
        ))

        self._emit_event('create', 'completed', {'uuid': validated['uuid']})
        return validated['uuid']

    def update(self, primary_key: str, data: dict) -> bool:
        """更新记录"""
        validated = self.validate_data(data)

        sql = '''
        UPDATE pdf_info
        SET title = ?, file_path = ?, updated_at = ?
        WHERE uuid = ?
        '''
        rows = self._executor.execute_update(sql, (
            validated['title'],
            validated['file_path'],
            validated['updated_at'],
            primary_key
        ))

        if rows > 0:
            self._emit_event('update', 'completed', {'uuid': primary_key})

        return rows > 0

    def delete(self, primary_key: str) -> bool:
        """删除记录"""
        sql = 'DELETE FROM pdf_info WHERE uuid = ?'
        rows = self._executor.execute_update(sql, (primary_key,))

        if rows > 0:
            self._emit_event('delete', 'completed', {'uuid': primary_key})

        return rows > 0

    def query_by_id(self, primary_key: str) -> dict:
        """根据主键查询"""
        sql = 'SELECT * FROM pdf_info WHERE uuid = ?'
        results = self._executor.execute_query(sql, (primary_key,))
        return results[0] if results else None

    def query_all(self, limit=None, offset=None):
        """查询所有记录"""
        sql = 'SELECT * FROM pdf_info ORDER BY created_at DESC'
        params = []

        if limit is not None:
            sql += ' LIMIT ?'
            params.append(limit)
        if offset is not None:
            sql += ' OFFSET ?'
            params.append(offset)

        return self._executor.execute_query(sql, tuple(params) if params else ())
```

### 3. TablePluginRegistry（注册中心）

插件注册中心负责管理所有表插件的注册、依赖解析和生命周期。

**特性：**
- 单例模式
- 自动依赖解析（拓扑排序）
- 循环依赖检测
- 按依赖顺序启用/禁用插件
- 延迟依赖验证（允许任意顺序注册）

**示例：**

```python
from src.backend.database import DatabaseConnectionManager, SQLExecutor
from src.backend.database.plugin import (
    EventBus, TablePluginRegistry
)

# 初始化基础设施
conn_manager = DatabaseConnectionManager.get_instance()
executor = SQLExecutor(conn_manager)
event_bus = EventBus(logger)

# 获取注册中心单例
registry = TablePluginRegistry.get_instance(executor, event_bus, logger)

# 注册插件（任意顺序）
pdf_info_plugin = PDFInfoTablePlugin(executor, event_bus)
pdf_annotation_plugin = PDFAnnotationTablePlugin(executor, event_bus)

registry.register(pdf_info_plugin)
registry.register(pdf_annotation_plugin)

# 启用所有插件（自动按依赖顺序）
registry.enable_all()

# 获取启用顺序
order = registry.get_enable_order()
# 结果：['pdf-info', 'pdf-annotation']

# 禁用所有插件（按依赖逆序）
registry.disable_all()

# 单独启用插件（自动启用依赖）
registry.enable('pdf-annotation')  # 会自动先启用 pdf-info

# 查询插件
plugin = registry.get('pdf-info')
enabled_plugins = registry.get_enabled()
```

## 依赖管理

### 声明依赖

```python
class PDFAnnotationTablePlugin(TablePlugin):
    @property
    def table_name(self) -> str:
        return 'pdf-annotation'

    @property
    def dependencies(self) -> list:
        return ['pdf-info']  # 依赖 pdf-info 表
```

### 依赖解析顺序

注册中心使用 **Kahn 算法**进行拓扑排序，自动计算正确的启用顺序：

```
pdf-info (无依赖)
  ↓
pdf-annotation (依赖 pdf-info)
  ↓
pdf-bookmark (依赖 pdf-annotation)
```

**启用顺序**：`pdf-info → pdf-annotation → pdf-bookmark`
**禁用顺序**：`pdf-bookmark → pdf-annotation → pdf-info`

### 循环依赖检测

系统会自动检测并阻止循环依赖：

```python
# ❌ 这会导致错误
# Plugin A 依赖 B
# Plugin B 依赖 C
# Plugin C 依赖 A （循环！）

registry.enable_all()
# 抛出: PluginDependencyError: Circular dependency detected: pdf-info -> pdf-annotation -> pdf-info
```

### 依赖缺失处理

```python
# 注册时允许依赖缺失（延迟验证）
registry.register(pdf_annotation_plugin)  # 即使 pdf-info 未注册也不报错

# 启用时检测依赖缺失
registry.enable_all()
# 抛出: PluginDependencyError: Plugin 'pdf-annotation' depends on 'pdf-info', but 'pdf-info' is not registered
```

## 事件通信

### 标准事件模式

所有插件应遵循统一的事件命名规范：

```
table:<table-name>:<action>:<status>
```

**示例：**
- `table:pdf-info:create:completed` - PDF 创建完成
- `table:pdf-annotation:update:success` - 注释更新成功
- `table:pdf-bookmark:delete:failed` - 书签删除失败

### 订阅其他插件的事件

```python
class PDFAnnotationTablePlugin(TablePlugin):
    def enable(self) -> None:
        super().enable()

        # 监听 pdf-info 的创建事件
        self._event_bus.on(
            'table:pdf-info:create:completed',
            self._on_pdf_created,
            'pdf-annotation-plugin'  # 订阅者ID
        )

    def _on_pdf_created(self, data: dict):
        """PDF 创建时的回调"""
        pdf_uuid = data.get('uuid')
        if pdf_uuid:
            # 执行相关操作
            pass
```

### 发布事件

```python
class PDFInfoTablePlugin(TablePlugin):
    def insert(self, data: dict) -> str:
        validated = self.validate_data(data)

        # 执行插入操作
        # ...

        # 发布事件（通知其他插件）
        self._emit_event('create', 'completed', {
            'uuid': validated['uuid'],
            'title': validated['title']
        })

        return validated['uuid']
```

## 表结构迁移

### 支持迁移

```python
class PDFInfoTablePlugin(TablePlugin):
    def migrate(self, from_version: str, to_version: str) -> None:
        """表结构迁移"""
        if from_version == '1.0.0' and to_version == '1.1.0':
            # 添加新字段
            sql = 'ALTER TABLE pdf_info ADD COLUMN description TEXT'
            self._executor.execute_script(sql)

        elif from_version == '1.1.0' and to_version == '2.0.0':
            # 更复杂的迁移
            sql = '''
            ALTER TABLE pdf_info ADD COLUMN tags TEXT;
            CREATE INDEX IF NOT EXISTS idx_pdf_info_tags ON pdf_info(tags);
            '''
            self._executor.execute_script(sql)

        else:
            raise NotImplementedError(
                f"Migration from {from_version} to {to_version} not supported"
            )
```

### 执行迁移

```python
plugin = registry.get('pdf-info')
plugin.migrate('1.0.0', '1.1.0')
```

## 最佳实践

### 1. 插件命名规范

- 表名使用连字符分隔：`pdf-info`, `pdf-annotation`
- 插件类名使用驼峰命名：`PDFInfoTablePlugin`
- 文件名使用下划线分隔：`pdf_info_table_plugin.py`

### 2. 数据验证

- **必须**在 `validate_data()` 中检查所有必填字段
- **必须**进行类型检查
- **建议**设置字段默认值
- **建议**验证外键存在性

### 3. 事件发布

- **必须**在 CRUD 操作成功后发布 `completed` 事件
- **必须**在操作失败时发布 `failed` 事件
- **建议**在事件数据中包含主键（便于订阅者处理）

### 4. 依赖管理

- **必须**在 `dependencies` 中声明所有依赖的表
- **禁止**在代码中硬编码依赖关系
- **建议**最小化依赖，保持插件独立性

### 5. 日志记录

- **必须**使用 `_logger` 记录重要操作
- **建议**使用不同日志级别：
  - `debug`：调试信息
  - `info`：一般信息
  - `warn`：警告信息
  - `error`：错误信息

### 6. 异常处理

- **必须**使用项目自定义异常（`DatabaseError` 及其子类）
- **禁止**吞噬异常
- **建议**在异常信息中包含上下文

### 7. 测试

- **必须**为每个插件编写单元测试
- **必须**测试依赖关系
- **必须**测试事件发布和订阅
- **建议**测试覆盖率 ≥ 85%

## 测试示例

```python
import pytest
from unittest.mock import Mock
from src.backend.database.plugin import EventBus

def test_pdf_info_plugin_insert():
    """测试 PDF 信息插入"""
    executor = Mock()
    executor.execute_update.return_value = 1

    event_bus = EventBus()
    received_events = []

    def handler(data):
        received_events.append(data)

    event_bus.on('table:pdf-info:create:completed', handler, 'test-subscriber')

    plugin = PDFInfoTablePlugin(executor, event_bus)

    # 插入数据
    uuid = plugin.insert({
        'uuid': 'abc123',
        'title': 'Test PDF',
        'file_path': '/path/to/test.pdf'
    })

    assert uuid == 'abc123'
    assert len(received_events) == 1
    assert received_events[0]['uuid'] == 'abc123'
```

## 架构对比：前端 vs 后端

| 特性 | 前端 Feature 架构 | 后端 Plugin 架构 |
|------|-------------------|------------------|
| 模块化单元 | Feature | TablePlugin |
| 通信机制 | ScopedEventBus | EventBus |
| 注册中心 | FeatureRegistry | TablePluginRegistry |
| 依赖管理 | DependencyContainer | dependencies 属性 |
| 生命周期 | install/uninstall | enable/disable |
| 状态管理 | StateManager | SQLExecutor |

## 常见问题

### 1. 如何处理插件间的数据访问？

**错误做法：**
```python
# ❌ 直接访问其他插件
pdf_info_plugin = registry.get('pdf-info')
pdf_data = pdf_info_plugin.query_by_id('abc123')
```

**正确做法：**
```python
# ✅ 使用事件通信
self._event_bus.on(
    'table:pdf-info:create:completed',
    self._on_pdf_created,
    'my-plugin'
)

# 或通过共享的 SQLExecutor 直接查询
sql = 'SELECT * FROM pdf_info WHERE uuid = ?'
results = self._executor.execute_query(sql, (uuid,))
```

### 2. 如何处理事务？

```python
from src.backend.database import TransactionManager

def insert_with_transaction(self, data: dict) -> str:
    """在事务中插入"""
    tm = TransactionManager(self._executor._conn_manager.get_connection())

    try:
        tm.begin()

        # 插入主表
        uuid = self.insert(data)

        # 插入关联表
        self._executor.execute_update(
            'INSERT INTO pdf_metadata (pdf_uuid, key, value) VALUES (?, ?, ?)',
            (uuid, 'author', data.get('author'))
        )

        tm.commit()
        return uuid

    except Exception as e:
        tm.rollback()
        raise
```

### 3. 如何调试事件流？

启用 EventBus 日志：

```python
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

event_bus = EventBus(logger)
```

所有事件发布和订阅都会被记录：
```
DEBUG: EventBus: [pdf-annotation-plugin] subscribed to 'table:pdf-info:create:completed'
DEBUG: EventBus: Emitting 'table:pdf-info:create:completed' with data: {'uuid': 'abc123'}
```

## 版本历史

- **v1.0** (2025-10-05)
  - 初始实现
  - EventBus 支持订阅者ID追踪
  - TablePlugin 抽象基类
  - TablePluginRegistry 注册中心
  - 依赖解析和循环依赖检测
  - 测试覆盖率 93%
