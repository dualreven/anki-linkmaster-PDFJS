- **规范名称**: 后端生命周期管理规范
- **规范描述**: 规定后端对象的生命周期管理和资源清理机制，确保组件卸载时正确清理资源，避免内存泄漏和意外行为
- **当前版本**: 1.0
- **所属范畴**: 后端编码规范
- **适用范围**: 所有后端Python代码中的对象生命周期管理
- **详细内容**:
  - 对象必须维护所有事件的清理函数集合
  - 在对象初始化时正确订阅事件，并保存取消函数的引用
  - 在对象销毁时必须清理所有事件订阅和资源
  - 对于PyQt组件，应该在destroy()方法中清理
  - 对于需要清理的资源，应该提供专门的cleanup()方法

- **正向例子**:
  ```python
  # 直接内存清理机制定义生命周期管理
  class WebSocketHandlers:
      def __init__(self, app_instance, response_handlers):
          self.app = app_instance
          self.response = response_handlers
          self.websocket_server = app_instance.websocket_server
          self.pdf_manager = app_instance.pdf_manager
          self.event_subscriptions = []

      def setup_event_handlers(self):
          """订阅所有事件处理程序"""
          # 无论何种类型的的监听都需要保存
          self.event_subscriptions.append(
              self.pdf_manager.file_added.connect(self.on_file_added)
          )
          self.event_subscriptions.append(
              self.pdf_manager.file_removed.connect(self.on_file_removed)
          )

      def cleanup(self):
          """清理所有资源和事件订阅"""
          # 断开所有信号连接
          for subscription in self.event_subscriptions:
              subscription.disconnect()
          self.event_subscriptions = []
          logger.info("WebSocketHandlers资源已清理")

      def on_file_added(self, file_info):
          """文件添加事件处理"""
          logger.info(f"文件已添加: {file_info}")

      def on_file_removed(self, file_id):
          """文件删除事件处理"""
          logger.info(f"文件已删除: {file_id}")

  # 使用生命周期管理的组件
  class AnkiLinkMasterApp:
      def __init__(self):
          self.websocket_handlers = None

      def initialize(self):
          """应用启动时的初始化"""
          self.websocket_handlers = WebSocketHandlers(self, self.response_handlers)
          self.websocket_handlers.setup_event_handlers()

      def shutdown(self):
          """应用关闭时的清理"""
          if self.websocket_handlers:
              self.websocket_handlers.cleanup()
              self.websocket_handlers = None
  ```

- **反向例子**:
  ```python
  # 错误：缺少清理机制
  class ProblematicHandlers:
      def __init__(self):
          self.pdf_manager.file_added.connect(self.on_file_added)
          # 没有保存取消函数的引用

      # 没有cleanup方法，资源无法释放

  # 错误：清理不完整
  class IncompleteCleanup:
      def __init__(self):
          self.subscriptions = []
          self.pdf_manager.file_added.connect(self.on_file_added)

      def add_subscription(self, subscription):
          self.subscriptions.append(subscription)

      def cleanup(self):
          # 只清理了部分订阅，只取消了第一次订阅
          if self.subscriptions:
              self.subscriptions[0].disconnect()
          # 漏掉了其他订阅的清理

  # 错误：循环引用导致内存泄漏
  class MemoryLeakRisk:
      def __init__(self, parent):
          self.parent = parent  # 强引用parent，互相引用
          parent.add_child(self)

      def cleanup(self):
          pass  # 没有清除引用关系
  ```

- **验证方法**:
  - 通过内存分析工具检测潜在的内存泄漏
  - 单元测试验证对象销毁后的资源清理
  - 集成测试expression单个对象的生命周期
  - 代码审查检查所有的资源获取都有对应的清理
  - 负载测试验证长时间运行时的资源使用情况
  - 使用weakref检测循环引用问题