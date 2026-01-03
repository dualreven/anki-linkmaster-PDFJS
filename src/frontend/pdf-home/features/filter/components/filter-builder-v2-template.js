export function getFilterBuilderV2Template() {
  return `
      <div class="filter-builder" hidden>
        <!-- 头部 -->
        <div class="filter-builder-header">
          <h3>🎚️ 高级筛选</h3>
          <button class="btn-collapse" aria-label="收起">▲</button>
        </div>

        <!-- 工具栏 -->
        <div class="filter-builder-toolbar">
          <div class="toolbar-group">
            <button class="btn-add-logic" data-logic="AND">+ AND</button>
            <button class="btn-add-logic" data-logic="OR">+ OR</button>
            <button class="btn-add-logic" data-logic="NOT">+ NOT</button>
          </div>
          <button class="btn-add-condition">+ 添加条件</button>
        </div>

        <!-- 条件树 -->
        <div class="filter-tree-container" id="filter-tree-container">
          <!-- 树状结构将在这里渲染 -->
        </div>

        <!-- 底部操作 -->
        <div class="filter-builder-footer">
          <div class="preview">
            <strong>Python表达式:</strong>
            <code id="python-preview">无条件</code>
          </div>
          <div class="actions">
            <button class="btn-reset">重置</button>
            <button class="btn-apply">应用筛选</button>
          </div>
        </div>
      </div>
    `;
}

