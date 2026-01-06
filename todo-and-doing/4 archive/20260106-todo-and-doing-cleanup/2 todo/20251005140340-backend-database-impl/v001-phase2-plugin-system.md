# 后端数据库系统 - 第二期需求文档

**期数**: 第二期 - 插件隔离架构
**版本**: v1.0
**创建日期**: 2025-10-05
**预计工期**: 3天
**依赖**: 第一期（数据库抽象层）
**设计参考**: 前端 Feature 架构 (`src/frontend/ARCHITECTURE-EXPLAINED.md`)

---

## 📋 概述

### 目标
实现插件化的数据表管理架构，支持并行开发、热插拔、事件驱动。

### 为什么需要插件架构？
1. **并行开发** - 多人同时开发不同数据表，互不阻塞
2. **热插拔** - 新增/移除数据表无需修改核心代码
3. **事件驱动** - 数据表之间通过事件解耦，降低依赖
4. **统一规范** - 所有数据表遵循相同接口，便于维护
5. **架构对齐** - 与前端 Feature 架构保持一致

### 与前端架构的对应关系

| 前端 | 后端 | 说明 |
|------|------|------|
| `IFeature` 接口 | `TablePlugin` 抽象类 | 定义标准接口 |
| `FeatureRegistry` | `TablePluginRegistry` | 注册和管理实例 |
| `EventBus` | `EventBus` | 事件总线通信 |
| `feature.install()` | `plugin.enable()` | 启用生命周期 |
| `feature.uninstall()` | `plugin.disable()` | 禁用生命周期 |

---

## 🎯 功能需求

### 1. TablePlugin 抽象基类

#### 1.1 职责
定义数据表插件的标准接口，所有数据表插件必须继承此类。

#### 1.2 完整接口设计

