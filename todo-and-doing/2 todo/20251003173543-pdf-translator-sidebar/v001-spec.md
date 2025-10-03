# PDF Viewer 翻译侧边栏功能规格说明

**功能ID**: 20251003173543-pdf-translator-sidebar
**优先级**: 高
**版本**: v001
**创建时间**: 2025-10-03 17:35:43
**预计完成**: 2025-10-15
**状态**: 设计中
**依赖需求**: 20251003140242-pdf-card-sidebar（卡片功能）

---

## 📋 功能概述

### 核心功能
在 PDF Viewer 中添加**翻译侧边栏**功能，支持实时翻译选中的文本内容，并可将翻译结果直接制作成 Anki 卡片。

### 功能定位
- **独立功能域**: 作为独立的 Feature 实现（`PDFTranslatorFeature`）
- **与卡片功能联动**: 翻译结果可一键发送到卡片侧边栏
- **实时响应**: 监听文本选择事件，自动触发翻译

---

## 🏗️ 架构设计

### 1. Feature 基础信息

```javascript
/**
 * PDF 翻译功能域
 * @class PDFTranslatorFeature
 * @implements {IFeature}
 */
export class PDFTranslatorFeature {
  get name() { return 'pdf-translator'; }
  get version() { return '1.0.0'; }
  get dependencies() {
    return ['app-core', 'ui-manager'];  // 依赖核心和UI管理器
  }
}
```

### 2. 目录结构

```
src/frontend/pdf-viewer/features/pdf-translator/
├── index.js                          # Feature 主类
├── feature.config.js                 # 配置文件
├── events.js                         # 事件常量定义
├── components/
│   ├── TranslatorSidebarUI.js       # 侧边栏 UI 组件
│   └── TranslationResultCard.js     # 翻译结果卡片组件
├── services/
│   ├── TranslationService.js        # 翻译服务（API 调用）
│   ├── SelectionMonitor.js          # 文本选择监听服务
│   └── CardIntegrationService.js    # 卡片集成服务
├── models/
│   └── TranslationRecord.js         # 翻译记录数据模型
└── __tests__/
    ├── TranslationService.test.js
    └── TranslatorFeature.test.js
```

### 3. 核心组件职责

#### 3.1 TranslatorSidebarUI（侧边栏 UI）
- **职责**: 渲染翻译侧边栏界面
- **位置**: 在卡片侧边栏下方，或作为独立侧边栏
- **交互**: 显示翻译结果、历史记录、设置选项

#### 3.2 TranslationService（翻译服务）
- **职责**: 调用翻译 API，处理翻译请求
- **支持引擎**:
  - 优先：DeepL API（高质量）
  - 备选：Google Translate API
  - 本地：离线词典（基础翻译）
- **缓存机制**: 避免重复翻译相同内容

#### 3.3 SelectionMonitor（选择监听器）
- **职责**: 监听 PDF 文本选择事件
- **触发条件**: 用户选中文本后释放鼠标
- **去重处理**: 避免重复触发翻译

#### 3.4 CardIntegrationService（卡片集成）
- **职责**: 将翻译结果转换为卡片数据
- **数据格式**:
  ```javascript
  {
    front: "英文原文",
    back: "中文翻译",
    source: "PDF文档名 - 第X页",
    tags: ["翻译", "PDF"],
    extras: {
      context: "上下文句子",
      pronunciation: "发音"
    }
  }
  ```

---

## 🎨 UI 设计

### 1. 触发入口

#### 1.1 按钮位置
```
主控制栏按钮布局：
┌──────────────────────────────────┐
│ [缩放] [导航] [书签] [卡片] [翻译] │  ← 新增「翻译」按钮
└──────────────────────────────────┘
```

#### 1.2 按钮设计
- **图标**: 🌐 或 🔤
- **文本**: "翻译"
- **点击行为**: 切换翻译侧边栏显示/隐藏

### 2. 侧边栏布局

