/**
 * PDF Table Module - Example Usage
 * @module PDFTableExample
 */

// Import the PDF Table Module
import PDFTable from './common/pdf-table/index.js';

// Example data
const sampleData = [
    {
        id: '001',
        filename: '机器学习基础教程.pdf',
        filepath: 'C:\\data\\pdfs\\machine_learning.pdf',
        title: '机器学习基础教程 - 从入门到实践',
        author: '张三',
        subject: '人工智能',
        keywords: '机器学习, AI, 算法',
        size: 2457600,
        created_time: 1735706550.674962,
        modified_time: 1735210049.2368014,
        page_count: 250,
        tags: ['学习', 'AI', '技术'],
        notes: '很好的入门教程',
        import_date: '2025-01-15T08:30:00.000Z',
        access_date: '2025-01-20T14:45:00.000Z',
        importance: 'high',
        unread_pages: 45,
        total_pages: 250,
        annotations_count: 12,
        cards_count: 28
    },
    {
        id: '002',
        filename: '数据结构与算法.pdf',
        filepath: 'C:\\data\\pdfs\\data_structures.pdf',
        title: '数据结构与算法 - 经典教材',
        author: '李四',
        subject: '计算机科学',
        keywords: '数据结构, 算法, 编程',
        size: 3789200,
        created_time: 1735706625.1306179,
        modified_time: 1735055630.628513,
        page_count: 420,
        tags: ['编程', '算法', '经典'],
        notes: '算法学习的必备书籍',
        import_date: '2025-01-10T09:15:00.000Z',
        access_date: '2025-01-21T16:20:00.000Z',
        importance: 'high',
        unread_pages: 120,
        total_pages: 420,
        annotations_count: 25,
        cards_count: 56
    },
    {
        id: '003',
        filename: '深度学习实战.pdf',
        filepath: 'C:\\data\\pdfs\\deep_learning.pdf',
        title: '深度学习实战 - 实战项目详解',
        author: '王五',
        subject: '深度学习',
        keywords: '深度学习, 神经网络, 实战',
        size: 5123400,
        created_time: 1735706700.1306179,
        modified_time: 1735055700.628513,
        page_count: 350,
        tags: ['深度学习', '神经网络', '实战'],
        notes: '包含很多实战案例',
        import_date: '2025-01-08T11:30:00.000Z',
        access_date: '2025-01-19T10:15:00.000Z',
        importance: 'medium',
        unread_pages: 80,
        total_pages: 350,
        annotations_count: 18,
        cards_count: 42
    },
    {
        id: '004',
        filename: 'Python编程指南.pdf',
        filepath: 'C:\\data\\pdfs\\python_guide.pdf',
        title: 'Python编程指南 - 从入门到精通',
        author: '赵六',
        subject: '编程语言',
        keywords: 'Python, 编程, 入门',
        size: 1867200,
        created_time: 1735706800.1306179,
        modified_time: 1735055800.628513,
        page_count: 180,
        tags: ['Python', '编程', '入门'],
        notes: '适合初学者的Python教程',
        import_date: '2025-01-12T14:45:00.000Z',
        access_date: '2025-01-18T09:30:00.000Z',
        importance: 'low',
        unread_pages: 30,
        total_pages: 180,
        annotations_count: 8,
        cards_count: 15
    },
    {
        id: '005',
        filename: 'Web前端开发.pdf',
        filepath: 'C:\\data\\pdfs\\web_frontend.pdf',
        title: 'Web前端开发 - 现代技术栈',
        author: '孙七',
        subject: '前端开发',
        keywords: '前端, JavaScript, HTML, CSS',
        size: 2981500,
        created_time: 1735706900.1306179,
        modified_time: 1735055900.628513,
        page_count: 320,
        tags: ['前端', 'JavaScript', 'Web开发'],
        notes: '涵盖最新的前端技术',
        import_date: '2025-01-05T16:20:00.000Z',
        access_date: '2025-01-22T13:10:00.000Z',
        importance: 'medium',
        unread_pages: 95,
        total_pages: 320,
        annotations_count: 22,
        cards_count: 38
    }
];

// Example 1: Basic Usage
function basicUsageExample() {
    console.log('=== Basic Usage Example ===');
    
    // Create table instance
    const table = new PDFTable('#pdf-table-container', {
        data: sampleData,
        pageSize: 10,
        sortable: true,
        filterable: true,
        selectable: true,
        pagination: true,
        theme: 'default'
    });
    
    // Initialize table
    table.initialize().then(() => {
        console.log('Table initialized successfully');
    }).catch(error => {
        console.error('Failed to initialize table:', error);
    });
    
    // Listen for events
    table.events.on('selection-changed', (selectedRows) => {
        console.log('Selected rows:', selectedRows);
    });
    
    table.events.on('sort-changed', (sortInfo) => {
        console.log('Sort changed:', sortInfo);
    });
    
    return table;
}

