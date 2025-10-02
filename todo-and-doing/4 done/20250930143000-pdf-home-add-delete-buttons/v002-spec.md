# PDF-Home添加和删除按钮功能实现规格说明

**功能ID**: 20250930143000-pdf-home-add-delete-buttons
**优先级**: 高
**版本**: v002
**创建时间**: 2025-10-01 00:00:00
**基于版本**: v001
**预计完成**: 2025-10-03
**状态**: 设计中

## v002 版本变更说明

### 主要变更
1. **通信流程调整**: PyQt 层不再直接发送 WebSocket 请求，而是通过 QWebChannel 将文件路径传递到 JS 层，由 JS 层统一通过 WebSocket 发送到 msgCenter
2. **强化阶段性开发**: 将实现拆分为 5 个可独立验证的阶段，每个阶段都有明确的验收标准
3. **职责更清晰**: PyQt 层只负责原生 UI 交互（文件选择、确认对话框），JS 层负责业务逻辑和通信

### 新的通信架构

```
┌─────────────┐
│   用户操作   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────┐
│            前端 JavaScript 层                    │
│  ┌──────────────┐         ┌──────────────┐     │
│  │ 按钮事件处理器│◄────────┤  EventBus    │     │
│  └──────┬───────┘         └──────┬───────┘     │
│         │                         │             │
│         │ ①调用原生对话框           │ ④更新UI     │
│         ▼                         ▲             │
│  ┌──────────────┐         ┌──────────────┐     │
│  │QWebChannel   │         │ WebSocket    │     │
│  │Bridge        │         │ Client       │     │
│  └──────┬───────┘         └──────┬───────┘     │
└─────────┼──────────────────────────┼────────────┘
          │                         │
          │ ②文件路径              │ ③业务请求
          ▼                         ▼
┌─────────────────────────────────────────────────┐
│            PyQt 后端层                          │
│  ┌──────────────┐         ┌──────────────┐     │
│  │PyQtBridge    │         │ msgCenter    │     │
│  │              │         │ (WebSocket)  │     │
│  │- selectFiles │         │              │     │
│  │- confirmDel  │         │              │     │
│  └──────────────┘         └──────┬───────┘     │
│                                   │             │
│                                   ▼             │
│                           ┌──────────────┐     │
│                           │ PDF Manager  │     │
│                           └──────────────┘     │
└─────────────────────────────────────────────────┘

流程说明：
①: 用户点击"添加PDF" → JS调用QWebChannel.selectFiles() → PyQt显示文件选择对话框 → 返回文件路径列表到JS
②: JS收到文件路径列表 → 通过WebSocket发送add_pdf请求到msgCenter
③: msgCenter转发请求到PDF Manager → PDF Manager执行添加操作
④: PDF Manager返回结果 → msgCenter广播更新 → JS更新UI
```

---

## 阶段性开发计划

### 阶段1: QWebChannel 建立连接 ✅

**目标**: 建立 PyQt 层与 JS 层的 QWebChannel 通信

**实现内容**:
1. 创建 `src/frontend/pdf-home/pyqt-bridge.py`
   - 定义 `PyQtBridge` 类，继承 `QObject`
   - 实现测试方法 `testConnection()` 返回 "PyQt Bridge Connected"

2. 创建 `src/frontend/pdf-home/qwebchannel/qwebchannel-bridge.js`
   - 封装 QWebChannel 连接逻辑
   - 提供 Promise 风格的 API
   - 实现 `initialize()` 和 `testConnection()` 方法

3. 修改 `src/frontend/pdf-home/launcher.py`
   - 导入 `PyQtBridge`
   - 创建 `QWebChannel` 实例
   - 注册 `PyQtBridge` 到 channel
   - 设置 WebChannel 到 WebPage

4. 在 `index.html` 中添加测试按钮
   - 添加 "测试QWebChannel" 按钮
   - 点击后调用 `qwebchannelBridge.testConnection()`
   - 在控制台和页面上显示结果

**验收标准**:
- ✅ PyQt 应用启动无错误
- ✅ 前端控制台无 QWebChannel 相关错误
- ✅ 点击测试按钮后，控制台显示 "PyQt Bridge Connected"
- ✅ 日志文件 `pdf-home.log` 中记录 QWebChannel 初始化成功