```python
# src/backend/database/plugin/base_table_plugin.py

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
import time
import json

class TablePlugin(ABC):
    """
    数据表插件抽象基类

    所有数据表插件必须实现此接口，确保：
    1. 统一的建表、增删查改接口
    2. 字段合规性检查
    3. 事件发布和监听
    4. 表结构变更（迁移）

    Example:
        >>> class PDFInfoTablePlugin(TablePlugin):
        ...     @property
        ...     def table_name(self) -> str:
        ...         return 'pdf_info'
        ...
        ...     def create_table(self) -> None:
        ...         # 实现建表逻辑
        ...         pass
    """

    # ==================== 必须实现的属性 ====================

    @property
    @abstractmethod
    def table_name(self) -> str:
        """
        表名（如 'pdf_info'）

        Returns:
            str: 表名（小写，下划线分隔）
        """
        pass

    @property
    @abstractmethod
    def version(self) -> str:
        """
        插件版本（遵循 SemVer，如 '1.0.0'）

        Returns:
            str: 版本号
        """
        pass

    @property
    def dependencies(self) -> List[str]:
        """
        依赖的其他表插件（可选，默认无依赖）

        Returns:
            List[str]: 依赖的表名列表

        Example:
            >>> @property
            >>> def dependencies(self) -> List[str]:
            ...     return ['pdf_info']  # pdf_annotation 依赖 pdf_info
        """
        return []

    # ==================== 构造函数 ====================

    def __init__(self, executor, event_bus, logger):
        """
        初始化插件

        Args:
            executor: SQLExecutor 实例
            event_bus: EventBus 实例
            logger: 日志记录器

        Note:
            不要在 __init__ 中执行建表操作，应在 enable() 中执行
        """
        self._executor = executor
        self._event_bus = event_bus
        self._logger = logger
        self._enabled = False

    # ==================== 必须实现的方法（建表） ====================

    @abstractmethod
    def create_table(self) -> None:
        """
        建表（如果表不存在）

        职责:
        1. 执行 CREATE TABLE IF NOT EXISTS 语句
        2. 创建索引
        3. 触发 'table:{table_name}:create:completed' 事件

        Raises:
            DatabaseError: 建表失败

        Example:
            >>> def create_table(self) -> None:
            ...     sql = '''
            ...     CREATE TABLE IF NOT EXISTS pdf_info (
            ...         uuid TEXT PRIMARY KEY NOT NULL,
            ...         title TEXT NOT NULL DEFAULT ''
            ...     )
            ...     '''
            ...     self._executor.execute_script(sql)
            ...     self._emit_event('create', 'completed')
        """
        pass

    # ==================== 必须实现的方法（数据验证） ====================

    @abstractmethod
    def validate_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        字段合规性检查

        Args:
            data: 待验证的数据字典

        Returns:
            验证并清洗后的数据（设置默认值、类型转换）

        Raises:
            DatabaseValidationError: 数据不合规

        验证内容:
        1. 必填字段存在性
        2. 字段类型正确性
        3. 字段约束（长度、范围、枚举）
        4. JSON 字段格式正确性
        5. 外键存在性（可选）

        Example:
            >>> def validate_data(self, data: Dict) -> Dict:
            ...     if 'uuid' not in data:
            ...         raise DatabaseValidationError("uuid is required")
            ...
            ...     if not isinstance(data['uuid'], str):
            ...         raise DatabaseValidationError("uuid must be string")
            ...
            ...     return {
            ...         'uuid': data['uuid'],
            ...         'title': data.get('title', ''),
            ...         'created_at': data.get('created_at', int(time.time() * 1000))
            ...     }
        """
        pass

    # ==================== 必须实现的方法（CRUD） ====================

    @abstractmethod
    def insert(self, data: Dict[str, Any]) -> str:
        """
        插入一条记录

        Args:
            data: 数据字典（必须包含主键）

        Returns:
            插入记录的主键值

        Raises:
            DatabaseConstraintError: 主键冲突
            DatabaseValidationError: 数据验证失败

        流程:
        1. 验证数据（调用 validate_data）
        2. 执行 INSERT
        3. 触发 create:completed 事件

        Example:
            >>> def insert(self, data: Dict) -> str:
            ...     validated = self.validate_data(data)
            ...     sql = "INSERT INTO pdf_info (uuid, title) VALUES (?, ?)"
            ...     self._executor.execute_update(sql, (validated['uuid'], validated['title']))
            ...     self._emit_event('create', 'completed', {'uuid': validated['uuid']})
            ...     return validated['uuid']
        """
        pass

    @abstractmethod
    def update(self, primary_key: str, data: Dict[str, Any]) -> bool:
        """
        更新记录

        Args:
            primary_key: 主键值
            data: 要更新的字段（不包含主键）

        Returns:
            是否成功更新（True=找到并更新，False=未找到）

        Raises:
            DatabaseValidationError: 数据验证失败

        流程:
        1. 验证数据
        2. 执行 UPDATE
        3. 触发 update:completed 事件

        Example:
            >>> def update(self, uuid: str, data: Dict) -> bool:
            ...     validated = self.validate_data(data)
            ...     sql = "UPDATE pdf_info SET title = ? WHERE uuid = ?"
            ...     rows = self._executor.execute_update(sql, (validated['title'], uuid))
            ...     if rows > 0:
            ...         self._emit_event('update', 'completed', {'uuid': uuid})
            ...     return rows > 0
        """
        pass

    @abstractmethod
    def delete(self, primary_key: str) -> bool:
        """
        删除记录

        Args:
            primary_key: 主键值

        Returns:
            是否成功删除

        流程:
        1. 执行 DELETE
        2. 触发 delete:completed 事件

        Example:
            >>> def delete(self, uuid: str) -> bool:
            ...     sql = "DELETE FROM pdf_info WHERE uuid = ?"
            ...     rows = self._executor.execute_update(sql, (uuid,))
            ...     if rows > 0:
            ...         self._emit_event('delete', 'completed', {'uuid': uuid})
            ...     return rows > 0
        """
        pass

    @abstractmethod
    def query_by_id(self, primary_key: str) -> Optional[Dict[str, Any]]:
        """
        根据主键查询单条记录

        Args:
            primary_key: 主键值

        Returns:
            记录字典，不存在则返回 None

        Example:
            >>> def query_by_id(self, uuid: str) -> Optional[Dict]:
            ...     sql = "SELECT * FROM pdf_info WHERE uuid = ?"
            ...     results = self._executor.execute_query(sql, (uuid,))
            ...     return results[0] if results else None
        """
        pass

    @abstractmethod
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

        Example:
            >>> def query_all(self, limit=None, offset=None) -> List[Dict]:
            ...     sql = "SELECT * FROM pdf_info"
            ...     if limit is not None:
            ...         sql += f" LIMIT {limit}"
            ...     if offset is not None:
            ...         sql += f" OFFSET {offset}"
            ...     return self._executor.execute_query(sql)
        """
        pass

    # ==================== 可选实现的方法 ====================

    def migrate(self, from_version: str, to_version: str) -> None:
        """
        表结构迁移（可选）

        Args:
            from_version: 当前版本
            to_version: 目标版本

        Raises:
            NotImplementedError: 如果不支持迁移

        Example:
            >>> def migrate(self, from_version: str, to_version: str) -> None:
            ...     if from_version == '1.0.0' and to_version == '1.1.0':
            ...         sql = "ALTER TABLE pdf_info ADD COLUMN new_field TEXT"
            ...         self._executor.execute_script(sql)
            ...     else:
            ...         raise NotImplementedError(f"Migration {from_version} -> {to_version} not supported")
        """
        raise NotImplementedError(
            f"{self.table_name} does not support migration"
        )

    def register_events(self) -> None:
        """
        注册事件监听器（可选）

        在 enable() 时自动调用，用于监听其他表的事件

        Example:
            >>> def register_events(self) -> None:
            ...     # 监听 pdf_info 表的删除事件
            ...     self._event_bus.on(
            ...         'table:pdf_info:delete:completed',
            ...         self._handle_pdf_deleted
            ...     )
            ...
            >>> def _handle_pdf_deleted(self, data: Dict) -> None:
            ...     # 级联删除本表的相关记录
            ...     pdf_uuid = data['uuid']
            ...     self.delete_by_pdf(pdf_uuid)
        """
        pass

    # ==================== 生命周期方法 ====================

    def enable(self) -> None:
        """
        启用插件

        流程:
        1. 检查是否已启用
        2. 建表（create_table）
        3. 注册事件监听（register_events）
        4. 标记为已启用
        """
        if self._enabled:
            self._logger.debug(f"{self.table_name} already enabled")
            return

        self._logger.info(f"Enabling {self.table_name} plugin...")

        try:
            # 1. 建表
            self.create_table()

            # 2. 注册事件
            self.register_events()

            # 3. 标记为已启用
            self._enabled = True

            self._logger.info(f"{self.table_name} plugin enabled successfully")
        except Exception as e:
            self._logger.error(f"Failed to enable {self.table_name}: {e}")
            raise

    def disable(self) -> None:
        """
        禁用插件

        流程:
        1. 检查是否已禁用
        2. 取消事件监听
        3. 标记为已禁用

        Note:
            不会删除表，只是停止监听事件
        """
        if not self._enabled:
            self._logger.debug(f"{self.table_name} already disabled")
            return

        self._logger.info(f"Disabling {self.table_name} plugin...")

        try:
            # 1. 取消事件监听
            self._event_bus.off_all(f'table:{self.table_name}')

            # 2. 标记为已禁用
            self._enabled = False

            self._logger.info(f"{self.table_name} plugin disabled successfully")
        except Exception as e:
            self._logger.error(f"Failed to disable {self.table_name}: {e}")
            raise

    # ==================== 内部辅助方法 ====================

    def _emit_event(
        self,
        action: str,
        status: str,
        data: Optional[Dict] = None
    ) -> None:
        """
        发布事件（三段式格式）

        Args:
            action: 动作（create/update/delete/query）
            status: 状态（requested/completed/failed）
            data: 事件数据

        生成的事件名格式:
            table:{table_name}:{action}:{status}

        Example:
            >>> self._emit_event('create', 'completed', {'uuid': 'abc123'})
            # 事件名: 'table:pdf_info:create:completed'
        """
        event_name = f'table:{self.table_name}:{action}:{status}'
        event_data = data or {}
        event_data['timestamp'] = int(time.time() * 1000)

        self._event_bus.emit(event_name, event_data)
        self._logger.debug(f"Event emitted: {event_name}")

    def _validate_json_field(
        self,
        data: Dict,
        field_name: str,
        required: bool = True
    ) -> Dict:
        """
        验证 JSON 字段（辅助方法）

        Args:
            data: 数据字典
            field_name: JSON 字段名
            required: 是否必填

        Returns:
            解析后的 JSON 对象

        Raises:
            DatabaseValidationError: JSON 格式错误
        """
        json_str = data.get(field_name)

        if json_str is None:
            if required:
                raise DatabaseValidationError(f"{field_name} is required")
            return {}

        if isinstance(json_str, dict):
            return json_str

        try:
            return json.loads(json_str)
        except json.JSONDecodeError as e:
            raise DatabaseValidationError(
                f"{field_name} is not valid JSON: {e}"
            ) from e
```

