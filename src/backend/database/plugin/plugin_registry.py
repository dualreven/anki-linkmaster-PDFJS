"""
插件注册中心

负责管理所有数据表插件的注册、依赖解析和生命周期。

创建日期: 2025-10-05
版本: v1.0
"""

from typing import Dict, List, Optional, Set, Any
from collections import defaultdict, deque

from .base_table_plugin import TablePlugin
from ..exceptions import DatabaseError


class PluginDependencyError(DatabaseError):
    """插件依赖错误"""
    pass


class TablePluginRegistry:
    """
    插件注册中心（单例模式）

    职责:
    1. 注册和管理所有表插件
    2. 解析插件依赖关系（拓扑排序）
    3. 按依赖顺序启用/禁用插件
    4. 检测循环依赖
    5. 查询已注册插件

    Example:
        >>> registry = TablePluginRegistry.get_instance(executor, event_bus, logger)
        >>> registry.register(PDFInfoTablePlugin(executor, event_bus))
        >>> registry.register(PDFAnnotationTablePlugin(executor, event_bus))
        >>> registry.enable_all()  # 按依赖顺序启用所有插件
    """

    _instance: Optional['TablePluginRegistry'] = None

    def __init__(self, executor, event_bus, logger=None):
        """
        初始化插件注册中心

        Args:
            executor: SQLExecutor 实例
            event_bus: EventBus 实例
            logger: 日志记录器（可选）

        Note:
            推荐使用 get_instance() 单例方法
        """
        self._executor = executor
        self._event_bus = event_bus
        self._logger = logger

        # 存储已注册的插件: {table_name: plugin_instance}
        self._plugins: Dict[str, TablePlugin] = {}

        # 存储依赖关系: {table_name: [dependency1, dependency2, ...]}
        self._dependencies: Dict[str, List[str]] = {}

        # 存储启用顺序（拓扑排序结果）
        self._enable_order: List[str] = []

    @classmethod
    def get_instance(cls, executor, event_bus, logger=None) -> 'TablePluginRegistry':
        """
        获取单例实例

        Args:
            executor: SQLExecutor 实例
            event_bus: EventBus 实例
            logger: 日志记录器（可选）

        Returns:
            TablePluginRegistry: 单例实例
        """
        if cls._instance is None:
            cls._instance = cls(executor, event_bus, logger)
        return cls._instance

    @classmethod
    def reset_instance(cls) -> None:
        """
        重置单例实例（主要用于测试）
        """
        cls._instance = None

    def register(self, plugin: TablePlugin) -> None:
        """
        注册插件

        Args:
            plugin: TablePlugin 实例

        Raises:
            ValueError: 插件已存在或表名无效

        Note:
            依赖验证会延迟到启用插件时进行

        Example:
            >>> plugin = PDFInfoTablePlugin(executor, event_bus)
            >>> registry.register(plugin)
        """
        table_name = plugin.table_name

        # 验证表名
        if not table_name or not isinstance(table_name, str):
            raise ValueError(f"Invalid table name: {table_name}")

        # 检查是否已注册
        if table_name in self._plugins:
            raise ValueError(f"Plugin '{table_name}' is already registered")

        # 注册插件
        self._plugins[table_name] = plugin
        self._dependencies[table_name] = plugin.dependencies

        if self._logger:
            self._logger.info(
                f"Registered plugin '{table_name}' v{plugin.version} "
                f"(dependencies: {plugin.dependencies or 'none'})"
            )

        # 清空启用顺序缓存（延迟验证）
        self._enable_order = []

    def unregister(self, table_name: str) -> None:
        """
        注销插件

        Args:
            table_name: 表名

        Raises:
            ValueError: 插件不存在或有其他插件依赖它

        Example:
            >>> registry.unregister('pdf-info')
        """
        if table_name not in self._plugins:
            raise ValueError(f"Plugin '{table_name}' is not registered")

        # 检查是否有其他插件依赖它
        dependents = self._find_dependents(table_name)
        if dependents:
            raise ValueError(
                f"Cannot unregister plugin '{table_name}', "
                f"following plugins depend on it: {dependents}"
            )

        # 禁用插件
        plugin = self._plugins[table_name]
        if plugin.is_enabled:
            plugin.disable()

        # 注销
        del self._plugins[table_name]
        del self._dependencies[table_name]

        if self._logger:
            self._logger.info(f"Unregistered plugin '{table_name}'")

        # 清空启用顺序缓存
        self._enable_order = []

    def enable_all(self) -> None:
        """
        启用所有插件（按依赖顺序）

        Raises:
            PluginDependencyError: 依赖解析失败

        Example:
            >>> registry.enable_all()
        """
        if not self._enable_order:
            self._resolve_dependencies()

        for table_name in self._enable_order:
            plugin = self._plugins[table_name]
            if not plugin.is_enabled:
                plugin.enable()

                if self._logger:
                    self._logger.info(
                        f"Enabled plugin '{table_name}' v{plugin.version}"
                    )

    def disable_all(self) -> None:
        """
        禁用所有插件（按依赖逆序）

        Example:
            >>> registry.disable_all()
        """
        # 按依赖逆序禁用
        for table_name in reversed(self._enable_order):
            plugin = self._plugins[table_name]
            if plugin.is_enabled:
                plugin.disable()

                if self._logger:
                    self._logger.info(f"Disabled plugin '{table_name}'")

    def enable(self, table_name: str) -> None:
        """
        启用单个插件（会自动启用依赖）

        Args:
            table_name: 表名

        Raises:
            ValueError: 插件不存在

        Example:
            >>> registry.enable('pdf-annotation')  # 自动启用 pdf-info
        """
        if table_name not in self._plugins:
            raise ValueError(f"Plugin '{table_name}' is not registered")

        # 启用所有依赖
        for dep in self._dependencies[table_name]:
            if not self._plugins[dep].is_enabled:
                self.enable(dep)

        # 启用插件
        plugin = self._plugins[table_name]
        if not plugin.is_enabled:
            plugin.enable()

            if self._logger:
                self._logger.info(f"Enabled plugin '{table_name}'")

    def disable(self, table_name: str, force: bool = False) -> None:
        """
        禁用单个插件

        Args:
            table_name: 表名
            force: 是否强制禁用（同时禁用依赖它的插件）

        Raises:
            ValueError: 插件不存在或有其他插件依赖它

        Example:
            >>> registry.disable('pdf-info', force=True)
        """
        if table_name not in self._plugins:
            raise ValueError(f"Plugin '{table_name}' is not registered")

        # 检查依赖
        if not force:
            dependents = [
                name for name, plugin in self._plugins.items()
                if plugin.is_enabled and table_name in self._dependencies[name]
            ]
            if dependents:
                raise ValueError(
                    f"Cannot disable plugin '{table_name}', "
                    f"following enabled plugins depend on it: {dependents}. "
                    f"Use force=True to disable all."
                )

        # 强制禁用所有依赖它的插件
        if force:
            for name in self._find_dependents(table_name):
                if self._plugins[name].is_enabled:
                    self.disable(name, force=True)

        # 禁用插件
        plugin = self._plugins[table_name]
        if plugin.is_enabled:
            plugin.disable()

            if self._logger:
                self._logger.info(f"Disabled plugin '{table_name}'")

    def get(self, table_name: str) -> Optional[TablePlugin]:
        """
        获取插件实例

        Args:
            table_name: 表名

        Returns:
            TablePlugin: 插件实例，不存在则返回 None
        """
        return self._plugins.get(table_name)

    def get_all(self) -> Dict[str, TablePlugin]:
        """
        获取所有已注册插件

        Returns:
            Dict[str, TablePlugin]: {table_name: plugin_instance}
        """
        return self._plugins.copy()

    def get_enabled(self) -> Dict[str, TablePlugin]:
        """
        获取所有已启用插件

        Returns:
            Dict[str, TablePlugin]: {table_name: plugin_instance}
        """
        return {
            name: plugin
            for name, plugin in self._plugins.items()
            if plugin.is_enabled
        }

    def has(self, table_name: str) -> bool:
        """
        检查插件是否已注册

        Args:
            table_name: 表名

        Returns:
            bool: 是否已注册
        """
        return table_name in self._plugins

    def is_enabled(self, table_name: str) -> bool:
        """
        检查插件是否已启用

        Args:
            table_name: 表名

        Returns:
            bool: 是否已启用

        Raises:
            ValueError: 插件不存在
        """
        if table_name not in self._plugins:
            raise ValueError(f"Plugin '{table_name}' is not registered")

        return self._plugins[table_name].is_enabled

    def get_enable_order(self) -> List[str]:
        """
        获取启用顺序（拓扑排序结果）

        Returns:
            List[str]: 表名列表（按依赖顺序）

        Raises:
            PluginDependencyError: 循环依赖或依赖不存在
        """
        if not self._enable_order:
            self._resolve_dependencies()

        return self._enable_order.copy()

    def _resolve_dependencies(self) -> None:
        """
        解析依赖关系（拓扑排序）

        Raises:
            PluginDependencyError: 循环依赖或依赖不存在

        使用 Kahn 算法进行拓扑排序
        """
        # 检查所有依赖是否存在
        for table_name, deps in self._dependencies.items():
            for dep in deps:
                if dep not in self._plugins:
                    raise PluginDependencyError(
                        f"Plugin '{table_name}' depends on '{dep}', "
                        f"but '{dep}' is not registered"
                    )

        # 检测循环依赖
        self._detect_circular_dependency()

        # Kahn 算法拓扑排序
        in_degree = defaultdict(int)  # 入度表

        # 计算入度（每个插件依赖的数量）
        for table_name, deps in self._dependencies.items():
            in_degree[table_name] = len(deps)

        # 队列存储入度为0的节点
        queue = deque([
            name for name in self._plugins
            if in_degree[name] == 0
        ])

        result = []

        while queue:
            current = queue.popleft()
            result.append(current)

            # 移除当前节点后，更新依赖它的节点的入度
            for table_name, deps in self._dependencies.items():
                if current in deps:
                    in_degree[table_name] -= 1
                    if in_degree[table_name] == 0:
                        queue.append(table_name)

        # 验证是否所有节点都被处理（检测循环依赖）
        if len(result) != len(self._plugins):
            raise PluginDependencyError(
                "Circular dependency detected in plugins"
            )

        self._enable_order = result

        if self._logger:
            self._logger.debug(f"Dependency resolution order: {result}")

    def _detect_circular_dependency(self) -> None:
        """
        检测循环依赖（使用DFS）

        Raises:
            PluginDependencyError: 检测到循环依赖
        """
        visited: Set[str] = set()
        rec_stack: Set[str] = set()

        def dfs(node: str, path: List[str]) -> None:
            visited.add(node)
            rec_stack.add(node)
            path.append(node)

            for dep in self._dependencies.get(node, []):
                if dep not in visited:
                    dfs(dep, path)
                elif dep in rec_stack:
                    # 找到循环
                    cycle_start = path.index(dep)
                    cycle = path[cycle_start:] + [dep]
                    raise PluginDependencyError(
                        f"Circular dependency detected: {' -> '.join(cycle)}"
                    )

            path.pop()
            rec_stack.remove(node)

        for table_name in self._plugins:
            if table_name not in visited:
                dfs(table_name, [])

    def _find_dependents(self, table_name: str) -> List[str]:
        """
        查找依赖指定插件的所有插件

        Args:
            table_name: 表名

        Returns:
            List[str]: 依赖列表
        """
        return [
            name for name, deps in self._dependencies.items()
            if table_name in deps
        ]