**日志输出要求**:
```
[Python日志] QWebChannel 初始化开始
[Python日志] PyQtBridge 创建成功
[Python日志] PyQtBridge 注册到 QWebChannel
[Python日志] QWebChannel 设置到 WebPage 成功
[JS日志] QWebChannel 连接中...
[JS日志] QWebChannel 连接成功
[JS日志] 测试连接: PyQt Bridge Connected
```

---

### 阶段2: 文件选择对话框完整流程 🎯

**目标**: 点击按钮 → JS层 → QWebChannel → PyQt层 → 获取文件路径 → QWebChannel → JS层 → WebSocket发送

**实现内容**:

1. **PyQt 端实现文件选择**:
   ```python
   # pyqt-bridge.py
   @pyqtSlot(bool, str, result=list)
   def selectFiles(self, multiple=True, fileType='pdf'):
       """
       打开文件选择对话框

       Args:
           multiple: 是否多选
           fileType: 文件类型 ('pdf', 'all')

       Returns:
           list: 文件路径列表 ["C:/path/file1.pdf", "C:/path/file2.pdf"]
       """
       logger.info(f"[PyQtBridge] selectFiles called: multiple={multiple}, fileType={fileType}")

       # 设置文件过滤器
       file_filter = "PDF Files (*.pdf)" if fileType == 'pdf' else "All Files (*.*)"

       # 打开文件选择对话框
       if multiple:
           files, _ = QFileDialog.getOpenFileNames(
               parent=self.parent,
               caption="选择PDF文件",
               directory="",
               filter=file_filter
           )
       else:
           file_path, _ = QFileDialog.getOpenFileName(
               parent=self.parent,
               caption="选择PDF文件",
               directory="",
               filter=file_filter
           )
           files = [file_path] if file_path else []

       logger.info(f"[PyQtBridge] 用户选择了 {len(files)} 个文件")
       for i, file_path in enumerate(files):
           logger.info(f"[PyQtBridge]   文件{i+1}: {file_path}")

       return files
   ```

2. **JS 端封装文件选择**:
   ```javascript
   // qwebchannel-bridge.js
   async selectFiles(options = {}) {
       const { multiple = true, fileType = 'pdf' } = options;

       console.log('[QWebChannelBridge] 调用 selectFiles:', { multiple, fileType });

       if (!this.isReady) {
           throw new Error('QWebChannel 未初始化');
       }

       try {
           // 调用 PyQt 方法（注意：这是同步调用，但我们包装成 Promise）
           const files = await new Promise((resolve, reject) => {
               try {
                   const result = this.bridge.selectFiles(multiple, fileType);
                   resolve(result);
               } catch (error) {
                   reject(error);
               }
           });

           console.log(`[QWebChannelBridge] 收到 ${files.length} 个文件路径:`, files);
           return files;

       } catch (error) {
           console.error('[QWebChannelBridge] selectFiles 失败:', error);
           throw error;
       }
   }
   ```

3. **按钮事件处理器集成**:
   ```javascript
   // button-event-handler.js
   async #handleAddPdf() {
       this.#logger.info('[ButtonHandler] 添加PDF按钮被点击');

       try {
           // 步骤1: 通过 QWebChannel 调用文件选择对话框
           this.#logger.info('[ButtonHandler] 调用 QWebChannel 文件选择对话框...');
           const files = await this.#qwebchannelBridge.selectFiles({
               multiple: true,
               fileType: 'pdf'
           });

           if (!files || files.length === 0) {
               this.#logger.info('[ButtonHandler] 用户取消了文件选择');
               return;
           }

           this.#logger.info(`[ButtonHandler] 用户选择了 ${files.length} 个文件`);
           files.forEach((file, i) => {
               this.#logger.info(`[ButtonHandler]   文件${i+1}: ${file}`);
           });

           // 步骤2: 通过 WebSocket 发送到 msgCenter
           this.#logger.info('[ButtonHandler] 通过 WebSocket 发送添加请求到 msgCenter');
           this.#eventBus.emit('pdf:add-files:request', {
               files: files,
               source: 'add-button',
               timestamp: Date.now()
           });

           // 显示加载状态
           DOMUtils.showInfo(`正在添加 ${files.length} 个文件...`);

       } catch (error) {
           this.#logger.error('[ButtonHandler] 添加文件失败:', error);
           DOMUtils.showError('文件添加失败: ' + error.message);
       }
   }
   ```

