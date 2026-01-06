# 需求规格说明书 - 侧边栏统一管理

**需求编号**: 20251004030451
**需求名称**: 侧边栏统一管理 (Unified Sidebar Management)
**版本**: v001
**创建日期**: 2025-10-04
**所属模块**: pdf-viewer
**优先级**: 高

---

## 1. 功能概述

实现PDF查看器的统一侧边栏管理系统，支持多个侧边栏（标注栏、书签栏、卡片栏、翻译栏）同时打开并智能布局，提供流畅的多侧边栏协同工作体验。

**核心价值**：
- 提升多功能协同效率，用户可以同时查看标注、书签、卡片和翻译
- 统一的侧边栏管理机制，降低架构复杂度
- 灵活的布局系统，自适应多侧边栏显示需求

---

## 2. 现状说明

### 2.1 当前实现状态

**已实现功能**：
- ✅ BookmarkFeature - 书签侧边栏功能（完整实现）
- ✅ AnnotationFeature - 标注工具核心功能（工具栏部分）
- ✅ Feature-based插件化架构

**规划中功能**：
- ⏳ 标注侧边栏 (20251002213000-pdf-annotation-sidebar)
  - 三种标注类型：截图标注、划词标注、打字标注
  - 侧边栏UI和交互设计
- ⏳ 卡片侧边栏 (20251003140242-pdf-card-sidebar)
  - 第一阶段：容器UI实现
  - 未来：关联卡片浏览和跳转
- ⏳ 翻译侧边栏 (20251003173543-pdf-translator-sidebar)
  - DeepL翻译服务集成
  - 翻译结果显示和历史记录

### 2.2 当前架构分析

```
pdf-viewer/
├── features/
│   ├── bookmark/           # 书签Feature（独立侧边栏）
│   ├── annotation/         # 标注Feature（工具栏 + 将来的侧边栏）
│   ├── pdf-card/          # 卡片Feature（规划中）
│   └── pdf-translator/    # 翻译Feature（规划中）
└── bootstrap/
    └── app-bootstrap-feature.js  # Feature注册和初始化
```

**当前侧边栏实现特点**：
- 每个Feature独立管理自己的侧边栏DOM
- 侧边栏之间无统一协调机制
- 打开/关闭逻辑分散在各Feature内部
- 布局位置硬编码或简单处理

---

## 3. 存在问题

### 3.1 架构层面问题

| 问题 | 描述 | 影响 |
|------|------|------|
| **缺少统一管理** | 各侧边栏独立实现，无中央协调者 | 难以实现多侧边栏并存 |
| **布局冲突** | 多个侧边栏同时打开时位置冲突 | 界面混乱，用户体验差 |
| **状态同步困难** | 侧边栏开关状态分散管理 | 按钮激活状态与实际不一致 |
| **扩展性差** | 添加新侧边栏需要重写布局逻辑 | 维护成本高 |

### 3.2 用户体验问题

- **无法多任务协同**: 用户想同时查看书签和标注时，只能开一个侧边栏
- **布局不智能**: 侧边栏位置固定，无法根据开启数量自适应
- **操作不直观**: 按钮状态与侧边栏显示状态不同步

---

## 4. 提出需求

### 4.1 功能需求

#### FR-1: 多侧边栏并存
**描述**: 支持同时打开标注栏、书签栏、卡片栏、翻译栏
**约束**:
- 最多同时打开4个侧边栏
- 每个侧边栏有独立的显示区域
- 侧边栏之间无重叠

#### FR-2: 左流动布局
**描述**: 侧边栏按打开顺序从左到右排列，新打开的侧边栏推到右侧
**规则**:
- 第1个打开：占据最左位置
- 第2个打开：第1个保持最左，新的在中间偏左
- 第3个打开：前2个保持位置，新的在中间偏右
- 第4个打开：前3个保持位置，新的在最右

**布局示例**:
```
1个侧边栏: [====侧边栏1====]
2个侧边栏: [==侧边栏1==][==侧边栏2==]
3个侧边栏: [=侧1=][=侧2=][=侧3=]
4个侧边栏: [侧1][侧2][侧3][侧4]
```

#### FR-3: 按钮状态管理
**描述**: 所有侧边栏按钮都不显示激活状态
**设计原则**:
- ❌ **所有按钮都不显示激活状态**（用户明确要求）
- ✅ 侧边栏自身提供关闭按钮（X按钮）
- ✅ 通过侧边栏的可见性本身来表明状态，无需按钮视觉反馈

