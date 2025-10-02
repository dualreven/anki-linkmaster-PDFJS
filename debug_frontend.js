// 在浏览器Console中运行此代码来调试前端数据

// 1. 检查Tabulator表格数据
console.log("=== 检查Tabulator表格数据 ===");
const tableElement = document.querySelector('#pdf-table-container table');
if (tableElement && tableElement.tabulator) {
    const data = tableElement.tabulator.getData();
    console.log(`表格行数: ${data.length}`);

    if (data.length > 0) {
        const first = data[0];
        console.log("\n第一行数据的扩展字段:");
        console.log("last_accessed_at:", first.last_accessed_at);
        console.log("review_count:", first.review_count);
        console.log("rating:", first.rating);
        console.log("tags:", first.tags);
        console.log("total_reading_time:", first.total_reading_time);
        console.log("due_date:", first.due_date);
        console.log("\n完整数据:", first);
    }
} else {
    console.log("表格未找到或未初始化");
}

// 2. 检查EventBus接收的数据
console.log("\n=== 监听下一次列表更新事件 ===");
if (window.eventBusSingleton) {
    window.eventBusSingleton.on('pdf:list:updated', (pdfs) => {
        console.log(`收到 ${pdfs.length} 条PDF记录`);
        if (pdfs.length > 0) {
            const first = pdfs[0];
            console.log("\n第一条记录的扩展字段:");
            console.log("last_accessed_at:", first.last_accessed_at);
            console.log("review_count:", first.review_count);
            console.log("rating:", first.rating);
            console.log("tags:", first.tags);
            console.log("total_reading_time:", first.total_reading_time);
            console.log("due_date:", first.due_date);
            console.log("\n完整数据:", first);
        }
    }, { subscriberId: 'debug-listener' });
    console.log("已注册监听器，请刷新页面...");
}

// 3. 手动检查表格列配置
console.log("\n=== 检查表格列配置 ===");
if (tableElement && tableElement.tabulator) {
    const columns = tableElement.tabulator.getColumnDefinitions();
    console.log("表格列数:", columns.length);
    console.log("列字段名:", columns.map(c => c.field).join(', '));

    // 检查扩展字段的列
    const extendedFieldColumns = columns.filter(c =>
        ['rating', 'review_count', 'last_accessed_at', 'total_reading_time', 'due_date', 'tags'].includes(c.field)
    );
    console.log("\n扩展字段列数:", extendedFieldColumns.length);
    extendedFieldColumns.forEach(col => {
        console.log(`- ${col.title}: ${col.field}`);
    });
}
