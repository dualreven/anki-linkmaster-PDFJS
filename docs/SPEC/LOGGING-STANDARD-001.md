<!-- LOGGING-STANDARD-001.md -->
- **规范名称**: 统一日志记录规范
- **规范描述**: 本规范定义了项目中日志记录的统一标准和最佳实践，确保日志信息的 consistency、可读性和可维护性，便于问题排查和系统监控。
- **当前版本**: 1.0
- **所属范畴**: 编码规范
- **适用范围**: 所有需要记录日志的模块和组件
- **详细内容**: 
  1. **日志记录器使用**: 必须使用common/utils/logger.js中的Logger类
  2. **日志级别**: 必须使用LogLevel中定义的级别（DEBUG, INFO, WARN, ERROR）
  3. **日志格式**: 日志必须包含时间戳、模块名、日志级别和消息内容
  4. **结构化日志**: 复杂数据必须使用JSON序列化进行记录
  5. **上下文信息**: 重要操作必须记录足够的上下文信息
  6. **性能考虑**: 避免在生产环境中记录DEBUG级别的日志

- **正向例子**:
  ```javascript
  // 正确使用日志记录器
  import { Logger, LogLevel } from '../../common/utils/logger.js';
  
  // 创建模块专用的日志记录器
  const logger = new Logger('PDFViewer', LogLevel.INFO);
  
  // 记录不同级别的日志
  logger.debug('开始加载PDF文件', { file: 'document.pdf', size: 1024 });
  logger.info('PDF文件加载完成', { duration: 1500, pages: 10 });
  logger.warn('文件加载较慢', { duration: 5000, threshold: 3000 });
  logger.error('文件加载失败', { 
    error: error.message, 
    stack: error.stack, 
    file: 'document.pdf' 
  });
  
  // 记录带上下文的操作
  function processPdfFile(file, options) {
    logger.info('开始处理PDF文件', { 
      file: file.name, 
      size: file.size,
      options: options 
    });
    
    try {
      // 处理逻辑
      logger.debug('处理进度更新', { progress: 50 });
      
      // 完成处理
      logger.info('PDF处理完成', { 
        duration: 2000,
        result: 'success'
      });
    } catch (error) {
      logger.error('PDF处理失败', {
        error: error.message,
        file: file.name,
        stack: error.stack
      });
      throw error;
    }
  }
  ```

- **反向例子**:
  ```javascript
  // 错误做法：使用console直接记录日志
  console.log('开始操作'); // 缺乏结构化格式
  console.error('错误发生'); // 缺乏上下文信息
  
  // 错误做法：硬编码日志消息
  function someFunction() {
    // 缺乏日志记录
    // 或者使用不一致的日志格式
  }
  
  // 错误做法：记录敏感信息
  logger.info('用户登录成功', {
    username: 'admin',
    password: 'secret', // 敏感信息泄露
    token: 'jwt-token'
  });
  
  // 错误做法：过度记录日志
  logger.debug('进入函数');
  logger.debug('参数检查');
  logger.debug('每一步操作'); // 产生大量噪音日志
  
  // 错误做法：忽略错误日志
  try {
    riskyOperation();
  } catch (error) {
    // 没有记录错误日志
  }
  
  // 错误做法：自定义日志实现
  class MyLogger { /* 重复实现日志功能 */ }
  ```