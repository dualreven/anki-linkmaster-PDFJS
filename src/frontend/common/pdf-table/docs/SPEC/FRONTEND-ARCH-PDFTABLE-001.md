<!-- FRONTEND-ARCH-PDFTABLE-001.md -->
- **规范名称**: PDF表格模块化架构设计规范
- **规范描述**: 本规范定义了PDF表格模块的模块化架构设计原则，确保代码结构清晰、职责单一、易于维护和扩展。
- **当前版本**: 1.0
- **所属范畴**: 设计模式规范
- **适用范围**: PDF表格模块的所有JavaScript代码
- **详细内容**:
  1. 模块应采用单一职责原则，每个类只负责一个核心功能
  2. 核心功能应拆分为独立类：配置管理、数据模型、渲染器、选择、排序、筛选、分页等
  3. 类之间通过构造函数注入依赖，避免硬编码依赖
  4. 主表类(PDFTable)作为协调者，负责初始化和管理各个功能模块
  5. 模块间通信通过事件系统进行，避免直接方法调用
  6. 所有模块应提供清晰的API接口和完整的生命周期管理

- **正向例子**:
  ```javascript
  // 符合规范的模块化架构
  class PDFTable {
      constructor(container, config = {}) {
          // 初始化核心组件
          this.config = new PDFTableConfig(config);
          this.events = new PDFTableEvents();
          this.dataModel = new PDFTableDataModel();
          this.renderer = new PDFTableRenderer(this);
          
          // 初始化功能模块
          this.selection = new PDFTableSelection(this);
          this.sorting = new PDFTableSorting(this);
          this.filtering = new PDFTableFiltering(this);
          this.pagination = new PDFTablePagination(this);
      }
  }
  ```

- **反向例子**:
  ```javascript
  // 违反规范：功能混杂在一个类中
  class PDFTable {
      constructor(container, config = {}) {
          // 所有功能都在一个类中实现，违反单一职责原则
          this.config = config;
          this.data = [];
          this.selectedRows = new Set();
          // ... 其他状态和功能全部混杂
      }
      
      // 混杂了配置、数据、渲染、选择、排序等所有功能
      loadData() { /* ... */ }
      render() { /* ... */ }
      sort() { /* ... */ }
      filter() { /* ... */ }
      selectRow() { /* ... */ }
      // ... 数十个方法混杂在一个类中
  }