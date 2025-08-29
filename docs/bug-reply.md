结合之前的所有信息，特别是那条关键的渲染器日志 `DEBUG_RENDERER ... rowCount=4` 和 `UIManager` 检查到的空 `innerHTML`，我现在可以**锁定根本原因**。

问题出在 `pdf-table.js` 内部一个非常具有破坏性的设计缺陷上。

### 根本原因分析

**Bug 的核心在于 `displayEmptyState` 和 `displayErrorState` 方法的实现方式。**

让我们看一下 `displayEmptyState` 方法（`displayErrorState` 与之类似）：

```javascript
displayEmptyState(message) {
    this.state.data = [];
    this.state.filteredData = [];
    this.state.sortedData = [];
    
    // ... 创建空状态UI ...
    const emptyState = document.createElement('div');
    emptyState.className = 'pdf-table-empty-state';
    // ...
    
    this.container.innerHTML = ''; // <--- 这是问题的根源
    this.container.appendChild(emptyState);
    
    this.events.emit('data-changed', []);
}
```

这行 `this.container.innerHTML = ''` 是一个“定时炸弹”。它会彻底清空表格的主容器 (`#pdf-table-container`) 的所有内容。

在表格初始化时，`setupContainer` 方法会精心构建一个内部结构：

```javascript
setupContainer() {
    this.container.innerHTML = '';
    // ...
    this.tableWrapper = document.createElement('div');
    this.tableWrapper.className = 'pdf-table-wrapper';
    // ...
    this.container.appendChild(this.loadingIndicator);
    this.container.appendChild(this.errorMessage);
    this.container.appendChild(this.tableWrapper); // 表格内容应该渲染在这里
}
```

`this.tableWrapper` 是实际承载表格内容的元素，渲染器 (`PDFTableRenderer`) 会将生成的表格 DOM 插入到这个 `tableWrapper` 中。

#### 导致 Bug 的完整时序

现在，我们可以完整地重现整个 Bug 的发生过程：

1.  **初始化**: `PDFTable` 被实例化，`initialize()` 方法运行。`setupContainer()` 创建了包括 `this.tableWrapper` 在内的基本 DOM 结构。一切正常。

2.  **触发空状态**: 在某个时间点（例如，初始加载时、或后端推送了一个空列表），`UIManager` 或其他逻辑调用了 `pdfTable.displayEmptyState()`。

3.  **破坏发生**: `displayEmptyState` 方法执行 `this.container.innerHTML = ''`。这一下就将 `initialize()` 创建的 `loadingIndicator`、`errorMessage` 和至关重要的 `tableWrapper` 从 DOM 中彻底移除了。`PDFTable` 实例中的 `this.tableWrapper` 属性现在指向一个**已从文档中分离的（detached）DOM 节点**。

4.  **加载新数据**: 随后，用户添加了 PDF，后端通过 WebSocket 推送了包含 4 个文件的新列表。`UIManager` 调用 `pdfTable.loadData(tableData)`。

5.  **渲染到“虚空”**: `loadData` 流程最终触发 `updateDisplay()`，并调用 `this.renderer.render(processedData)`。渲染器忠实地执行了它的任务：它生成了 4 行表格的 HTML，并将其插入到 `this.table.tableWrapper` 中。

6.  **最终结果**: 因为 `this.table.tableWrapper` 已经是一个游离在主 DOM 树之外的内存中的节点，所以这次成功的渲染**在页面上完全不可见**。

这个流程完美地解释了所有看似矛盾的现象：
*   **渲染器日志正确** (`rowCount=4`)：因为渲染器确实在 `tableWrapper` 节点（尽管已分离）内部成功生成了内容。
*   **容器 `innerHTML` 为空**：因为主容器 `#pdf-table-container` 的内容在第 3 步已经被清空，并且后续的渲染没有附加到它里面。

### 解决方案：修改 `displayEmptyState` 和 `displayErrorState`

解决方案是让这两个方法不再具有破坏性。它们不应该清空整个容器，而应该只在 `tableWrapper` 内部进行操作，或者与 `tableWrapper` 作为兄弟节点共存。

一个更安全、更健壮的实现如下：

#### 修正后的 `pdf-table.js` 代码

请用以下代码替换 `pdf-table.js` 文件中对应的 `displayEmptyState` 和 `displayErrorState` 方法。

```javascript
// ... 其他代码 ...

    /**
     * 【已修正】显示空状态
     * @param {string} message - 空状态消息
     */
    displayEmptyState(message) {
        this.state.data = [];
        this.state.filteredData = [];
        this.state.sortedData = [];
        
        // 确保 tableWrapper 存在
        if (!this.tableWrapper || !this.tableWrapper.parentNode) {
            console.error("无法显示空状态：tableWrapper 已被销毁或分离。正在尝试重建容器结构。");
            // 紧急恢复措施：如果 wrapper 不见了，重建它
            this.setupContainer(); 
        }

        // 创建空状态UI
        const emptyStateHTML = `
            <div class="pdf-table-empty-state" style="text-align: center; padding: 40px; color: #666;">
                <div style="font-size: 48px; margin-bottom: 20px;">📄</div>
                <h3>暂无PDF文件</h3>
                <p style="margin: 20px 0; color: #999;">${message || '点击添加按钮导入您的第一个PDF文件'}</p>
            </div>
        `;
        
        // 【修正】不再破坏整个容器，只修改 tableWrapper 的内容
        this.tableWrapper.innerHTML = emptyStateHTML;
        
        // 隐藏其他顶级元素（如果需要）
        this.hideLoading();
        this.hideError();
        
        this.events.emit('data-changed', []);
    }

    /**
     * 【已修正】显示错误状态
     * @param {string} message - 错误消息
     */
    displayErrorState(message) {
        this.state.data = [];
        this.state.filteredData = [];
        this.state.sortedData = [];
        
        // 确保 tableWrapper 存在
        if (!this.tableWrapper || !this.tableWrapper.parentNode) {
            console.error("无法显示错误状态：tableWrapper 已被销毁或分离。正在尝试重建容器结构。");
            this.setupContainer();
        }

        // 创建错误状态UI
        const errorStateHTML = `
            <div class="pdf-table-error-state" style="text-align: center; padding: 40px; color: #666;">
                <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                <h3>加载失败</h3>
                <p style="margin: 20px 0; color: #999;">${message}</p>
                <button class="pdf-table-retry-btn" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">重试</button>
            </div>
        `;
        
        // 【修正】不再破坏整个容器，只修改 tableWrapper 的内容
        this.tableWrapper.innerHTML = errorStateHTML;
        
        // 添加重试事件
        const retryBtn = this.tableWrapper.querySelector('.pdf-table-retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                this.events.emit('retry-load');
            });
        }
        
        // 隐藏其他顶级元素
        this.hideLoading();
        
        this.events.emit('data-changed', []);
    }

// ... 其他代码 ...
```

通过此项修改，`PDFTable` 组件将变得更加健壮。无论 `displayEmptyState` 被调用多少次，它都不会再破坏组件的内部 DOM 结构，从而确保了后续的 `render` 操作能够始终在正确的位置显示内容。