#### FR-4: 切换关闭功能
**描述**: 提供两种关闭侧边栏的方式
**行为**:
- **按钮切换**:
  - 首次点击：打开对应侧边栏
  - 再次点击：关闭对应侧边栏
- **侧边栏关闭按钮**:
  - 每个侧边栏头部有关闭按钮（X图标）
  - 点击后关闭当前侧边栏
- 关闭后：剩余侧边栏保持打开顺序，重新布局

#### FR-5: 宽度调整功能
**描述**: 所有侧边栏支持鼠标拖拽调整宽度
**交互方式**:
- **拖拽分隔条**: 每个侧边栏右侧有可拖拽的分隔条（resize handle）
- **实时反馈**: 拖拽时显示宽度变化，鼠标样式变为 `col-resize`
- **宽度约束**:
  - 最小宽度：250px（保证基本内容可见）
  - 最大宽度：600px（避免占用过多空间）
  - 默认宽度：350px
- **多侧边栏处理**:
  - 拖拽某个侧边栏时，只调整该侧边栏宽度
  - 其他侧边栏位置自动调整以适应变化
  - 保存用户自定义宽度，下次打开时恢复

### 4.2 非功能需求

#### NFR-1: 性能要求
- 侧边栏打开/关闭响应时间 < 200ms
- 布局重排动画流畅（60fps）
- 支持动态添加/移除侧边栏类型

#### NFR-2: 兼容性要求
- 与现有Feature架构无缝集成
- 不破坏现有BookmarkFeature功能
- 支持未来新侧边栏类型扩展

#### NFR-3: 可维护性要求
- 侧边栏管理逻辑集中在SidebarManagerFeature
- 各侧边栏Feature只负责内容渲染
- 通过EventBus解耦通信

---

## 5. 解决方案

### 5.1 架构设计

#### 5.1.1 整体架构

```
┌─────────────────────────────────────────────────────┐
│                 SidebarManagerFeature                │
│  (统一侧边栏管理器 - 新增核心Feature)                  │
├─────────────────────────────────────────────────────┤
│  • 侧边栏注册与生命周期管理                            │
│  • 多侧边栏布局引擎 (LayoutEngine)                    │
│  • 打开顺序追踪 (OrderTracker)                        │
│  • 按钮状态同步 (StateSync)                           │
└──────────────┬──────────────────────────────────────┘
               │ EventBus通信
     ┌─────────┼─────────┬─────────┬─────────┐
     ▼         ▼         ▼         ▼         ▼
┌─────────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│ToolbarUI│ │Annot.│ │Book. │ │Card  │ │Trans.│
│ Feature │ │Feature│ │Feature│ │Feature│ │Feature│
└─────────┘ └──────┘ └──────┘ └──────┘ └──────┘
     │         │         │         │         │
     └─────────┴─────────┴─────────┴─────────┘
                事件发布/订阅
```

#### 5.1.2 核心组件

**组件1: SidebarManagerFeature**
```javascript
class SidebarManagerFeature {
  #sidebars = new Map();        // 注册的侧边栏 {id: SidebarConfig}
  #openOrder = [];               // 打开顺序 [id1, id2, ...]
  #layoutEngine;                 // 布局计算引擎
  #container;                    // 统一容器DOM

  // 注册侧边栏
  registerSidebar(id, config) {}

  // 打开侧边栏
  openSidebar(id) {}

  // 关闭侧边栏
  closeSidebar(id) {}

  // 切换侧边栏
  toggleSidebar(id) {}

  // 重新计算布局
  #recalculateLayout() {}
}
```

**组件2: LayoutEngine（布局引擎）**
```javascript
class LayoutEngine {
  // 计算每个侧边栏的宽度和位置
  calculateLayout(openSidebarIds, containerWidth) {
    // 返回: [{id, left, width}, ...]
  }

  // 应用布局到DOM
  applyLayout(layoutData) {}

  // 左流动算法
  #leftFlowAlgorithm(count) {
    // 1个: [100%]
    // 2个: [50%, 50%]
    // 3个: [33%, 33%, 34%]
    // 4个: [25%, 25%, 25%, 25%]
  }
}
```

**组件3: SidebarConfig（侧边栏配置）**
```javascript
const SidebarConfig = {
  id: 'annotation',               // 唯一标识
  buttonSelector: '#annotation-btn', // 按钮选择器
  contentRenderer: () => {},      // 内容渲染函数
  title: '标注',                  // 侧边栏标题（显示在头部）
  minWidth: 250,                  // 最小宽度（px）
  maxWidth: 600,                  // 最大宽度（px）
  defaultWidth: 350,              // 默认宽度（px）
  resizable: true,                // 是否可调整宽度
  priority: 1                     // 优先级（暂未使用）
};
```

