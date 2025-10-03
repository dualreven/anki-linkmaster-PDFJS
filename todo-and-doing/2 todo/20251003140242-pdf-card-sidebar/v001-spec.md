# PDF Viewer 卡片栏功能规格说明（第一期）

**功能ID**: 20251003140242-pdf-card-sidebar
**优先级**: 高
**版本**: v001
**创建时间**: 2025-10-03 14:02:42
**预计完成**: 2025-10-08
**状态**: 设计中

## 现状说明

### 当前系统状态
- PDF Viewer 已实现 Feature-based 插件化架构
- 已有侧边栏实现参考：BookmarkManager 和 BookmarkSidebarUI
- UI 管理层已集成多种控件（缩放、导航、书签）
- WebSocket 通信已建立，可与后端交互（Anki集成）
- Text Layer 已启用，支持文本选择
- 标注功能正在开发中，为卡片制作提供基础

### 已有功能基础
1. **BookmarkSidebarUI**: 可参考的侧边栏实现，包含 header、列表、交互
2. **EventBus 事件总线**: 完整的事件驱动架构
3. **WebSocket 通信**: 与后端 Python 应用通信，可集成 Anki API
4. **文本选择**: Text Layer 支持选择文本内容
5. **截图能力**: 可通过 Canvas API 截取 PDF 页面区域

### Anki 集成基础
- 后端已有 PyQt5 环境，可集成 Anki Connect 或直接调用 Anki API
- 已有 WebSocket 通道，可实现前后端卡片数据交互
- 可通过 file_id 关联 PDF 文档与 Anki 卡片

## 存在问题

### 缺少的功能
1. **卡片管理界面**: 当前没有专门的卡片管理侧边栏
2. **Anki 集成**: 未建立与 Anki 的数据连接
3. **快速制卡工具**: 缺少便捷的卡片创建流程
4. **卡片复习入口**: 无法在 PDF 阅读过程中快速复习相关卡片

### 技术挑战
1. **Anki API 集成**: 需要研究 Anki Connect 或 AnkiDroid API
2. **截图实现**: 需要支持区域选择和高质量截图
3. **卡片数据模型**: 需要设计前后端统一的卡片数据结构
4. **临时牌组管理**: 需要实现动态创建和销毁牌组的逻辑

---

## 第一期目标：容器 UI 设计与基础架构

### 核心目标
**本期只实现基础 UI 容器和架构，不实现具体的业务逻辑，为后续迭代留好扩展接口。**

### 功能范围

#### 1. 卡片侧边栏容器 UI

##### 1.1 触发入口
- **卡片按钮位置**: 在 PDF Viewer 主 UI 的控制栏添加「卡片」按钮
- **按钮图标**: 📇 或类似卡片样式的 icon
- **点击行为**: 切换卡片侧边栏的显示/隐藏状态

##### 1.2 侧边栏布局
```
┌─────────────────────────────────┐
│ Header                          │
│ ┌─────┬──────┬──────┬──────┬─┐ │
│ │快速 │ 制卡 │ 复习 │排序/ │✕│ │
│ │制卡 │      │      │筛选  │ │ │
│ └─────┴──────┴──────┴──────┴─┘ │
├─────────────────────────────────┤
│ Body (Empty in Phase 1)         │
│                                 │
│ [预留：未来显示卡片列表]        │
│                                 │
│                                 │
│                                 │
│                                 │
│                                 │
│                                 │
└─────────────────────────────────┘
```

##### 1.3 Header 按钮设计

| 按钮名称 | 图标建议 | 第一期行为 | 未来功能 |
|---------|---------|-----------|---------|
| 快速制卡 | ⚡ | 显示"功能开发中"提示 | 打开快速制卡工具 |
| 制卡 | ➕ | 显示"功能开发中"提示 | 打开完整制卡窗口 |
| 复习 | 📖 | 显示"功能开发中"提示 | 创建临时牌组并开始复习 |
| 排序/筛选 | 🔽 | 显示"功能开发中"提示 | 打开排序/筛选菜单 |
| 关闭 | ✕ | 关闭侧边栏 | - |

