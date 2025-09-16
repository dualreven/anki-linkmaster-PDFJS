// 前端中文标题调试脚本
// 在浏览器控制台中运行此脚本检查中文标题显示问题

function debugChineseTitle() {
    console.log('=== 中文PDF标题调试 ===');
    
    // 检查全局应用状态
    if (window.app && window.app._internal) {
        const app = window.app._internal;
        console.log('应用状态:', app.getState());
        
        // 检查PDF管理器数据
        if (app._pdfManager) {
            const pdfs = app._pdfManager.getPDFs();
            console.log('PDF管理器数据:', pdfs);
            
            // 查找中文PDF
            const chinesePDFs = pdfs.filter(pdf => 
                pdf.title && /[\u4e00-\u9fa5]/.test(pdf.title)
            );
            
            console.log('中文PDF文件:', chinesePDFs);
            
            if (chinesePDFs.length > 0) {
                console.log('第一个中文PDF详情:', chinesePDFs[0]);
                
                // 检查表格数据
                if (app.tableWrapper && app.tableWrapper.tabulator) {
                    const tableData = app.tableWrapper.tabulator.getData();
                    console.log('表格数据:', tableData);
                    
                    // 查找表格中的中文标题
                    const tableChinesePDFs = tableData.filter(row => 
                        row.title && /[\u4e00-\u9fa5]/.test(row.title)
                    );
                    console.log('表格中的中文PDF:', tableChinesePDFs);
                }
            }
        }
    }
    
    // 检查DOM中的表格内容
    console.log('=== DOM检查 ===');
    const table = document.querySelector('.tabulator-table');
    if (table) {
        console.log('Tabulator表格存在');
        
        // 检查标题列
        const titleCells = table.querySelectorAll('.tabulator-cell[data-field="title"]');
        console.log('标题单元格数量:', titleCells.length);
        
        titleCells.forEach((cell, index) => {
            const titleText = cell.textContent.trim();
            if (titleText && /[\u4e00-\u9fa5]/.test(titleText)) {
                console.log(`中文标题[${index}]:`, titleText);
            }
        });
    } else {
        console.log('Tabulator表格未找到，检查回退表格');
        const fallbackTable = document.querySelector('.pdf-table-fallback');
        if (fallbackTable) {
            console.log('回退表格存在');
            const titleCells = fallbackTable.querySelectorAll('td:nth-child(3)'); // 假设标题是第三列
            titleCells.forEach((cell, index) => {
                const titleText = cell.textContent.trim();
                if (titleText && /[\u4e00-\u9fa5]/.test(titleText)) {
                    console.log(`回退表格中文标题[${index}]:`, titleText);
                }
            });
        }
    }
    
    // 检查事件总线中的PDF列表更新
    if (window.app && window.app._internal && window.app._internal._eventBus) {
        const eventBus = window.app._internal._eventBus;
        console.log('=== 事件总线监听 ===');
        
        // 临时监听PDF列表更新事件
        const tempListener = (pdfs) => {
            console.log('PDF列表更新事件:', pdfs);
            const chineseInEvent = pdfs.filter(pdf => 
                pdf.title && /[\u4e00-\u9fa5]/.test(pdf.title)
            );
            console.log('事件中的中文PDF:', chineseInEvent);
        };
        
        const unsubscribe = eventBus.on('pdf:list:updated', tempListener);
        
        // 5秒后取消监听
        setTimeout(() => {
            unsubscribe();
            console.log('临时监听已取消');
        }, 5000);
    }
}

// 运行调试
debugChineseTitle();

// 添加全局函数以便手动调用
window.debugChineseTitle = debugChineseTitle;
console.log('调试函数已注册: debugChineseTitle()');