```
┌─────────────────────────────────────┐
│ Header                              │
│ ┌──────────────────────────────┬─┐ │
│ │ 翻译设置 (DeepL/Google)       │✕│ │
│ └──────────────────────────────┴─┘ │
├─────────────────────────────────────┤
│ 实时翻译区                           │
│ ┌─────────────────────────────────┐ │
│ │ 原文:                            │ │
│ │ The quick brown fox...          │ │
│ │                                 │ │
│ │ 译文:                            │ │
│ │ 敏捷的棕色狐狸...                │ │
│ │                                 │ │
│ │ [制作卡片] [复制] [朗读]         │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ 翻译历史 (可折叠)                    │
│ ┌─────────────────────────────────┐ │
│ │ • quick (adj.) - 快速的          │ │
│ │ • translate - 翻译               │ │
│ │ ...                             │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 3. 交互流程

```
用户选中文本
    ↓
SelectionMonitor 检测到选择
    ↓
发送事件: pdf-translator:text:selected
    ↓
TranslationService 调用 API
    ↓
发送事件: pdf-translator:translate:completed
    ↓
TranslatorSidebarUI 显示结果
    ↓
用户点击「制作卡片」按钮
    ↓
CardIntegrationService 转换数据
    ↓
发送事件: pdf-card:create:requested
    ↓
卡片侧边栏接收并创建卡片
```

---

## 🔌 事件系统设计

### 事件定义 (events.js)

```javascript
/**
 * PDF 翻译功能域事件常量
 * @module PDFTranslatorEvents
 */
export const PDF_TRANSLATOR_EVENTS = {
  // 文本选择事件
  TEXT_SELECTED: 'pdf-translator:text:selected',

  // 翻译请求事件
  TRANSLATE_REQUESTED: 'pdf-translator:translate:requested',
  TRANSLATE_COMPLETED: 'pdf-translator:translate:completed',
  TRANSLATE_FAILED: 'pdf-translator:translate:failed',

  // 侧边栏事件
  SIDEBAR_TOGGLE: 'pdf-translator:sidebar:toggle',
  SIDEBAR_OPENED: 'pdf-translator:sidebar:opened',
  SIDEBAR_CLOSED: 'pdf-translator:sidebar:closed',

  // 卡片集成事件
  CARD_CREATE_REQUESTED: 'pdf-translator:card:create-requested',

  // 设置事件
  ENGINE_CHANGED: 'pdf-translator:engine:changed',
};
```

### 事件数据格式

#### 文本选择事件
```javascript
{
  type: 'pdf-translator:text:selected',
  data: {
    text: '选中的文本内容',
    pageNumber: 42,
    position: { x: 100, y: 200 },
    timestamp: Date.now()
  }
}
```

#### 翻译完成事件
```javascript
{
  type: 'pdf-translator:translate:completed',
  data: {
    original: '英文原文',
    translation: '中文翻译',
    engine: 'deepl',
    language: {
      source: 'en',
      target: 'zh'
    },
    extras: {
      pronunciation: '/kwɪk/',
      partOfSpeech: 'adjective'
    }
  }
}
```

---

## 🔧 服务层设计

### 1. TranslationService

```javascript
/**
 * 翻译服务类
 * @class TranslationService
 */
class TranslationService {
  #apiKey = null;
  #engine = 'deepl';  // 'deepl' | 'google' | 'local'
  #cache = new Map();

  /**
   * 翻译文本
   * @param {string} text - 原文
   * @param {string} targetLang - 目标语言 (默认 'zh')
   * @returns {Promise<TranslationResult>}
   */
  async translate(text, targetLang = 'zh') {
    // 1. 检查缓存
    const cacheKey = `${text}:${targetLang}`;
    if (this.#cache.has(cacheKey)) {
      return this.#cache.get(cacheKey);
    }

    // 2. 调用翻译 API
    const result = await this.#callAPI(text, targetLang);

    // 3. 缓存结果
    this.#cache.set(cacheKey, result);

    return result;
  }