##### 1.4 Body 区域设计
- **第一期状态**: 显示占位提示文本
  ```
  ┌─────────────────────────────┐
  │   📇                        │
  │   卡片功能开发中...          │
  │                             │
  │   即将支持：                 │
  │   • 查看与此PDF相关的卡片    │
  │   • 快速制作Anki卡片         │
  │   • 在阅读时复习卡片          │
  └─────────────────────────────┘
  ```
- **预留扩展点**:
  - 卡片列表容器（用于第2期加载卡片）
  - 卡片项组件（显示卡片摘要）
  - 空状态提示（无卡片时显示）

#### 2. 技术架构设计

##### 2.1 Feature 结构
```
src/frontend/pdf-viewer/features/pdf-card/
├── index.js                    # PDFCardFeature 主类
├── feature.config.js           # 功能配置
├── events.js                   # 事件常量定义
├── components/
│   ├── card-sidebar-ui.js      # 侧边栏UI组件
│   ├── card-header.js          # Header按钮组
│   └── card-placeholder.js     # 占位内容组件
├── services/
│   ├── card-manager.js         # 卡片管理服务（第一期仅框架）
│   └── anki-adapter.js         # Anki适配器（第一期仅接口定义）
└── styles/
    └── card-sidebar.css        # 样式文件
```

##### 2.2 事件定义（events.js）
```javascript
export const PDF_CARD_EVENTS = {
  // UI 交互事件
  SIDEBAR: {
    OPEN: 'pdf-card:sidebar:open',
    CLOSE: 'pdf-card:sidebar:close',
    TOGGLE: 'pdf-card:sidebar:toggle'
  },

  // 按钮点击事件（预留）
  QUICK_CREATE: {
    REQUESTED: 'pdf-card:quick-create:requested',  // 第2期实现
    STARTED: 'pdf-card:quick-create:started',
    COMPLETED: 'pdf-card:quick-create:completed',
    FAILED: 'pdf-card:quick-create:failed'
  },

  CREATE: {
    REQUESTED: 'pdf-card:create:requested',  // 第3期实现
    STARTED: 'pdf-card:create:started',
    COMPLETED: 'pdf-card:create:completed',
    FAILED: 'pdf-card:create:failed'
  },

  REVIEW: {
    REQUESTED: 'pdf-card:review:requested',  // 第4期实现
    STARTED: 'pdf-card:review:started',
    COMPLETED: 'pdf-card:review:completed',
    FAILED: 'pdf-card:review:failed'
  },

  // 卡片数据事件（预留）
  CARDS: {
    LOAD_REQUESTED: 'pdf-card:cards:load-requested',  // 第2期实现
    LOADED: 'pdf-card:cards:loaded',
    UPDATED: 'pdf-card:cards:updated',
    DELETED: 'pdf-card:cards:deleted'
  }
};
```

##### 2.3 服务接口定义

**CardManager 服务（第一期仅定义接口）**
```javascript
export class CardManager {
  /**
   * 加载与当前PDF关联的卡片（第2期实现）
   * @param {string} pdfId - PDF文档ID
   * @returns {Promise<Card[]>}
   */
  async loadCardsForPdf(pdfId) {
    throw new Error('Not implemented yet - Phase 2');
  }

  /**
   * 快速创建卡片（第2期实现）
   * @param {Object} cardData - 卡片数据
   * @returns {Promise<Card>}
   */
  async quickCreateCard(cardData) {
    throw new Error('Not implemented yet - Phase 2');
  }

  /**
   * 创建完整卡片（第3期实现）
   * @param {Object} cardData - 卡片数据
   * @returns {Promise<Card>}
   */
  async createCard(cardData) {
    throw new Error('Not implemented yet - Phase 3');
  }

  /**
   * 创建临时复习牌组（第4期实现）
   * @param {string[]} cardIds - 卡片ID列表
   * @returns {Promise<Deck>}
   */
  async createTemporaryDeck(cardIds) {
    throw new Error('Not implemented yet - Phase 4');
  }
}
```