### 5.2 EventBus事件设计

#### 5.2.1 事件命名规范

遵循项目EventBus规范: `{module}:{action}:{status}`

| 事件名 | 触发时机 | 数据 | 发送者 | 接收者 |
|--------|---------|------|--------|--------|
| `sidebar:open:requested` | 用户点击打开侧边栏按钮 | `{sidebarId}` | ToolbarUI | SidebarManager |
| `sidebar:close:requested` | 用户点击关闭侧边栏按钮 | `{sidebarId}` | ToolbarUI | SidebarManager |
| `sidebar:toggle:requested` | 用户点击切换按钮 | `{sidebarId}` | ToolbarUI | SidebarManager |
| `sidebar:opened:completed` | 侧边栏打开完成 | `{sidebarId, order}` | SidebarManager | All Features |
| `sidebar:closed:completed` | 侧边栏关闭完成 | `{sidebarId, remainingIds}` | SidebarManager | All Features |
| `sidebar:layout:updated` | 布局重新计算完成 | `{layoutData}` | SidebarManager | Sidebar Features |

#### 5.2.2 事件流程示例

**场景：用户依次打开书签、标注、卡片侧边栏**

```
用户点击书签按钮
  ↓
[ToolbarUI] emit → 'sidebar:toggle:requested' {sidebarId: 'bookmark'}
  ↓
[SidebarManager] 检查状态 → 未打开 → 调用openSidebar('bookmark')
  ↓
[SidebarManager] 更新openOrder: ['bookmark']
  ↓
[SidebarManager] LayoutEngine计算布局: [{id:'bookmark', left:0, width:100%}]
  ↓
[SidebarManager] 渲染DOM并应用布局
  ↓
[SidebarManager] emit → 'sidebar:opened:completed' {sidebarId: 'bookmark', order: 1}

---

用户点击标注按钮
  ↓
[ToolbarUI] emit → 'sidebar:toggle:requested' {sidebarId: 'annotation'}
  ↓
[SidebarManager] openOrder: ['bookmark', 'annotation']
  ↓
[LayoutEngine] 计算布局: [
    {id:'bookmark', left:0, width:50%},
    {id:'annotation', left:50%, width:50%}
  ]
  ↓
[SidebarManager] emit → 'sidebar:layout:updated' + 'sidebar:opened:completed'

---

用户点击卡片按钮
  ↓
[SidebarManager] openOrder: ['bookmark', 'annotation', 'card']
  ↓
[LayoutEngine] 计算布局: [
    {id:'bookmark', left:0, width:33%},
    {id:'annotation', left:33%, width:33%},
    {id:'card', left:66%, width:34%}
  ]
```

### 5.3 布局算法详解

#### 5.3.1 左流动布局算法

```javascript
class LayoutEngine {
  calculateLayout(openSidebarIds, containerWidth) {
    const count = openSidebarIds.length;
    const layouts = [];

    for (let i = 0; i < count; i++) {
      const width = Math.floor(containerWidth / count);
      const left = i * width;

      layouts.push({
        id: openSidebarIds[i],
        left: left,
        width: i === count - 1 ? containerWidth - left : width,
        zIndex: 100 + i
      });
    }

    return layouts;
  }
}
```

**特点**：
- ✅ 均分宽度，最后一个补齐剩余空间
- ✅ 保持打开顺序，左侧优先
- ✅ 关闭某个侧边栏后，剩余侧边栏保持相对顺序

#### 5.3.2 动画过渡

使用CSS Transition实现平滑过渡：

```css
.sidebar-panel {
  position: absolute;
  top: 0;
  height: 100%;
  transition: left 0.3s ease, width 0.3s ease;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--sidebar-border);
}
```

### 5.4 侧边栏UI结构

#### 5.4.1 完整UI结构

每个侧边栏包含：
- 头部（标题 + 关闭按钮）
- 内容区（由各Feature渲染）
- 右侧调整分隔条（resize handle）

```html
<div class="sidebar-panel" data-sidebar-id="bookmark">
  <div class="sidebar-header">
    <h3 class="sidebar-title">书签</h3>
    <button class="sidebar-close-btn" aria-label="关闭侧边栏">
      <svg><!-- X 图标 --></svg>
    </button>
  </div>
  <div class="sidebar-content">
    <!-- 侧边栏内容 -->
  </div>
  <div class="sidebar-resize-handle" data-sidebar-id="bookmark"></div>
</div>
```

