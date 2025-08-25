**规范名称**: 测试方法规范
**规范描述**: 定义测试的三种主要方法：单元测试、模块测试和端到端测试，确保测试方法选择恰当。
**当前版本**: 1.0
**所属范畴**: 测试规范
**适用范围**: 所有AI进行的测试活动

**详细内容**:
- **单元测试**: 测试单个函数或类的正确性
- **模块测试**: 测试完整模块的功能
- **端到端测试**: 测试完整业务流程

**正向例子**:
```javascript
// 单元测试：测试单个函数
function testAddFunction() {
  const result = add(2, 3);
  assert(result === 5);
}

// 模块测试：测试用户模块
function testUserModule() {
  const user = new User();
  user.create('test@example.com');
  assert(user.exists());
}

// 端到端测试：测试完整登录流程
function testLoginFlow() {
  navigateToLogin();
  enterCredentials();
  submitForm();
  assert(isLoggedIn());
}
```

**反向例子**:
```javascript
// 错误做法：测试方法不明确
// 混合了单元测试和端到端测试，难以维护
// 没有明确的方法分类