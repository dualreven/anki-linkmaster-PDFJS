- **规范名称**: 前端事件生命周期管理规范
- **规范描述**: 规定组件生命周期中事件订阅的清理机制，确保组件卸载时正确清理事件订阅，避免内存泄漏和意外行为。
- **当前版本**: 1.0
- **所属范畴**: 编码规范
- **适用范围**: 所有前端JavaScript/TypeScript代码中的组件事件订阅管理
- **详细内容**: 
  - 组件必须维护订阅清理函数的集合
  - 在组件挂载时订阅事件，并保存取消订阅函数
  - 在组件卸载时必须清理所有事件订阅
  - 对于类组件，应该在unmount或析构方法中清理
  - 对于函数组件，应该在useEffect的清理函数中清理

- **正向例子**:
  ```javascript
  // 类组件示例
  class PDFViewerComponent {
    subscriptions = [];
    
    mount() {
      // 订阅事件并保存取消函数
      this.subscriptions.push(
        eventBus.on(PDF.LOAD.SUCCESS, this.handleLoadSuccess),
        eventBus.on(PDF.LOAD.FAIL, this.handleLoadFail)
      );
    }
    
    unmount() {
      // 清理所有订阅
      this.subscriptions.forEach(unsubscribe => unsubscribe());
      this.subscriptions = [];
    }
    
    handleLoadSuccess = (data) => {
      // 处理加载成功
    }
    
    handleLoadFail = (error) => {
      // 处理加载失败
    }
  }

  // 函数组件示例（React）
  function PDFViewer() {
    useEffect(() => {
      const unsubscribeSuccess = eventBus.on(PDF.LOAD.SUCCESS, handleLoadSuccess);
      const unsubscribeFail = eventBus.on(PDF.LOAD.FAIL, handleLoadFail);
      
      // 返回清理函数
      return () => {
        unsubscribeSuccess();
        unsubscribeFail();
      };
    }, []);
    
    const handleLoadSuccess = (data) => {
      // 处理加载成功
    }
    
    const handleLoadFail = (error) => {
      // 处理加载失败
    }
  }
  ```

- **反向例子**:
  ```javascript
  // 错误：缺少清理机制
  class Component {
    mount() {
      eventBus.on(PDF.LOAD.SUCCESS, this.handleLoad); // 没有保存取消函数
    }
    // 没有unmount方法，会导致内存泄漏
  }

  // 错误：清理不完整
  class Component {
    subscriptions = [];
    
    mount() {
      this.subscriptions.push(eventBus.on(PDF.LOAD.SUCCESS, this.handleLoad));
    }
    
    unmount() {
      // 只清理了部分订阅
      if (this.subscriptions.length > 0) {
        this.subscriptions[0](); // 应该清理所有订阅
      }
    }
  }

  // 错误：函数组件缺少清理函数
  function Component() {
    useEffect(() => {
      eventBus.on(PDF.LOAD.SUCCESS, handleLoad); // 没有返回清理函数
    }, []);
  }