**CSS样式**:
```css
.sidebar-resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 4px;
  height: 100%;
  cursor: col-resize;
  background: transparent;
  z-index: 10;
}

.sidebar-resize-handle:hover {
  background: var(--primary-color);
}

.sidebar-resize-handle.resizing {
  background: var(--primary-color);
}
```

#### 5.4.2 创建侧边栏面板

```javascript
class SidebarManagerFeature {
  #createSidebarPanel(config) {
    const panel = document.createElement('div');
    panel.className = 'sidebar-panel';
    panel.setAttribute('data-sidebar-id', config.id);

    // 创建头部
    const header = document.createElement('div');
    header.className = 'sidebar-header';

    const title = document.createElement('h3');
    title.className = 'sidebar-title';
    title.textContent = config.title;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'sidebar-close-btn';
    closeBtn.innerHTML = '<svg>...</svg>';
    closeBtn.addEventListener('click', () => {
      this.closeSidebar(config.id);
    });

    header.appendChild(title);
    header.appendChild(closeBtn);

    // 创建内容区
    const content = document.createElement('div');
    content.className = 'sidebar-content';
    content.appendChild(config.contentRenderer());

    // 创建调整分隔条
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'sidebar-resize-handle';
    resizeHandle.setAttribute('data-sidebar-id', config.id);
    this.#attachResizeHandlers(resizeHandle, panel, config);

    panel.appendChild(header);
    panel.appendChild(content);
    panel.appendChild(resizeHandle);

    return panel;
  }
}
```

### 5.5 宽度调整功能实现

#### 5.5.1 宽度状态管理

```javascript
class SidebarManagerFeature {
  #sidebarWidths = new Map();  // 存储每个侧边栏的自定义宽度

  // 获取侧边栏宽度（自定义 > 默认）
  #getSidebarWidth(sidebarId) {
    const config = this.#sidebars.get(sidebarId);
    return this.#sidebarWidths.get(sidebarId) || config.defaultWidth;
  }

  // 设置侧边栏宽度（带约束检查）
  #setSidebarWidth(sidebarId, width) {
    const config = this.#sidebars.get(sidebarId);
    const constrainedWidth = Math.max(
      config.minWidth,
      Math.min(config.maxWidth, width)
    );
    this.#sidebarWidths.set(sidebarId, constrainedWidth);
    this.#saveWidthPreferences();  // 持久化到localStorage
  }

  // 持久化宽度偏好
  #saveWidthPreferences() {
    const preferences = Object.fromEntries(this.#sidebarWidths);
    localStorage.setItem('sidebar-widths', JSON.stringify(preferences));
  }

  // 加载宽度偏好
  #loadWidthPreferences() {
    try {
      const saved = localStorage.getItem('sidebar-widths');
      if (saved) {
        const preferences = JSON.parse(saved);
        Object.entries(preferences).forEach(([id, width]) => {
          this.#sidebarWidths.set(id, width);
        });
      }
    } catch (error) {
      logger.error('Failed to load width preferences', error);
    }
  }
}
```

#### 5.5.2 拖拽事件处理

```javascript
class SidebarManagerFeature {
  #resizeState = {
    isResizing: false,
    sidebarId: null,
    startX: 0,
    startWidth: 0
  };

  #attachResizeHandlers(handle, panel, config) {
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();

      this.#resizeState.isResizing = true;
      this.#resizeState.sidebarId = config.id;
      this.#resizeState.startX = e.clientX;
      this.#resizeState.startWidth = panel.offsetWidth;

      handle.classList.add('resizing');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });
  }

  #setupGlobalResizeHandlers() {
    document.addEventListener('mousemove', (e) => {
      if (!this.#resizeState.isResizing) return;

      const deltaX = e.clientX - this.#resizeState.startX;
      const newWidth = this.#resizeState.startWidth + deltaX;
      const sidebarId = this.#resizeState.sidebarId;

      // 更新宽度
      this.#setSidebarWidth(sidebarId, newWidth);

      // 重新计算布局
      this.#recalculateLayoutWithCustomWidths();
    });

    document.addEventListener('mouseup', () => {
      if (!this.#resizeState.isResizing) return;

      this.#resizeState.isResizing = false;

      const handles = document.querySelectorAll('.sidebar-resize-handle');
      handles.forEach(h => h.classList.remove('resizing'));

      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      logger.info('Sidebar resize completed', {
        sidebarId: this.#resizeState.sidebarId,
        width: this.#sidebarWidths.get(this.#resizeState.sidebarId)
      });
    });
  }
}
```

