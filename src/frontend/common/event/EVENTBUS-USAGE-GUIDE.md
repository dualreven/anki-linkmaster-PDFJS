# EventBus 使用规范指南

**版本**: v1.0
**更新日期**: 2025-10-04
**适用范围**: pdf-viewer 和 pdf-home 模块

---

## 📖 目录

1. [核心概念](#核心概念)
2. [事件命名规范](#事件命名规范)
3. [局部事件 vs 全局事件](#局部事件-vs-全局事件)
4. [API 使用指南](#api-使用指南)
5. [最佳实践](#最佳实践)
6. [常见错误](#常见错误)
7. [完整示例](#完整示例)

---

## ⚠️ 为什么必须使用EventBus？

### Feature间通信的唯一方式

在本项目的插件架构中，**所有Feature间通信必须通过EventBus**，这是强制规则，不是建议。

**严格禁止的做法**：
```javascript
// ❌ 禁止：直接import其他Feature
import { BookmarkFeature } from '../bookmark/index.js';
const bookmarkFeature = new BookmarkFeature();
bookmarkFeature.toggleSidebar(); // 绕过EventBus

// ❌ 禁止：访问其他Feature的内部实现
import { BookmarkManager } from '../bookmark/components/bookmark-manager.js';

// ❌ 禁止：通过全局变量共享
window.myFeatureState = { ... };
```

**正确的做法**：
```javascript
// ✅ 正确：通过EventBus通信
eventBus.emitGlobal('bookmark:sidebar:toggle:requested', {}, { actorId: 'MyFeature' });

// ✅ 正确：通过Container获取服务（前提是该服务已注册）
const bookmarkService = container.get('bookmarkService');
```

**自动化保护**：
- ESLint规则 `custom/no-cross-feature-internals` 会在CI中强制检查
- 违反规则的代码无法合并

**详细说明** → `../HOW-TO-ADD-FEATURE.md` → "核心规则"章节

---

## 核心概念

### EventBus（全局事件总线）

**定义**: 项目唯一的全局事件中心，所有事件都通过它传递。

**特点**:
- 单例模式，全局共享
- 无命名空间隔离
- 位置: `src/frontend/common/event/event-bus.js`

**使用场景**:
- ✅ Feature 间跨模块通信
- ✅ 全局状态变化通知
- ✅ 系统级事件广播

---

### ScopedEventBus（作用域事件总线）

**定义**: 为每个 Feature 提供独立命名空间的事件总线包装器。

**特点**:
- 自动添加命名空间前缀 `@feature-name/`
- 隔离模块内部事件
- 支持模块内和全局两种通信模式

**工作原理**:
```javascript
const scopedBus = new ScopedEventBus(globalEventBus, 'my-feature');

// 局部事件 - 自动添加 @my-feature/ 前缀
scopedBus.emit('data:load:completed', data);
// 实际事件名: @my-feature/data:load:completed

// 全局事件 - 不添加前缀
scopedBus.emitGlobal('pdf:file:loaded', data);
// 实际事件名: pdf:file:loaded
```

---

## 事件命名规范

### ✅ 三段式格式（强制）

**格式**: `{module}:{action}:{status}`

**说明**:
- **module**: 模块名称（小写，用连字符分隔）
- **action**: 动作名称（小写，用连字符分隔）
- **status**: 状态（requested/completed/success/failed/error 等）

### ✅ 正确示例

```javascript
'pdf:load:completed'          // PDF加载完成
'bookmark:create:requested'   // 请求创建书签
'sidebar:open:success'        // 侧边栏打开成功
'annotation:delete:failed'    // 删除批注失败
'search:result:updated'       // 搜索结果更新
```

### ❌ 错误示例

```javascript
'loadData'                    // ❌ 缺少冒号
'pdf:list:data:loaded'        // ❌ 超过3段
'pdf_list_updated'            // ❌ 使用下划线
'onButtonClick'               // ❌ 非事件格式
'pdfLoadCompleted'            // ❌ 驼峰命名
'PDF:LOAD:COMPLETED'          // ❌ 大写字母
```

### 状态关键字参考

| 状态 | 含义 | 使用场景 |
|-----|------|---------|
| `requested` | 请求发起 | 用户操作触发，请求某个动作 |
| `started` | 开始执行 | 异步操作开始 |
| `progress` | 执行中 | 长时间操作的进度更新 |
| `completed` | 完成 | 操作成功完成（通用） |
| `success` | 成功 | 操作成功（强调结果） |
| `failed` | 失败 | 操作失败 |
| `error` | 错误 | 发生错误 |
| `updated` | 更新 | 数据或状态更新 |
| `changed` | 变化 | 状态变化 |
| `cancelled` | 取消 | 操作被取消 |

---

## 局部事件 vs 全局事件

### 🔹 局部事件（Feature 内部通信）

**使用方法**: `on()` / `emit()`

**特点**:
- 自动添加命名空间 `@feature-name/`
- 仅在同一个 Feature 内传递
- 其他 Feature **无法**监听

**使用场景**:
- ✅ Feature 内部组件间通信
- ✅ 私有状态变化通知
- ✅ 不希望被外部监听的内部事件

**示例**:
```javascript
// 在 pdf-bookmark Feature 中
class PDFBookmarkFeature {
  async install(context) {
    const { scopedEventBus } = context;

    // 发布局部事件（仅限 pdf-bookmark 内部）
    scopedEventBus.emit('cache:update:completed', { count: 10 });
    // 实际事件名: @pdf-bookmark/cache:update:completed

    // 监听局部事件（仅限 pdf-bookmark 内部）
    scopedEventBus.on('ui:refresh:requested', (data) => {
      this.#refreshUI(data);
    });
    // 实际监听: @pdf-bookmark/ui:refresh:requested
  }
}
```

---

### 🌐 全局事件（Feature 间跨模块通信）

**使用方法**: `onGlobal()` / `emitGlobal()`

**特点**:
- 不添加命名空间前缀
- 所有 Feature 都可以监听
- 用于公共接口和跨模块协作

**使用场景**:
- ✅ Feature 对外暴露的公共事件
- ✅ 跨模块数据共享
- ✅ 系统级状态变化（如 PDF 加载完成）
- ✅ 用户操作触发的全局事件

**示例**:
```javascript
// Feature A: 发布全局事件
class PDFManagerFeature {
  async loadPDF(url) {
    const doc = await this.#loader.load(url);

    // 发布全局事件，通知其他 Feature
    this.#eventBus.emitGlobal(
      'pdf:load:completed',
      { pdfDocument: doc, pageCount: doc.numPages },
      { actorId: 'PDFManagerFeature' }
    );
  }
}

// Feature B: 监听全局事件
class BookmarkFeature {
  async install(context) {
    const { scopedEventBus } = context;

    // 监听全局事件
    scopedEventBus.onGlobal('pdf:load:completed', (data) => {
      this.#loadBookmarks(data.pdfDocument);
    });
  }
}

// Feature C: 也可以监听同一个全局事件
class AnnotationFeature {
  async install(context) {
    const { scopedEventBus } = context;

    // 多个 Feature 可以同时监听
    scopedEventBus.onGlobal('pdf:load:completed', (data) => {
      this.#initAnnotations(data.pdfDocument);
    });
  }
}
```

---

## API 使用指南

### 在 Feature 中获取 EventBus

**推荐方式**（优先使用 ScopedEventBus）:
```javascript
class MyFeature {
  #eventBus;

  async install(context) {
    // 方式1: 使用 scopedEventBus（推荐）
    this.#eventBus = context.scopedEventBus;

    // 方式2: 如果没有 scopedEventBus，使用 globalEventBus
    if (!this.#eventBus) {
      this.#eventBus = context.globalEventBus;
    }
  }
}
```

---

### 发布事件

#### 局部事件（Feature 内部）
```javascript
// 基本用法
this.#eventBus.emit('data:load:completed', { items: [] });

// 带元数据
this.#eventBus.emit(
  'cache:update:completed',
  { count: 10 },
  { actorId: 'MyFeature' }  // 可选：标识发送者
);
```

#### 全局事件（Feature 间通信）
```javascript
// 基本用法
this.#eventBus.emitGlobal('pdf:file:loaded', { url: '/file.pdf' });

// 带元数据（推荐）
this.#eventBus.emitGlobal(
  'bookmark:create:success',
  { bookmarkId: '123', title: '第一章' },
  { actorId: 'BookmarkFeature' }  // 推荐：标识发送者
);
```

---

### 监听事件

#### 局部事件（Feature 内部）
```javascript
// 基本用法
this.#eventBus.on('ui:refresh:requested', (data) => {
  console.log('Refresh UI:', data);
});

// 带选项
const unsubscribe = this.#eventBus.on(
  'data:load:completed',
  (data) => {
    console.log('Data loaded:', data);
  },
  { subscriberId: 'MyComponent' }  // 可选：标识订阅者
);

// 保存 unsubscribe 函数以便后续清理
this.#unsubs.push(unsubscribe);
```

#### 全局事件（Feature 间通信）
```javascript
// 基本用法
this.#eventBus.onGlobal('pdf:page:changed', (data) => {
  console.log('Page changed:', data.pageNumber);
});

// 带选项（推荐）
const unsubscribe = this.#eventBus.onGlobal(
  'pdf:load:completed',
  (data) => {
    this.#handlePdfLoaded(data);
  },
  { subscriberId: 'MyFeature' }  // 推荐：标识订阅者，便于调试
);

// 保存 unsubscribe 函数
this.#unsubs.push(unsubscribe);
```

---

### 取消订阅

**方式1: 使用返回的 unsubscribe 函数（推荐）**
```javascript
class MyFeature {
  #unsubs = [];

  async install(context) {
    // 订阅时保存 unsubscribe 函数
    const unsub1 = this.#eventBus.on('data:load:completed', handler);
    const unsub2 = this.#eventBus.onGlobal('pdf:load:completed', handler);

    this.#unsubs.push(unsub1, unsub2);
  }

  async uninstall() {
    // 卸载时取消所有订阅
    this.#unsubs.forEach(unsub => unsub());
    this.#unsubs = [];
  }
}
```

**方式2: 使用 off() / offGlobal()**
```javascript
const handler = (data) => console.log(data);

// 订阅
this.#eventBus.on('data:load:completed', handler);

// 取消订阅（需要保存 handler 引用）
this.#eventBus.off('data:load:completed', handler);
```

---

## 最佳实践

### ✅ DO（推荐做法）

1. **优先使用 ScopedEventBus**
   ```javascript
   // ✅ 推荐
   const eventBus = context.scopedEventBus || context.globalEventBus;
   ```

2. **遵循三段式命名规范**
   ```javascript
   // ✅ 正确
   eventBus.emitGlobal('pdf:load:completed', data);
   ```

3. **区分局部和全局事件**
   ```javascript
   // ✅ Feature 内部通信
   eventBus.emit('cache:update:completed', data);

   // ✅ Feature 间通信
   eventBus.emitGlobal('pdf:load:completed', data);
   ```

4. **标识发送者和订阅者**
   ```javascript
   // ✅ 发送时标识 actorId
   eventBus.emitGlobal('pdf:load:completed', data, { actorId: 'PDFManager' });

   // ✅ 订阅时标识 subscriberId
   eventBus.onGlobal('pdf:load:completed', handler, { subscriberId: 'BookmarkFeature' });
   ```

5. **保存 unsubscribe 函数**
   ```javascript
   // ✅ 保存以便卸载时清理
   this.#unsubs = [];
   this.#unsubs.push(eventBus.on('event', handler));
   ```

6. **在 uninstall() 中清理所有监听器**
   ```javascript
   // ✅ 避免内存泄漏
   async uninstall() {
     this.#unsubs.forEach(unsub => unsub());
     this.#unsubs = [];
   }
   ```

---

### ❌ DON'T（禁止做法）

1. **混用局部和全局方法**
   ```javascript
   // ❌ 错误：用 emit() 发布，但用 onGlobal() 监听
   // Feature A
   eventBus.emit('data:loaded', data);  // 实际: @feature-a/data:loaded

   // Feature B
   eventBus.onGlobal('data:loaded', handler);  // 监听: data:loaded（收不到！）
   ```

2. **忘记取消订阅**
   ```javascript
   // ❌ 内存泄漏风险
   async install(context) {
     eventBus.on('event', handler);  // 没有保存 unsubscribe
   }

   async uninstall() {
     // 无法取消订阅！
   }
   ```

3. **使用不符合规范的事件名**
   ```javascript
   // ❌ 会被 EventBus 阻止
   eventBus.emit('loadData', data);  // 格式错误
   eventBus.emit('pdf_loaded', data);  // 使用下划线
   ```

4. **在全局事件中使用命名空间前缀**
   ```javascript
   // ❌ 多余的前缀
   eventBus.emitGlobal('@my-feature/data:loaded', data);
   // 应该直接用: 'data:loaded'（如果确实需要全局）
   ```

5. **不标识发送者和订阅者**
   ```javascript
   // ❌ 难以调试
   eventBus.emitGlobal('pdf:load:completed', data);  // 不知道谁发的
   eventBus.onGlobal('pdf:load:completed', handler);  // 不知道谁订阅的
   ```

---

## 常见错误

### 错误1: 局部事件和全局事件混用

**问题**:
```javascript
// Feature A: 发布局部事件
scopedEventBus.emit('data:loaded', data);
// 实际事件名: @feature-a/data:loaded

// Feature B: 尝试监听全局事件
scopedEventBus.onGlobal('data:loaded', handler);
// 实际监听: data:loaded

// 结果：收不到事件！因为事件名不匹配
```

**解决方案**:
```javascript
// 方案1: 改为全局事件
scopedEventBus.emitGlobal('data:loaded', data);
scopedEventBus.onGlobal('data:loaded', handler);

// 方案2: 改为局部事件（如果确实只在 Feature 内通信）
scopedEventBus.emit('data:loaded', data);
scopedEventBus.on('data:loaded', handler);
```

---

### 错误2: 事件名格式错误

**问题**:
```javascript
eventBus.emit('loadData', data);  // ❌ 格式错误
```

**控制台错误**:
```
❌ 事件名称验证失败！

错误：事件名称 'loadData' 格式不正确

📋 正确格式：{module}:{action}:{status} (必须正好3段，用冒号分隔)

✅ 正确示例：
  - pdf:load:completed
  - bookmark:toggle:requested
  - sidebar:open:success

💡 建议修复：事件名缺少冒号，应该分为3段：模块名:动作名:状态

⚠️ 此事件发布/订阅已被阻止！请立即修复事件名称。
```

**解决方案**:
```javascript
eventBus.emit('data:load:completed', data);  // ✅ 正确
```

---

### 错误3: 忘记清理监听器

**问题**:
```javascript
class MyFeature {
  async install(context) {
    eventBus.on('event', handler);  // 没有保存 unsubscribe
  }

  async uninstall() {
    // 无法取消订阅，导致内存泄漏
  }
}
```

**解决方案**:
```javascript
class MyFeature {
  #unsubs = [];

  async install(context) {
    const unsub = eventBus.on('event', handler);
    this.#unsubs.push(unsub);  // ✅ 保存 unsubscribe
  }

  async uninstall() {
    this.#unsubs.forEach(unsub => unsub());  // ✅ 清理
    this.#unsubs = [];
  }
}
```

---

## 完整示例

### 示例1: Feature 内部通信（局部事件）

```javascript
/**
 * CacheManager Feature - 缓存管理功能
 */
class CacheManagerFeature {
  #eventBus;
  #cache = new Map();
  #unsubs = [];

  get name() { return 'cache-manager'; }
  get dependencies() { return []; }

  async install(context) {
    this.#eventBus = context.scopedEventBus || context.globalEventBus;

    // 监听局部事件：缓存清空请求
    this.#unsubs.push(
      this.#eventBus.on(
        'cache:clear:requested',
        () => this.#clearCache(),
        { subscriberId: 'CacheManagerFeature' }
      )
    );

    // 监听局部事件：缓存项添加请求
    this.#unsubs.push(
      this.#eventBus.on(
        'cache:add:requested',
        (data) => this.#addToCache(data),
        { subscriberId: 'CacheManagerFeature' }
      )
    );
  }

  async uninstall() {
    this.#unsubs.forEach(unsub => unsub());
    this.#unsubs = [];
  }

  #clearCache() {
    this.#cache.clear();

    // 发布局部事件：缓存已清空
    this.#eventBus.emit(
      'cache:clear:completed',
      { timestamp: Date.now() },
      { actorId: 'CacheManagerFeature' }
    );
  }

  #addToCache(data) {
    const { key, value } = data;
    this.#cache.set(key, value);

    // 发布局部事件：缓存项已添加
    this.#eventBus.emit(
      'cache:add:completed',
      { key, size: this.#cache.size },
      { actorId: 'CacheManagerFeature' }
    );
  }
}
```

---

### 示例2: Feature 间通信（全局事件）

```javascript
/**
 * PDFManager Feature - 发布全局事件
 */
class PDFManagerFeature {
  #eventBus;

  async install(context) {
    this.#eventBus = context.scopedEventBus || context.globalEventBus;
  }

  async loadPDF(url) {
    // 发布全局事件：PDF 加载开始
    this.#eventBus.emitGlobal(
      'pdf:load:started',
      { url },
      { actorId: 'PDFManagerFeature' }
    );

    try {
      const doc = await this.#loader.load(url);

      // 发布全局事件：PDF 加载完成
      this.#eventBus.emitGlobal(
        'pdf:load:completed',
        { pdfDocument: doc, pageCount: doc.numPages, url },
        { actorId: 'PDFManagerFeature' }
      );
    } catch (error) {
      // 发布全局事件：PDF 加载失败
      this.#eventBus.emitGlobal(
        'pdf:load:failed',
        { url, error: error.message },
        { actorId: 'PDFManagerFeature' }
      );
    }
  }
}

/**
 * BookmarkFeature - 监听全局事件
 */
class BookmarkFeature {
  #eventBus;
  #unsubs = [];

  async install(context) {
    this.#eventBus = context.scopedEventBus || context.globalEventBus;

    // 监听全局事件：PDF 加载完成
    this.#unsubs.push(
      this.#eventBus.onGlobal(
        'pdf:load:completed',
        (data) => this.#handlePdfLoaded(data),
        { subscriberId: 'BookmarkFeature' }
      )
    );

    // 监听全局事件：PDF 加载失败
    this.#unsubs.push(
      this.#eventBus.onGlobal(
        'pdf:load:failed',
        (data) => this.#handlePdfLoadFailed(data),
        { subscriberId: 'BookmarkFeature' }
      )
    );
  }

  async uninstall() {
    this.#unsubs.forEach(unsub => unsub());
    this.#unsubs = [];
  }

  #handlePdfLoaded(data) {
    console.log('PDF loaded, loading bookmarks...', data);
    // 加载书签逻辑
  }

  #handlePdfLoadFailed(data) {
    console.error('PDF load failed:', data.error);
    // 错误处理逻辑
  }
}

/**
 * AnnotationFeature - 也可以监听同一个全局事件
 */
class AnnotationFeature {
  #eventBus;
  #unsubs = [];

  async install(context) {
    this.#eventBus = context.scopedEventBus || context.globalEventBus;

    // 多个 Feature 可以同时监听同一个全局事件
    this.#unsubs.push(
      this.#eventBus.onGlobal(
        'pdf:load:completed',
        (data) => this.#initAnnotations(data),
        { subscriberId: 'AnnotationFeature' }
      )
    );
  }

  async uninstall() {
    this.#unsubs.forEach(unsub => unsub());
    this.#unsubs = [];
  }

  #initAnnotations(data) {
    console.log('PDF loaded, initializing annotations...', data);
    // 初始化批注逻辑
  }
}
```

---

## 快速参考卡片

| 场景 | 使用方法 | 事件名示例 |
|-----|---------|-----------|
| **Feature 内部通信** | `emit()` / `on()` | `cache:update:completed` |
| **Feature 间通信** | `emitGlobal()` / `onGlobal()` | `pdf:load:completed` |
| **发布事件** | `emit(event, data, metadata)` | - |
| **监听事件** | `on(event, handler, options)` | - |
| **取消订阅** | `const unsub = on(...); unsub()` | - |

---

## 参考文档

- **EventBus 实现**: `src/frontend/common/event/event-bus.js`
- **ScopedEventBus 实现**: `src/frontend/common/event/scoped-event-bus.js`
- **事件常量定义**: `src/frontend/common/event/pdf-viewer-constants.js`
- **架构说明**: `src/frontend/ARCHITECTURE-EXPLAINED.md`

---

**版本历史**:
- v1.0 (2025-10-04) - 初始版本

**维护者**: Claude (AI Agent)
