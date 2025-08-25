**规范名称**: 前端测试清理规范
**规范描述**: 定义前端测试后的清理工作规范，要求删除测试添加的DOM元素、移除事件监听和清理全局变量，确保测试无副作用。
**当前版本**: 1.0
**所属范畴**: 测试规范
**适用范围**: 前端测试活动

**详细内容**:
- 必须删除测试添加的DOM元素
- 必须移除测试注册的事件监听器
- 必须清理测试产生的全局变量
- 清理工作必须在测试完成后立即执行

**正向例子**:
```javascript
// 测试清理函数示例
export function cleanupTest() {
    // 删除测试添加的DOM元素
    const testElements = document.querySelectorAll('.test-element');
    testElements.forEach(el => el.remove());
    
    // 移除事件监听
    window.eventBus.off('test:event');
    
    // 清理全局变量
    delete window.testData;
}
```

**反向例子**:
```javascript
// 错误做法：未进行清理，导致副作用
// 测试后遗留DOM元素
// 事件监听未移除，可能干扰后续操作
// 全局变量未清理，可能造成内存泄漏