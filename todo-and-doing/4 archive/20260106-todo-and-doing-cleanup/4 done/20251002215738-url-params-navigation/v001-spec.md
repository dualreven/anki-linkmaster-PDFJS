# URL参数跳转功能规格说明

**功能ID**: 20251002215738-url-params-navigation
**优先级**: 中
**版本**: v001
**创建时间**: 2025-10-02 21:57:38
**预计完成**: 2025-10-05
**状态**: 设计中

## 现状说明
- PDF-Viewer目前支持通过WebSocket从PDF管理界面打开PDF文件
- 打开PDF后默认从第一页开始显示
- 没有URL参数解析机制来控制初始显示位置
- 外部程序（如Anki插件）无法直接指定PDF打开后的精确位置

## 存在问题
- 缺少从外部程序唤醒PDF-Viewer并跳转到指定位置的能力
- 无法通过URL参数传递PDF文件标识、页码和页面内位置信息
- 需要用户手动导航到目标页面和位置，降低了用户体验
- 与Anki等外部应用的集成能力受限

## 提出需求
### 核心功能需求
1. **URL参数解析**: 解析URL中的`pdf-id`、`page-at`、`position`参数
2. **PDF定位加载**: 根据参数加载指定PDF并跳转到指定页面和位置
3. **位置百分比支持**: 支持通过百分比（0-100）指定页面内垂直位置
4. **外部唤醒支持**: 允许外部程序通过URL唤醒PDF-Viewer窗口

### 性能要求
- URL参数解析响应时间 < 50ms
- PDF定位跳转完成时间 < 500ms（不含PDF加载时间）
- 支持跨平台URL scheme调用（Windows/macOS/Linux）

## 解决方案
### 技术方案
1. **URL参数格式设计**
   ```
   http://localhost:3000/?pdf-id=<文件ID>&page-at=<页码>&position=<百分比>
   ```
   - `pdf-id`: PDF文件的唯一标识（不含.pdf扩展名）
   - `page-at`: 目标页码（从1开始）
   - `position`: 页面内垂直位置百分比（0-100，可选）

2. **实现流程**
   - 前端启动时检查URL参数
   - 通过WebSocket向后端请求完整文件路径
   - 加载PDF文档并等待渲染完成
   - 跳转到指定页码
   - 如果有position参数，滚动到页面的指定百分比位置

3. **关键模块**
   - URLParamsParser: 解析和验证URL参数
   - PDFNavigationController: 控制PDF跳转和位置定位
   - 集成到现有的PDFManager和WebSocketClient

## 约束条件
### 仅修改本模块代码
仅修改 `pdf-viewer` 模块中的代码，不可修改其他模块的代码

### 严格遵循代码规范和标准
必须优先阅读和理解 `src/frontend/pdf-viewer/docs/SPEC/SPEC-HEAD-pdf-viewer.yml` 下的代码规范

### 兼容性约束
- 必须与现有的PDF加载流程兼容
- 不能破坏现有的WebSocket通信机制
- 需要保持向后兼容（无参数时正常工作）

## 可行验收标准
### 单元测试
- URLParamsParser单元测试覆盖率 > 90%
- 参数验证测试：有效参数、无效参数、缺失参数
- 边界值测试：page-at=0、page-at超出范围、position=0/100

### 端到端测试
#### 测试场景1: 基本跳转
- 输入URL: `?pdf-id=sample&page-at=5`
- 预期结果: 打开sample.pdf并显示第5页

#### 测试场景2: 位置定位
- 输入URL: `?pdf-id=sample&page-at=5&position=50`
- 预期结果: 打开sample.pdf第5页，滚动到页面中间（50%）

#### 测试场景3: 边界情况
- 页码超出范围：跳转到最后一页
- position超出0-100：限制在有效范围内
- pdf-id不存在：显示友好错误提示

#### 测试场景4: 无参数兼容性
- 输入URL: 无参数
- 预期结果: 正常显示PDF管理界面

### 接口实现
#### 接口1: URLParamsParser.parse()
**函数**: `URLParamsParser.parse(urlString)`
**描述**: 解析URL字符串并提取导航参数
**参数**:
- `urlString` (string): 完整的URL字符串
**返回值**:
```javascript
{
  pdfId: string | null,      // PDF文件ID
  pageAt: number | null,     // 目标页码（从1开始）
  position: number | null    // 位置百分比（0-100）
}
```

#### 接口2: PDFNavigationController.navigateTo()
**函数**: `PDFNavigationController.navigateTo(params)`
**描述**: 根据导航参数跳转到指定PDF位置
**参数**:
```javascript
{
  pdfId: string,           // PDF文件ID
  pageAt: number,          // 目标页码
  position?: number        // 可选的位置百分比
}
```
**返回值**: `Promise<boolean>` - 导航是否成功

### 类实现
#### 类1: URLParamsParser
**类**: `URLParamsParser`
**描述**: 负责解析和验证URL参数
**属性**: 无（静态工具类）
**方法**:
- `static parse(urlString)`: 解析URL参数
- `static validate(params)`: 验证参数有效性

#### 类2: PDFNavigationController
**类**: `PDFNavigationController`
**描述**: 控制PDF文档的导航和位置定位
**属性**:
- `pdfViewer`: PDF.js viewer实例
- `currentPage`: 当前页码
**方法**:
- `navigateTo(params)`: 执行导航
- `scrollToPosition(percentage)`: 滚动到指定百分比位置
- `waitForPageReady()`: 等待页面渲染完成

### 事件规范
#### 事件1: pdf:navigation:requested
**描述**: 当URL参数请求导航时触发
**参数**:
```javascript
{
  pdfId: string,
  pageAt: number,
  position: number | null
}
```
**返回值**: 无

#### 事件2: pdf:navigation:completed
**描述**: 导航完成时触发
**参数**:
```javascript
{
  success: boolean,
  pdfId: string,
  pageAt: number,
  error?: string
}
```
**返回值**: 无

## 实现步骤
1. 创建URLParamsParser类和单元测试
2. 创建PDFNavigationController类和单元测试
3. 在PDF-Viewer启动流程中集成参数解析
4. 实现WebSocket请求获取完整文件路径
5. 实现页面跳转和位置滚动逻辑
6. 编写端到端测试
7. 文档更新和使用示例

## 参考资料
- PDF.js API文档: https://mozilla.github.io/pdf.js/api/
- URL API标准: https://url.spec.whatwg.org/
- 现有代码: `src/frontend/pdf-viewer/js/pdf-manager/`
