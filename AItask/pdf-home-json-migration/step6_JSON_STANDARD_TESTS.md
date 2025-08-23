# JSON标准格式测试文档

## 测试目标
验证新的JSON通信标准格式在PDF主页中的正确实现，包括向后兼容性。

## 测试环境
- 测试文件：`src/frontend/pdf-home/index.js`
- 测试方式：浏览器控制台测试 + WebSocket模拟测试

## 测试用例

### 1. 消息格式验证测试

#### 1.1 标准请求格式测试
```javascript
// 测试用例：验证标准请求格式
const testRequest = buildStandardRequest('get_pdf_list', { filter: 'recent' });
console.log('标准请求格式:', testRequest);

// 验证格式
assert(testRequest.type === 'get_pdf_list', '消息类型正确');
assert(typeof testRequest.timestamp === 'number', '时间戳为数字');
assert(typeof testRequest.request_id === 'string', 'request_id为字符串');
assert(testRequest.request_id.length === 36, 'request_id格式正确');
assert(typeof testRequest.data === 'object', '数据为对象');
```

#### 1.2 消息格式验证测试
```javascript
// 测试用例：验证消息格式验证函数
const validMessage = {
    type: 'get_pdf_list',
    timestamp: 1690000000.123,
    request_id: '123e4567-e89b-12d3-a456-426614174000',
    data: {}
};

const invalidMessage = {
    type: 'get_pdf_list',
    data: {}
};

console.log('有效消息验证:', validateMessageFormat(validMessage)); // true
console.log('无效消息验证:', validateMessageFormat(invalidMessage)); // false
```

### 2. 版本检测测试

#### 2.1 新版本消息检测
```javascript
const newFormatMessage = {
    type: 'get_pdf_list',
    timestamp: 1690000000.123,
    request_id: '123e4567-e89b-12d3-a456-426614174000',
    data: {}
};

console.log('新版本检测:', detectMessageVersion(newFormatMessage)); // 'new'
```

#### 2.2 旧版本消息检测
```javascript
const oldFormatMessage = {
    type: 'pdf_list',
    files: []
};

console.log('旧版本检测:', detectMessageVersion(oldFormatMessage)); // 'old'
```

#### 2.3 无效消息检测
```javascript
const invalidMessage = {
    message: 'hello'
};

console.log('无效消息检测:', detectMessageVersion(invalidMessage)); // 'invalid'
```

### 3. WebSocket集成测试

#### 3.1 新格式消息发送测试
```javascript
// 测试发送新格式消息
const success = WebSocketManager.send('get_pdf_list', {}, { useNewFormat: true });
console.log('新格式发送结果:', success);
```

#### 3.2 旧格式消息发送测试（向后兼容）
```javascript
// 测试发送旧格式消息
const success = WebSocketManager.send('get_pdf_list', {}, { useNewFormat: false });
console.log('旧格式发送结果:', success);
```

### 4. 错误处理测试

#### 4.1 标准错误处理测试
```javascript
// 模拟标准错误响应
const mockError = {
    request_id: '123e4567-e89b-12d3-a456-426614174000',
    message: '文件不存在',
    code: 404,
    data: { filename: 'test.pdf' }
};

ErrorHandler.handleStandardError(mockError);
```

#### 4.2 旧格式错误处理测试
```javascript
// 模拟旧格式错误
const mockLegacyError = {
    message: '文件不存在',
    filename: 'test.pdf'
};

ErrorHandler.handleLegacyError(mockLegacyError);
```

### 5. PDF管理器功能测试

#### 5.1 加载PDF列表测试
```javascript
// 测试加载PDF列表
PDFManager.loadPDFList();
```

#### 5.2 添加PDF测试
```javascript
// 测试添加PDF
PDFManager.addPDF();
```

#### 5.3 删除PDF测试
```javascript
// 测试删除PDF
PDFManager.removePDF('test.pdf');
```

### 6. 集成测试

#### 6.1 完整流程测试
```javascript
// 模拟完整的PDF管理流程
async function testFullWorkflow() {
    console.log('=== 开始完整流程测试 ===');
    
    // 1. 加载PDF列表
    console.log('1. 加载PDF列表...');
    PDFManager.loadPDFList();
    
    // 2. 等待响应
    await new Promise(resolve => {
        EventBus.once('pdf:list:updated', (data) => {
            console.log('2. PDF列表加载完成:', data);
            resolve();
        });
    });
    
    // 3. 添加PDF
    console.log('3. 添加PDF...');
    PDFManager.addPDF();
    
    // 4. 等待添加完成
    await new Promise(resolve => {
        EventBus.once('pdf:add:success', (data) => {
            console.log('4. PDF添加完成:', data);
            resolve();
        });
    });
    
    console.log('=== 完整流程测试完成 ===');
}

testFullWorkflow();
```

## 测试验证清单

### ✅ 基础功能验证
- [ ] UUID生成函数正常工作
- [ ] 时间戳生成正确
- [ ] 消息格式验证函数准确
- [ ] 版本检测函数准确

### ✅ 消息格式验证
- [ ] 标准请求格式包含所有必需字段
- [ ] 标准响应格式包含所有必需字段
- [ ] 消息验证函数正确处理各种情况

### ✅ WebSocket功能验证
- [ ] 新格式消息发送成功
- [ ] 旧格式消息发送成功（向后兼容）
- [ ] 消息接收和解析正确
- [ ] 错误处理机制工作正常

### ✅ PDF管理器功能验证
- [ ] 加载PDF列表功能正常
- [ ] 添加PDF功能正常
- [ ] 删除PDF功能正常
- [ ] 批量操作功能正常

### ✅ 错误处理验证
- [ ] 标准错误格式处理正确
- [ ] 旧格式错误兼容处理正确
- [ ] 网络错误处理正确
- [ ] 用户友好的错误消息显示

## 浏览器测试步骤

1. 打开PDF主页：`src/frontend/pdf-home/index.html`
2. 打开浏览器开发者工具（F12）
3. 切换到Console标签
4. 执行上述测试代码
5. 验证所有测试结果

## 测试成功标准

所有测试用例必须返回预期结果，没有错误抛出。特别是：
- 消息格式符合JSON标准规范
- 向后兼容性得到保证
- 错误处理机制工作正常
- 用户界面响应正常