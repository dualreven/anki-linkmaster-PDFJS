# PDF Viewer 翻译功能 - 工作日志

**功能ID**: 20251003173543-pdf-translator-sidebar
**当前版本**: v001
**当前状态**: 需求设计完成，待开发

---

## 2025-10-03 17:35 - 需求创建

### 工作内容
- 创建需求文档 `v001-spec.md`
- 定义翻译功能的架构设计
- 规划与卡片功能的集成方式
- 制定 7 阶段开发计划（15天）

### 核心设计决策

#### 1. 架构选择：独立 Feature
**决策**: 作为独立的 `PDFTranslatorFeature` 实现
**理由**:
- 遵循 Feature-based 模块化架构
- 与卡片功能解耦，可独立开发和测试
- 通过 EventBus 实现功能间通信

#### 2. 翻译引擎策略
**决策**: 优先 DeepL，备选 Google，支持本地词典
**理由**:
- DeepL 翻译质量最高，适合专业文档
- Google API 作为备选，覆盖更多语言
- 本地词典支持离线场景

#### 3. 文本选择监听方案
**决策**: 使用 `SelectionMonitor` 服务监听文本选择事件
**技术方案**:
```javascript
document.addEventListener('mouseup', () => {
  const text = window.getSelection().toString();
  if (text.length >= 3) {
    eventBus.emit('pdf-translator:text:selected', { text });
  }
});
```
**关键点**:
- 防抖处理（300ms）
- 最少 3 个字符才触发
- 去重避免重复翻译

#### 4. 与卡片功能的集成方式
**决策**: 通过全局事件 `pdf-card:create:requested` 通信
**数据格式**:
```javascript
{
  cardData: {
    front: "英文原文",
    back: "中文翻译",
    source: "PDF文档名 - 第X页",
    tags: ["翻译", "PDF", "en"],
    extras: {
      context: "上下文句子",
      pronunciation: "发音"
    }
  },
  source: 'translator'
}
```
**优势**:
- 卡片功能可区分翻译卡片和其他类型卡片
- 松耦合，翻译功能和卡片功能互不依赖
- 易于扩展（未来可添加其他卡片来源）

#### 5. UI 布局设计
**决策**: 侧边栏布局包含实时翻译区和历史记录
**关键组件**:
1. **Header**: 翻译引擎选择器 + 关闭按钮
2. **实时翻译区**: 显示当前翻译结果，包含「制作卡片」按钮
3. **翻译历史**: 可折叠的历史记录列表

#### 6. 性能优化策略
**缓存机制**:
- 使用 Map 缓存翻译结果
- 缓存键: `${原文}:${目标语言}`
- 最大缓存 1000 条，TTL 24 小时

**防抖处理**:
- 文本选择触发延迟 300ms
- 避免用户拖拽选择时频繁触发

### 关键技术点

#### 1. DeepL API 集成
**API 端点**: `https://api-free.deepl.com/v2/translate`
**认证方式**: `Authorization: DeepL-Auth-Key ${API_KEY}`
**请求格式**:
```javascript
{
  text: ["要翻译的文本"],
  target_lang: "ZH"
}
```
**响应格式**:
```javascript
{
  translations: [{
    text: "翻译结果",
    detected_source_language: "EN"
  }]
}
```

#### 2. 文本选择 API
**获取选中文本**:
```javascript
const selection = window.getSelection();
const text = selection.toString().trim();
```
**获取选择位置**:
```javascript
const range = selection.getRangeAt(0);
const rect = range.getBoundingClientRect();
const position = { x: rect.left, y: rect.top };
```

#### 3. 事件系统设计
**事件命名规范**: `{module}:{action}:{status}`

**本地事件**（功能域内部）:
- `text:selected` - 文本被选中
- `translate:requested` - 请求翻译
- `translate:completed` - 翻译完成
- `translate:failed` - 翻译失败

**全局事件**（跨功能域）:
- `pdf-card:create:requested` - 请求创建卡片（发送给卡片功能）

### 风险评估

| 风险项 | 等级 | 应对措施 |
|-------|------|---------|
| DeepL API 配额限制 | 中 | 实现缓存，每月 50 万字符免费配额应够用 |
| 网络请求失败 | 中 | 重试 3 次，超时 5 秒，失败后切换到 Google API |
| 文本选择误触发 | 低 | 最少 3 字符 + 防抖 300ms |
| 翻译引擎响应慢 | 中 | 显示加载动画，超时提示 |
| 与卡片功能版本不匹配 | 低 | 事件数据格式向后兼容 |

---

## 开发阶段计划

### Phase 1: 基础架构（2天）
**目标**: 搭建 Feature 基础框架
- [ ] 创建目录结构
- [ ] 实现 PDFTranslatorFeature 类
- [ ] 定义事件常量
- [ ] 在 app-bootstrap-feature.js 注册

### Phase 2: 侧边栏 UI（2天）
**目标**: 实现翻译侧边栏界面
- [ ] 创建 TranslatorSidebarUI 组件
- [ ] 添加「翻译」按钮到主控制栏
- [ ] 实现侧边栏显示/隐藏动画
- [ ] 设计翻译结果卡片样式

### Phase 3: 翻译服务（3天）
**目标**: 实现翻译核心功能
- [ ] 创建 TranslationService 类
- [ ] 集成 DeepL API
- [ ] 实现缓存机制
- [ ] 添加错误处理和重试逻辑
- [ ] 支持多引擎切换

### Phase 4: 文本选择监听（2天）
**目标**: 实现自动翻译触发
- [ ] 创建 SelectionMonitor 类
- [ ] 监听 mouseup 事件
- [ ] 实现防抖和去重
- [ ] 自动触发翻译请求

### Phase 5: 卡片集成（2天）
**目标**: 实现翻译结果制卡功能
- [ ] 创建 CardIntegrationService 类
- [ ] 定义卡片数据格式
- [ ] 实现「制作卡片」按钮
- [ ] 发送 `pdf-card:create:requested` 事件
- [ ] 验证与卡片功能的集成

### Phase 6: 测试与优化（3天）
**目标**: 确保质量和性能
- [ ] 编写单元测试（覆盖率 > 80%）
- [ ] 编写集成测试
- [ ] 性能优化（缓存、防抖）
- [ ] 用户体验优化（动画、提示）
- [ ] 边界情况处理

### Phase 7: 文档与发布（1天）
**目标**: 完善文档并发布
- [ ] 编写 README
- [ ] 更新架构文档
- [ ] 代码审查
- [ ] 合并到 main 分支

**总计**: 15 个工作日

---

## 下一步计划

1. **立即执行**: 开始 Phase 1（基础架构搭建）
2. **技术调研**:
   - 研究 DeepL API 使用细节
   - 确认 API Key 获取方式
   - 测试 Selection API 在 PDF.js 中的兼容性
3. **与团队对齐**:
   - 确认翻译功能的优先级
   - 确认是否需要支持多语言翻译（不仅是英译中）
   - 确认卡片数据格式是否符合 Anki 需求

---

## 参考资料

### 待查阅文档
- [ ] DeepL API 官方文档: https://www.deepl.com/docs-api
- [ ] Google Translate API 文档
- [ ] Anki Connect API 文档
- [ ] Selection API MDN 文档

### 已参考代码
- ✅ `src/frontend/pdf-viewer/features/pdf-bookmark/` - 侧边栏参考实现
- ✅ `src/frontend/HOW-TO-ADD-FEATURE.md` - Feature 开发指南

---

**最后更新**: 2025-10-03 17:35:43
**负责人**: AI Assistant
**状态**: 📋 需求设计完成，等待开发启动
