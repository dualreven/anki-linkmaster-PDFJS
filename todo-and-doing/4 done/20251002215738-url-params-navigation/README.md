# URL参数导航功能 - 使用文档

## 功能概述

URL参数导航功能允许从外部程序（如Anki）通过命令行参数打开PDF并自动跳转到指定页面和位置。

## 技术架构

### 参数流转链路
```
外部程序 (Anki)
    ↓
ai_launcher.py (根启动器)
    ↓
launcher.py (前端启动器)
    ↓
URL参数 (?pdf-id=xxx&page-at=5&position=50)
    ↓
URLNavigationFeature (前端Feature)
    ↓
PDF自动加载 + 页面跳转 + 位置滚动
```

### 核心组件

1. **ai_launcher.py** (根启动器)
   - 解析命令行参数
   - 启动Vite开发服务器
   - 启动后端服务
   - 调用前端launcher.py并传递参数

2. **launcher.py** (前端启动器)
   - 接收参数并构建URL
   - 启动QtWebEngine窗口
   - 加载带参数的Vite页面

3. **URLNavigationFeature** (前端Feature)
   - 解析URL参数
   - 触发PDF加载
   - 执行页面导航和位置滚动

## 使用方法

### 方式1: 通过ai_launcher.py启动（推荐）

ai_launcher.py会自动启动所有必需的服务（Vite + 后端 + 前端）。

#### 基础用法
```bash
# 只打开PDF
python ai_launcher.py start --module pdf-viewer --pdf-id sample

# 打开PDF并跳转到第5页
python ai_launcher.py start --module pdf-viewer --pdf-id sample --page-at 5

# 打开PDF、跳转到第5页并滚动到50%位置
python ai_launcher.py start --module pdf-viewer --pdf-id sample --page-at 5 --position 50
```

#### 完整参数说明
```bash
python ai_launcher.py start \
  --module pdf-viewer \           # 前端模块 (pdf-home|pdf-viewer)
  --pdf-id <id> \                 # PDF文件ID
  --page-at <page> \              # 目标页码 (1-based, 可选)
  --position <percentage> \       # 页面内垂直位置百分比 0-100 (可选)
  --vite-port <port> \            # Vite开发服务器端口 (可选，默认3000)
  --msgServer-port <port> \       # WebSocket消息服务器端口 (可选，默认8765)
  --pdfFileServer-port <port>     # PDF文件服务器端口 (可选，默认8080)
```

### 方式2: 直接使用launcher.py（需手动启动服务）

如果Vite和后端服务已经启动，可以直接调用launcher.py。

```bash
# 前提条件: Vite (3000) 和后端服务 (8765, 8080) 已启动

# 只打开PDF
python src/frontend/pdf-viewer/launcher.py --pdf-id sample

# 打开PDF并跳转到第5页
python src/frontend/pdf-viewer/launcher.py --pdf-id sample --page-at 5

# 打开PDF、跳转到第5页并滚动到50%位置
python src/frontend/pdf-viewer/launcher.py --pdf-id sample --page-at 5 --position 50
```

## 参数详细说明

### --pdf-id (必需)
- **类型**: 字符串
- **说明**: PDF文件的唯一标识符
- **示例**: `sample`, `document`, `test.pdf`

### --page-at (可选)
- **类型**: 整数
- **说明**: 目标页码，1-based索引（第1页=1）
- **取值范围**: 1 到 PDF总页数
- **默认行为**: 不指定时默认打开第1页
- **示例**: `--page-at 5` (跳转到第5页)

### --position (可选)
- **类型**: 浮点数
- **说明**: 页面内垂直位置百分比
- **取值范围**: 0.0 - 100.0
  - 0.0 = 页面顶部
  - 50.0 = 页面中间
  - 100.0 = 页面底部
- **边界保护**: 超出范围的值会自动限制到0-100
- **默认行为**: 不指定时默认页面顶部
- **示例**: `--position 50` (滚动到页面中间)

## 参数组合示例

### 1. 基础打开
```bash
python ai_launcher.py start --module pdf-viewer --pdf-id research-paper
```
**效果**: 打开research-paper.pdf，显示第1页顶部