4. **WebSocket 监听器**:
   ```javascript
   // 在某个管理器中监听事件并发送 WebSocket 消息
   this.#eventBus.on('pdf:add-files:request', (data) => {
       console.log('[WebSocket] 收到添加文件请求，准备发送到 msgCenter');
       console.log('[WebSocket] 文件列表:', data.files);

       // 发送到 msgCenter
       this.#websocketClient.send({
           action: 'add_pdf',
           files: data.files,
           source: data.source
       });
   });
   ```

**验收标准**:
- ✅ 点击"添加PDF"按钮，弹出原生文件选择对话框
- ✅ 选择文件后，对话框关闭
- ✅ Python 日志记录文件选择的完整路径
- ✅ JS 控制台显示收到的文件路径列表
- ✅ WebSocket 消息发送成功（可以在浏览器开发者工具中查看）
- ✅ 取消选择时，流程正常终止，无错误

**日志输出要求**:
```
[Python日志] [PyQtBridge] selectFiles called: multiple=True, fileType=pdf
[Python日志] [PyQtBridge] 用户选择了 2 个文件
[Python日志] [PyQtBridge]   文件1: C:/Users/xxx/Desktop/test1.pdf
[Python日志] [PyQtBridge]   文件2: C:/Users/xxx/Desktop/test2.pdf
[JS日志] [QWebChannelBridge] 调用 selectFiles: {multiple: true, fileType: "pdf"}
[JS日志] [QWebChannelBridge] 收到 2 个文件路径: ["C:/Users/xxx/Desktop/test1.pdf", "C:/Users/xxx/Desktop/test2.pdf"]
[JS日志] [ButtonHandler] 用户选择了 2 个文件
[JS日志] [ButtonHandler]   文件1: C:/Users/xxx/Desktop/test1.pdf
[JS日志] [ButtonHandler]   文件2: C:/Users/xxx/Desktop/test2.pdf
[JS日志] [ButtonHandler] 通过 WebSocket 发送添加请求到 msgCenter
[JS日志] [WebSocket] 收到添加文件请求，准备发送到 msgCenter
[JS日志] [WebSocket] 发送消息: {action: "add_pdf", files: [...]}
```

---

### 阶段3: msgCenter 转发与 PDF Manager 执行 📋

**目标**: msgCenter 接收请求 → 转发到 PDF Manager → 执行添加操作

**实现内容**:

1. **msgCenter 端添加请求处理器**:
   ```python
   # standard_server.py
   async def handle_add_pdf_request(self, client_id, data):
       """
       处理添加PDF请求

       Args:
           client_id: 客户端ID
           data: {
               'action': 'add_pdf',
               'files': ['C:/path/file1.pdf', ...],
               'source': 'add-button'
           }
       """
       logger.info(f"[msgCenter] 收到添加PDF请求，客户端: {client_id}")
       logger.info(f"[msgCenter] 文件数量: {len(data.get('files', []))}")

       files = data.get('files', [])
       if not files:
           await self.send_error(client_id, 'add_pdf_response', '没有选择文件')
           return

       # 转发到 PDF Manager
       logger.info(f"[msgCenter] 转发请求到 PDF Manager")
       result = await self.pdf_manager.add_pdfs(files)

       # 返回结果
       logger.info(f"[msgCenter] PDF Manager 返回结果: {result}")
       await self.broadcast({
           'action': 'add_pdf_response',
           'success': result.get('success', False),
           'added_count': result.get('added_count', 0),
           'failed_count': result.get('failed_count', 0),
           'message': result.get('message', '')
       })
   ```

