// 临时脚本用于更新测试文件
const fs = require('fs');
const path = require('path');

// 获取当前工作目录
const currentDir = process.cwd();
console.log('当前工作目录:', currentDir);

// 读取测试文件
const testFilePath = path.join(currentDir, 'test/frontend/common/error/error-handler.test.js');
console.log('测试文件路径:', testFilePath);

try {
  let testContent = fs.readFileSync(testFilePath, 'utf8');
  console.log('文件读取成功');

  // 替换测试代码
  const oldCode = `    it('应该为未知错误类型显示默认消息', () => {
      // 准备测试数据
      const error = new Error('未知错误');
      
      // 执行测试
      errorHandler.handleError(error, '测试上下文');
      
      // 验证结果
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        UI_EVENTS.ERROR.SHOW,
        expect.objectContaining({
          message: '操作失败，请稍后重试',
          type: ErrorType.SYSTEM
        })
      );
    });`;

  const newCode = `    it('应该为未知错误类型显示默认消息', () => {
      // 准备测试数据
      const error = new Error('未知错误');
      // 明确设置错误类型为undefined，模拟未知错误类型
      error.type = undefined;
      
      // 执行测试
      errorHandler.handleError(error, '测试上下文');
      
      // 验证结果
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        UI_EVENTS.ERROR.SHOW,
        expect.objectContaining({
          message: '操作失败，请稍后重试',
          type: ErrorType.SYSTEM
        })
      );
    });`;

  testContent = testContent.replace(oldCode, newCode);

  // 写回文件
  fs.writeFileSync(testFilePath, testContent, 'utf8');
  console.log('测试文件已更新');
} catch (error) {
  console.error('处理文件时出错:', error.message);
}