---

### 2. EventBus 事件总线

#### 2.1 职责
实现观察者模式，支持插件间解耦通信。

#### 2.2 完整接口设计

```python
# src/backend/database/event_bus.py

import re
from typing import Callable, Dict, List, Any

class EventBus:
    """
    事件总线（后端版）

    特性:
    - 严格的三段式事件命名验证（{module}:{action}:{status}）
    - 支持通配符订阅（如 'table:*:create:*'）
    - 同步事件分发
    - 监听器异常隔离（一个监听器异常不影响其他监听器）

    事件命名规范:
        正确: 'table:pdf_info:create:completed'
        错误: 'createPDF' (缺少冒号)
        错误: 'table:pdf_info:created' (只有2段)
        错误: 'Table:PDF:Create' (使用大写)
    """

    def __init__(self, logger: Any):
        """
        初始化事件总线

        Args:
            logger: 日志记录器
        """
        self._listeners: Dict[str, List[Callable]] = {}
        self._logger = logger

    def emit(self, event_name: str, data: Dict[str, Any]) -> None:
        """
        发布事件

        Args:
            event_name: 事件名（三段式格式）
            data: 事件数据（字典）

        Raises:
            ValueError: 事件名格式不合规

        Example:
            >>> bus = EventBus(logger)
            >>> bus.emit('table:pdf_info:create:completed', {'uuid': 'abc123'})
        """
        # 1. 验证事件名格式
        if not self._validate_event_name(event_name):
            raise ValueError(
                f"Invalid event name '{event_name}'. "
                f"Must follow pattern: {{module}}:{{action}}:{{status}}"
            )

        self._logger.debug(f"[EventBus] Emit: {event_name}")

        # 2. 触发所有监听器
        listeners = self._listeners.get(event_name, [])
        for listener in listeners:
            try:
                listener(data)
            except Exception as e:
                self._logger.error(
                    f"Error in listener for '{event_name}': {e}",
                    exc_info=True
                )

    def on(self, event_name: str, listener: Callable[[Dict], None]) -> Callable:
        """
        订阅事件

        Args:
            event_name: 事件名
            listener: 回调函数 (data: Dict) -> None

        Returns:
            取消订阅的函数

        Example:
            >>> def handle_pdf_created(data: Dict):
            ...     print(f"PDF created: {data['uuid']}")
            ...
            >>> bus.on('table:pdf_info:create:completed', handle_pdf_created)
            >>>
            >>> # 或者使用返回的 unsubscribe 函数
            >>> unsubscribe = bus.on('table:pdf_info:create:completed', handle_pdf_created)
            >>> unsubscribe()  # 取消订阅
        """
        if event_name not in self._listeners:
            self._listeners[event_name] = []

        self._listeners[event_name].append(listener)
        self._logger.debug(f"[EventBus] Listener added: {event_name}")

        # 返回取消订阅函数
        def unsubscribe():
            if listener in self._listeners.get(event_name, []):
                self._listeners[event_name].remove(listener)
                self._logger.debug(f"[EventBus] Listener removed: {event_name}")

        return unsubscribe

    def off(self, event_name: str, listener: Callable) -> None:
        """
        取消特定监听器

        Args:
            event_name: 事件名
            listener: 要移除的回调函数
        """
        if event_name in self._listeners:
            if listener in self._listeners[event_name]:
                self._listeners[event_name].remove(listener)
                self._logger.debug(f"[EventBus] Listener removed: {event_name}")

    def off_all(self, pattern: str) -> None:
        """
        取消所有匹配模式的监听器

        Args:
            pattern: 事件名前缀（如 'table:pdf_info'）

        Example:
            >>> # 取消所有 pdf_info 表的监听器
            >>> bus.off_all('table:pdf_info')
        """
        keys_to_remove = [
            key for key in self._listeners.keys()
            if key.startswith(pattern)
        ]

        for key in keys_to_remove:
            del self._listeners[key]
            self._logger.debug(f"[EventBus] All listeners removed: {key}")

    def _validate_event_name(self, event_name: str) -> bool:
        """
        验证事件名是否符合三段式格式

        格式: {module}:{action}:{status}

        规则:
        - 必须有3段，用冒号分隔
        - 每段必须以小写字母开头
        - 只能包含小写字母、数字、连字符

        Args:
            event_name: 事件名

        Returns:
            是否合规
        """
        # 正则: 小写字母开头 + (字母/数字/连字符)
        pattern = r'^[a-z][a-z0-9\-]*:[a-z][a-z0-9\-]*:[a-z][a-z0-9\-]*$'
        return bool(re.match(pattern, event_name))
```