2. **PDF Manager 实现添加逻辑**:
   ```python
   # pdf_manager.py
   async def add_pdfs(self, file_paths):
       """
       添加PDF文件到库

       Args:
           file_paths: 文件路径列表

       Returns:
           dict: {
               'success': bool,
               'added_count': int,
               'failed_count': int,
               'message': str,
               'added_files': list
           }
       """
       logger.info(f"[PDFManager] 开始添加 {len(file_paths)} 个PDF文件")

       added_files = []
       failed_files = []

       for i, file_path in enumerate(file_paths):
           logger.info(f"[PDFManager] 处理文件 {i+1}/{len(file_paths)}: {file_path}")

           try:
               # 验证文件存在
               if not os.path.exists(file_path):
                   logger.error(f"[PDFManager] 文件不存在: {file_path}")
                   failed_files.append({'path': file_path, 'error': '文件不存在'})
                   continue

               # 验证是PDF文件
               if not file_path.lower().endswith('.pdf'):
                   logger.error(f"[PDFManager] 不是PDF文件: {file_path}")
                   failed_files.append({'path': file_path, 'error': '不是PDF文件'})
                   continue

               # 复制到 data/pdfs/ 目录
               filename = os.path.basename(file_path)
               dest_path = os.path.join(self.pdf_dir, filename)

               # 处理重名
               if os.path.exists(dest_path):
                   base, ext = os.path.splitext(filename)
                   counter = 1
                   while os.path.exists(dest_path):
                       filename = f"{base}_{counter}{ext}"
                       dest_path = os.path.join(self.pdf_dir, filename)
                       counter += 1

               logger.info(f"[PDFManager] 复制文件到: {dest_path}")
               shutil.copy2(file_path, dest_path)

               # 添加到数据库（如果有）
               # TODO: 提取元数据，添加到数据库

               added_files.append({
                   'original_path': file_path,
                   'stored_path': dest_path,
                   'filename': filename
               })
               logger.info(f"[PDFManager] 文件添加成功: {filename}")

           except Exception as e:
               logger.error(f"[PDFManager] 添加文件失败: {file_path}, 错误: {e}")
               failed_files.append({'path': file_path, 'error': str(e)})

       success = len(failed_files) == 0
       message = f"成功添加 {len(added_files)} 个文件"
       if failed_files:
           message += f"，{len(failed_files)} 个失败"

       logger.info(f"[PDFManager] 添加操作完成: {message}")

       return {
           'success': success,
           'added_count': len(added_files),
           'failed_count': len(failed_files),
           'message': message,
           'added_files': added_files,
           'failed_files': failed_files
       }
   ```

**验收标准**:
- ✅ msgCenter 正确接收 WebSocket 消息
- ✅ msgCenter 正确转发请求到 PDF Manager
- ✅ PDF Manager 成功验证文件存在性
- ✅ PDF Manager 成功复制文件到 `data/pdfs/` 目录
- ✅ Python 日志完整记录整个处理流程
- ✅ 处理文件重名情况（自动重命名）
- ✅ 正确处理错误情况（文件不存在、不是PDF等）

**日志输出要求**:
```
[Python日志] [msgCenter] 收到添加PDF请求，客户端: client_123
[Python日志] [msgCenter] 文件数量: 2
[Python日志] [msgCenter] 转发请求到 PDF Manager
[Python日志] [PDFManager] 开始添加 2 个PDF文件
[Python日志] [PDFManager] 处理文件 1/2: C:/Users/xxx/Desktop/test1.pdf
[Python日志] [PDFManager] 复制文件到: C:/project/data/pdfs/test1.pdf
[Python日志] [PDFManager] 文件添加成功: test1.pdf
[Python日志] [PDFManager] 处理文件 2/2: C:/Users/xxx/Desktop/test2.pdf
[Python日志] [PDFManager] 复制文件到: C:/project/data/pdfs/test2.pdf
[Python日志] [PDFManager] 文件添加成功: test2.pdf
[Python日志] [PDFManager] 添加操作完成: 成功添加 2 个文件
[Python日志] [msgCenter] PDF Manager 返回结果: {'success': True, 'added_count': 2, ...}
```

---

### 阶段4: 操作结果反馈 📤

**目标**: PDF Manager 发送结果 → msgCenter 转发 → JS层接收并显示

**实现内容**:

1. **msgCenter 广播结果**:
   ```python
   # standard_server.py (在阶段3中已实现)
   await self.broadcast({
       'action': 'add_pdf_response',
       'success': result.get('success', False),
       'added_count': result.get('added_count', 0),
       'failed_count': result.get('failed_count', 0),
       'message': result.get('message', ''),
       'added_files': result.get('added_files', [])
   })
   ```

2. **JS 层监听响应事件**:
   ```javascript
   // websocket-event-manager.js 或类似的管理器
   setupWebSocketMessageHandlers() {
       this.#websocketClient.on('message', (data) => {
           const action = data.action;

           if (action === 'add_pdf_response') {
               console.log('[WebSocket] 收到添加PDF响应:', data);

               // 发布到事件总线
               this.#eventBus.emit('pdf:add-files:response', {
                   success: data.success,
                   added_count: data.added_count,
                   failed_count: data.failed_count,
                   message: data.message,
                   added_files: data.added_files
               });
           }
       });
   }
   ```

3. **UI层显示结果**:
   ```javascript
   // ui-response-handler.js 或 button-event-handler.js
   #setupAddPdfResponseListener() {
       this.#eventBus.on('pdf:add-files:response', (data) => {
           console.log('[UIHandler] 收到添加文件响应:', data);

           // 隐藏加载状态
           this.hideProgress();

           // 显示结果消息
           if (data.success) {
               DOMUtils.showSuccess(data.message);
               console.log(`[UIHandler] 成功添加 ${data.added_count} 个文件`);
           } else {
               DOMUtils.showWarning(data.message);
               console.log(`[UIHandler] 添加失败: ${data.failed_count} 个文件`);
           }

           // 触发列表刷新（在阶段5处理）
           console.log('[UIHandler] 触发列表刷新事件');
           this.#eventBus.emit('pdf:list:refresh-request');
       });
   }
   ```

**验收标准**:
- ✅ WebSocket 正确接收 msgCenter 的响应消息
- ✅ 事件总线正确分发响应事件
- ✅ UI 正确显示成功/失败消息
- ✅ 显示添加的文件数量
- ✅ 正确处理部分成功的情况（部分文件添加成功，部分失败）
- ✅ 加载状态正确隐藏

**日志输出要求**:
```
[JS日志] [WebSocket] 收到添加PDF响应: {success: true, added_count: 2, message: "成功添加 2 个文件"}
[JS日志] [UIHandler] 收到添加文件响应: {success: true, ...}
[JS日志] [UIHandler] 成功添加 2 个文件
[JS日志] [UIHandler] 触发列表刷新事件
[页面显示] 绿色提示框: "成功添加 2 个文件"
```

---

### 阶段5: PDF列表更新 🔄

**目标**: JS层根据操作结果更新PDF列表显示

**实现内容**:

1. **请求完整列表**:
   ```javascript
   // pdf-manager.js (前端的 PDF Manager)
   #setupListRefreshListener() {
       this.#eventBus.on('pdf:list:refresh-request', async () => {
           console.log('[PDFManager] 收到列表刷新请求');

           try {
               // 通过 WebSocket 请求完整列表
               console.log('[PDFManager] 请求完整PDF列表');
               this.#websocketClient.send({
                   action: 'get_pdf_list'
               });

           } catch (error) {
               console.error('[PDFManager] 列表刷新失败:', error);
               DOMUtils.showError('列表刷新失败');
           }
       });
   }
   ```

2. **msgCenter 处理列表请求**:
   ```python
   # standard_server.py
   async def handle_get_pdf_list(self, client_id):
       """获取PDF列表"""
       logger.info(f"[msgCenter] 客户端 {client_id} 请求PDF列表")

       # 从 PDF Manager 获取列表
       pdf_list = await self.pdf_manager.get_pdf_list()

       logger.info(f"[msgCenter] 返回 {len(pdf_list)} 个PDF文件")

       await self.send_to_client(client_id, {
           'action': 'pdf_list_updated',
           'items': pdf_list,
           'total': len(pdf_list)
       })
   ```

