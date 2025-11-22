# PDF URL Loader Feature

> **URL参数导航功能** | 支持通过URL参数加载PDF文件

## ⚠️ 功能变更说明（2024-11 版本）

**URL 参数跳转功能已移除**。pdf-url-loader 模块现在只负责：
1. 解析 URL 中的 `pdf-id` 和 `title` 参数
2. 触发 PDF 文件加载（通过 WebSocket）
3. 响应其他模块通过事件发出的手动导航请求

**如需在启动时跳转到特定位置，请通过以下方式**：
- **WebSocket 消息**：启动后发送导航消息
- **事件触发**：其他 Feature 监听 `FILE.LOAD.SUCCESS` 后触发导航
- **UI 操作**：用户手动点击书签、大纲或标注

---

## 📦 功能概述

URL Navigation功能域负责：
- ✅ 解析URL查询参数（`pdf-id`, `title`）
- ✅ 触发PDF文件加载（通过 WebSocket 请求文件详情）
- ✅ 响应其他模块的手动导航请求（通过事件）
- ✅ 提供导航成功/失败的事件反馈
- ❌ ~~自动跳转到指定页面~~（已移除）
- ❌ ~~解析导航参数（page-at, position, anchor-id 等）~~（已移除）

## 📁 目录结构

```
pdf-url-loader/
├── index.js                        # Feature入口（实现IFeature接口）
├── feature.config.js               # 功能配置
├── README.md                       # 本文档
├── components/
│   ├── url-params-parser.js        # URL参数解析器（仅解析 pdf-id 和 title）
│   └── url-jump-dispatcher.js      # 跳转分发器（已禁用）
└── __tests__/
    ├── url-params-parser.test.js
    ├── url-navigation-feature.test.js
    ├── public-api.test.js
    ├── negative-old-param.routing.test.js
    └── url-navigation.log-level.guard.test.js
```

## 🎯 功能配置

| 配置项 | 值 |
|--------|-----|
| **名称** | `pdf-url-loader` |
| **版本** | `1.0.0` |
| **依赖** | `infra-app`, `pdf-manager`, `infra-nav-core` |
| **阶段** | Phase 1 |
| **优先级** | 中 |

## 📡 URL参数格式

### 支持的参数（当前版本）

| 参数名 | 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| `pdf-id` | string | ✅ | PDF文件ID（不含.pdf扩展名） | `sample-document` |
| `title` | string | ❌ | PDF标题（可选，用于显示） | `My%20Document` |

### 已移除的参数（不再支持）

以下参数在 URL 中会被忽略：
- ❌ `page-at` - 目标页码（请使用 WebSocket 消息或事件触发导航）
- ❌ `position` - 页面内位置百分比
- ❌ `anchor-id` - 锚点ID
- ❌ `annotation-id` - 标注ID
- ❌ `outline-item-id` - 大纲项ID

### 使用示例

```bash
# 打开 sample.pdf
http://localhost:3000/?pdf-id=sample

# 打开 sample.pdf 并设置标题
http://localhost:3000/?pdf-id=sample&title=Sample%20Document

# 不含任何参数（不加载PDF）
http://localhost:3000/

# 旧的导航参数会被忽略
http://localhost:3000/?pdf-id=sample&page-at=5&position=50
# ↑ 只会加载 sample.pdf，不会跳转到第5页
```

## 📊 事件定义

### 监听的事件

- `pdf-viewer:file:load-success` - PDF加载成功（来自 pdf-manager）
- `pdf-viewer:file:load-failed` - PDF加载失败（来自 pdf-manager）
- `pdf-viewer:navigation:url-params:requested` - 手动导航请求（来自其他 Feature）

### 发出的事件

#### URL参数解析完成
```javascript
'pdf-viewer:navigation:url-params:parsed'
{
  pdfId: string | null,      // PDF文件ID
  title: string | null,      // PDF标题
  hasParams: boolean         // 是否存在任何参数
}
```

#### PDF加载请求
```javascript
'pdf-viewer:file:load:requested'
{
  filename: string,          // 文件名（自动添加 .pdf 扩展名）
  source: "pdf-url-loader"    // 请求来源
}
```

#### 手动导航成功
```javascript
'pdf-viewer:navigation:url-params:success'
{
  pdfId: string,             // PDF文件ID
  pageAt: number,            // 实际页码
  position: number | null,   // 实际位置百分比
  duration: number           // 导航耗时(ms)
}
```

#### 手动导航失败
```javascript
'pdf-viewer:navigation:url-params:failed'
{
  error: Error,              // 错误对象
  message: string,           // 错误消息
  stage: string              // 失败阶段('parse'|'validate'|'load'|'navigate')
}
```

## 🛠️ 核心组件

### URLParamsParser
**职责**: 解析和验证URL参数（仅 pdf-id 和 title）

**方法**:
- `static parse(url?: string)`: 解析URL并提取参数
- `static validate(params)`: 验证参数有效性
- `static normalize(params)`: 标准化参数值
- `static buildQueryString(params)`: 构建查询字符串

### URLJumpDispatcher
**职责**: ~~执行URL导航跳转~~（已禁用）

**状态**:
- `tryExecute()` 方法返回 `{type: "disabled", message: "..."}`
- 所有跳转逻辑已移除

