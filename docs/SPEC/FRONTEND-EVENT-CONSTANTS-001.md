- **规范名称**: 前端事件常量定义规范
- **规范描述**: 规定前端事件常量的定义方式，确保事件名称通过常量引用，避免硬编码，提高代码的可维护性和一致性。
- **当前版本**: 1.0
- **所属范畴**: 编码规范
- **适用范围**: 所有前端JavaScript/TypeScript代码中的事件常量定义
- **详细内容**: 
  - 事件常量必须定义在专门的常量文件中，如 `event-constants.js`
  - 常量命名使用大写字母和下划线，遵循模块化结构
  - 每个模块的事件常量应分组定义，使用对象嵌套结构
  - 常量值必须与事件命名规范一致，使用小写和冒号分隔
  - 禁止在代码中直接使用字符串字面量作为事件名称

- **正向例子**:
  ```javascript
  // event-constants.js 文件
  export const APP = {
    INIT: { 
      START: 'app:init:start', 
      COMPLETE: 'app:init:complete' 
    }
  };

  export const PDF = {
    LOAD: { 
      START: 'pdf:load:start', 
      SUCCESS: 'pdf:load:success' 
    }
  };

  export const WEBSOCKET = {
    CONNECT: { 
      START: 'websocket:connect:start', 
      SUCCESS: 'websocket:connect:success',
      FAIL: 'websocket:connect:fail'
    }
  };

  // 使用常量
  import { APP, PDF } from './event-constants';
  eventBus.emit(APP.INIT.START, data);
  eventBus.emit(PDF.LOAD.SUCCESS, pdfData);
  ```

- **反向例子**:
  ```javascript
  // 错误：硬编码事件名称
  eventBus.emit('app:init:start', data); // 应该使用常量
  
  // 错误：常量定义不规范
  const appInitStart = 'app:init:start'; // 应该使用模块化结构
  
  // 错误：常量文件缺失或结构混乱
  // 没有专门的常量文件，事件名称散落在各处