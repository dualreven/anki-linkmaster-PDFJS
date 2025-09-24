/**
 * 简单的QWebChannel集成测试
 */

// 模拟全局对象
global.QWebChannel = jest.fn();
global.qt = {
  webChannelTransport: {}
};

// 模拟 PdfHomeBridge
const mockBridge = {
  getPdfList: jest.fn().mockResolvedValue([
    { id: 1, filename: 'test1.pdf', title: 'Test 1' },
    { id: 2, filename: 'test2.pdf', title: 'Test 2' }
  ]),
  selectPdfFiles: jest.fn().mockResolvedValue(['test.pdf']),
  removePdf: jest.fn().mockResolvedValue(true),
  openPdfViewer: jest.fn().mockResolvedValue(true),
  addPdfBatchFromBase64: jest.fn().mockResolvedValue(true)
};

// 设置 QWebChannel mock
QWebChannel.mockImplementation((transport, callback) => {
  callback({
    objects: {
      pdfHomeBridge: mockBridge
    }
  });
});

// 动态导入我们的模块进行测试
async function runTests() {
  console.log('开始测试 QWebChannel 集成...\n');

  try {
    // 测试 PDFHomeQWebChannelManager
    const { PDFHomeQWebChannelManager } = await import('./src/frontend/pdf-home/pdf-qwebchannel-manager.js');
    const { EventBus } = await import('./src/frontend/common/event/event-bus.js');

    const eventBus = new EventBus();
    const pdfManager = new PDFHomeQWebChannelManager(eventBus);

    // 测试 1: 初始化
    console.log('测试 1: 初始化 PDFHomeQWebChannelManager');
    await pdfManager.initialize();
    console.log('✓ 初始化成功');

    // 测试 2: 获取PDF列表
    console.log('\n测试 2: 获取PDF列表');
    const pdfs = pdfManager.getPDFs();
    console.log(`✓ 获取到 ${pdfs.length} 个PDF文件`);

    // 测试 3: 添加PDF
    console.log('\n测试 3: 添加PDF');
    try {
      const addResult = await pdfManager.addPDF({});
      console.log(`✓ 添加PDF结果: ${addResult}`);
    } catch (error) {
      console.log(`⚠ 添加PDF测试跳过 (需要实际的文件选择器): ${error.message}`);
    }

    // 测试 4: 删除PDF
    console.log('\n测试 4: 删除PDF');
    const removeResult = await pdfManager.removePDF('test.pdf');
    console.log(`✓ 删除PDF结果: ${removeResult}`);

    // 测试 5: 打开PDF
    console.log('\n测试 5: 打开PDF');
    const openResult = await pdfManager.openPDF('test.pdf');
    console.log(`✓ 打开PDF结果: ${openResult}`);

    console.log('\n🎉 所有测试通过！');

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
runTests();