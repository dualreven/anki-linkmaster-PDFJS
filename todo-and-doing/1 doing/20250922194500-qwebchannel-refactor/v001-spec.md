# PDF-Home模块QWebChannel通信重构规格说明

**功能ID**: 20250922194500-qwebchannel-refactor
**优先级**: 中
**版本**: v001
**创建时间**: 2025-09-22 19:45:00
**预计完成**: 2025-09-25
**状态**: 设计中

## 现状说明
- 当前pdf-home模块使用WebSocket与后端AnkiLinkMasterApp通信
- 前端PDFHomeManager通过WebSocket发送消息（如request_file_selection, add_pdf等）
- 后端AnkiLinkMasterApp.handle_websocket_message()处理消息并调用PDFManager
- 文件选择使用QFileDialog.getOpenFileName()在后端进程显示

## 存在问题
- WebSocket增加了通信复杂度，需要消息序列化/反序列化
- 消息类型定义需要前后端同步维护
- 调试困难，无法直接调用Python方法
- 异步消息处理增加了错误处理复杂度

## 提出需求
- 在pdf-home模块中使用QWebChannel替代WebSocket通信
- JavaScript可以直接调用Python对象的方法
- 保持现有的PDFManager接口不变
- 文件选择等UI操作更直观

## 解决方案
- 在pdf-home模块的PyQt窗口中集成QWebChannel
- 创建PdfHomeBridge类暴露给JavaScript调用
- 保留WebSocket用于打开pdf-viewer窗口（模块间通信）

## 约束条件
### 仅修改本模块代码
仅修改 pdf-home 模块中的代码,不可修改其他模块的代码

### 严格遵循代码规范和标准
必须优先阅读和理解 `pdf-home/docs/SPEC/SPEC-HEAD-pdf-home.json` 下的代码规范

## 可行验收标准
### 单元测试
所有新增代码通过单元测试

### 端到端测试
验证文件选择、添加、删除、双击打开功能正常

### 接口实现
#### 接口1: 文件选择
函数: selectPdfFiles()
描述: 调用QFileDialog选择PDF文件
参数: 无
返回值: Promise<string[]> - 选择的文件路径数组

#### 接口2: 获取文件列表
函数: getPdfList()
描述: 获取当前PDF文件列表
参数: 无
返回值: Promise<Array> - PDF文件信息数组

#### 接口3: 删除文件
函数: removePdf(fileId)
描述: 删除指定PDF文件
参数: fileId: string - PDF文件ID
返回值: Promise<boolean> - 删除是否成功

#### 接口4: 打开PDF查看器
函数: openPdfViewer(fileId)
描述: 通过WebSocket请求打开PDF查看器窗口
参数: fileId: string - PDF文件ID
返回值: Promise<boolean> - 请求是否发送成功

### 类实现
#### 类1: PdfHomeBridge
类: PdfHomeBridge
描述: QWebChannel桥接类，连接JavaScript和Python
属性:
- pdf_manager: PDFManager实例
- websocket_client: WebSocket客户端（用于打开查看器）
方法:
- selectPdfFiles(): 文件选择对话框
- getPdfList(): 获取文件列表
- removePdf(fileId): 删除文件
- openPdfViewer(fileId): 打开查看器

### 事件规范
#### 事件1: 文件列表更新
描述: 当PDF列表发生变化时通过QWebChannel信号通知前端
参数: pdfList: Array - 更新后的PDF列表
返回值: 无