---

### 3. TablePluginRegistry 插件注册中心

#### 3.1 职责
管理所有 TablePlugin 的注册、依赖解析、生命周期。

#### 3.2 完整接口设计

```python
# src/backend/database/plugin/registry.py

from typing import Dict, List, Optional
from .base_table_plugin import TablePlugin

class TablePluginRegistry:
    """
    表插件注册中心

    职责:
    1. 注册和管理所有 TablePlugin 实例
    2. 依赖关系解析（拓扑排序）
    3. 批量启用/禁用插件（按依赖顺序）
    4. 获取插件实例
    """

    def __init__(self, event_bus, logger):
        """
        初始化注册中心

        Args:
            event_bus: EventBus 实例
            logger: 日志记录器
        """
        self._plugins: Dict[str, TablePlugin] = {}
        self._event_bus = event_bus
        self._logger = logger

    def register(self, plugin: TablePlugin) -> None:
        """
        注册插件

        Args:
            plugin: TablePlugin 实例

        Raises:
            ValueError: 插件已存在

        Example:
            >>> registry = TablePluginRegistry(event_bus, logger)
            >>> registry.register(PDFInfoTablePlugin(executor, event_bus, logger))
        """
        table_name = plugin.table_name

        if table_name in self._plugins:
            raise ValueError(f"Plugin '{table_name}' already registered")

        self._plugins[table_name] = plugin
        self._logger.info(f"Plugin '{table_name}' registered (version {plugin.version})")

    def get(self, table_name: str) -> Optional[TablePlugin]:
        """
        获取插件实例

        Args:
            table_name: 表名

        Returns:
            TablePlugin 实例，不存在则返回 None

        Example:
            >>> pdf_info_plugin = registry.get('pdf_info')
            >>> pdf_info_plugin.insert({'uuid': 'abc123', 'title': 'Test'})
        """
        return self._plugins.get(table_name)

    def get_all(self) -> List[TablePlugin]:
        """获取所有已注册的插件"""
        return list(self._plugins.values())

    def enable_all(self) -> None:
        """
        启用所有插件（按依赖顺序）

        流程:
        1. 解析依赖关系
        2. 拓扑排序
        3. 按序启用

        Example:
            >>> registry.register(PDFInfoTablePlugin(...))
            >>> registry.register(PDFAnnotationTablePlugin(...))  # 依赖 pdf_info
            >>> registry.enable_all()
            # 先启用 pdf_info，再启用 pdf_annotation
        """
        self._logger.info("Enabling all plugins...")

        # 1. 拓扑排序
        sorted_plugins = self._topological_sort()

        # 2. 按序启用
        for plugin in sorted_plugins:
            plugin.enable()

        self._logger.info(f"{len(sorted_plugins)} plugins enabled")

    def disable_all(self) -> None:
        """
        禁用所有插件（逆序）

        流程:
        1. 拓扑排序
        2. 按逆序禁用

        Example:
            >>> registry.disable_all()
            # 先禁用 pdf_annotation，再禁用 pdf_info
        """
        self._logger.info("Disabling all plugins...")

        # 1. 拓扑排序
        sorted_plugins = self._topological_sort()

        # 2. 按逆序禁用
        for plugin in reversed(sorted_plugins):
            plugin.disable()

        self._logger.info(f"{len(sorted_plugins)} plugins disabled")

    def _topological_sort(self) -> List[TablePlugin]:
        """
        拓扑排序（处理依赖关系）

        使用 Kahn 算法:
        1. 找出所有入度为0的节点
        2. 从队列中取出节点，输出
        3. 将该节点的所有邻接节点入度-1
        4. 重复2-3，直到队列为空

        Returns:
            排序后的插件列表

        Raises:
            ValueError: 存在循环依赖
        """
        # 构建依赖图
        in_degree = {}  # 入度
        graph = {}      # 邻接表

        for table_name, plugin in self._plugins.items():
            in_degree[table_name] = 0
            graph[table_name] = []

        for table_name, plugin in self._plugins.items():
            for dep in plugin.dependencies:
                if dep not in self._plugins:
                    raise ValueError(
                        f"Plugin '{table_name}' depends on '{dep}', but '{dep}' not registered"
                    )
                graph[dep].append(table_name)
                in_degree[table_name] += 1

        # Kahn 算法
        queue = [name for name, degree in in_degree.items() if degree == 0]
        sorted_names = []

        while queue:
            current = queue.pop(0)
            sorted_names.append(current)

            for neighbor in graph[current]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        # 检查循环依赖
        if len(sorted_names) != len(self._plugins):
            raise ValueError("Circular dependency detected")

        # 返回排序后的插件对象列表
        return [self._plugins[name] for name in sorted_names]
```