### PDFUrlLoaderFeature
**职责**:
- 解析启动时的 URL 参数
- 触发 PDF 文件加载（如果 URL 包含 pdf-id）
- 响应其他模块的手动导航请求（通过事件）

## 🚀 使用示例

### 外部程序调用（仅加载PDF）
```python
# Python示例：从Anki插件打开PDF
import webbrowser

pdf_id = "my-document"

# 只加载PDF，不跳转
url = f"http://localhost:3000/?pdf-id={pdf_id}"
webbrowser.open(url)

# 如需跳转，请在PDF加载后通过WebSocket发送导航消息
```

### JavaScript示例（手动导航请求）
```javascript
// 通过事件触发手动导航（需要先加载PDF）
eventBus.emit('pdf-viewer:navigation:url-params:requested', {
  pdfId: 'sample',        // 如果与当前PDF不同，会重新加载
  pageAt: 5,              // 目标页码
  position: 50            // 位置百分比（可选）
});

// 监听导航成功
eventBus.on('pdf-viewer:navigation:url-params:success', ({ pdfId, pageAt, duration }) => {
  console.log(`Successfully navigated to ${pdfId} page ${pageAt} in ${duration}ms`);
});
```

### 启动时加载并跳转的正确方式
```javascript
// 方案1：监听 FILE.LOAD.SUCCESS 后触发导航
eventBus.on('pdf-viewer:file:load-success', (data) => {
  // PDF 加载成功后，触发导航
  eventBus.emit('pdf-viewer:navigation:url-params:requested', {
    pdfId: data.filename,
    pageAt: 5,
    position: 50
  });
});

// 方案2：通过 WebSocket 发送导航消息
// （需要后端支持）
wsClient.send({
  type: 'navigate',
  payload: {
    pdfId: 'sample',
    pageAt: 5,
    position: 50
  }
});
```

## 📋 开发状态

| 任务 | 状态 |
|------|------|
| 创建Feature目录结构 | ✅ 完成 |
| 实现URLParamsParser | ✅ 完成 |
| 实现PDFUrlLoaderFeature主类 | ✅ 完成 |
| 编写单元测试 | ✅ 完成 |
| 集成测试 | ✅ 完成 |
| 移除URL跳转功能 | ✅ 完成（2024-11） |
| 清理过时测试和文档 | 🚧 进行中 |

## ✅ 验收标准

- ✅ Feature可注册到FeatureRegistry
- ✅ 依赖关系正确解析
- ✅ 生命周期钩子（install/uninstall）正常工作
- ✅ URL参数正确解析（单元测试覆盖率 > 90%）
- ✅ PDF加载流程正常
- ✅ 手动导航请求正常工作
- ✅ 边界情况处理（无效参数、PDF不存在）
- ✅ 无参数时不影响正常流程（向后兼容）

## 🔍 技术细节

### PDF加载流程（启动时）
```
URL解析 → 参数验证 → WebSocket查询文件详情
  ↓
发出 FILE.LOAD.REQUESTED 事件
  ↓
pdf-manager 处理加载
  ↓
发出 FILE.LOAD.SUCCESS 或 FILE.LOAD.FAILED 事件
```

### 手动导航流程（通过事件触发）
```
接收 URL_PARAMS.REQUESTED 事件
  ↓
参数验证 → pdfId不同？重新加载PDF : 同文档内导航
  ↓
调用 navigationService.navigateTo()
  ↓
发出 SUCCESS 或 FAILED 事件
```

### 错误处理
- 参数解析失败 → 发出FAILED事件（stage: 'parse'）
- 参数验证失败 → 发出FAILED事件（stage: 'validate'）
- PDF加载失败 → 发出FAILED事件（stage: 'load'）
- 导航执行失败 → 发出FAILED事件（stage: 'navigate'）

### 性能要求
- URL解析响应时间 < 50ms
- PDF加载触发响应时间 < 100ms
- 事件处理响应时间 < 50ms

---

## 🔧 迁移指南（从旧版本升级）

如果您之前使用 URL 参数进行自动跳转，请参考以下迁移方案：

### 旧代码（不再工作）
```python
# ❌ 旧方式：期望自动跳转
url = f"http://localhost:3000/?pdf-id=sample&page-at=5&position=50"
webbrowser.open(url)
```

### 新代码（推荐方式）

#### 方案 A：使用 WebSocket 消息（推荐）
```python
# 1. 先打开PDF
url = f"http://localhost:3000/?pdf-id=sample"
webbrowser.open(url)

# 2. 通过 WebSocket 发送导航消息
import websocket
ws = websocket.create_connection("ws://localhost:8765")
ws.send(json.dumps({
    "type": "navigate",
    "payload": {"pdfId": "sample", "pageAt": 5, "position": 50}
}))
ws.close()
```

#### 方案 B：前端监听文件加载后触发导航
```javascript
// 在前端代码中添加
eventBus.on('pdf-viewer:file:load-success', (data) => {
  const urlParams = URLParamsParser.parse();
  if (urlParams.pdfId === data.filename) {
    // 从其他来源获取导航参数（如 localStorage、URL hash 等）
    const navParams = getStoredNavigationParams();
    if (navParams) {
      eventBus.emit('pdf-viewer:navigation:url-params:requested', navParams);
    }
  }
});
```

---

**最后更新**: 2024-11-18
**状态**: ✅ 稳定（URL跳转功能已移除）
**负责人**: AI Assistant