// Example 2: Advanced Configuration
function advancedConfigurationExample() {
    console.log('=== Advanced Configuration Example ===');
    
    // Custom configuration
    const config = {
        columns: [
            { id: 'select', title: '选择', field: 'select', width: 50, align: 'center' },
            { id: 'filename', title: '文件名', field: 'filename', width: 200, sortable: true },
            { id: 'title', title: '标题', field: 'title', width: 250, sortable: true },
            { id: 'size', title: '大小', field: 'size', width: 100, align: 'right', sortable: true },
            { id: 'import_date', title: '导入日期', field: 'import_date', width: 120, sortable: true },
            { id: 'importance', title: '重要性', field: 'importance', width: 100, sortable: true },
            { id: 'unread_pages', title: '未读页数', field: 'unread_pages', width: 100, align: 'right' },
            { id: 'actions', title: '操作', field: 'actions', width: 120, align: 'center' }
        ],
        data: sampleData,
        pageSize: 5,
        sortable: true,
        filterable: true,
        selectable: true,
        pagination: true,
        theme: 'modern',
        multiSelect: true,
        rowClickSelect: true,
        exportEnabled: true,
        searchEnabled: true
    };
    
    const table = new PDFTable('#pdf-table-advanced', config);
    
    // Initialize with event handlers
    table.initialize().then(() => {
        console.log('Advanced table initialized');
        
        // Example: Add a filter
        table.filtering.addTextFilter('importance', 'equals', 'high');
        
        // Example: Set initial sort
        table.sorting.setSort('import_date', 'desc');
        
    }).catch(error => {
        console.error('Failed to initialize advanced table:', error);
    });
    
    // Advanced event handling
    table.events.on('row-click', ({ rowData, event }) => {
        console.log('Row clicked:', rowData.title);
    });
    
    table.events.on('button-click', ({ action, rowId, event }) => {
        console.log(`Button clicked: ${action} on row ${rowId}`);
        
        if (action === 'open') {
            // Handle open action
            const row = table.getData().find(r => r.id === rowId);
            if (row) {
                console.log('Opening file:', row.filepath);
            }
        } else if (action === 'delete') {
            // Handle delete action
            if (confirm('确定要删除这个文件吗？')) {
                table.removeRow(rowId);
            }
        }
    });
    
    return table;
}

// Example 3: Dynamic Data Management
function dynamicDataExample() {
    console.log('=== Dynamic Data Management Example ===');
    
    const table = new PDFTable('#pdf-table-dynamic', {
        data: [],
        pageSize: 10,
        sortable: true,
        selectable: true,
        pagination: true
    });
    
    // Initialize table
    table.initialize().then(() => {
        console.log('Dynamic table initialized');
        
        // Load data after initialization
        setTimeout(() => {
            table.loadData(sampleData);
            console.log('Data loaded');
        }, 1000);
        
        // Example: Add new row
        setTimeout(() => {
            const newRow = {
                id: '006',
                filename: '新添加的文档.pdf',
                filepath: 'C:\\data\\pdfs\\new_document.pdf',
                title: '新添加的文档',
                size: 1024000,
                import_date: new Date().toISOString(),
                importance: 'medium',
                unread_pages: 0,
                total_pages: 100,
                annotations_count: 0,
                cards_count: 0
            };
            
            table.addRow(newRow);
            console.log('New row added');
        }, 2000);
        
        // Example: Update existing row
        setTimeout(() => {
            table.updateRow('001', { 
                importance: 'high',
                unread_pages: 50 
            });
            console.log('Row updated');
        }, 3000);
        
        // Example: Remove row
        setTimeout(() => {
            table.removeRow('004');
            console.log('Row removed');
        }, 4000);
        
    }).catch(error => {
        console.error('Failed to initialize dynamic table:', error);
    });
    
    return table;
}