**AnkiAdapter 服务（第一期仅定义接口）**
```javascript
export class AnkiAdapter {
  /**
   * 连接到Anki（第2期实现）
   * @returns {Promise<boolean>}
   */
  async connect() {
    throw new Error('Not implemented yet - Phase 2');
  }

  /**
   * 获取卡片列表（第2期实现）
   * @param {Object} query - 查询条件
   * @returns {Promise<Card[]>}
   */
  async getCards(query) {
    throw new Error('Not implemented yet - Phase 2');
  }

  /**
   * 添加新卡片（第2/3期实现）
   * @param {Object} cardData - 卡片数据
   * @returns {Promise<Card>}
   */
  async addCard(cardData) {
    throw new Error('Not implemented yet - Phase 2');
  }

  /**
   * 创建临时牌组（第4期实现）
   * @param {string} deckName - 牌组名称
   * @param {string[]} cardIds - 卡片ID列表
   * @returns {Promise<Deck>}
   */
  async createDeck(deckName, cardIds) {
    throw new Error('Not implemented yet - Phase 4');
  }
}
```

#### 3. 数据模型定义（预留）

##### 3.1 卡片数据结构
```javascript
/**
 * @typedef {Object} Card
 * @property {string} id - 卡片唯一ID（Anki生成）
 * @property {string} pdfId - 关联的PDF文档ID
 * @property {string} deckName - 所属牌组名称
 * @property {string} front - 卡片正面（问题）
 * @property {string} back - 卡片背面（答案）
 * @property {string[]} tags - 标签列表
 * @property {CardSource} source - 卡片来源信息
 * @property {number} createdAt - 创建时间戳
 * @property {number} modifiedAt - 修改时间戳
 */

/**
 * @typedef {Object} CardSource
 * @property {string} type - 来源类型: 'text' | 'screenshot' | 'mixed'
 * @property {number} pageNumber - 来源页码
 * @property {Object} selection - 选中区域信息（可选）
 */
```

##### 3.2 临时牌组数据结构
```javascript
/**
 * @typedef {Object} TemporaryDeck
 * @property {string} id - 临时牌组ID
 * @property {string} name - 牌组名称（格式：临时-PDF名称-时间戳）
 * @property {string[]} cardIds - 包含的卡片ID列表
 * @property {number} createdAt - 创建时间戳
 * @property {boolean} autoDestroy - 复习完成后是否自动销毁
 */
```

---

## 未来扩展规划

### 第二期：从 Anki 加载卡片（预计 2025-10-15）

#### 功能目标
- 实现 Anki API 集成（通过 AnkiConnect 或直接调用）
- 根据 PDF ID 查询关联的卡片列表
- 在侧边栏 Body 中显示卡片简要信息
- 点击卡片可展开详情或跳转到卡片编辑窗口

#### 技术要点
- **后端集成**: 安装并配置 AnkiConnect 插件，或使用 Anki 的 Python API
- **查询逻辑**: 通过自定义字段（如 `pdf_id`）关联卡片与 PDF
- **卡片展示**: 设计卡片列表项 UI，显示 front 的前 50 字符作为摘要
- **交互优化**: 支持点击卡片跳转到对应页码（如果有 `pageNumber` 字段）

#### 关键接口实现
- `AnkiAdapter.connect()` - 建立与 Anki 的连接
- `AnkiAdapter.getCards({ pdfId })` - 查询卡片
- `CardManager.loadCardsForPdf(pdfId)` - 加载并缓存卡片
- 事件：`pdf-card:cards:loaded` - 卡片加载完成

---

### 第三期：快速制卡功能（预计 2025-10-22）

#### 功能目标
- 提供「截图」和「文字选中」两种快速制卡方式
- 一键设置为「问题」或「答案」
- 简化流程，直接提交创建卡片

#### 操作流程
1. 点击「快速制卡」按钮
2. 进入制卡模式：
   - 方式 A：框选 PDF 区域截图
   - 方式 B：选中文本内容
