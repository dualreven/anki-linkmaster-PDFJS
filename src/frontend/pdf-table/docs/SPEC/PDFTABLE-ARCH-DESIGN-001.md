<![CDATA[<!-- PDFTABLE-ARCH-DESIGN-001.md -->
- **规范名称**: PDF-Table 架构设计规范
- **规范描述**: 规定 PDF-Table 模块的组合式架构设计原则，确保模块职责清晰、耦合度低、易于维护和扩展。
- **当前版本**: 1.0
- **所属范畴**: 设计规范
- **适用范围**: PDF-Table 模块的架构设计和模块划分
- **详细内容**: 
  - 采用组合优于继承的原则，通过对象组合构建功能
  - 每个模块必须专注于单一职责领域
  - 模块间通过事件总线进行通信，禁止直接依赖
  - 必须实现错误边界机制，模块级错误处理
  - 支持异步加载和初始化，确保性能优化

- **正向例子**:
  ```javascript
  // 正确：组合式架构，通过事件总线通信
  class PDFTableApp {
    constructor() {
      this.eventBus = new EventBus();
      this.errorHandler = new ErrorHandler(this.eventBus);
      this.dataManager = new DataManager(this.eventBus);
      this.uiManager = new UIManager(this.eventBus);
    }
  }

  // 正确：模块职责单一
  class DataManager {
    // 只处理数据逻辑，不涉及UI操作
    handleSortData(data) {
      // 数据处理逻辑
      this.eventBus.emit(TABLE_EVENTS.SORT.COMPLETED, result);
    }
  }
  ```

- **反向例子**:
  ```javascript
  // 错误：模块职责混杂
  class DataManager {
    constructor() {
      this.uiElement = document.getElementById('table'); // 不应直接操作UI
    }
    
    handleSortData(data) {
      // 数据逻辑
      this.updateUI(); // 不应在数据模块中更新UI
    }
  }

  // 错误：直接模块依赖，高耦合
  class UIManager {
    constructor(dataManager) {
      this.dataManager = dataManager; // 直接依赖，违反事件驱动原则
    }
  }
  ```
]]>