  /**
   * 调用翻译 API（私有方法）
   */
  async #callAPI(text, targetLang) {
    if (this.#engine === 'deepl') {
      return await this.#callDeepL(text, targetLang);
    } else if (this.#engine === 'google') {
      return await this.#callGoogle(text, targetLang);
    } else {
      return await this.#localTranslate(text, targetLang);
    }
  }

  /**
   * 切换翻译引擎
   */
  setEngine(engine) {
    this.#engine = engine;
  }
}
```

### 2. SelectionMonitor

```javascript
/**
 * 文本选择监听服务
 * @class SelectionMonitor
 */
class SelectionMonitor {
  #eventBus = null;
  #lastSelection = null;
  #debounceTimer = null;

  constructor(eventBus) {
    this.#eventBus = eventBus;
  }

  /**
   * 开始监听文本选择
   */
  startMonitoring() {
    document.addEventListener('mouseup', this.#handleMouseUp.bind(this));
  }

  /**
   * 停止监听
   */
  stopMonitoring() {
    document.removeEventListener('mouseup', this.#handleMouseUp);
  }

  /**
   * 处理鼠标释放事件
   * @private
   */
  #handleMouseUp() {
    // 防抖处理（300ms）
    clearTimeout(this.#debounceTimer);
    this.#debounceTimer = setTimeout(() => {
      const selection = window.getSelection();
      const text = selection.toString().trim();

      // 至少选中3个字符才触发
      if (text.length >= 3 && text !== this.#lastSelection) {
        this.#lastSelection = text;
        this.#eventBus.emit('pdf-translator:text:selected', {
          text,
          pageNumber: this.#getCurrentPage(),
          position: this.#getSelectionPosition(selection)
        });
      }
    }, 300);
  }
}
```

### 3. CardIntegrationService

```javascript
/**
 * 卡片集成服务
 * @class CardIntegrationService
 */
class CardIntegrationService {
  #eventBus = null;

  /**
   * 将翻译结果转换为卡片
   * @param {TranslationResult} translation
   */
  createCardFromTranslation(translation) {
    const cardData = {
      front: translation.original,
      back: translation.translation,
      source: this.#buildSourceInfo(),
      tags: ['翻译', 'PDF', translation.language.source],
      extras: {
        context: translation.extras?.context,
        pronunciation: translation.extras?.pronunciation,
        partOfSpeech: translation.extras?.partOfSpeech
      }
    };

    // 发送到卡片功能域
    this.#eventBus.emitGlobal('pdf-card:create:requested', {
      cardData,
      source: 'translator'
    });
  }

  /**
   * 构建来源信息
   * @private
   */
  #buildSourceInfo() {
    const fileName = window.PDF_PATH?.split('/').pop() || 'Unknown';
    const pageNumber = this.#getCurrentPage();
    return `${fileName} - 第${pageNumber}页`;
  }
}
```

---

## 🔄 与卡片功能的集成

### 1. 功能依赖关系

```
PDFTranslatorFeature (翻译功能)
    ↓ 依赖
UIManagerCore (UI 管理器)
    ↓ 通过事件通信
PDFCardFeature (卡片功能)
```

### 2. 事件通信流程

```javascript
// 翻译功能发送事件
eventBus.emitGlobal('pdf-card:create:requested', {
  cardData: {
    front: "quick",
    back: "快速的",
    source: "document.pdf - 第5页",
    tags: ["翻译", "PDF", "en"]
  },
  source: 'translator'
});

// 卡片功能监听事件
eventBus.on('pdf-card:create:requested', (data) => {
  if (data.source === 'translator') {
    // 创建翻译类型的卡片
    this.createTranslationCard(data.cardData);
  }
});
```

### 3. 数据流

```
用户选中文本
    ↓
翻译服务处理
    ↓
显示翻译结果
    ↓
用户点击「制作卡片」
    ↓
CardIntegrationService 转换数据
    ↓
发送全局事件: pdf-card:create:requested
    ↓
PDFCardFeature 接收事件
    ↓
创建 Anki 卡片
    ↓