#### 5.5.3 自定义宽度布局算法

```javascript
class LayoutEngine {
  // 计算布局（支持自定义宽度）
  calculateLayoutWithCustomWidths(openSidebarIds, widthMap, containerWidth) {
    const layouts = [];
    let currentLeft = 0;

    openSidebarIds.forEach((id, index) => {
      const width = widthMap.get(id) || 350;  // 使用自定义宽度或默认值

      layouts.push({
        id: id,
        left: currentLeft,
        width: width,
        zIndex: 100 + index
      });

      currentLeft += width;
    });

    return layouts;
  }

  applyLayout(layouts, containerElement) {
    layouts.forEach(layout => {
      const panel = containerElement.querySelector(`[data-sidebar-id="${layout.id}"]`);
      if (panel) {
        panel.style.left = `${layout.left}px`;
        panel.style.width = `${layout.width}px`;
        panel.style.zIndex = layout.zIndex;
      }
    });
  }
}
```

---

## 6. 技术实现细节

### 6.1 实现步骤

#### 阶段1: 核心框架（第1-2天）
1. ✅ 创建 `SidebarManagerFeature` 类骨架
2. ✅ 实现侧边栏注册机制
3. ✅ 创建统一容器DOM结构
4. ✅ 实现基础的打开/关闭逻辑

#### 阶段2: 布局引擎（第3-4天）
1. ✅ 实现 `LayoutEngine` 类
2. ✅ 左流动布局算法
3. ✅ CSS动画过渡
4. ✅ 响应式布局适配

#### 阶段3: 事件集成（第5-6天）
1. ✅ 定义EventBus事件
2. ✅ 集成ToolbarUI Feature
3. ✅ 实现按钮状态同步
4. ✅ 处理特殊情况（标注按钮）

#### 阶段4: Feature迁移（第7-8天）
1. ✅ 迁移BookmarkFeature到新架构
2. ✅ 更新AnnotationFeature（如已有侧边栏UI）
3. ✅ 集成CardFeature（待实现）
4. ✅ 集成TranslatorFeature（待实现）

#### 阶段5: 测试和优化（第9-10天）
1. ✅ 单元测试
2. ✅ 集成测试
3. ✅ 性能优化
4. ✅ 文档完善

### 6.2 文件结构

```
src/frontend/pdf-viewer/
├── features/
│   ├── sidebar-manager/              # 新增Feature
│   │   ├── index.js                  # SidebarManagerFeature主类
│   │   ├── layout-engine.js          # 布局引擎
│   │   ├── sidebar-config.js         # 配置定义
│   │   ├── components/
│   │   │   ├── sidebar-container.js  # 容器组件
│   │   │   └── sidebar-panel.js      # 单个侧边栏面板
│   │   ├── styles/
│   │   │   └── sidebar-layout.css    # 布局样式
│   │   └── tests/
│   │       ├── layout-engine.test.js
│   │       └── sidebar-manager.test.js
│   │
│   ├── bookmark/                     # 需要适配
│   │   └── index.js (修改: 注册到SidebarManager)
│   │
│   ├── annotation/                   # 需要适配
│   │   └── sidebar/ (新增: 侧边栏UI部分)
│   │
│   ├── pdf-card/                     # 需要适配
│   └── pdf-translator/               # 需要适配
│
├── common/
│   └── event/
│       └── constants.js (新增: 侧边栏事件常量)
│
└── bootstrap/
    └── app-bootstrap-feature.js (修改: 注册SidebarManager)
```

### 6.3 关键代码示例

#### 示例1: SidebarManagerFeature核心实现