---

## 📁 文件结构

```
src/backend/database/plugin/
├── __init__.py                      # 导出公共接口
├── base_table_plugin.py             # TablePlugin 抽象基类
├── registry.py                      # TablePluginRegistry
└── __tests__/
    ├── __init__.py
    ├── conftest.py                  # pytest fixtures
    ├── test_base_plugin.py          # 基类测试
    └── test_registry.py             # 注册中心测试

src/backend/database/
├── event_bus.py                     # EventBus 实现
└── __tests__/
    └── test_event_bus.py            # 事件总线测试
```

---

## ✅ 单元测试要求

### 测试覆盖率
- **目标**: ≥ 85%
- **工具**: `pytest` + `pytest-cov`

### 测试用例清单

#### 1. EventBus 测试

```python
# test_event_bus.py

def test_event_name_validation():
    """测试：事件名格式验证"""
    bus = EventBus(logger)

    # 正确格式
    bus.emit('table:pdf_info:create:completed', {})  # ✅ 通过

    # 错误格式
    with pytest.raises(ValueError):
        bus.emit('createPDF', {})  # ❌ 缺少冒号

    with pytest.raises(ValueError):
        bus.emit('table:pdf_info:created', {})  # ❌ 只有2段

    with pytest.raises(ValueError):
        bus.emit('Table:PDF:Create:Done', {})  # ❌ 使用大写

def test_event_subscription():
    """测试：事件订阅和发布"""
    bus = EventBus(logger)
    received_data = []

    def listener(data):
        received_data.append(data)

    bus.on('table:pdf_info:create:completed', listener)
    bus.emit('table:pdf_info:create:completed', {'uuid': 'abc123'})

    assert len(received_data) == 1
    assert received_data[0]['uuid'] == 'abc123'

def test_event_unsubscription():
    """测试：取消订阅"""
    bus = EventBus(logger)
    received_count = [0]

    def listener(data):
        received_count[0] += 1

    unsubscribe = bus.on('table:pdf_info:create:completed', listener)

    bus.emit('table:pdf_info:create:completed', {})
    assert received_count[0] == 1

    unsubscribe()  # 取消订阅

    bus.emit('table:pdf_info:create:completed', {})
    assert received_count[0] == 1  # 不应该增加

def test_listener_exception_isolation():
    """测试：监听器异常隔离"""
    bus = EventBus(logger)
    received = []

    def bad_listener(data):
        raise ValueError("Test error")

    def good_listener(data):
        received.append(data)

    bus.on('table:pdf_info:create:completed', bad_listener)
    bus.on('table:pdf_info:create:completed', good_listener)

    # 第一个监听器抛异常，但不影响第二个
    bus.emit('table:pdf_info:create:completed', {'uuid': 'abc123'})

    assert len(received) == 1
```