显示在卡片侧边栏
```

---

## 📦 翻译 API 集成

### 1. DeepL API（推荐）

#### 优势
- 翻译质量高
- 支持多种语言
- 有免费配额（每月 500,000 字符）

#### 集成方式
```javascript
async function callDeepL(text, targetLang) {
  const response = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: [text],
      target_lang: targetLang.toUpperCase()
    })
  });

  const data = await response.json();
  return {
    original: text,
    translation: data.translations[0].text,
    engine: 'deepl',
    language: {
      source: data.translations[0].detected_source_language,
      target: targetLang
    }
  };
}
```

### 2. Google Translate API（备选）

#### 集成方式
```javascript
async function callGoogle(text, targetLang) {
  const response = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        target: targetLang,
        format: 'text'
      })
    }
  );

  const data = await response.json();
  return {
    original: text,
    translation: data.data.translations[0].translatedText,
    engine: 'google',
    language: {
      source: data.data.translations[0].detectedSourceLanguage,
      target: targetLang
    }
  };
}
```

### 3. 本地词典（离线）

#### 方案
- 使用 IndexedDB 存储词典数据
- 支持基础单词翻译
- 无需网络连接

---

## 🎯 开发阶段规划

### Phase 1: 基础架构（第 1-2 天）
- [x] 创建 Feature 目录结构
- [ ] 实现 PDFTranslatorFeature 类
- [ ] 定义事件常量
- [ ] 注册到 FeatureRegistry

### Phase 2: 侧边栏 UI（第 3-4 天）
- [ ] 实现 TranslatorSidebarUI 组件
- [ ] 添加翻译按钮到主控制栏
- [ ] 实现侧边栏显示/隐藏动画
- [ ] 设计翻译结果展示卡片

### Phase 3: 翻译服务（第 5-7 天）
- [ ] 实现 TranslationService
- [ ] 集成 DeepL API
- [ ] 实现缓存机制
- [ ] 添加错误处理和重试逻辑

### Phase 4: 文本选择监听（第 8-9 天）
- [ ] 实现 SelectionMonitor
- [ ] 监听文本选择事件
- [ ] 实现防抖和去重
- [ ] 自动触发翻译

### Phase 5: 卡片集成（第 10-11 天）
- [ ] 实现 CardIntegrationService
- [ ] 设计卡片数据格式
- [ ] 实现与卡片功能的事件通信
- [ ] 一键制卡功能

### Phase 6: 测试与优化（第 12-14 天）
- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试
- [ ] 性能优化（缓存、防抖）
- [ ] 用户体验优化

### Phase 7: 文档与发布（第 15 天）
- [ ] 编写 README
- [ ] 更新 HOW-TO-ADD-FEATURE 文档
- [ ] 提交代码审查
- [ ] 合并到 main 分支

---

## ⚙️ 配置文件

### feature.config.js

```javascript
/**
 * PDF 翻译功能配置
 */
