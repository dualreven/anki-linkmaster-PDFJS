**规范名称**: PDF.js集成规范
**规范描述**: 定义PDF.js的集成规范，包括推荐的PDF.js版本、worker线程配置、大文件处理策略、错误降级机制以及与QtWebEngine的兼容性。
**当前版本**: 1.0
**所属范畴**: 前端集成规范
**适用范围**: PDF查看器PDF.js集成

**详细内容**:
- PDF.js版本：使用稳定版本，推荐v3.4.120或更高版本
- Worker配置：正确配置PDF.js worker线程，支持跨域资源加载
- 大文件处理：实现逐页懒加载和缩略图策略，优化内存使用
- 错误降级：在内存受限时提供优雅降级或用户提示
- QtWebEngine兼容性：确保在Qt 5.15和Qt6.5环境下正常工作

**验证方法**:
- 测试在Qt 5.15和Qt6.5环境下打开100MB PDF文件不崩溃且在5秒内渲染首屏
- 验证逐页懒加载和缩略图策略的正确实现
- 检查内存受限时的降级机制和用户提示
- 确认与QtWebEngine无已知兼容性问题
- 运行性能测试验证大文件处理能力

**正向例子**:
```typescript
// 正确的PDF.js配置
const pdfjsLib = await import('pdfjs-dist/build/pdf');
pdfjsLib.GlobalWorkerOptions.workerSrc = 
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// 大文件懒加载
const loadPage = async (pageNumber) => {
  const page = await pdfDocument.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1.5 });
  // 仅渲染当前可见页面
};

// 内存受限处理
if (memoryUsage > threshold) {
  showUserMessage('内存不足，正在优化显示...');
  reduceRenderingQuality();
}
```

**反向例子**:
```typescript
// 错误的worker配置
// 缺少worker配置或使用错误版本

// 一次性加载所有页面
const loadAllPages = async () => {
  for (let i = 1; i <= totalPages; i++) {
    await pdfDocument.getPage(i); // 内存爆炸
  }
};

// 无错误处理
try {
  await loadLargePDF();
} catch (error) {
  // 无降级机制或用户提示
}