<!-- FRONTEND-STYLE-PDFTABLE-001.md -->
- **规范名称**: PDF表格样式和主题规范
- **规范描述**: 本规范定义了PDF表格模块的样式和主题管理要求，包括CSS架构、主题系统、响应式设计和样式一致性，确保UI的一致性和可定制性。
- **当前版本**: 1.0
- **所属范畴**: 样式规范
- **适用范围**: PDF表格模块的所有样式相关代码和CSS文件
- **详细内容**:
  1. 样式应采用模块化CSS架构，使用BEM命名约定避免样式冲突
  2. 主题系统应支持多种预设主题（默认、深色、现代、经典、紧凑）
  3. 响应式设计应适配不同屏幕尺寸，支持移动端和桌面端
  4. 样式应使用CSS变量（自定义属性）便于主题切换和定制
  5. 组件样式应隔离，避免全局样式污染
  6. 样式文件应提供完整的注释，说明样式用途和依赖关系

- **正向例子**:
  ```css
  /* 符合规范的模块化CSS架构 */
  .pdf-table-container {
      --table-bg: #fff;
      --table-border: #e0e0e0;
      --table-header-bg: #f5f5f5;
      /* 其他CSS变量 */
  }

  .pdf-table-container--dark {
      --table-bg: #333;
      --table-border: #555;
      --table-header-bg: #444;
  }

  .pdf-table {
      background-color: var(--table-bg);
      border: 1px solid var(--table-border);
      width: 100%;
  }

  .pdf-table__header {
      background-color: var(--table-header-bg);
      font-weight: bold;
  }

  .pdf-table__row--selected {
      background-color: var(--selected-bg, #e3f2fd);
  }

  .pdf-table__cell {
      padding: 8px 12px;
      border-bottom: 1px solid var(--table-border);
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
      .pdf-table-container {
          overflow-x: auto;
      }
      .pdf-table {
          min-width: 600px;
      }
  }
  ```

- **反向例子**:
  ```css
  /* 违反规范：全局样式和硬编码 */
  table {
      width: 100%; /* 全局样式，可能影响其他表格 */
      border: 1px solid #000; /* 硬编码颜色 */
  }

  .header {
      background: gray; /* 模糊的类名，可能冲突 */
  }

  /* 没有使用CSS变量，主题切换困难 */
  .dark-theme {
      background: #333; /* 重复定义，维护困难 */
      border: 1px solid #555;
  }

  /* 缺乏响应式设计 */
  .table-cell {
      padding: 10px; /* 固定尺寸，不适应移动端 */
  }
  ```

- **JavaScript中的样式管理示例**:
  ```javascript
  // 符合规范的样式管理
  class PDFTableRenderer {
      applyTheme(theme) {
          // 使用CSS变量切换主题
          this.container.className = `pdf-table-container pdf-table-container--${theme}`;
      }

      // 响应式处理
      handleResize() {
          if (window.innerWidth < 768) {
              this.enableMobileLayout();
          } else {
              this.enableDesktopLayout();
          }
      }
  }