3. **前端更新表格显示**:
   ```javascript
   // pdf-manager.js (前端)
   #setupListUpdateListener() {
       this.#websocketClient.on('message', (data) => {
           if (data.action === 'pdf_list_updated') {
               console.log(`[PDFManager] 收到列表更新: ${data.total} 个文件`);

               // 发布到事件总线
               this.#eventBus.emit('pdf:list:updated', {
                   items: data.items,
                   total: data.total
               });
           }
       });
   }

   // table-configuration-manager.js 或 ui-manager.js
   #setupTableUpdateListener() {
       this.#eventBus.on('pdf:list:updated', (data) => {
           console.log(`[TableManager] 更新表格显示: ${data.total} 个文件`);

           // 更新 Tabulator 表格数据
           if (this.#tableWrapper) {
               this.#tableWrapper.setData(data.items);
               console.log('[TableManager] 表格数据更新完成');
           }
       });
   }
   ```

**验收标准**:
- ✅ 添加成功后自动触发列表刷新
- ✅ WebSocket 正确请求和接收完整列表
- ✅ 表格显示更新，新添加的文件出现在列表中
- ✅ 表格排序、选中状态等保持正常
- ✅ 空状态处理（无PDF时显示提示）
- ✅ 整个流程完整无中断

**日志输出要求**:
```
[JS日志] [PDFManager] 收到列表刷新请求
[JS日志] [PDFManager] 请求完整PDF列表
[JS日志] [WebSocket] 发送消息: {action: "get_pdf_list"}
[Python日志] [msgCenter] 客户端 client_123 请求PDF列表
[Python日志] [msgCenter] 返回 5 个PDF文件
[JS日志] [PDFManager] 收到列表更新: 5 个文件
[JS日志] [TableManager] 更新表格显示: 5 个文件
[JS日志] [TableManager] 表格数据更新完成
```

---

## 完整流程示意图

```
┌─────────────────────────────────────────────────────────────┐
│                     完整添加PDF流程                          │
└─────────────────────────────────────────────────────────────┘

用户点击"添加PDF"按钮
    │
    ▼
[阶段1] JS: ButtonEventHandler.handleAddPdf()
    │
    ├─► [阶段2] JS: qwebchannelBridge.selectFiles()
    │       │
    │       ├─► PyQt: PyQtBridge.selectFiles()
    │       │       │
    │       │       ├─► 显示文件选择对话框
    │       │       │
    │       │       └─► 返回文件路径列表 ["C:/path/file1.pdf", ...]
    │       │
    │       └─► JS: 收到文件路径列表
    │
    ├─► [阶段2] JS: eventBus.emit('pdf:add-files:request', { files })
    │       │
    │       └─► JS: websocketClient.send({ action: 'add_pdf', files })
    │
    ▼
[阶段3] Python: msgCenter 收到 WebSocket 消息
    │
    ├─► Python: msgCenter.handle_add_pdf_request()
    │       │
    │       └─► Python: pdfManager.add_pdfs(files)
    │               │
    │               ├─► 验证文件存在性
    │               ├─► 复制文件到 data/pdfs/
    │               ├─► 提取元数据（可选）
    │               └─► 返回结果 { success, added_count, ... }
    │
    ▼
[阶段4] Python: msgCenter.broadcast({ action: 'add_pdf_response', ... })
    │
    ├─► JS: websocketClient 收到响应
    │       │
    │       └─► JS: eventBus.emit('pdf:add-files:response', result)
    │               │
    │               ├─► UIHandler: 显示成功/失败消息
    │               └─► UIHandler: 触发列表刷新
    │
    ▼
[阶段5] JS: eventBus.emit('pdf:list:refresh-request')
    │
    ├─► JS: websocketClient.send({ action: 'get_pdf_list' })
    │       │
    │       └─► Python: msgCenter.handle_get_pdf_list()
    │               │
    │               └─► Python: pdfManager.get_pdf_list()
    │
    ├─► Python: msgCenter.send({ action: 'pdf_list_updated', items })
    │
    └─► JS: TableManager.updateTable(items)
            │
            └─► 表格显示更新完成 ✅
```

---

## 删除功能实现（类似流程）

删除功能遵循相同的阶段性开发流程：

### 阶段2-删除: 确认对话框流程