```javascript
import { getLogger } from '../../common/utils/logger.js';
import { LayoutEngine } from './layout-engine.js';

const logger = getLogger('SidebarManager');

export class SidebarManagerFeature {
  name = 'sidebar-manager';
  version = '1.0.0';
  dependencies = ['eventBus', 'container'];

  #eventBus;
  #container;
  #sidebars = new Map();
  #openOrder = [];
  #layoutEngine;
  #containerElement;

  async install({ eventBus, container }) {
    this.#eventBus = eventBus;
    this.#container = container;
    this.#layoutEngine = new LayoutEngine();

    this.#createContainer();
    this.#setupEventListeners();

    logger.info('SidebarManagerFeature installed');
  }

  async uninstall() {
    this.#containerElement?.remove();
    logger.info('SidebarManagerFeature uninstalled');
  }

  // 注册侧边栏
  registerSidebar(config) {
    this.#sidebars.set(config.id, config);
    logger.debug(`Sidebar registered: ${config.id}`, config);
  }

  // 切换侧边栏
  toggleSidebar(sidebarId) {
    const isOpen = this.#openOrder.includes(sidebarId);
    if (isOpen) {
      this.closeSidebar(sidebarId);
    } else {
      this.openSidebar(sidebarId);
    }
  }

  // 打开侧边栏
  openSidebar(sidebarId) {
    if (this.#openOrder.includes(sidebarId)) {
      logger.warn(`Sidebar already open: ${sidebarId}`);
      return;
    }

    const config = this.#sidebars.get(sidebarId);
    if (!config) {
      logger.error(`Sidebar not registered: ${sidebarId}`);
      return;
    }

    // 添加到打开顺序
    this.#openOrder.push(sidebarId);

    // 创建侧边栏DOM
    const panel = this.#createSidebarPanel(config);
    this.#containerElement.appendChild(panel);

    // 重新计算布局
    this.#recalculateLayout();

    // 触发事件
    this.#eventBus.emitGlobal('sidebar:opened:completed', {
      sidebarId,
      order: this.#openOrder.length
    });

    logger.info(`Sidebar opened: ${sidebarId}`);
  }

  // 关闭侧边栏
  closeSidebar(sidebarId) {
    const index = this.#openOrder.indexOf(sidebarId);
    if (index === -1) {
      logger.warn(`Sidebar not open: ${sidebarId}`);
      return;
    }

    // 从打开顺序中移除
    this.#openOrder.splice(index, 1);

    // 移除DOM
    const panel = this.#containerElement.querySelector(`[data-sidebar-id="${sidebarId}"]`);
    panel?.remove();

    // 重新计算布局
    this.#recalculateLayout();

    // 触发事件
    this.#eventBus.emitGlobal('sidebar:closed:completed', {
      sidebarId,
      remainingIds: [...this.#openOrder]
    });

    logger.info(`Sidebar closed: ${sidebarId}`);
  }

  #createContainer() {
    this.#containerElement = document.createElement('div');
    this.#containerElement.id = 'unified-sidebar-container';
    this.#containerElement.className = 'unified-sidebar-container';
    document.body.appendChild(this.#containerElement);
  }

  #createSidebarPanel(config) {
    const panel = document.createElement('div');
    panel.className = 'sidebar-panel';
    panel.setAttribute('data-sidebar-id', config.id);

    // 渲染内容
    const content = config.contentRenderer();
    panel.appendChild(content);

    return panel;
  }

  #recalculateLayout() {
    const containerWidth = this.#containerElement.offsetWidth;
    const layouts = this.#layoutEngine.calculateLayout(this.#openOrder, containerWidth);

    this.#layoutEngine.applyLayout(layouts, this.#containerElement);

    this.#eventBus.emitGlobal('sidebar:layout:updated', { layouts });
  }

  #setupEventListeners() {
    this.#eventBus.onGlobal('sidebar:toggle:requested', ({ sidebarId }) => {
      this.toggleSidebar(sidebarId);
    });

    this.#eventBus.onGlobal('sidebar:open:requested', ({ sidebarId }) => {
      this.openSidebar(sidebarId);
    });

    this.#eventBus.onGlobal('sidebar:close:requested', ({ sidebarId }) => {
      this.closeSidebar(sidebarId);
    });
  }
}
```

#### 示例2: LayoutEngine实现

```javascript
export class LayoutEngine {
  calculateLayout(openSidebarIds, containerWidth) {
    const count = openSidebarIds.length;
    if (count === 0) return [];

    const layouts = [];
    const baseWidth = Math.floor(containerWidth / count);

    for (let i = 0; i < count; i++) {
      const isLast = i === count - 1;
      const left = i * baseWidth;
      const width = isLast ? containerWidth - left : baseWidth;

      layouts.push({
        id: openSidebarIds[i],
        left: left,
        width: width,
        zIndex: 100 + i
      });
    }

    return layouts;
  }

  applyLayout(layouts, containerElement) {
    layouts.forEach(layout => {
      const panel = containerElement.querySelector(`[data-sidebar-id="${layout.id}"]`);
      if (panel) {
        panel.style.left = `${layout.left}px`;
        panel.style.width = `${layout.width}px`;
        panel.style.zIndex = layout.zIndex;
      }
    });
  }
}
```

