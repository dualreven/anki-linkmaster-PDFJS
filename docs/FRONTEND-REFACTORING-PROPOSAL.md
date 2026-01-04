# 前端架构重构提案：从 EventBus 到 响应式状态管理

## 1. 背景与现状诊断 (Context & Diagnosis)

**当前环境：**
*   **运行环境：** QtWebEngine (Chromium embedded in Python application).
*   **技术栈：** 原生 JavaScript (ES Modules), EventBus, 手动 DOM 操作.
*   **约束：** 内存与性能敏感，不宜引入 React/Vue 等大型框架 Runtime。

**痛点分析 (The Problem)：**
目前项目采用极端的 **Feature-based + EventBus** 架构。虽然实现了模块解耦，但导致了严重的**逻辑碎片化（Logic Fragmentation）**，俗称“EventBus 面条代码”。
1.  **控制流断裂：** 业务逻辑被拆解为多个离散的事件监听器，无法通过 IDE 追踪调用链（Go-to-definition 失效）。
2.  **隐式依赖：** 组件间依赖关系隐藏在字符串常量中，重构和修改极其脆弱。
3.  **状态非一致性：** 数据分散在各个 UI 组件的私有属性中，缺乏单一数据源（Single Source of Truth），需手动同步。
4.  **防御性编程泛滥：** 为应对异步事件时序的不确定性，代码中充斥着过度的 `try-catch` 和空值检查。

## 2. 核心提案：轻量级可观察状态模式 (Lightweight Observable Pattern)

**设计目标：**
在**不引入任何第三方库**（Zero-Dependency）的前提下，实现现代前端框架的核心优势：**数据驱动视图（Data-Driven View）**与**单向数据流（Unidirectional Data Flow）**。

**架构变更：**
*   **Before:** UI -> EventBus -> Logic -> EventBus -> UI
*   **After:** UI -> Manager (Methods) -> Store (State) -> UI (Subscription)

## 3. 实现细节 (Implementation Details)

该方案仅需引入一个微型基建类（< 20行代码）。

### 3.1 基础设施：`ObservableState`

```javascript
// src/frontend/common/utils/observable.js

/**
 * 极简状态容器
 * 实现观察者模式，提供 Subscribe/Notify 机制
 */
export class ObservableState {
  constructor(initialState) {
    this._state = initialState;
    this._listeners = new Set();
  }

  // 获取当前快照
  get() {
    return this._state;
  }

  // 更新状态（浅合并策略）
  set(partialState) {
    const oldState = this._state;
    this._state = { ...this._state, ...partialState };
    this._notify(this._state, oldState);
  }

  // 订阅变化
  subscribe(listener) {
    this._listeners.add(listener);
    // 返回 cleanup 函数，方便在组件销毁时取消订阅
    return () => this._listeners.delete(listener);
  }

  _notify(newState, oldState) {
    for (const listener of this._listeners) {
      listener(newState, oldState);
    }
  }
}
```

### 3.2 业务逻辑层：`Manager` + `Store`

业务逻辑不再监听事件，而是持有状态并暴露方法。

```javascript
// Example: SearchManager.js
export class SearchManager {
  constructor() {
    // 单一数据源
    this.store = new ObservableState({
      isLoading: false,
      results: [],
      query: ""
    });
  }

  // 明确的业务动作
  async search(query) {
    this.store.set({ isLoading: true, query });
    try {
      const results = await api.fetch(query);
      this.store.set({ isLoading: false, results });
    } catch (e) {
      this.store.set({ isLoading: false, results: [] });
    }
  }
}
```

### 3.3 视图层：订阅模式

UI 组件不再监听 EventBus，而是订阅 Manager 的状态变化，实现自动更新。

```javascript
// Example: SearchBar.js
export class SearchBar {
  constructor(manager) {
    this.manager = manager;
  }

  render(container) {
    // ...创建 DOM...

    // 绑定交互：调用 Manager 方法
    this.input.oninput = (e) => this.manager.search(e.target.value);

    // 绑定数据：订阅状态变化
    this.unsubscribe = this.manager.store.subscribe((state, oldState) => {
      // 细粒度更新：仅当 loading 变化时更新 spinner
      if (state.isLoading !== oldState.isLoading) {
        this.spinner.style.display = state.isLoading ? 'block' : 'none';
      }
      // 仅当结果变化时渲染列表
      if (state.results !== oldState.results) {
        this.renderList(state.results);
      }
    });
  }

  destroy() {
    this.unsubscribe(); // 防止内存泄漏
  }
}
```

## 4. 方案对比 (Comparison)

| 特性 | 旧方案 (EventBus) | 新方案 (Observable State) |
| :--- | :--- | :--- |
| **数据流向** | 双向/混乱 (Ping-Pong) | 单向 (Cyclic) |
| **代码追踪** | 全局搜索字符串常量 | IDE 直接跳转 (Jump to Definition) |
| **状态持有** | 分散在 DOM 和 UI 实例中 | 集中在 Store 中 |
| **模块解耦** | 极度解耦 (甚至看不出关系) | 显式依赖 (Dependency Injection) |
| **调试难度** | 高 (无法确定事件触发顺序) | 低 (只需查看 State 快照) |
| **性能开销** | 低 | 极低 (无 Virtual DOM，直接操作 DOM) |

## 5. 落地策略 (Adoption Strategy)

为了平衡**新功能开发**与**技术债务治理**，建议采取 **"渐进式混合架构"**：

1.  **新功能 (New Features)：**
    *   **强制执行：** 所有新开发的 Feature 必须采用 `Manager + Store` 模式。
    *   **严禁：** 严禁在新模块内部定义新的 EventBus 事件。

