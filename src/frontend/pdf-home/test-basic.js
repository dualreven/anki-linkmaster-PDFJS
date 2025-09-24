// 最基本的测试文件
console.log('=== Basic Test Started ===');

// 测试基础导入
try {
  console.log('Testing TableUtils import...');
  import('./table-utils.js')
    .then(module => {
      console.log('TableUtils imported successfully:', module);

      // 测试TableWrapperCore导入
      console.log('Testing TableWrapperCore import...');
      return import('./table-wrapper-core.js');
    })
    .then(module => {
      console.log('TableWrapperCore imported successfully:', module);

      // 测试TableWrapper导入
      console.log('Testing TableWrapper import...');
      return import('./table-wrapper.js');
    })
    .then(module => {
      console.log('TableWrapper imported successfully:', module);
      console.log('=== All imports successful ===');
    })
    .catch(error => {
      console.error('Import failed:', error);
    });
} catch (error) {
  console.error('Test setup failed:', error);
}