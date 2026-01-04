# 前端架构迁移指南：从 EventBus 到 ObservableState

本文档定义了从“基于事件的面条代码”迁移到“基于可观察状态的模块化架构”的详细路径。

## 1. 核心理念变更

| 维度 | 旧模式 (Legacy EventBus) | 新模式 (ObservableState) |
| :--- | :--- | :--- |
| **通讯方式** | `EventBus.emit('EVENT_NAME', data)` | `manager.method(data)` (调用) <br> `store.subscribe(...)` (响应) |
| **数据源** | 分散在各个组件实例、DOM 属性中 | 收敛在 `Manager.store` 中 (Single Source of Truth) |
| **依赖关系** | 隐式依赖 (字符串耦合) | 显式依赖 (构造函数注入 Manager) |
| **控制流** | 离散、难以追踪 (Global Search) | 线性、IDE 可跳转 (Go to Definition) |

## 2. 新架构标准组件

所有的业务模块（Feature）应遵循 `Manager + Store + UI` 的分层结构。

### 2.1 Store (状态层)
使用 `src/frontend/common/utils/observable.js`。
*   **职责**：仅保存纯数据（JSON-serializable 推荐）。
*   **原则**：禁止存放 DOM 节点、定时器 ID、复杂的类实例。

### 2.2 Manager (业务逻辑层)
*   **职责**：持有 Store，暴露修改状态的方法（Actions），处理异步逻辑（API 调用）。
*   **原则**：UI 组件**严禁**直接修改 Store，必须通过 Manager 的方法。

### 2.3 UI (视图层)
*   **职责**：初始化时订阅 Store，根据状态渲染 DOM。
*   **原则**：UI 应该是“哑”的，只负责显示和转发用户操作给 Manager。

---

## 3. 迁移步骤 (Step-by-Step)

### 阶段一：试点 (Pilot)
**目标**：在非核心或独立性强的新功能中验证模式。

1.  **创建目录结构**：
    ```text
    src/frontend/features/[feature-name]/
    ├── index.js          # 入口，组装 Manager 和 UI
    ├── [feature].manager.js # 业务逻辑 + Store 定义
    └── [feature].ui.js      # 视图渲染
    ```
2.  **编写 Manager**：
    *   初始化 `this.store = new ObservableState({...})`。
    *   实现 `doSomething()` 方法，在其中调用 `this.store.set(...)`。
3.  **编写 UI**：
    *   构造函数接收 `manager`。
    *   `init()` 中调用 `manager.store.subscribe(selector, renderFn)`。
4.  **禁止事项**：
    *   禁止在该 Feature 内部定义新的 EventBus 事件。

### 阶段二：互操作 (Interop / Adapter Pattern)
**目标**：让新模块能与旧系统共存，充当“防腐层”。

场景：旧系统发出 `PDF_LOADED` 事件，新模块需要响应。

*   **错误做法**：在 UI 或 Manager 深处直接 `EventBus.on('PDF_LOADED', ...)`。
*   **正确做法**：在 Feature 的入口（Composition Root）进行桥接。

```javascript
// src/frontend/features/search/index.js
import { eventBus } from '...';
import { SearchManager } from './search.manager.js';

export function initSearchFeature() {
    const manager = new SearchManager();
    const ui = new SearchUI(manager);

    // 【防腐层】将外部事件转化为内部状态变更
    // 只有这里允许接触 EventBus，内部逻辑完全不知情
    eventBus.on('PDF_LOADED', (data) => {
        manager.resetContext(data.pdfId);
    });

    ui.mount(document.getElementById('search-root'));
}
```

### 阶段三：渐进式重构 (Strangler Fig Pattern)
**目标**：逐步吞噬旧逻辑，而不是一次性重写。

1.  **识别痛点**：找到一个 EventBus 依赖最复杂、Bug 最多的模块（如标注管理）。
2.  **影子状态 (Shadow State)**：
    *   创建一个新的 Manager，开始在其 Store 中“镜像”旧系统的状态。
    *   监听旧事件，同步更新 Store。
3.  **切换读取**：
    *   修改 UI 组件，从读取 DOM/私有属性改为读取 Manager.store。
4.  **切换写入**：
    *   将 UI 的交互操作改为调用 Manager 方法。
    *   Manager 方法更新 Store 后，**暂时**还需要 emit 旧事件以兼容未迁移的模块。
    *   *注释：`// TODO: Remove legacy event emission after full migration`*
5.  **清理**：
    *   当所有消费者都迁移后，删除 EventBus emit 代码。

---

## 4. 最佳实践与规范

### 4.1 状态更新
*   **原子化**：尽量一次 `set` 完成相关状态变更，减少渲染次数。
*   **不可变**：虽然 `ObservableState` 支持浅合并，但建议习惯性使用 spread operator `...` 保证引用变化，方便后续可能的 React 迁移。

### 4.2 订阅性能
*   **按需订阅**：尽量使用 `subscribe(state => state.specificField, callback)` 而不是监听整个 State。
*   **防止内存泄漏**：`subscribe` 返回的 `unsubscribe` 函数必须在组件销毁（`destroy`）时调用。

```javascript
class MyComponent {
    mount() {
        this.unsub = store.subscribe(...)
    }
    destroy() {
        this.unsub(); // 必须调用
    }
}
```

### 4.3 竞态处理 (Race Conditions)
在 Manager 中处理异步（如搜索）时，需防止旧请求覆盖新请求。

```javascript
class SearchManager {
    async search(query) {
        // 生成请求 ID
        const requestId = Date.now();
        this.currentRequestId = requestId;

        this.store.set({ loading: true });

        const result = await api.search(query);

        // 只有当请求 ID 匹配时才更新结果（丢弃过时响应）
        if (this.currentRequestId === requestId) {
            this.store.set({ loading: false, data: result });
        }
    }
}
```

## 5. 验收标准
1.  **无隐式依赖**：新模块不应 import `event-bus.js`（除了入口文件的 adapter）。
2.  **可测试性**：Manager 可以在没有 DOM 环境下独立通过单元测试。
3.  **调试性**：可以通过 `store.get()` 在控制台直接查看当前业务状态快照。
