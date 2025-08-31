<!-- EVENT-NAMING-CONVENTION-001.md -->
- **规范名称**: 事件命名约定规范
- **规范描述**: 本规范定义了项目中事件命名的标准格式和约定，确保事件名称的一致性和可读性，便于事件总线的管理和维护。
- **当前版本**: 1.0
- **所属范畴**: 编码规范
- **适用范围**: 所有使用事件总线的模块和组件
- **详细内容**: 
  1. **命名格式**: 必须采用 `模块:操作:状态` 的三段式命名结构
  2. **模块命名**: 使用小写字母和连字符，如 `pdf-viewer`, `ui`, `websocket`
  3. **操作命名**: 使用动词描述操作，如 `load`, `render`, `navigate`
  4. **状态命名**: 使用过去分词描述状态，如 `requested`, `started`, `completed`, `failed`
  5. **常量定义**: 所有事件名称必须在常量文件中定义，禁止硬编码
  6. **命名空间组织**: 使用嵌套对象组织相关事件，提高可读性

- **正向例子**:
  ```javascript
  // 正确的事件命名和组织
  export const PDF_VIEWER_EVENTS = {
    FILE: {
      LOAD: {
        REQUESTED: 'pdf-viewer:file:load:requested',
        STARTED: 'pdf-viewer:file:load:started',
        COMPLETED: 'pdf-viewer:file:load:completed',
        FAILED: 'pdf-viewer:file:load:failed'
      },
      CLOSE: 'pdf-viewer:file:close'
    },
    NAVIGATION: {
      PAGE_CHANGE: 'pdf-viewer:navigation:page:changed',
      GOTO: 'pdf-viewer:navigation:goto:requested'
    }
  };
  
  // 正确使用事件常量
  eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, { file: 'document.pdf' });
  eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.PAGE_CHANGE, { page: 5 });
  ```

- **反向例子**:
  ```javascript
  // 错误做法：不规范的命名格式
  eventBus.emit('loadFile', data); // 缺少模块前缀
  eventBus.emit('pdf_viewer_file_load', data); // 使用下划线而非冒号
  eventBus.emit('PDF:FILE:LOAD', data); // 使用大写字母
  
  // 错误做法：硬编码事件名称
  eventBus.emit('pdf-viewer:file:load:requested', data); // 应使用常量
  
  // 错误做法：混乱的命名空间
  export const EVENTS = {
    LOAD_FILE: 'load-file', // 缺乏结构
    RENDER_PAGE: 'render-page'
  };
  ```