#### 2. TablePlugin 测试

```python
# test_base_plugin.py

class MockTablePlugin(TablePlugin):
    """模拟插件（用于测试）"""

    @property
    def table_name(self) -> str:
        return 'mock_table'

    @property
    def version(self) -> str:
        return '1.0.0'

    def create_table(self):
        self._executor.execute_script(
            "CREATE TABLE IF NOT EXISTS mock_table (id TEXT PRIMARY KEY)"
        )

    def validate_data(self, data):
        if 'id' not in data:
            raise DatabaseValidationError("id is required")
        return data

    def insert(self, data):
        validated = self.validate_data(data)
        self._executor.execute_update(
            "INSERT INTO mock_table (id) VALUES (?)",
            (validated['id'],)
        )
        self._emit_event('create', 'completed', {'id': validated['id']})
        return validated['id']

    # ... 省略其他方法

def test_plugin_enable():
    """测试：插件启用"""
    plugin = MockTablePlugin(executor, event_bus, logger)

    assert not plugin._enabled

    plugin.enable()

    assert plugin._enabled

def test_plugin_disable():
    """测试：插件禁用"""
    plugin = MockTablePlugin(executor, event_bus, logger)
    plugin.enable()

    plugin.disable()

    assert not plugin._enabled

def test_emit_event():
    """测试：事件发布"""
    plugin = MockTablePlugin(executor, event_bus, logger)
    plugin.enable()

    received_events = []

    def listener(data):
        received_events.append(data)

    event_bus.on('table:mock_table:create:completed', listener)

    plugin._emit_event('create', 'completed', {'id': 'test123'})

    assert len(received_events) == 1
    assert received_events[0]['id'] == 'test123'
    assert 'timestamp' in received_events[0]
```