3. 选择内容类型：
   - 「设为问题」按钮
   - 「设为答案」按钮
4. 自动填充对应字段，点击「提交」即可创建

#### 技术要点
- **截图实现**: 使用 Canvas API 截取 PDF 页面的指定区域
- **文本选择**: 利用已有的 Text Layer 获取选中文本
- **临时状态管理**: 暂存问题和答案，允许多次添加内容
- **自动填充元数据**: 自动记录 PDF ID、页码、来源类型

#### 关键接口实现
- `CardManager.quickCreateCard(cardData)` - 快速创建卡片
- `AnkiAdapter.addCard(cardData)` - 调用 Anki API 添加卡片
- 事件：`pdf-card:quick-create:completed` - 快速制卡完成

---

### 第四期：完整制卡功能（预计 2025-11-01）

#### 功能目标
- 打开独立的卡片编辑窗口（类似 Anki 的添加窗口）
- 支持插入标注内容（高亮、笔记等）
- 支持手动编辑问题和答案
- 提供更多选项：牌组选择、标签、卡片类型等

#### 操作流程
1. 点击「制卡」按钮
2. 打开完整的卡片编辑窗口
3. 可选操作：
   - 从侧边栏标注列表选择内容插入
   - 使用截图/文字选中工具添加内容
   - 手动编辑问题和答案字段
4. 设置卡片选项（牌组、标签、类型）
5. 点击「保存」创建卡片

#### 技术要点
- **模态窗口**: 实现类似 pdf-edit 的模态框管理器
- **富文本编辑**: 支持 HTML 格式的问题和答案
- **标注集成**: 从标注侧边栏获取内容（需第五期标注功能完成）
- **表单验证**: 确保必填字段完整

#### 关键接口实现
- `CardManager.createCard(cardData)` - 完整创建卡片
- 模态窗口组件：`CardEditModal`
- 事件：`pdf-card:create:completed` - 制卡完成

---

### 第五期：复习功能（预计 2025-11-10）

#### 功能目标
- 点击「复习」按钮后自动创建临时牌组
- 牌组包含当前 PDF 筛选后的卡片（根据排序/筛选设置）
- 打开 Anki 复习界面或内嵌复习组件
- 复习结束后自动销毁临时牌组

#### 操作流程
1. 点击「复习」按钮
2. 系统自动：
   - 获取当前侧边栏中筛选后的卡片列表
   - 创建临时牌组（命名：`临时-{PDF名称}-{时间戳}`）
   - 将卡片添加到临时牌组
3. 打开复习界面（Anki 原生或自定义）
4. 用户完成复习
5. 系统自动销毁临时牌组，卡片归还原牌组

#### 技术要点
- **临时牌组管理**: 使用唯一 ID 标识，设置 `autoDestroy` 标志
- **Anki 复习集成**: 调用 Anki 的复习模式，或实现简单的 SRS 算法
- **状态追踪**: 监听复习完成事件，触发清理逻辑
- **错误处理**: 如果销毁失败，记录日志并提示用户手动清理

#### 关键接口实现
- `CardManager.createTemporaryDeck(cardIds)` - 创建临时牌组
- `AnkiAdapter.createDeck(deckName, cardIds)` - 调用 Anki API
- `AnkiAdapter.startReview(deckId)` - 启动复习模式
- `CardManager.destroyTemporaryDeck(deckId)` - 销毁临时牌组
- 事件：`pdf-card:review:completed` - 复习完成

---

## 技术实现细节

### 1. 侧边栏 UI 实现

