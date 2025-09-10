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
  const oldCode = `      // 验证结果
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        UI_EVENTS.ERROR.SHOW,
        expect.objectContaining({
          message: '操作失败，请稍后重试',
          type: ErrorType.SYSTEM
        })
      );`;

  const newCode = `      // 验证结果
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        UI_EVENTS.ERROR.SHOW,
        expect.objectContaining({
          message: '系统错误，请联系管理员',
          type: ErrorType.SYSTEM
        })
      );`;

  testContent = testContent.replace(oldCode, newCode);

  // 写回文件
  fs.writeFileSync(testFilePath, testContent, 'utf8');
  console.log('测试文件已更新');
} catch (error) {
  console.error('处理文件时出错:', error.message);
}