2.  **旧功能 (Legacy Code)：**
    *   **冻结：** 只要工作正常，暂不重构。
    *   **童子军规则 (Boy Scout Rule)：** 仅当需要深度修改某个旧模块时，顺手将其重构为新模式。

3.  **互操作 (Interop)：**
    *   **防腐层 (Anti-Corruption Layer)：** 新 Manager 可以监听旧系统的全局 EventBus 事件（如 `PDF_LOADED`），将其转化为内部状态，从而隔离“脏逻辑”。

## 6. 预期收益 (Expected Outcome)
*   **可维护性提升：** 逻辑清晰度大幅提高，新人上手成本降低。
*   **Bug率下降：** 消除因状态不同步导致的 UI Bug。
*   **开发效率提升：** 减少编写样板代码（事件定义、监听、解绑）的时间。
*   **未来兼容性：** 该模式与 React/Vue 的理念同源。若未来决定迁移至框架，逻辑层代码几乎无需修改，只需替换 UI 渲染层。

## 7. LLM Review（2026-01-05）

### 7.1 总体结论（我是否同意）
我**同意提案的大方向**：在 QtWebEngine + 原生 DOM 的约束下，不引入 React/Vue 等大型 runtime，而是用 zero-deps 的 `Manager + Store（可观察状态）` 来承载业务主流程，并将 EventBus 收敛到跨边界/集成用途，是可落地且性价比高的路线。

但我也认为提案当前版本偏“概念正确、工程细节不足”：如果直接照搬，会很容易把“EventBus 面条”换皮成“Store 面条”（状态更新与订阅逻辑在 UI 里继续碎片化）。

### 7.2 为什么说 EventBus 容易变成“面条化”（我对“面条”的定义）
EventBus 并不天然等于面条，但当它被用来承载业务主干时，会引入 4 类典型的“逻辑面条”症状：
1) **控制流断裂**：一个业务动作被拆成多个 listener 的“跳转”，调用链无法从入口顺藤摸瓜（只能全局搜索事件名）。
2) **依赖隐式化**：谁依赖谁不体现在函数签名/构造参数里，而藏在“谁订阅了哪个事件”里；重构时容易漏改/误删。
3) **时序不确定**：多个 listener 的执行顺序、异步回调返回顺序，往往靠约定或经验；为躲避竞态，代码就会自然长出大量防御性判断。
4) **状态分散与同步成本**：状态散落在各 UI 对象私有字段、DOM dataset、临时变量里；不同地方靠事件互相“同步”，越改越难。

### 7.3 我认为必须补齐的工程点（否则会“换皮继续面条”）
提案的 `ObservableState` 过于极简，落地到真实业务时建议至少补齐这些点：
1) **状态更新语义**：仅有 `set(partial)` 的“浅合并”不够，容易导致深层 mutate 失控、以及无意义刷新；建议支持 `replace(nextState)` 与 `set(updaterFn)`（明确鼓励不可变更新）。
2) **订阅 API 粒度**：只有 `subscribe(listener)` 会导致 UI 里堆大量 `if (a!==b)`；建议支持 `subscribe(selector, listener, { equals })`，让“监听某个派生片段”成为默认用法。
3) **错误语义必须符合 fail-fast**：示例里 `catch` 后把结果置空会把真实错误“吃掉”；更符合本项目原则的做法是：要么把错误写进 state 并触发显式 UI 呈现/日志（可观测），要么直接抛出并带上上下文（禁止静默兜底）。
4) **异步竞态要有标准解法**：例如连续触发 search 时“旧回包覆盖新结果”的问题，需要 Manager 内置 `requestSeq/latestOnly/abort` 等策略（或复用已有 WS `request_id` gate）。
5) **与现有规范对齐**：logger、订阅清理（subscription bag）、事件常量白名单等项目既有基建不要绕开；否则会出现“两套习惯”并行，长期更难维护。

### 7.4 我建议的“工程版 ObservableState”边界（仍保持 zero-deps）
我倾向于把它定义成“够用且不失控”的最小子集（不引入框架，但把坑填上）：
- `get()`：取快照。
- `set(partialOrUpdater)`：`partial` 或 `(prev)=>nextPartial/nextState`。
- `replace(nextState)`：完全替换（用于重置/回放/事务结束）。
- `subscribe(selector, listener, { equals, fireImmediately })`：默认通过 selector 降低 UI 碎片化，`equals` 控制刷新噪音。
- listener 抛错：建议 fail-fast，但要带上“哪个 store/哪个 selector/哪个 manager”的上下文日志，方便定位。

### 7.5 我建议的 EventBus 新定位（收敛规则）
我建议把 EventBus 明确收敛为“边界事件/集成层”，而不是 Feature 内的业务主流程：
- **允许**：跨窗口/跨模块边界的通知（例如后端 WS 消息、窗口生命周期、全局快捷键、应用级广播）。
- **禁止**：在 Feature 内部用“事件 ping-pong”替代方法调用与状态变更（尤其是同一个 manager/UI 之间）。
- **互操作**：用一个很薄的 bridge 把旧 EventBus 事件转成新 Store 状态（提案里的 Anti-Corruption Layer 思路是对的），但只允许单向流入，避免再反向污染。

### 7.6 落地顺序建议（不阻塞新功能）
如果你现在还有新功能要写，我建议采用“渐进式混合”但更明确一点：
1) **新功能优先**：直接用 `Manager + Store` 写（不要再新增 EventBus 事件承载主流程）。
2) **旧模块不强推全量重构**：只有当修改范围已触及核心逻辑时才顺手迁移（童子军规则）。
3) **先做一个试点模板**：挑选一个事件密度高但边界清晰的 Feature（例如 search/results 或某个工具窗），沉淀出：目录结构、store 约束、订阅清理范式、竞态处理范式，再复制到后续模块。