export const TranslatorFeatureConfig = {
  name: 'pdf-translator',
  version: '1.0.0',

  // 翻译引擎配置
  translation: {
    defaultEngine: 'deepl',
    engines: {
      deepl: {
        apiUrl: 'https://api-free.deepl.com/v2/translate',
        maxChars: 500,  // 单次最大字符数
        timeout: 5000   // 超时时间（毫秒）
      },
      google: {
        apiUrl: 'https://translation.googleapis.com/language/translate/v2',
        maxChars: 1000,
        timeout: 3000
      }
    },

    // 语言设置
    defaultSourceLang: 'auto',  // 自动检测
    defaultTargetLang: 'zh',     // 默认翻译为中文

    // 缓存设置
    cache: {
      enabled: true,
      maxSize: 1000,  // 最多缓存 1000 条
      ttl: 86400000   // 缓存有效期（24小时）
    }
  },

  // UI 设置
  ui: {
    sidebar: {
      width: '320px',
      position: 'right',
      animation: {
        duration: 300,
        easing: 'ease-in-out'
      }
    },

    // 自动翻译设置
    autoTranslate: {
      enabled: true,
      minLength: 3,      // 最少选中字符数
      debounceDelay: 300 // 防抖延迟（毫秒）
    }
  },

  // 事件配置
  events: {
    namespace: 'pdf-translator',

    // 本地事件（仅功能域内部）
    local: [
      'text:selected',
      'translate:requested',
      'translate:completed',
      'translate:failed'
    ],

    // 全局事件（跨功能域通信）
    global: [
      'pdf-card:create:requested'
    ]
  }
};
```

---

## 🧪 测试策略

### 1. 单元测试

#### TranslationService.test.js
```javascript
describe('TranslationService', () => {
  test('should translate text using DeepL', async () => {
    const service = new TranslationService({ engine: 'deepl' });
    const result = await service.translate('quick', 'zh');

    expect(result.translation).toBe('快速的');
    expect(result.engine).toBe('deepl');
  });

  test('should use cache for repeated translations', async () => {
    const service = new TranslationService();

    await service.translate('quick', 'zh');
    const result = await service.translate('quick', 'zh');

    // 第二次应该从缓存读取，速度更快
    expect(result.fromCache).toBe(true);
  });
});
```

#### SelectionMonitor.test.js
```javascript
describe('SelectionMonitor', () => {
  test('should emit event when text is selected', (done) => {
    const eventBus = new EventBus();
    const monitor = new SelectionMonitor(eventBus);

    eventBus.on('pdf-translator:text:selected', (data) => {
      expect(data.text).toBe('test selection');
      done();
    });

    monitor.startMonitoring();
    // 模拟文本选择...
  });
});
```

### 2. 集成测试

```javascript
describe('Translator Feature Integration', () => {
  test('should create card from translation', async () => {
    // 1. 选择文本
    // 2. 等待翻译完成
    // 3. 点击「制作卡片」
    // 4. 验证卡片已创建
  });
});
```

---

## 🚨 风险评估

| 风险项 | 等级 | 应对措施 |
|-------|------|---------|
| API 配额限制 | 中 | 实现缓存机制，避免重复翻译 |
| 网络请求失败 | 中 | 添加重试机制，提供降级方案 |
| 翻译质量问题 | 低 | 优先使用 DeepL，提供多引擎切换 |
| 性能问题（频繁翻译） | 中 | 防抖处理，最小选中字符数限制 |
| 与卡片功能冲突 | 低 | 通过事件解耦，明确接口定义 |

---

## 📚 参考资料

### 已查阅文档
- ✅ `src/frontend/HOW-TO-ADD-FEATURE.md` - Feature 开发指南
- ✅ `todo-and-doing/2 todo/20251003140242-pdf-card-sidebar/v001-spec.md` - 卡片功能规格
- ✅ `.kilocode/rules/FEATURE-REGISTRATION-RULES.md` - 注册规则

### API 文档
- [ ] DeepL API 官方文档
- [ ] Google Translate API 文档
- [ ] Anki Connect API（卡片创建）

### 技术参考
- [ ] Selection API - 文本选择处理
- [ ] Fetch API - HTTP 请求
- [ ] IndexedDB - 本地词典存储

---

## 📝 总结

### 核心特性
1. ✅ **独立 Feature**: 遵循 Feature-based 架构，独立开发
2. ✅ **实时翻译**: 自动监听文本选择，实时翻译
3. ✅ **多引擎支持**: DeepL、Google、本地词典
4. ✅ **卡片集成**: 一键将翻译结果制作成 Anki 卡片
5. ✅ **事件驱动**: 通过 EventBus 与其他功能解耦通信

### 技术亮点
- **Feature-based 模块化**: 完全遵循项目架构标准
- **事件驱动通信**: 与卡片功能松耦合，可独立开发
- **服务层设计**: 翻译、选择监听、卡片集成分离
- **性能优化**: 缓存、防抖、去重机制
- **可扩展性**: 支持多翻译引擎，易于扩展

---

**最后更新**: 2025-10-03 17:35:43
**负责人**: AI Assistant
**审核人**: 待定