// Example 4: Custom Renderers and Formatters
function customRenderersExample() {
    console.log('=== Custom Renderers Example ===');
    
    const config = {
        columns: [
            { id: 'filename', title: '文件名', field: 'filename', width: 200 },
            { 
                id: 'size', 
                title: '大小', 
                field: 'size', 
                width: 100, 
                align: 'right',
                formatter: (value) => {
                    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                    const i = Math.floor(Math.log(value) / Math.log(1024));
                    return parseFloat((value / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
                }
            },
            { 
                id: 'importance', 
                title: '重要性', 
                field: 'importance', 
                width: 120,
                renderer: (value, row, column) => {
                    const icons = {
                        high: '🔥',
                        medium: '⭐',
                        low: '📝'
                    };
                    return `<span class="custom-importance custom-importance--${value}">
                        ${icons[value]} ${value}
                    </span>`;
                }
            },
            { 
                id: 'progress', 
                title: '阅读进度', 
                field: 'unread_pages', 
                width: 150,
                renderer: (value, row, column) => {
                    const total = row.total_pages;
                    const read = total - value;
                    const percentage = total > 0 ? Math.round((read / total) * 100) : 0;
                    
                    return `
                        <div class="progress-container">
                            <div class="progress-bar" style="width: ${percentage}%"></div>
                            <span class="progress-text">${percentage}%</span>
                        </div>
                    `;
                }
            },
            { 
                id: 'actions', 
                title: '操作', 
                field: 'actions', 
                width: 150,
                renderer: (value, row, column) => {
                    return `
                        <div class="custom-actions">
                            <button class="btn btn-primary" onclick="viewFile('${row.id}')">查看</button>
                            <button class="btn btn-secondary" onclick="editFile('${row.id}')">编辑</button>
                            <button class="btn btn-danger" onclick="deleteFile('${row.id}')">删除</button>
                        </div>
                    `;
                }
            }
        ],
        data: sampleData,
        pageSize: 10,
        theme: 'modern'
    };
    
    const table = new PDFTable('#pdf-table-custom', config);
    
    table.initialize().then(() => {
        console.log('Custom renderers table initialized');
    }).catch(error => {
        console.error('Failed to initialize custom renderers table:', error);
    });
    
    return table;
}

// Example 5: Real-time Updates
function realTimeUpdatesExample() {
    console.log('=== Real-time Updates Example ===');
    
    const table = new PDFTable('#pdf-table-realtime', {
        data: [...sampleData],
        pageSize: 10,
        sortable: true,
        selectable: true,
        pagination: true
    });
    
    // Initialize table
    table.initialize().then(() => {
        console.log('Real-time table initialized');
        
        // Simulate real-time updates
        let updateCounter = 0;
        const updateInterval = setInterval(() => {
            updateCounter++;
            
            // Random update
            const randomIndex = Math.floor(Math.random() * sampleData.length);
            const randomRow = sampleData[randomIndex];
            
            // Update access date
            table.updateRow(randomRow.id, {
                access_date: new Date().toISOString()
            });
            
            // Occasionally update other fields
            if (Math.random() > 0.7) {
                const updates = {};
                
                if (Math.random() > 0.5 && randomRow.unread_pages > 0) {
                    updates.unread_pages = randomRow.unread_pages - 1;
                }
                
                if (Math.random() > 0.8) {
                    updates.annotations_count = (randomRow.annotations_count || 0) + 1;
                }
                
                if (Object.keys(updates).length > 0) {
                    table.updateRow(randomRow.id, updates);
                }
            }
            
            console.log(`Update ${updateCounter}: Updated row ${randomRow.id}`);
            
            // Stop after 10 updates
            if (updateCounter >= 10) {
                clearInterval(updateInterval);
                console.log('Real-time updates completed');
            }
            
        }, 2000);
        
    }).catch(error => {
        console.error('Failed to initialize real-time table:', error);
    });
    
    return table;
}

// Example 6: Export and Import
function exportImportExample() {
    console.log('=== Export and Import Example ===');
    
    const table = new PDFTable('#pdf-table-export', {
        data: sampleData,
        pageSize: 10,
        exportEnabled: true,
        theme: 'default'
    });
    
    table.initialize().then(() => {
        console.log('Export table initialized');
        
        // Export to CSV
        setTimeout(() => {
            table.exportToCSV('pdf-data.csv');
            console.log('Data exported to CSV');
        }, 1000);
        
        // Export to JSON
        setTimeout(() => {
            const data = table.getData();
            const jsonData = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'pdf-data.json';
            a.click();
            URL.revokeObjectURL(url);
            console.log('Data exported to JSON');
        }, 2000);
        
    }).catch(error => {
        console.error('Failed to initialize export table:', error);
    });
    
    return table;
}

// Utility functions for examples
function viewFile(rowId) {
    console.log('Viewing file:', rowId);
    alert(`查看文件: ${rowId}`);
}

function editFile(rowId) {
    console.log('Editing file:', rowId);
    alert(`编辑文件: ${rowId}`);
}

function deleteFile(rowId) {
    console.log('Deleting file:', rowId);
    if (confirm('确定要删除这个文件吗？')) {
        alert(`删除文件: ${rowId}`);
    }
}

// Initialize examples when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing PDF Table examples...');
    
    // Run examples
    const basicTable = basicUsageExample();
    const advancedTable = advancedConfigurationExample();
    const dynamicTable = dynamicDataExample();
    const customTable = customRenderersExample();
    const realtimeTable = realTimeUpdatesExample();
    const exportTable = exportImportExample();
    
    // Store references for debugging
    window.pdfTableExamples = {
        basic: basicTable,
        advanced: advancedTable,
        dynamic: dynamicTable,
        custom: customTable,
        realtime: realtimeTable,
        export: exportTable
    };
    
    console.log('All examples initialized');
});

// Export example functions
export {
    basicUsageExample,
    advancedConfigurationExample,
    dynamicDataExample,
    customRenderersExample,
    realTimeUpdatesExample,
    exportImportExample
};