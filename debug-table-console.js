/**
 * 表格调试脚本 - 在浏览器控制台运行
 * 复制以下代码到浏览器控制台中执行
 */

console.log("🔍 开始表格调试诊断...");

// 1. 检查表格容器
const container = document.querySelector('#pdf-table-container');
console.log("📦 表格容器:", container);

if (container) {
    console.log("✅ 找到表格容器");
    console.log("🏷️ 容器类名:", container.className);
    console.log("👶 子元素数量:", container.children.length);
    console.log("📏 容器尺寸:", {
        width: container.offsetWidth,
        height: container.offsetHeight,
        visible: container.offsetParent !== null
    });

    // 2. 查找 Tabulator 相关元素
    const tabulatorEl = container.querySelector('.tabulator');
    console.log("📊 Tabulator元素:", tabulatorEl);

    if (tabulatorEl) {
        console.log("✅ 找到Tabulator元素");

        // 3. 查找表格行
        const rows = container.querySelectorAll('.tabulator-row');
        console.log("📋 表格行数量:", rows.length);

        if (rows.length > 0) {
            console.log("✅ 找到表格行");

            const firstRow = rows[0];
            console.log("🔍 第一行详情:", {
                tagName: firstRow.tagName,
                className: firstRow.className,
                textContent: firstRow.textContent?.substring(0, 50) + '...',
                style: {
                    pointerEvents: getComputedStyle(firstRow).pointerEvents,
                    userSelect: getComputedStyle(firstRow).userSelect,
                    cursor: getComputedStyle(firstRow).cursor
                }
            });

            // 4. 添加测试事件监听器
            console.log("🎧 添加测试事件监听器...");

            firstRow.addEventListener('click', function(e) {
                console.log("🖱️ [测试] 行单击事件触发!", e.target);
            });

            firstRow.addEventListener('dblclick', function(e) {
                console.log("🖱️🖱️ [测试] 行双击事件触发!", e.target);
                alert('双击事件成功!');
            });

            console.log("✅ 事件监听器已添加到第一行");
            console.log("💡 请尝试双击第一行，应该会弹出提示框");

        } else {
            console.log("❌ 未找到表格行");
        }
    } else {
        console.log("❌ 未找到Tabulator元素");
    }

    // 5. 检查全局变量
    console.log("🌐 检查全局变量...");
    if (window.pdfHomeApp) {
        console.log("✅ 找到 pdfHomeApp");
        console.log("📊 TableWrapper:", window.pdfHomeApp.tableWrapper);
    } else {
        console.log("❌ 未找到 pdfHomeApp");
    }

} else {
    console.log("❌ 未找到表格容器 #pdf-table-container");
}

// 6. 检查是否有其他可能的表格元素
console.log("🔍 搜索其他可能的表格元素...");
const allTabulators = document.querySelectorAll('.tabulator');
console.log("📊 页面中所有Tabulator元素:", allTabulators.length);

allTabulators.forEach((tab, index) => {
    console.log(`📊 Tabulator ${index + 1}:`, {
        element: tab,
        parent: tab.parentElement?.id || tab.parentElement?.className,
        rows: tab.querySelectorAll('.tabulator-row').length
    });
});

console.log("🔍 表格调试诊断完成");
console.log("💡 如果找到了表格行，请尝试双击第一行");

// 7. 提供手动测试函数
window.testTableEvents = function() {
    console.log("🧪 手动测试表格事件...");
    const firstRow = document.querySelector('.tabulator-row');
    if (firstRow) {
        console.log("📋 模拟双击第一行...");
        const event = new MouseEvent('dblclick', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        firstRow.dispatchEvent(event);
        console.log("✅ 双击事件已发送");
    } else {
        console.log("❌ 未找到表格行");
    }
};

console.log("💡 你也可以运行 testTableEvents() 来手动触发双击事件");