# 窗口控制组件 (WindowControlsComponent)

提供跨模块复用的自定义窗口控制按钮组件，支持最小化、最大化和关闭功能。

## 📦 功能特性

- ✅ **三个窗口控制按钮**：最小化、最大化/还原、关闭
- ✅ **Windows 11 风格设计**：扁平化按钮，关闭按钮hover红色效果
- ✅ **QWebChannel 集成**：通过PyQt Bridge调用窗口方法
- ✅ **WebSocket 注销支持**：关闭前自动断开WebSocket连接
- ✅ **灵活挂载**：支持动态挂载到任意DOM元素
- ✅ **自动资源清理**：提供destroy方法清理事件和DOM

## 🚀 快速开始

### 1. 在 Feature 中使用

```javascript
import { WindowControlsComponent } from '../../../common/components/window-controls/window-controls.js';

export class MyFeature {
  #windowControls = null;

  async install(context) {
    const { container } = context;

    // 创建组件实例
    this.#windowControls = new WindowControlsComponent({
      bridgeName: 'pdfViewerBridge',  // 或 'pyqtBridge'
      wsClient: container.get('wsClient'),  // 可选
      autoLoad: true  // 自动加载CSS
    });

    // 挂载到DOM
    await this.#windowControls.mount('#toolbar');  // 或传入元素引用
  }

  async uninstall(context) {
    // 清理组件
    if (this.#windowControls) {
      this.#windowControls.destroy();
      this.#windowControls = null;
    }
  }
}
```

### 2. 在 HTML 中添加挂载点

```html
<div id="toolbar">
  <!-- 组件将挂载到这里 -->
</div>
```

### 3. 确保 PyQt Bridge 实现了必要的方法

```python
from PyQt6.QtCore import pyqtSlot

class YourBridge(QObject):
    @pyqtSlot(result=bool)
    def minimizeWindow(self) -> bool:
        """最小化窗口"""
        window = self.parent()
        if window and hasattr(window, 'showMinimized'):
            window.showMinimized()
            return True
        return False

    @pyqtSlot(result=bool)
    def maximizeWindow(self) -> bool:
        """最大化/还原窗口（切换）"""
        window = self.parent()
        if window and hasattr(window, 'isMaximized'):
            if window.isMaximized():
                window.showNormal()
            else:
                window.showMaximized()
            return True
        return False

    @pyqtSlot(result=bool)
    def requestCloseWindow(self) -> bool:
        """关闭窗口"""
        window = self.parent()
        if window and hasattr(window, 'close'):
            window.close()
            return True
        return False
```

## 🔧 配置选项

### WindowControlsOptions

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `bridgeName` | `string` | ✅ | - | PyQt Bridge对象名称（如 `'pdfViewerBridge'` 或 `'pyqtBridge'`） |
| `wsClient` | `Object` | ❌ | `null` | WebSocket客户端实例（关闭时会调用 `disconnect()`） |
| `autoLoad` | `boolean` | ❌ | `true` | 是否自动加载CSS样式文件 |

## 📋 API 文档

### 方法

#### `constructor(options)`

创建组件实例。

**参数：**
- `options` (WindowControlsOptions) - 组件配置

**示例：**
```javascript
const controls = new WindowControlsComponent({
  bridgeName: 'pdfViewerBridge',
  wsClient: myWSClient
});
```

---

#### `async mount(containerOrSelector)`

挂载组件到DOM。

**参数：**
- `containerOrSelector` (HTMLElement | string) - 容器元素或CSS选择器

**返回：**
- `Promise<void>`

**示例：**
```javascript
await controls.mount('#toolbar');           // 使用选择器
await controls.mount(toolbarElement);       // 使用元素引用
```

---

#### `destroy()`

销毁组件，清理事件监听器和DOM。

**示例：**
```javascript
controls.destroy();
```

---

### 属性

#### `mounted` (只读)

检查组件是否已挂载。

**类型：** `boolean`

**示例：**
```javascript
if (controls.mounted) {
  console.log('Component is mounted');
}
```

## 🎨 样式定制

### 全局CSS变量（可选）

你可以通过CSS变量覆盖默认样式：

```css
:root {
  --window-control-btn-size: 32px;
  --window-control-btn-color: #666;
  --window-control-btn-hover-bg: rgba(0, 0, 0, 0.05);
  --window-close-btn-hover-bg: #e81123;
  --window-close-btn-hover-color: #fff;
}
```

### 添加窗口阴影

在根容器上添加 `.frameless-window` 类以启用阴影：

```html
<div id="app" class="frameless-window">
  <!-- 内容 -->
</div>
```

或手动添加CSS：

```css
#app {
  box-shadow: 0 0.3px 0.9px rgba(0, 0, 0, 0.108),
              0 1.6px 3.6px rgba(0, 0, 0, 0.132);
}
```

## ⚠️ 注意事项

1. **QWebChannel 依赖**：组件依赖 `window.qt.webChannelTransport`，确保在PyQt环境中使用
2. **Bridge 方法**：PyQt Bridge必须实现 `minimizeWindow()`, `maximizeWindow()`, `requestCloseWindow()` 三个方法
3. **事件顺序**：关闭时会先断开WebSocket（如果提供），再调用关闭方法
4. **单次挂载**：同一实例只能挂载一次，重复调用会记录警告
5. **资源清理**：使用完毕后必须调用 `destroy()` 清理资源

## 🐛 常见问题

### Q: 点击按钮没有反应？

**A:** 检查以下几点：
- PyQt Bridge是否正确暴露给QWebChannel
- Bridge对象名称是否与 `bridgeName` 参数一致
- Bridge是否实现了对应的方法（`minimizeWindow`, `maximizeWindow`, `requestCloseWindow`）
- 打开浏览器控制台查看错误日志

### Q: 如何禁用某个按钮？

**A:** 挂载后可以手动禁用：

```javascript
await controls.mount('#toolbar');
document.getElementById('window-minimize-btn').disabled = true;
```

### Q: 如何更改按钮样式？

**A:** 在你的CSS中覆盖样式：

```css
.window-control-btn {
  width: 40px;
  height: 40px;
}

.window-control-btn.window-close:hover {
  background-color: #ff0000;  /* 更红的颜色 */
}
```

## 📚 相关文档

- [如何添加Feature](../../../HOW-TO-ADD-FEATURE.md)
- [EventBus使用指南](../../event/EVENTBUS-USAGE-GUIDE.md)
- [Logger使用指南](../../utils/logger.js)

## 📝 示例代码

完整示例请查看：
- `src/frontend/pdf-viewer/features/window-controls/index.js`
- `src/frontend/pdf-home/features/window-controls/index.js`