#### 示例3: Bootstrap注册

```javascript
// src/frontend/pdf-viewer/bootstrap/app-bootstrap-feature.js

import { SidebarManagerFeature } from '../features/sidebar-manager/index.js';

// ...其他Feature导入...

export async function bootstrapFeatures(registry, container, eventBus) {
  // 1. 注册核心Feature
  await registry.register(new SidebarManagerFeature());

  // 2. 获取SidebarManager实例
  const sidebarManager = container.resolve('sidebar-manager');

  // 3. 注册各侧边栏配置
  sidebarManager.registerSidebar({
    id: 'annotation',
    buttonSelector: '#annotation-sidebar-btn',
    title: '标注',
    contentRenderer: () => createAnnotationSidebar()
  });

  sidebarManager.registerSidebar({
    id: 'bookmark',
    buttonSelector: '#bookmark-sidebar-btn',
    title: '书签',
    contentRenderer: () => createBookmarkSidebar()
  });

  // ...其他侧边栏注册...

  // 4. 注册其他Features
  await registry.register(new BookmarkFeature());
  await registry.register(new AnnotationFeature());
  // ...
}
```

---

## 7. 约束条件

### 7.1 技术约束

| 约束 | 说明 | 解决方案 |
|------|------|----------|
| **最大并发数** | 最多同时4个侧边栏 | 在openSidebar()中检查数量限制 |
| **最小宽度** | 每个侧边栏最小250px | LayoutEngine计算时检查容器宽度 |
| **浏览器兼容** | 支持现代浏览器CSS Grid/Flexbox | 使用绝对定位 + JS计算布局 |
| **响应式** | 窗口缩放时重新布局 | 监听resize事件，debounce处理 |

### 7.2 性能约束

| 指标 | 目标值 | 验证方法 |
|------|--------|----------|
| **打开延迟** | < 200ms | Performance API测量 |
| **布局重排** | < 100ms | Chrome DevTools Timeline |
| **动画帧率** | ≥ 60fps | requestAnimationFrame监控 |
| **内存占用** | 每个侧边栏 < 5MB | Chrome Memory Profiler |

### 7.3 兼容性约束

- ✅ 必须兼容现有BookmarkFeature
- ✅ 不影响AnnotationFeature工具栏功能
- ✅ 支持未来Feature动态注册
- ⚠️ 侧边栏内部滚动由各Feature自行处理

---

## 8. 验收标准

### 8.1 功能验收

| 用例ID | 测试场景 | 操作步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|--------|
| **TC-01** | 单侧边栏打开 | 1. 点击书签按钮 | 书签侧边栏占据100%宽度显示 | P0 |
| **TC-02** | 双侧边栏并存 | 1. 点击书签按钮<br>2. 点击卡片按钮 | 书签在左50%，卡片在右50% | P0 |
| **TC-03** | 三侧边栏并存 | 1. 依次打开书签、卡片、翻译 | 三个侧边栏各占约33%宽度 | P0 |
| **TC-04** | 四侧边栏并存 | 1. 依次打开所有侧边栏 | 四个侧边栏各占25%宽度 | P1 |
| **TC-05** | 左流动验证 | 1. 打开书签（左）<br>2. 打开卡片（中）<br>3. 打开翻译（右） | 后开的总在右侧 | P0 |
| **TC-06** | 关闭中间侧边栏 | 1. 打开3个侧边栏<br>2. 关闭中间的 | 剩余2个重新均分宽度 | P0 |
| **TC-07** | 按钮切换关闭 | 1. 点击书签按钮打开<br>2. 再次点击书签按钮 | 书签侧边栏关闭 | P0 |
| **TC-08** | 侧边栏关闭按钮 | 1. 打开书签侧边栏<br>2. 点击侧边栏头部的X按钮 | 书签侧边栏关闭 | P0 |
| **TC-09** | 无激活状态 | 1. 点击任意侧边栏按钮 | 按钮**不显示**激活样式 | P0 |
| **TC-10** | 拖拽调整宽度 | 1. 打开书签侧边栏<br>2. 拖拽右侧分隔条向右 | 侧边栏宽度增加，鼠标样式为col-resize | P0 |
| **TC-11** | 宽度最小值约束 | 1. 打开侧边栏<br>2. 拖拽分隔条向左超过最小值 | 宽度停留在250px，无法继续缩小 | P0 |
| **TC-12** | 宽度最大值约束 | 1. 打开侧边栏<br>2. 拖拽分隔条向右超过最大值 | 宽度停留在600px，无法继续扩大 | P0 |
| **TC-13** | 宽度持久化 | 1. 调整侧边栏宽度到400px<br>2. 关闭侧边栏<br>3. 重新打开 | 侧边栏宽度保持为400px | P1 |
| **TC-14** | 多侧边栏宽度调整 | 1. 打开2个侧边栏<br>2. 调整第1个宽度 | 第2个侧边栏位置自动调整 | P0 |

