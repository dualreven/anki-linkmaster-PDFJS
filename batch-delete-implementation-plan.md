# 批量删除功能实现计划

## 当前状态分析

### 前端架构
- ✅ Tabulator已配置行选择功能（selectable: true）
- ✅ 表格有选择列（rowSelection formatter）
- ✅ UI中已有批量删除按钮
- ✅ TableWrapper已有getSelectedRows()方法
- ✅ 事件系统已支持批量删除事件（PDF_MANAGEMENT_EVENTS.BATCH.REQUESTED）

### 后端通信
- ✅ PDFManager已实现handleBatchRemove方法
- ✅ 支持批量请求ID跟踪
- ✅ 通过WebSocket发送单文件删除请求（带批次元数据）

## 需要改进的问题

### 前端问题
1. **UI-Manager中的#handleBatchDelete方法过于复杂**：尝试多种选择检测方式，应该统一使用TableWrapper的API
2. **选择状态同步**：需要确保Tabulator选择事件正确触发
3. **用户体验**：需要添加选择状态提示和批量操作确认

### 后端问题
1. **需要真正的批量删除API**：当前是循环发送单文件删除请求
2. **原子性保证**：需要确保批量操作要么全部成功，要么全部失败
3. **性能优化**：一次性删除多个文件应该比逐个删除更高效

## 实现方案

### 前端修改
1. **简化选择检测**：直接使用`this.pdfTable.getSelectedRows()`
2. **添加选择状态监听**：监听Tabulator的选择变化事件
3. **优化批量删除逻辑**：直接传递选中行的ID数组

### 后端修改
1. **新增批量删除API**：`/api/pdf/batch-delete`
2. **原子性处理**：使用事务确保批量操作的原子性
3. **批量响应**：一次性返回所有操作结果

## 开发步骤

1. **前端优化**：
   - 修改ui-manager.js中的#handleBatchDelete方法
   - 添加选择状态显示
   - 优化批量删除确认对话框

2. **后端实现**：
   - 创建批量删除API端点
   - 实现批量删除业务逻辑
   - 添加事务支持

3. **测试验证**：
   - 前端选择功能测试
   - 批量删除流程测试
   - 错误处理测试

## 风险评估
- 批量操作可能影响系统性能
- 需要确保选择状态的正确同步
- 后端批量API需要正确处理并发请求