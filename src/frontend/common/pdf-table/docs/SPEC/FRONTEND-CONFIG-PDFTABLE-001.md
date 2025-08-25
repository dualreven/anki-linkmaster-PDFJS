<!-- FRONTEND-CONFIG-PDFTABLE-001.md -->
- **规范名称**: PDF表格配置管理规范
- **规范描述**: 本规范定义了PDF表格模块的配置管理要求，包括默认配置、配置验证、配置合并和动态配置更新，确保配置的一致性和灵活性。
- **当前版本**: 1.0
- **所属范畴**: 配置规范
- **适用范围**: PDF表格模块的所有配置相关代码
- **详细内容**:
  1. 配置应提供完整的默认配置对象，覆盖所有可配置选项
  2. 配置合并应支持深度合并，用户配置优先于默认配置
  3. 配置验证应确保所有配置项的类型和值符合预期
  4. 动态配置更新应触发相应的重新渲染或状态更新
  5. 配置应支持主题、语言、分页大小等常见选项
  6. 配置对象应提供getter方法用于安全访问配置值

- **正向例子**:
  ```javascript
  // 符合规范的配置管理
  class PDFTableConfig {
      static DEFAULT_CONFIG = {
          columns: [],
          data: [],
          pageSize: 20,
          sortable: true,
          filterable: true,
          selectable: true,
          pagination: true,
          theme: 'default',
          locale: 'zh-CN'
      };

      constructor(config = {}) {
          this.config = this.mergeConfig(config);
          this.validateConfig();
          this.freezeConfig();
      }

      // 深度合并配置
      mergeConfig(userConfig) {
          return {
              ...PDFTableConfig.DEFAULT_CONFIG,
              ...userConfig,
              columns: userConfig.columns || PDFTableConfig.DEFAULT_CONFIG.columns
          };
      }

      // 安全获取配置值
      get(key) {
          return this.config[key];
      }

      // 动态更新配置
      setTheme(theme) {
          this.config.theme = theme;
          this.validateConfig();
      }
  }
  ```

- **反向例子**:
  ```javascript
  // 违反规范：配置管理混乱
  class PDFTableConfig {
      constructor(config) {
          // 没有默认配置，直接使用用户配置
          this.config = config || {};
          
          // 没有验证，可能导致运行时错误
          if (config.pageSize > 100) {
              console.warn('Page size too large'); // 只有简单警告，没有正确处理
          }
      }

      // 直接暴露配置对象，没有封装
      getConfig() {
          return this.config; // 外部可以直接修改，破坏封装性
      }

      // 没有深度合并，可能导致配置丢失
      mergeConfig(userConfig) {
          return Object.assign({}, userConfig); // 丢失默认配置
      }
  }