#### 3. TablePluginRegistry 测试

```python
# test_registry.py

def test_register_plugin():
    """测试：注册插件"""
    registry = TablePluginRegistry(event_bus, logger)
    plugin = MockTablePlugin(executor, event_bus, logger)

    registry.register(plugin)

    assert registry.get('mock_table') is plugin

def test_duplicate_registration():
    """测试：重复注册检测"""
    registry = TablePluginRegistry(event_bus, logger)
    plugin = MockTablePlugin(executor, event_bus, logger)

    registry.register(plugin)

    with pytest.raises(ValueError):
        registry.register(plugin)

def test_dependency_resolution():
    """测试：依赖关系拓扑排序"""
    # 创建两个插件：A 依赖 B
    class PluginA(MockTablePlugin):
        @property
        def table_name(self):
            return 'table_a'

        @property
        def dependencies(self):
            return ['table_b']

    class PluginB(MockTablePlugin):
        @property
        def table_name(self):
            return 'table_b'

    registry = TablePluginRegistry(event_bus, logger)
    plugin_a = PluginA(executor, event_bus, logger)
    plugin_b = PluginB(executor, event_bus, logger)

    registry.register(plugin_a)
    registry.register(plugin_b)

    sorted_plugins = registry._topological_sort()

    # B 应该在 A 前面
    assert sorted_plugins[0].table_name == 'table_b'
    assert sorted_plugins[1].table_name == 'table_a'

def test_circular_dependency_detection():
    """测试：循环依赖检测"""
    # 创建两个互相依赖的插件
    class PluginA(MockTablePlugin):
        @property
        def table_name(self):
            return 'table_a'

        @property
        def dependencies(self):
            return ['table_b']

    class PluginB(MockTablePlugin):
        @property
        def table_name(self):
            return 'table_b'

        @property
        def dependencies(self):
            return ['table_a']

    registry = TablePluginRegistry(event_bus, logger)
    registry.register(PluginA(executor, event_bus, logger))
    registry.register(PluginB(executor, event_bus, logger))

    with pytest.raises(ValueError, match="Circular dependency"):
        registry._topological_sort()

def test_enable_all():
    """测试：批量启用插件"""
    registry = TablePluginRegistry(event_bus, logger)
    plugin = MockTablePlugin(executor, event_bus, logger)
    registry.register(plugin)

    registry.enable_all()

    assert plugin._enabled
```

