<!-- FRONTEND-EVENT-PDFTABLE-001.md -->
- **规范名称**: PDF表格事件处理规范
- **规范描述**: 本规范定义了PDF表格模块的事件处理机制，确保模块间通信通过事件系统进行，实现松耦合和可扩展性。
- **当前版本**: 1.0
- **所属范畴**: 事件处理规范
- **适用范围**: PDF表格模块的所有事件相关代码
- **详细内容**:
  1. 事件系统应采用发布-订阅模式，支持多模块间通信
  2. 事件命名应清晰描述其用途，遵循驼峰命名法
  3. 事件应包含相关数据，便于监听器处理
  4. 事件监听器应支持异步操作，避免阻塞事件循环
  5. 事件错误应妥善处理，避免影响其他监听器
  6. 事件系统应提供生命周期事件（初始化、渲染完成、销毁等）

- **正向例子**:
  ```javascript
  // 符合规范的事件系统实现
  class PDFTableEvents {
      constructor() {
          this.listeners = new Map();
      }

      on(event, listener) {
          if (!this.listeners.has(event)) {
              this.listeners.set(event, new Set());
          }
          this.listeners.get(event).add(listener);
      }

      off(event, listener) {
          if (this.listeners.has(event)) {
              this.listeners.get(event).delete(listener);
          }
      }

      emit(event, data) {
          if (this.listeners.has(event)) {
              this.listeners.get(event).forEach(listener => {
                  try {
                      listener(data);
                  } catch (error) {
                      console.error(`Error in event listener for ${event}:`, error);
                  }
              });
          }
      }
  }

  // 事件使用示例
  this.events.on('data-changed', (data) => {
      console.log('Data changed:', data);
      this.updateDisplay();
  });

  this.events.emit('data-changed', { data: newData });
  ```

- **反向例子**:
  ```javascript
  // 违反规范：直接方法调用或全局事件
  class PDFTable {
      // 直接调用其他模块的方法，紧耦合
      updateData() {
          this.renderer.render(); // 直接调用，违反松耦合原则
          this.selection.clear(); // 直接调用
      }

      // 使用全局事件总线，难以维护
      handleClick() {
          window.dispatchEvent(new CustomEvent('table-click', { detail: this.data }));
      }
  }

  // 或者没有错误处理的事件系统
  class SimpleEvents {
      emit(event, data) {
          this.listeners[event]?.forEach(listener => listener(data)); // 没有错误处理
      }
  }