### 2. 跳转到特定页面
```bash
python ai_launcher.py start --module pdf-viewer --pdf-id thesis --page-at 42
```
**效果**: 打开thesis.pdf，跳转到第42页顶部

### 3. 精确定位（页+位置）
```bash
python ai_launcher.py start --module pdf-viewer --pdf-id textbook --page-at 128 --position 75
```
**效果**: 打开textbook.pdf，跳转到第128页并滚动到75%位置（靠近底部）

### 4. 自定义端口
```bash
python ai_launcher.py start \
  --module pdf-viewer \
  --pdf-id document \
  --page-at 10 \
  --position 25 \
  --vite-port 3001 \
  --msgServer-port 8766 \
  --pdfFileServer-port 8081
```
**效果**: 使用自定义端口启动所有服务，并打开PDF到指定位置

## 错误处理

### 参数验证
- **pdf-id为空**: Feature发出FAILED事件，不加载PDF
- **page-at超出范围**: 自动限制到1或最大页数
- **position超出范围**: 自动限制到0.0-100.0
- **page-at非整数**: 命令行参数解析失败，显示错误信息
- **position非数字**: 命令行参数解析失败，显示错误信息

### 常见问题

**Q: 为什么PDF没有跳转到指定页面？**
A: 检查以下几点：
1. page-at参数是否正确传递（查看日志）
2. 页码是否在有效范围内（1到总页数）
3. URLNavigationFeature是否已注册（查看app-bootstrap-feature.js）

**Q: position参数不生效？**
A:
1. position参数必须与page-at一起使用
2. 确保值在0-100范围内
3. 检查浏览器控制台是否有JavaScript错误

**Q: ai_launcher.py启动失败？**
A:
1. 检查端口是否被占用（3000, 8765, 8080）
2. 确保Vite和后端服务正常
3. 查看logs/ai-launcher.log日志

## 技术细节

### URL参数格式
```
http://localhost:3000/pdf-viewer/?msgCenter=8765&pdfs=8080&pdf-id=sample&page-at=5&position=50
```

### 事件流程
```javascript
1. URLNavigationFeature.install()
   ↓
2. URLParamsParser.parse(window.location.href)
   ↓
3. 发出事件: NAVIGATION.URL_PARAMS.PARSED
   ↓
4. 参数验证: URLParamsParser.validate()
   ↓
5. 触发PDF加载: FILE.LOAD.REQUESTED
   ↓
6. 监听加载成功: FILE.LOAD.SUCCESS
   ↓
7. 执行导航: NavigationService.navigateTo()
   ↓
8. 页面跳转: NAVIGATION.GOTO事件
   ↓
9. 等待渲染: 监听PAGE.CHANGING事件
   ↓
10. 位置滚动: NavigationService.scrollToPosition()
    ↓
11. 发出成功事件: URL_PARAMS.SUCCESS
```

### 性能特性
- **参数解析**: < 5ms
- **页面跳转**: 依赖PDF渲染速度
- **平滑滚动**: 使用easeInOutQuad缓动函数
- **超时保护**: 页面渲染等待最多5秒

### 向后兼容性
- 无参数时不影响现有功能
- Feature可在app-bootstrap-feature.js中轻松启用/禁用
- 通过EventBus通信，零侵入现有代码

## 测试验证

### 单元测试
```bash
# URLParamsParser测试 (34个测试)
npm test -- url-params-parser

# URLNavigationFeature测试 (13个测试)
npm test -- url-navigation
```

### 集成测试
```bash
# URL构建逻辑测试
python test_url_navigation.py

# ai_launcher参数传递测试
python test_ai_launcher_navigation.py
```

## 开发文档

详细开发文档请查看：
- [功能规格说明](./v001-spec.md)
- [工作日志](./working-log.md)
- [Feature实现](../../src/frontend/pdf-viewer/features/url-navigation/README.md)

## 更新历史

- **2025-10-02 23:15**: ai_launcher.py添加--page-at和--position参数支持
- **2025-10-02 23:00**: launcher.py添加URL导航参数支持
- **2025-10-02 22:30**: URLNavigationFeature实现完成
- **2025-10-02 21:57**: 功能需求创建