#### 1.1 CardSidebarUI 组件
```javascript
export class CardSidebarUI {
  #container = null;
  #header = null;
  #body = null;
  #isVisible = false;
  #eventBus = null;

  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#createUI();
    this.#attachEventListeners();
  }

  #createUI() {
    // 创建侧边栏容器
    this.#container = document.createElement('div');
    this.#container.className = 'card-sidebar';
    this.#container.style.display = 'none'; // 初始隐藏

    // 创建 Header
    this.#header = this.#createHeader();
    this.#container.appendChild(this.#header);

    // 创建 Body
    this.#body = this.#createBody();
    this.#container.appendChild(this.#body);

    // 添加到页面
    document.body.appendChild(this.#container);
  }

  #createHeader() {
    const header = document.createElement('div');
    header.className = 'card-sidebar-header';

    const buttons = [
      { id: 'quick-create', text: '快速制卡', icon: '⚡' },
      { id: 'create', text: '制卡', icon: '➕' },
      { id: 'review', text: '复习', icon: '📖' },
      { id: 'filter', text: '排序/筛选', icon: '🔽' },
      { id: 'close', text: '关闭', icon: '✕' }
    ];

    buttons.forEach(({ id, text, icon }) => {
      const btn = document.createElement('button');
      btn.className = `card-header-btn card-header-btn-${id}`;
      btn.innerHTML = `<span class="icon">${icon}</span><span class="text">${text}</span>`;
      btn.dataset.action = id;
      header.appendChild(btn);
    });

    return header;
  }

  #createBody() {
    const body = document.createElement('div');
    body.className = 'card-sidebar-body';

    // 第一期：显示占位内容
    body.innerHTML = `
      <div class="card-placeholder">
        <div class="placeholder-icon">📇</div>
        <div class="placeholder-title">卡片功能开发中...</div>
        <div class="placeholder-features">
          <p>即将支持：</p>
          <ul>
            <li>查看与此PDF相关的卡片</li>
            <li>快速制作Anki卡片</li>
            <li>在阅读时复习卡片</li>
          </ul>
        </div>
      </div>
    `;

    return body;
  }

  show() {
    this.#container.style.display = 'block';
    this.#isVisible = true;
    this.#eventBus.emit('pdf-card:sidebar:open');
  }

  hide() {
    this.#container.style.display = 'none';
    this.#isVisible = false;
    this.#eventBus.emit('pdf-card:sidebar:close');
  }

  toggle() {
    this.#isVisible ? this.hide() : this.show();
  }
}
```

#### 1.2 样式设计
```css
/* card-sidebar.css */
.card-sidebar {
  position: fixed;
  top: 0;
  right: 0;
  width: 320px;
  height: 100vh;
  background: #ffffff;
  border-left: 1px solid #e0e0e0;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  transition: transform 0.3s ease;
}

.card-sidebar-header {
  display: flex;
  padding: 12px 8px;
  border-bottom: 1px solid #e0e0e0;
  background: #f5f5f5;
  gap: 4px;
}

.card-header-btn {
  flex: 1;
  padding: 8px 4px;
  border: 1px solid #d0d0d0;
  background: #ffffff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  text-align: center;
  transition: all 0.2s;
}

.card-header-btn:hover {
  background: #f0f0f0;
  border-color: #1976d2;
}

.card-header-btn-close {
  flex: 0 0 40px;
  background: #f44336;
  color: white;
  border-color: #d32f2f;
}

.card-sidebar-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

/* 占位内容样式 */
.card-placeholder {
  text-align: center;
  padding: 40px 20px;
  color: #666;
}

.placeholder-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.placeholder-title {
  font-size: 18px;
  font-weight: 500;
  margin-bottom: 24px;
}

.placeholder-features ul {
  text-align: left;
  list-style: none;
  padding: 0;
}

.placeholder-features li {
  padding: 8px 0;
  padding-left: 24px;
  position: relative;
}

.placeholder-features li::before {
  content: '•';
  position: absolute;
  left: 8px;
  color: #1976d2;
}
```

### 2. Feature 主类实现

