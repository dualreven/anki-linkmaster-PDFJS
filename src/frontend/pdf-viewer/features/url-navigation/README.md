# URL Navigation Feature

> **URL参数导航功能** | 支持通过URL参数打开PDF并跳转到指定位置

## 📦 功能概述

URL Navigation功能域负责：
- 解析URL查询参数（pdf-id, page-at, position）
- 触发PDF文件加载
- 自动跳转到指定页面
- 滚动到页面内指定位置（百分比）
- 提供导航成功/失败的事件反馈

## 📁 目录结构

```
url-navigation/
├── index.js                  # Feature入口（实现IFeature接口）
├── feature.config.js         # 功能配置
├── README.md                # 本文档
├── components/
│   └── url-params-parser.js  # URL参数解析器
├── services/
│   └── navigation-service.js # 导航服务
└── __tests__/
    ├── url-params-parser.test.js
    ├── navigation-service.test.js
    └── url-navigation-feature.test.js
```

## 🎯 功能配置

| 配置项 | 值 |
|--------|-----|
| **名称** | `url-navigation` |
| **版本** | `1.0.0` |
| **依赖** | `app-core`, `pdf-manager` |
| **阶段** | Phase 1 |
| **优先级** | 中 |

## 📡 URL参数格式

### 基本格式
```
http://localhost:3000/?pdf-id=<文件ID>&page-at=<页码>&position=<百分比>
```

### 参数说明

| 参数名 | 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| `pdf-id` | string | ✅ | PDF文件ID（不含.pdf扩展名） | `sample-document` |
| `page-at` | number | ❌ | 目标页码（从1开始，默认1） | `5` |
| `position` | number | ❌ | 页面内垂直位置百分比（0-100，默认0） | `50` |

### 使用示例

```bash
# 打开sample.pdf的第5页
http://localhost:3000/?pdf-id=sample&page-at=5

# 打开sample.pdf的第5页，滚动到页面中间（50%）
http://localhost:3000/?pdf-id=sample&page-at=5&position=50

# 只打开sample.pdf（第1页，位置0%）
http://localhost:3000/?pdf-id=sample

# 打开sample.pdf第10页顶部
http://localhost:3000/?pdf-id=sample&page-at=10&position=0
```

## 📊 事件定义

### 监听的事件
- `pdf-viewer:file:load-success` - PDF加载成功（来自pdf-manager）
- `pdf-viewer:page:changing` - 页面正在切换（来自ui-manager）

### 发出的事件

#### URL参数解析完成
```javascript
'pdf-viewer:navigation:url-params:parsed'
{
  pdfId: string | null,      // PDF文件ID
  pageAt: number | null,     // 目标页码
  position: number | null    // 位置百分比
}
```

#### URL参数导航请求
```javascript
'pdf-viewer:navigation:url-params:requested'
{
  pdfId: string,             // PDF文件ID
  pageAt: number,            // 目标页码
  position: number | null    // 位置百分比（可选）
}
```

#### URL参数导航成功
```javascript
'pdf-viewer:navigation:url-params:success'
{
  pdfId: string,             // PDF文件ID
  pageAt: number,            // 实际页码
  position: number | null,   // 实际位置百分比
  duration: number           // 导航耗时(ms)
}
```

#### URL参数导航失败
```javascript
'pdf-viewer:navigation:url-params:failed'
{
  error: Error,              // 错误对象
  message: string,           // 错误消息
  stage: string              // 失败阶段('parse'|'load'|'navigate'|'scroll')
}
```

## 🛠️ 核心组件

### URLParamsParser
**职责**: 解析和验证URL参数

**方法**:
- `static parse(url)`: 解析URL并提取参数
- `static validate(params)`: 验证参数有效性

### NavigationService
**职责**: 执行导航和位置滚动

**方法**:
- `navigateTo(params)`: 执行完整的导航流程
- `scrollToPosition(percentage)`: 滚动到指定百分比位置
- `waitForPageReady()`: 等待页面渲染完成

## 🚀 使用示例

### 外部程序调用
```python
# Python示例：从Anki插件打开PDF
import webbrowser

pdf_id = "my-document"
page_num = 15
position = 75  # 滚动到75%位置

url = f"http://localhost:3000/?pdf-id={pdf_id}&page-at={page_num}&position={position}"
webbrowser.open(url)
```

### JavaScript示例
```javascript
// 手动触发URL参数导航
eventBus.emit('pdf-viewer:navigation:url-params:requested', {
  pdfId: 'sample',
  pageAt: 5,
  position: 50
});

// 监听导航成功
eventBus.on('pdf-viewer:navigation:url-params:success', ({ pdfId, pageAt, duration }) => {
  console.log(`Successfully navigated to ${pdfId} page ${pageAt} in ${duration}ms`);
});
```

## 📋 实施计划

| 任务 | 状态 |
|------|------|
| 创建Feature目录结构 | ✅ 完成 |
| 实现URLParamsParser | 🚧 进行中 |
| 实现NavigationService | 🚧 进行中 |
| 实现URLNavigationFeature主类 | ⏳ 待开始 |
| 编写单元测试 | ⏳ 待开始 |
| 集成测试 | ⏳ 待开始 |

## ✅ 验收标准

- ✅ Feature可注册到FeatureRegistry
- ✅ 依赖关系正确解析
- ✅ 生命周期钩子（install/uninstall）正常工作
- 🚧 URL参数正确解析（单元测试覆盖率 > 90%）
- 🚧 PDF加载+页面跳转+位置滚动完整流程正常
- 🚧 边界情况处理（无效参数、页码超范围、PDF不存在）
- 🚧 无参数时不影响正常流程（向后兼容）
- 🚧 端到端测试通过

## 🔍 技术细节

### 导航流程
```
URL解析 → 参数验证 → 触发PDF加载
  ↓
等待FILE.LOAD.SUCCESS事件
  ↓
触发NAVIGATION.GOTO事件 → ui-manager处理页面跳转
  ↓
等待PAGE.CHANGING事件
  ↓
执行页面内滚动到position百分比
  ↓
发出SUCCESS事件
```

### 错误处理
- 参数解析失败 → 发出FAILED事件（stage: 'parse'）
- PDF加载失败 → 发出FAILED事件（stage: 'load'）
- 页面跳转失败 → 发出FAILED事件（stage: 'navigate'）
- 位置滚动失败 → 发出FAILED事件（stage: 'scroll'）

### 性能要求
- URL解析响应时间 < 50ms
- 完整导航时间 < 5000ms（不含PDF加载）
- 滚动动画流畅（使用requestAnimationFrame）

---

**最后更新**: 2025-10-02
**状态**: 🚧 开发中
**负责人**: AI Assistant