**PyQt 端实现确认对话框**:
```python
# pyqt-bridge.py
@pyqtSlot(str, str, result=bool)
def showConfirmDialog(self, title, message):
    """
    显示确认对话框

    Args:
        title: 对话框标题
        message: 提示消息

    Returns:
        bool: 用户是否点击确认
    """
    logger.info(f"[PyQtBridge] showConfirmDialog: {title} - {message}")

    reply = QMessageBox.question(
        self.parent,
        title,
        message,
        QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
        QMessageBox.StandardButton.No  # 默认选择"否"
    )

    confirmed = (reply == QMessageBox.StandardButton.Yes)
    logger.info(f"[PyQtBridge] 用户选择: {'确认' if confirmed else '取消'}")

    return confirmed
```

**JS 端封装**:
```javascript
// qwebchannel-bridge.js
async showConfirmDialog(title, message) {
    console.log('[QWebChannelBridge] 显示确认对话框:', { title, message });

    if (!this.isReady) {
        throw new Error('QWebChannel 未初始化');
    }

    try {
        const confirmed = await new Promise((resolve, reject) => {
            try {
                const result = this.bridge.showConfirmDialog(title, message);
                resolve(result);
            } catch (error) {
                reject(error);
            }
        });

        console.log('[QWebChannelBridge] 用户选择:', confirmed ? '确认' : '取消');
        return confirmed;

    } catch (error) {
        console.error('[QWebChannelBridge] showConfirmDialog 失败:', error);
        throw error;
    }
}
```

**删除按钮处理器**:
```javascript
// button-event-handler.js
async #handleBatchDelete() {
    this.#logger.info('[ButtonHandler] 批量删除按钮被点击');

    // 获取选中的行
    const selectedRows = this.#getSelectedRows();

    if (selectedRows.length === 0) {
        DOMUtils.showWarning('请先选择要删除的文件');
        return;
    }

    try {
        // 步骤1: 通过 QWebChannel 显示确认对话框
        const fileCount = selectedRows.length;
        const message = fileCount === 1
            ? `确定要删除 "${selectedRows[0].filename}" 吗？`
            : `确定要删除选中的 ${fileCount} 个文件吗？`;

        this.#logger.info('[ButtonHandler] 显示确认对话框');
        const confirmed = await this.#qwebchannelBridge.showConfirmDialog(
            '确认删除',
            message
        );

        if (!confirmed) {
            this.#logger.info('[ButtonHandler] 用户取消了删除操作');
            return;
        }

        // 步骤2: 通过 WebSocket 发送删除请求
        const fileIds = selectedRows.map(row => row.id);
        this.#logger.info(`[ButtonHandler] 发送删除请求: ${fileIds.length} 个文件`);

        this.#eventBus.emit('pdf:remove-files:request', {
            file_ids: fileIds,
            source: 'delete-button',
            timestamp: Date.now()
        });

        // 显示加载状态
        DOMUtils.showInfo(`正在删除 ${fileCount} 个文件...`);

    } catch (error) {
        this.#logger.error('[ButtonHandler] 删除文件失败:', error);
        DOMUtils.showError('文件删除失败: ' + error.message);
    }
}
```

---

## 文件结构

```
src/frontend/pdf-home/
├── pyqt-bridge.py (新建)
│   └── class PyQtBridge
│       ├── selectFiles(multiple, fileType) → list[str]
│       ├── showConfirmDialog(title, message) → bool
│       └── testConnection() → str
│
├── qwebchannel/
│   ├── qwebchannel.js (保留，第三方库)
│   └── qwebchannel-bridge.js (新建)
│       └── class QWebChannelBridge
│           ├── initialize() → Promise<void>
│           ├── selectFiles(options) → Promise<string[]>
│           ├── showConfirmDialog(title, message) → Promise<boolean>
│           └── testConnection() → Promise<string>
│
├── launcher.py (修改)
│   └── 注册 PyQtBridge 到 QWebChannel
│
├── ui/handlers/
│   └── button-event-handler.js (修改)
│       ├── #handleAddPdf() - 集成 QWebChannel
│       └── #handleBatchDelete() - 集成 QWebChannel
│
└── index.html (修改)
    └── 添加测试按钮（阶段1用）

src/backend/msgCenter_server/
├── standard_server.py (修改)
│   ├── handle_add_pdf_request()
│   ├── handle_remove_pdf_request()
│   └── handle_get_pdf_list()
│
└── pdf_manager.py (新建或修改)
    ├── add_pdfs(file_paths) → dict
    ├── remove_pdfs(file_ids) → dict
    └── get_pdf_list() → list
```