```javascript
// index.js
import { getLogger } from '../../../common/utils/logger.js';
import { PDFCardFeatureConfig } from './feature.config.js';
import { PDF_CARD_EVENTS } from './events.js';
import { CardSidebarUI } from './components/card-sidebar-ui.js';
import { CardManager } from './services/card-manager.js';
import { AnkiAdapter } from './services/anki-adapter.js';

export class PDFCardFeature {
  #logger = null;
  #eventBus = null;
  #sidebarUI = null;
  #cardManager = null;
  #ankiAdapter = null;
  #enabled = false;

  get name() { return PDFCardFeatureConfig.name; }
  get version() { return PDFCardFeatureConfig.version; }
  get dependencies() { return PDFCardFeatureConfig.dependencies; }

  async install(context) {
    this.#logger = context.logger || getLogger(`Feature.${this.name}`);
    this.#eventBus = context.scopedEventBus;

    this.#logger.info(`Installing ${this.name} v${this.version}...`);

    // 初始化服务（第一期仅框架）
    this.#ankiAdapter = new AnkiAdapter(this.#eventBus, this.#logger);
    this.#cardManager = new CardManager(this.#ankiAdapter, this.#eventBus, this.#logger);

    // 创建侧边栏 UI
    this.#sidebarUI = new CardSidebarUI(this.#eventBus);

    // 注册事件监听
    this.#registerEventListeners();

    // 添加卡片按钮到主 UI（需要与 ui-manager 集成）
    this.#addCardButtonToUI();

    this.#enabled = true;
    this.#logger.info(`${this.name} installed successfully`);
  }

  async uninstall(context) {
    this.#logger.info(`Uninstalling ${this.name}...`);

    // 清理 UI
    if (this.#sidebarUI) {
      this.#sidebarUI.destroy();
    }

    this.#enabled = false;
  }

  #registerEventListeners() {
    // 监听侧边栏切换事件
    this.#eventBus.subscribe(PDF_CARD_EVENTS.SIDEBAR.TOGGLE, () => {
      this.#sidebarUI.toggle();
    });

    // 监听按钮点击事件（第一期仅提示）
    this.#eventBus.subscribe(PDF_CARD_EVENTS.QUICK_CREATE.REQUESTED, () => {
      alert('快速制卡功能开发中，敬请期待！\n预计第二期（2025-10-15）发布');
    });

    this.#eventBus.subscribe(PDF_CARD_EVENTS.CREATE.REQUESTED, () => {
      alert('制卡功能开发中，敬请期待！\n预计第三期（2025-10-22）发布');
    });

    this.#eventBus.subscribe(PDF_CARD_EVENTS.REVIEW.REQUESTED, () => {
      alert('复习功能开发中，敬请期待！\n预计第四期（2025-11-01）发布');
    });
  }

  #addCardButtonToUI() {
    // TODO: 与 ui-manager 集成，添加卡片按钮
    // 第一期可能需要手动在 HTML 中添加按钮
    this.#logger.debug('Card button should be added to UI manually in Phase 1');
  }

  isEnabled() {
    return this.#enabled;
  }
}
```

### 3. 配置文件

```javascript
// feature.config.js
export const PDFCardFeatureConfig = {
  name: 'pdf-card',
  version: '1.0.0',
  dependencies: ['app-core', 'pdf-manager', 'ui-manager'],

  // 功能标志（分期控制）
  features: {
    phase1: {
      enabled: true,
      description: '容器UI设计'
    },
    phase2: {
      enabled: false,
      description: '从Anki加载卡片'
    },
    phase3: {
      enabled: false,
      description: '快速制卡功能'
    },
    phase4: {
      enabled: false,
      description: '完整制卡功能'
    },
    phase5: {
      enabled: false,
      description: '复习功能'
    }
  }
};
```

---

## 验收标准

### 第一期验收标准

#### 功能验收
- [ ] 点击「卡片」按钮能正常打开/关闭侧边栏
- [ ] 侧边栏显示正确的 Header 按钮（5个按钮）
- [ ] 侧边栏 Body 显示占位提示内容
- [ ] 点击「关闭」按钮能关闭侧边栏
- [ ] 点击其他功能按钮显示"开发中"提示

#### 技术验收
- [ ] PDFCardFeature 正确实现 IFeature 接口
- [ ] 在 FeatureRegistry 中成功注册并安装
- [ ] 事件常量定义完整（包含未来扩展事件）
- [ ] 服务接口定义完整（CardManager、AnkiAdapter）
- [ ] 代码符合 ESLint 规范
- [ ] 通过单元测试（UI 组件创建、事件触发）

