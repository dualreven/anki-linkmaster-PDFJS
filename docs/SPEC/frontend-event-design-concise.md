# 前端事件设计规范（精简版）

## 核心规则

### 1. 事件命名
**格式**：`{模块}:{动作}:{状态}`
- 模块：app | websocket | pdf | ui | error
- 动作：init | load | save | update | delete
- 状态：start | success | fail | progress

**示例**：
```js
'app:init:start'
'pdf:load:success'
'websocket:connect:fail'
```

### 2. 常量定义
**文件**：`event-constants.js`
```js
export const APP = {
  INIT: { START: 'app:init:start', COMPLETE: 'app:init:complete' }
};

export const PDF = {
  LOAD: { START: 'pdf:load:start', SUCCESS: 'pdf:load:success' }
};
```

### 3. 事件总线
**核心API**：
```js
// 订阅
const off = eventBus.on('pdf:load:success', handler);

// 发布
eventBus.emit('pdf:load:success', data);

// 清理
off(); // 单个取消
```

### 4. 错误处理
**必须try-catch**：
```js
eventBus.on('pdf:load:start', (data) => {
  try {
    // 业务逻辑
  } catch (e) {
    console.error('处理失败:', e);
    eventBus.emit('error:handle', e);
  }
});
```

### 5. 生命周期
**组件卸载时清理**：
```js
class Component {
  subscriptions = [];
  
  mount() {
    this.subscriptions.push(
      eventBus.on('pdf:load:success', this.handleLoad)
    );
  }
  
  unmount() {
    this.subscriptions.forEach(off => off());
  }
}
```

## 快速检查清单
- [ ] 事件名符合格式
- [ ] 使用常量而非硬编码
- [ ] 处理函数有try-catch
- [ ] 组件卸载时清理订阅
- [ ] 调试模式开启验证