### 8.2 性能验收

```javascript
// 性能测试脚本示例
describe('SidebarManager Performance', () => {
  test('打开侧边栏响应时间 < 200ms', async () => {
    const startTime = performance.now();
    sidebarManager.openSidebar('bookmark');
    await waitForAnimationEnd();
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(200);
  });

  test('布局重排时间 < 100ms', async () => {
    // 打开3个侧边栏
    sidebarManager.openSidebar('bookmark');
    sidebarManager.openSidebar('card');
    sidebarManager.openSidebar('translator');

    const startTime = performance.now();
    sidebarManager.closeSidebar('card');  // 触发重排
    await waitForLayoutComplete();
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(100);
  });
});
```

### 8.3 质量验收

| 检查项 | 标准 | 工具 |
|--------|------|------|
| **代码覆盖率** | ≥ 80% | Jest Coverage |
| **ESLint检查** | 0 errors | ESLint |
| **类型检查** | 0 errors | JSDoc + TypeScript ESLint |
| **日志规范** | 100%使用Logger | Code Review |
| **事件命名** | 100%符合规范 | EventBus验证器 |

### 8.4 文档验收

- ✅ API文档（JSDoc注释完整）
- ✅ 架构设计文档（本文档）
- ✅ 使用示例和最佳实践
- ✅ Feature迁移指南

---

## 9. 风险评估

### 9.1 技术风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| **现有Feature冲突** | 中 | 高 | 详细测试BookmarkFeature集成 |
| **性能问题** | 低 | 中 | 使用虚拟滚动和懒加载 |
| **浏览器兼容性** | 低 | 低 | 使用成熟的CSS技术 |
| **事件循环死锁** | 低 | 高 | EventBus防重入机制 |

### 9.2 项目风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| **依赖Feature未完成** | 高 | 中 | 先用Mock实现，后续替换 |
| **需求变更** | 中 | 中 | 模块化设计，易于修改 |
| **测试不充分** | 中 | 高 | 编写完整的自动化测试 |

---

## 10. 后续扩展

### 10.1 第二阶段功能

- **侧边栏拖拽排序**: 用户可以拖动侧边栏调整顺序
- **自定义宽度**: 用户可以拖动分隔线调整宽度
- **侧边栏最小化**: 点击图标折叠为图标栏
- **快捷键支持**: Ctrl+1/2/3/4 快速打开/关闭

### 10.2 第三阶段功能

- **侧边栏预设**: 保存和加载侧边栏布局配置
- **多屏支持**: 侧边栏可以拖出为独立窗口
- **主题定制**: 侧边栏颜色和样式自定义

---

## 11. 参考资料

### 11.1 项目文档

- `src/frontend/ARCHITECTURE-EXPLAINED.md` - 架构深度解析
- `src/frontend/HOW-TO-ADD-FEATURE.md` - Feature开发指南
- `.kilocode/rules/memory-bank/context.md` - 项目上下文
- `CLAUDE.md` - 项目开发规范

### 11.2 相关需求

- `20251002213000-pdf-annotation-sidebar` - 标注侧边栏
- `20251003140242-pdf-card-sidebar` - 卡片侧边栏
- `20251003173543-pdf-translator-sidebar` - 翻译侧边栏

### 11.3 代码位置

- `src/frontend/pdf-viewer/features/bookmark/` - 现有书签Feature
- `src/frontend/common/event/event-bus.js` - EventBus实现
- `src/frontend/common/micro-service/` - 共享基础设施

---

## 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v001 | 2025-10-04 | Claude AI | 初始版本创建 |
| v001.1 | 2025-10-04 | Claude AI | 需求变更：移除所有按钮激活状态，改为侧边栏关闭按钮 |
| v001.2 | 2025-10-04 | Claude AI | 需求新增：侧边栏宽度可拖拽调整（250-600px，支持持久化） |

---

**审批签字**:

- [ ] 产品经理: ________________  日期: ________
- [ ] 技术负责人: ____________  日期: ________
- [ ] 前端负责人: ____________  日期: ________