#### 用户体验验收
- [ ] 侧边栏打开/关闭动画流畅（< 300ms）
- [ ] 侧边栏布局美观，与整体 UI 风格一致
- [ ] 按钮 hover 效果明显
- [ ] 占位提示文案清晰、友好

---

## 风险与挑战

### 技术风险
1. **Anki API 兼容性**: 不同版本 Anki 的 API 可能不同，需要充分测试
2. **截图质量**: Canvas 截图的清晰度需要优化，避免模糊
3. **临时牌组管理**: 需要处理异常情况（如用户手动删除牌组、Anki 崩溃等）
4. **性能问题**: 加载大量卡片时可能卡顿，需要分页或虚拟滚动

### 解决方案
1. **API 兼容**: 优先支持最新版 Anki，提供降级方案
2. **截图优化**: 使用高分辨率 Canvas，提供质量选项
3. **容错处理**: 添加完善的错误处理和恢复机制
4. **性能优化**: 实现虚拟滚动，按需加载卡片

---

## 开发计划

### 第一期（2025-10-03 ~ 2025-10-08）
- **Day 1**: 创建 Feature 目录结构，定义接口
- **Day 2**: 实现 CardSidebarUI 组件
- **Day 3**: 实现 PDFCardFeature 主类，集成到 FeatureRegistry
- **Day 4**: 编写样式文件，优化 UI
- **Day 5**: 编写单元测试，修复 bug
- **Day 6**: 集成测试，文档完善

### 后续期次（简要）
- **第二期（2025-10-15）**: Anki 集成，卡片加载
- **第三期（2025-10-22）**: 快速制卡工具
- **第四期（2025-11-01）**: 完整制卡窗口
- **第五期（2025-11-10）**: 复习功能

---

## 参考资料

### Anki 相关
- [AnkiConnect 插件文档](https://foosoft.net/projects/anki-connect/)
- [Anki 官方 API 文档](https://github.com/ankitects/anki/blob/main/docs/addons.md)
- [AnkiDroid API](https://github.com/ankidroid/Anki-Android/wiki/AnkiDroid-API)

### 项目内参考
- `src/frontend/pdf-viewer/features/pdf-bookmark/` - 侧边栏实现参考
- `src/frontend/pdf-home/features/pdf-edit/` - 模态框实现参考
- `src/frontend/HOW-TO-ADD-FEATURE.md` - Feature 开发指南
- `.kilocode/rules/FEATURE-REGISTRATION-RULES.md` - Feature 注册规则

---

## 附录

### A. 卡片数据流图
```
┌──────────────┐
│  PDF Viewer  │
└──────┬───────┘
       │
       │ 1. 用户点击「卡片」
       ↓
┌──────────────┐
│ CardFeature  │
└──────┬───────┘
       │
       │ 2. 发送事件
       ↓
┌──────────────┐      3. 查询卡片       ┌──────────────┐
│ CardManager  │ ───────────────────→   │ AnkiAdapter  │
└──────┬───────┘                        └──────┬───────┘
       │                                       │
       │ 4. 返回卡片数据                       │ 5. 调用 Anki API
       ↓                                       ↓
┌──────────────┐                        ┌──────────────┐
│ CardSidebarUI│                        │   Anki DB    │
└──────────────┘                        └──────────────┘
   显示卡片列表
```

### B. 事件流图
```
用户操作                事件                     监听者
────────────────────────────────────────────────────────
点击「卡片」按钮    →  sidebar:toggle      →  CardFeature
点击「快速制卡」    →  quick-create:req    →  CardManager
点击「制卡」        →  create:requested    →  CardManager
点击「复习」        →  review:requested    →  CardManager
卡片加载完成        →  cards:loaded        →  CardSidebarUI
```

---

**文档版本**: v001
**最后更新**: 2025-10-03 14:02:42
**作者**: Claude Code AI Assistant