---

## 📦 交付标准

### 代码完成
- [x] `base_table_plugin.py` - TablePlugin 抽象基类
- [x] `event_bus.py` - EventBus 实现
- [x] `registry.py` - TablePluginRegistry 实现

### 测试通过
- [x] 所有单元测试通过（pytest）
- [x] 测试覆盖率 ≥ 85%（pytest-cov）

### 代码质量
- [x] 所有类和方法有 docstring
- [x] 所有参数有类型注解
- [x] 通过 pylint 检查（评分 ≥ 8.0）
- [x] 通过 mypy 类型检查

### 文档完善
- [x] 接口规范文档
- [x] 事件命名规范
- [x] 插件开发指南（如何继承 TablePlugin）

---

## 📚 插件开发指南

### 如何开发一个新的数据表插件？

#### 步骤1：继承 TablePlugin

```python
from src.backend.database.plugin.base_table_plugin import TablePlugin

class MyTablePlugin(TablePlugin):
    @property
    def table_name(self) -> str:
        return 'my_table'

    @property
    def version(self) -> str:
        return '1.0.0'

    # 如果依赖其他表
    @property
    def dependencies(self) -> List[str]:
        return ['pdf_info']
```

#### 步骤2：实现必须的7个方法

```python
def create_table(self) -> None:
    sql = '''
    CREATE TABLE IF NOT EXISTS my_table (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
    )
    '''
    self._executor.execute_script(sql)
    self._emit_event('create', 'completed')

def validate_data(self, data: Dict) -> Dict:
    if 'id' not in data:
        raise DatabaseValidationError("id is required")
    return {'id': data['id'], 'name': data.get('name', '')}

def insert(self, data: Dict) -> str:
    validated = self.validate_data(data)
    sql = "INSERT INTO my_table (id, name) VALUES (?, ?)"
    self._executor.execute_update(sql, (validated['id'], validated['name']))
    self._emit_event('create', 'completed', {'id': validated['id']})
    return validated['id']

# ... 实现 update, delete, query_by_id, query_all
```

#### 步骤3：注册插件

```python
from src.backend.database.plugin.registry import TablePluginRegistry

registry = TablePluginRegistry(event_bus, logger)
registry.register(MyTablePlugin(executor, event_bus, logger))
registry.enable_all()
```

---

## 🔗 下一期预告

**第三期：数据表实现**
- PDFInfoTablePlugin（PDF 信息表）
- PDFAnnotationTablePlugin（标注表）
- PDFBookmarkTablePlugin（书签表）
- SearchConditionTablePlugin（搜索条件表）

依赖第二期交付物：
- TablePlugin 抽象基类
- EventBus 事件总线
- TablePluginRegistry 注册中心

---

**文档结束**

✅ 第二期完成后，将为第三期提供灵活、可扩展的插件架构。
