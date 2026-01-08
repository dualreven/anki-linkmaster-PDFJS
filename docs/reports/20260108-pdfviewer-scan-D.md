# PDFViewer 面条化扫描（D - outline/search/bootstrap）

**功能ID**: 20260108212200-pdfviewer-spaghetti-scan-D
**版本**: v001
**状态**: 完成

## 一键复跑命令清单
```bash
pnpm -s run lint
rg -n "eventBus\\.(on|onGlobal|once)\\(" src/frontend/pdf-viewer/features/pdf-outline src/frontend/pdf-viewer/features/pdf-search src/frontend/pdf-viewer/bootstrap -S
rg -n "addEventListener\\(|removeEventListener\\(" src/frontend/pdf-viewer/features/pdf-outline src/frontend/pdf-viewer/features/pdf-search src/frontend/pdf-viewer/bootstrap -S
rg -n "setTimeout\\(|setInterval\\(" src/frontend/pdf-viewer/features/pdf-outline src/frontend/pdf-viewer/features/pdf-search src/frontend/pdf-viewer/bootstrap -S
```

## P0/P1/P2 问题列表

### P0：高危风险 - 必须立即处理
* **`src/frontend/pdf-viewer/bootstrap/app-bootstrap-feature.js:189`**: 全局 `wheel` 和 `keydown` 事件监听器没有被移除，可能导致内存泄漏和意外的全局行为。
    * **风险**: 内存泄漏，影响整个应用的性能和稳定性。
    * **推荐修复方向**: 在 feature 的 `destroy` 或 `cleanup` 方法中移除这些监听器。

### P1：中度风险 - 建议尽快处理
* **`src/frontend/pdf-viewer/features/pdf-search/components/search-box-dom-bindings.js`**: DOM 事件监听器与业务逻辑混合在一起，难以测试和维护。
    * **风险**: UI 和业务逻辑紧密耦合，使得单独测试任一方都变得困难。
    * **推荐修复方向**: 将事件监听器（DOM 操作）与业务逻辑（`onInputHandler` 等）分离。可以创建一个 `SearchBoxDOMManager` 来处理所有 DOM 交互，并通过事件或回调与业务逻辑通信。
* **`src/frontend/pdf-viewer/features/pdf-search/index.js`**: `SearchManager` 承担了过多的职责，包括状态管理、EventBus 订阅和 UI 更新。
    * **风险**: 单个文件过大，职责不清，难以理解和修改。
    * **推荐修复方向**: 
        1.  将 EventBus 订阅逻辑提取到 `search-box-event-subscriptions.js`。
        2.  将状态管理逻辑提取到一个独立的 `SearchState` 模块。
        3.  `SearchManager` 只负责协调各个子模块。
* **`src/frontend/pdf-viewer/features/pdf-outline/components/outline-sidebar-ui.js:79`**: 订阅了全局 `WEBSOCKET_EVENTS`，这使得 UI 组件与 WebSocket 层直接耦合。
    * **风险**: UI 组件对底层数据来源有过多假设，不利于组件复用和测试。
    * **推荐修复方向**: 应该通过 `OutlineManager` 来处理 WebSocket 事件，并转换为更通用的 `OUTLINE.LOAD.SUCCESS` 等领域事件，UI 组件只订阅领域事件。

### P2：低度风险 - 可在后续迭代中处理
* **`src/frontend/pdf-viewer/features/pdf-outline/components/outline-sidebar-ui.js:153-159`**: 在组件内部直接操作 DOM 并添加事件监听器。
    * **风险**: 使得组件的渲染逻辑和行为逻辑耦合。
    * **推荐修复方向**: 考虑使用模板引擎或 UI 框架（如 React/Vue）来声明式地处理 DOM 更新和事件绑定。如果不行，至少将这些 DOM 操作封装在独立的函数中。
* **`src/frontend/pdf-viewer/features/pdf-search/utils/debounce.js`**: `setTimeout` 用于实现 `debounce`，但未在任何地方清理。
    * **风险**: 如果在使用 `debounce` 的组件销毁时，`setTimeout` 仍在等待执行，可能会导致意外的行为。
    * **推荐修复方向**: `debounce` 函数应返回一个包含 `cancel` 方法的对象，允许在组件销毁时取消待处理的 `setTimeout`。

## 面条化结构图
在 `pdf-search` 功能中，`SearchManager` 是一个典型的“上帝对象”。它通过 EventBus 订阅了来自 PDF.js 核心的事件、来自其他功能的事件以及 UI 事件。同时，它又通过 `addEventListener` 直接与 `SearchBox` 的 DOM 元素交互。`search-box-dom-bindings.js` 稍微好一点，它将 DOM 绑定逻辑集中在一起，但仍然与 `SearchManager` 紧密耦合。

在 `pdf-outline` 中，`OutlineManager` 也存在类似的问题，但程度较轻。它通过 `eventBus.onGlobal` 监听 WebSocket 消息，这是一个跨层耦合。`outline-sidebar-ui.js` 则直接监听 DOM 事件，并订阅全局事件，使得 UI 与数据来源和具体实现耦合。

`bootstrap` 层的 `app-bootstrap-feature.js` 设置了全局的事件监听器，但没有提供清理机制，这是最危险的。

总结来说，这些模块中的装配层（`index.js` / `app-bootstrap-feature.js`）承担了太多的职责，包括：
1.  **WS 消费**: 直接监听 WebSocket 事件。
2.  **状态管理**: 维护着功能内部的状态。
3.  **UI 交互**: 直接操作 DOM 或通过 `addEventListener` 监听 UI 事件。
4.  **事件桥接**: 在不同的事件总线或事件源之间转换和传递事件。

这种结构导致了高度的耦合和低内聚，使得代码难以测试、维护和扩展。

## 回归测试建议
1.  **针对 `search-box-dom-bindings.js` 的拆分**
    * **测试建议**: 创建一个针对 `SearchBoxDOMManager` 的单元测试。使用 JSDOM 来模拟 DOM 环境。
    * **测试步骤**:
        1.  初始化 `SearchBoxDOMManager`。
        2.  模拟用户点击“下一个”按钮（`#nextButton`）。
        3.  断言 `onNextHandler` 回调函数被正确调用。
        4.  模拟用户在搜索框中输入文本。
        5.  断言 `onInputHandler` 被调用，并传入正确的输入值。
        6.  测试 `cleanup` 方法，确保所有的事件监听器都被正确移除。
    * **代码示例** (`__tests__/search-box-dom-manager.test.js`):
    ```javascript
    import { SearchBoxDOMManager } from '../components/search-box-dom-manager';
    
describe('SearchBoxDOMManager', () => {
      let onNext, onInput;
    
      beforeEach(() => {
        document.body.innerHTML = `
          <input id="searchInput" />
          <button id="nextButton"></button>
        `;
        onNext = jest.fn();
        onInput = jest.fn();
        
        const manager = new SearchBoxDOMManager({ onNext, onInput });
        manager.init();
      });
    
      it('should call onNext when next button is clicked', () => {
        document.getElementById('nextButton').click();
        expect(onNext).toHaveBeenCalled();
      });
    
      it('should call onInput when text is entered', () => {
        const input = document.getElementById('searchInput');
        input.value = 'test';
        input.dispatchEvent(new Event('input'));
        expect(onInput).toHaveBeenCalledWith('test');
      });
    });
    ```