---

## 测试要求

### 每个阶段的测试重点

**阶段1测试**:
- QWebChannel 连接是否成功
- testConnection() 能否正常调用并返回

**阶段2测试**:
- 文件选择对话框是否正常弹出
- 文件路径是否正确传递到 JS 层
- WebSocket 消息是否正确发送

**阶段3测试**:
- msgCenter 是否正确接收消息
- PDF Manager 是否正确处理文件
- 文件是否成功复制到 data/pdfs/
- 错误情况是否正确处理

**阶段4测试**:
- 响应消息是否正确返回
- UI 是否正确显示结果
- 成功/失败消息是否准确

**阶段5测试**:
- 列表是否正确刷新
- 新添加的文件是否显示
- 删除后文件是否移除
- 表格状态是否正常

### 回归测试（每个阶段都要验证）

- ✅ 双击表格行能正常打开PDF
- ✅ 表格数据正常显示
- ✅ WebSocket连接正常
- ✅ 调试面板正常显示
- ✅ 新代码不破坏现有功能

---

## 约束条件

### 仅修改本模块代码
仅修改 pdf-home 模块中的代码，不修改其他模块。

### 严格遵循代码规范
必须阅读和遵循 `pdf-home/docs/SPEC/SPEC-HEAD-PDFHome.json` 引用的规范。

### 渐进式开发
- 每个阶段独立开发和测试
- 每个阶段完成后提交 git
- 新功能不破坏现有功能
- 充分的日志记录

### 向后兼容性
- 保持现有事件总线接口不变
- 保持现有WebSocket消息协议兼容
- 不破坏现有的表格显示功能

---

## 验收标准

### 功能验收
1. ✅ 点击"添加PDF"按钮，能选择文件并成功添加
2. ✅ 支持单选和多选文件
3. ✅ 点击"删除选中"按钮，能删除选中的文件
4. ✅ 删除前有确认对话框
5. ✅ 操作后列表自动刷新
6. ✅ 显示成功/失败消息

### 性能验收
- 按钮点击响应时间 < 100ms
- 文件对话框打开时间 < 500ms
- 单个文件添加时间 < 2s

### 日志验收
- 每个阶段都有完整的日志记录
- Python 日志写入 `logs/pdf-home.log`
- JS 日志显示在浏览器控制台
- 日志格式统一，易于追踪

---

## 风险和注意事项

1. **QWebChannel 初始化时机**: 必须在 WebPage 加载后才能使用
2. **文件路径格式**: Windows 和 Linux 路径格式不同，需要统一处理
3. **文件重名**: 需要处理目标目录已存在同名文件的情况
4. **权限问题**: 文件复制可能因权限不足失败
5. **大文件处理**: 超大PDF文件可能导致复制耗时较长
6. **并发请求**: 多个客户端同时添加/删除需要处理冲突

---

## 开发计划

| 阶段 | 预计工作量 | 验收标准 | 优先级 |
|-----|----------|---------|--------|
| 阶段1 | 2小时 | QWebChannel连接成功 | P0 |
| 阶段2 | 3小时 | 文件选择和路径传递成功 | P0 |
| 阶段3 | 4小时 | 文件成功添加到目录 | P0 |
| 阶段4 | 2小时 | 结果正确反馈到前端 | P0 |
| 阶段5 | 2小时 | 列表正确更新 | P0 |
| 删除功能 | 3小时 | 删除功能完整实现 | P1 |
| 测试和优化 | 2小时 | 所有测试通过 | P1 |

**总计预估**: 18小时

---

## 参考资料

- QWebChannel 官方文档: https://doc.qt.io/qt-6/qwebchannel.html
- PyQt6 文件对话框: https://doc.qt.io/qt-6/qfiledialog.html
- PyQt6 消息框: https://doc.qt.io/qt-6/qmessagebox.html
