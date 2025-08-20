# Anki LinkMaster PDFJS - task2-homepageDev 需求理解文档

## 1. 项目特性规范

### 项目概述
Anki LinkMaster PDFJS 是一个用于管理和查看PDF文件的应用程序，它使用Python和PyQt6作为后端，HTML5、CSS3和JavaScript作为前端，并通过WebSocket实现前后端实时通信。

### 项目架构
- **前端**：位于 `src/frontend/` 目录，使用 Vite 作为构建工具
- **后端**：位于 `src/backend/` 目录，使用 Python 3.9+ 和 PyQt6 框架
- **通信**：使用 WebSocket 进行前后端实时通信
- **PDF管理**：由 `PDFManager` 类负责PDF文件的添加、删除和列表展示

## 2. 原始需求

修复PDF主页的功能缺陷，使其能够正常地展示和管理PDF文件，重点解决无法导入PDF文件的问题。

## 3. 边界确认

### 任务范围
- 修复PDF文件导入功能
- 确保PDF文件列表正常展示
- 修复PDF文件操作功能（打开、删除）
- 确保前后端通信正常

### 不包含的内容
- 不涉及PDF内容查看器的实现细节
- 不涉及用户认证和权限管理
- 不涉及PDF文件内容解析和提取功能

## 4. 需求理解

### 现有项目理解
1. **前端实现**：
   - `PDFHomeManager` 类负责管理PDF主页逻辑
   - 包含WebSocket连接、事件监听和PDF管理相关方法
   - 有文件选择器用于选择本地PDF文件
   - 已实现了文件选择后的处理逻辑 (`handleFileSelect`)
   - 通过WebSocket发送 `add_pdf` 类型的消息到后端
   - 已实现了 `removePDF` 方法，但存在递归调用错误

2. **后端实现**：
   - `PDFManager` 类负责PDF文件的添加、删除和列表展示
   - `WebSocketServer` 类负责处理前端与后端的实时通信
   - `AnkiLinkMasterApp` 类负责管理整个应用程序的生命周期

3. **发现的问题**：
   - **核心问题**：`application.py` 中没有将 `websocket_server` 的 `message_received` 信号连接到任何处理函数
   - 前端发送的 `add_pdf`、`get_pdf_list`、`remove_pdf` 等消息在后端没有对应的处理逻辑
   - `main.js` 中的 `removePDF` 方法存在递归调用问题
   - 在浏览器环境中，无法直接获取文件的完整本地路径

## 5. 疑问澄清

1. **文件上传机制**：在浏览器环境中，无法直接获取文件的完整本地路径。需要实现一种合适的文件处理机制。

2. **消息处理逻辑**：需要实现后端的消息处理逻辑，将 WebSocket 消息与 PDF 管理器的操作连接起来。

3. **错误处理流程**：需要明确前端如何处理后端返回的错误信息。

4. **文件存储策略**：需要确认PDF文件是直接使用用户选择的文件路径，还是复制到应用程序指定目录。

## 6. 解决方案概要

1. 在 `application.py` 中实现 WebSocket 消息处理逻辑，连接 `websocket_server.message_received` 信号

2. 实现处理 `add_pdf`、`get_pdf_list`、`remove_pdf` 等消息的方法

3. 修复 `main.js` 中的 `removePDF` 方法递归调用问题

4. 处理浏览器环境下的文件路径问题，确保文件能够正确添加到PDF管理器

本文档将作为后续开发的基础，确保所有相关方对需求有清晰的理解。