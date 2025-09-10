/**
 * TDD测试：验证Tabulator导入和Vite构建问题修复
 * 该测试用于验证ws-client.js文件中的XML标签是否已正确移除，
 * 以及Tabulator是否能够正常导入和使用。
 */

// 测试1：验证ws-client.js文件不包含XML标签
function testWSClientFileSyntax() {
  console.log('测试1: 验证ws-client.js文件语法正确性...');
  
  try {
    // 动态导入ws-client.js模块
    import('../src/frontend/common/ws/ws-client.js')
      .then((module) => {
        console.log('✅ ws-client.js模块导入成功，语法正确');
        return true;
      })
      .catch((error) => {
        console.error('❌ ws-client.js模块导入失败:', error.message);
        return false;
      });
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message);
    return false;
  }
}

// 测试2：验证Tabulator导入
function testTabulatorImport() {
  console.log('测试2: 验证Tabulator导入...');
  
  try {
    // 动态导入tabulator-tables模块
    import('tabulator-tables')
      .then((tabulatorModule) => {
        console.log('✅ Tabulator模块导入成功');
        console.log('  - TabulatorFull可用:', typeof tabulatorModule.TabulatorFull === 'function');
        console.log('  - Tabulator可用:', typeof tabulatorModule.Tabulator === 'function');
        return true;
      })
      .catch((error) => {
        console.error('❌ Tabulator模块导入失败:', error.message);
        return false;
      });
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message);
    return false;
  }
}

// 测试3：验证TableWrapper类
function testTableWrapperClass() {
  console.log('测试3: 验证TableWrapper类...');
  
  try {
    // 动态导入TableWrapper模块
    import('../src/frontend/pdf-home/table-wrapper.js')
      .then((module) => {
        console.log('✅ TableWrapper模块导入成功');
        
        // 检查默认导出是否为类
        if (typeof module.default === 'function') {
          console.log('✅ TableWrapper类定义正确');
          
          // 尝试创建实例（需要DOM环境）
          if (typeof document !== 'undefined') {
            const testContainer = document.createElement('div');
            testContainer.style.display = 'none';
            document.body.appendChild(testContainer);
            
            try {
              const wrapper = new module.default(testContainer, {
                columns: [{ title: 'Test', field: 'test' }],
                height: '100px'
              });
              console.log('✅ TableWrapper实例创建成功');
              
              // 清理
              wrapper.destroy();
              document.body.removeChild(testContainer);
              return true;
            } catch (error) {
              console.error('❌ TableWrapper实例创建失败:', error.message);
              return false;
            }
          } else {
            console.log('⚠️  非DOM环境，跳过实例创建测试');
            return true;
          }
        } else {
          console.error('❌ TableWrapper类定义不正确');
          return false;
        }
      })
      .catch((error) => {
        console.error('❌ TableWrapper模块导入失败:', error.message);
        return false;
      });
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message);
    return false;
  }
}

// 测试4：验证Vite构建（仅在Node.js环境中运行）
function testViteBuild() {
  console.log('测试4: 验证Vite构建...');
  
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    const { exec } = require('child_process');
    
    exec('npm run build', (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Vite构建失败:', error.message);
        console.error('错误输出:', stderr);
        return false;
      } else {
        console.log('✅ Vite构建成功');
        console.log('构建输出:', stdout);
        return true;
      }
    });
  } else {
    console.log('⚠️  非Node.js环境，跳过Vite构建测试');
    return true;
  }
}

// 主测试函数
async function runAllTests() {
  console.log('开始运行Tabulator导入和Vite构建验证测试...\n');
  
  const results = [];
  
  // 运行所有测试
  results.push(await testWSClientFileSyntax());
  results.push(await testTabulatorImport());
  results.push(await testTableWrapperClass());
  results.push(await testViteBuild());
  
  // 等待异步测试完成
  setTimeout(() => {
    console.log('\n测试结果汇总:');
    console.log('================');
    console.log(`总测试数: ${results.length}`);
    console.log(`通过测试: ${results.filter(r => r).length}`);
    console.log(`失败测试: ${results.filter(r => !r).length}`);
    
    if (results.every(r => r)) {
      console.log('🎉 所有测试通过！Tabulator导入和Vite构建问题已修复。');
    } else {
      console.log('⚠️  部分测试失败，需要进一步检查。');
    }
  }, 3000); // 给异步测试足够的时间完成
}

// 如果在浏览器环境中，自动运行测试
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    runAllTests();
  });
}

// 如果在Node.js环境中，导出测试函数
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    testWSClientFileSyntax,
    testTabulatorImport,
    testTableWrapperClass,
    testViteBuild,
    runAllTests
  };
}