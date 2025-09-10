// Tabulator 默认导入测试
// 测试默认导入方案是否可行

/**
 * 测试 Tabulator 的默认导入
 * 这个测试验证 `import Tabulator from 'tabulator-tables'` 是否能正常工作
 */
function testDefaultImport() {
  try {
    // 尝试默认导入
    const Tabulator = require('tabulator-tables');
    
    // 验证导入是否成功
    if (typeof Tabulator === 'function') {
      console.log('✅ 默认导入成功：Tabulator 是一个函数/构造函数');
      
      // 尝试创建一个简单的测试实例
      const container = document.createElement('div');
      container.style.width = '200px';
      container.style.height = '100px';
      document.body.appendChild(container);
      
      const table = new Tabulator(container, {
        height: '100%',
        layout: 'fitColumns',
        columns: [{ title: 'Test', field: 'test' }],
        data: [{ test: 'Default Import' }]
      });
      
      // 验证实例是否创建成功
      if (table && typeof table.setData === 'function') {
        console.log('✅ Tabulator 实例创建成功，基本方法可用');
        
        // 清理测试元素
        setTimeout(() => {
          try {
            table.destroy();
            document.body.removeChild(container);
            console.log('✅ 测试清理完成');
          } catch (e) {
            console.warn('⚠️ 清理测试元素时出错:', e);
          }
        }, 100);
        
        return true;
      } else {
        console.error('❌ Tabulator 实例创建失败或基本方法不可用');
        return false;
      }
    } else {
      console.error('❌ 默认导入失败：Tabulator 不是一个函数/构造函数');
      console.error('导入的类型:', typeof Tabulator);
      console.error('导入的值:', Tabulator);
      return false;
    }
  } catch (error) {
    console.error('❌ 默认导入测试失败:', error);
    return false;
  }
}

// 如果在浏览器环境中，自动运行测试
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  console.log('🧪 开始测试 Tabulator 默认导入...');
  
  // 等待 DOM 加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const result = testDefaultImport();
      console.log('🧪 测试结果:', result ? '通过' : '失败');
    });
  } else {
    const result = testDefaultImport();
    console.log('🧪 测试结果:', result ? '通过' : '失败');
  }
}

// 导出测试函数供其他模块使用
module.exports = { testDefaultImport };