<!-- FRONTEND-PERF-PDFTABLE-001.md -->
- **规范名称**: PDF表格渲染性能优化规范
- **规范描述**: 本规范定义了PDF表格模块的渲染性能优化要求，确保在大数据量下仍能保持流畅的用户体验和高效的渲染性能。
- **当前版本**: 1.0
- **所属范畴**: 性能规范
- **适用范围**: PDF表格模块的所有渲染相关代码
- **详细内容**:
  1. 渲染应采用requestAnimationFrame进行调度，避免阻塞主线程
  2. 支持虚拟滚动技术，只渲染可见区域的元素
  3. 使用对象池技术复用DOM元素，减少垃圾回收
  4. 实现防抖机制优化高频操作（如滚动、调整大小）
  5. 渲染时间应监控和记录，确保性能指标达标（1000行数据渲染时间<100ms）
  6. 支持渐进式渲染，优先渲染可见内容

- **正向例子**:
  ```javascript
  // 符合规范的性能优化实现
  class PDFTableRenderer {
      async render(data) {
          // 使用requestAnimationFrame优化渲染
          await new Promise(resolve => {
              requestAnimationFrame(async () => {
                  await this.performRender(data);
                  resolve();
              });
          });
      }

      // 虚拟滚动实现
      async renderVirtualBody(data) {
          const scrollTop = this.container.scrollTop;
          const visibleStart = Math.floor(scrollTop / this.virtualScrollRowHeight);
          const visibleEnd = visibleStart + Math.ceil(this.container.clientHeight / this.virtualScrollRowHeight);
          
          // 只渲染可见区域的数据
          const visibleData = data.slice(
              Math.max(0, visibleStart - this.virtualScrollBufferSize),
              Math.min(data.length, visibleEnd + this.virtualScrollBufferSize)
          );
          
          await this.renderBody(visibleData);
      }

      // 对象池复用DOM元素
      class PDFTableRowPool {
          acquire() {
              return this.pool.pop() || document.createElement('tr');
          }
          release(row) {
              this.pool.push(row);
          }
      }
  }
  ```

- **反向例子**:
  ```javascript
  // 违反规范：性能低下的实现
  class PDFTableRenderer {
      render(data) {
          // 直接同步渲染，可能阻塞主线程
          this.container.innerHTML = ''; // 清除所有DOM，导致大量重排重绘
          
          data.forEach(item => {
              // 为每一行创建新的DOM元素，没有复用
              const row = document.createElement('tr');
              // ... 创建所有单元格
              this.container.appendChild(row);
          });
      }

      // 没有虚拟滚动，渲染所有数据
      renderBody(data) {
          // 即使有10000行数据也全部渲染，导致性能问题
          data.forEach((item, index) => {
              this.createTableRow(item, index);
          });
      }
  }