# PDF Viewer 标注功能 - 截图工具第一期实现规格

**功能ID**: 20251002213000-pdf-annotation-sidebar-phase1-screenshot
**优先级**: 高
**版本**: v002 (基于v001修订)
**创建时间**: 2025-10-03 02:00:00
**预计完成**: 2025-10-03
**状态**: 开发中

## 修订说明

本文档是v001规格说明的截图工具部分的**第一期实现版本**，主要修订：
1. **数据存储方式**：不使用base64，改为通过QWebChannel保存到PyQt端并获取图片路径
2. **后端通信**：msgCenter使用mock响应，不真实发送到后端
3. **图片加载**：通过HTTP请求从文件服务器加载图片
4. **实现范围**：仅实现前端交互和PyQt通信，不实现后端持久化

## 截图工具完整流程

### 最终版本流程（v001原始设计）
```
用户截图 → Canvas捕获base64 → 通过WebSocket保存到后端 → 存储到数据库 → 返回成功
```

### 第一期实现流程（v002当前版本）
```
用户截图
  ↓
Canvas捕获base64 (ScreenshotCapturer)
  ↓
通过QWebChannel发送到PyQt端
  ↓
PyQt保存为<hash>.png到特定目录
  ↓
PyQt返回保存成功 + 图片路径
  ↓
JS端发送新增截图消息到msgCenter
  ↓
msgCenter mock返回成功（不发送到后端）✨第一期特殊处理
  ↓
更新UI，显示标注卡片
  ↓
通过HTTP请求加载图片（从文件服务器）
```

## 数据结构修改

### 截图标注数据结构（v002修订）
```javascript
{
  id: 'ann_001',
  type: 'screenshot',
  pageNumber: 23,
  rect: { x: 100, y: 200, width: 300, height: 200 },

  // ✨修改点1：不再存储base64，改为存储图片路径
  imagePath: '/data/screenshots/<hash>.png',  // PyQt返回的相对路径
  imageHash: 'a1b2c3d4e5f6...',               // 文件hash码（用于去重）

  description: '这是一个重要的图表',
  comments: [],
  createdAt: '2025-10-02T14:30:00Z',
  updatedAt: '2025-10-02T14:30:00Z'
}
```

## 技术实现方案

### 1. ScreenshotCapturer类（Canvas截图）

**职责**：使用Canvas API捕获PDF指定区域，生成base64图片数据

```javascript
/**
 * 截图捕获器 - 使用Canvas捕获PDF区域
 * @file screenshot-capturer.js
 */
class ScreenshotCapturer {
  #pdfViewerManager

  constructor(pdfViewerManager) {
    this.#pdfViewerManager = pdfViewerManager;
  }

  /**
   * 捕获PDF指定区域的截图
   * @param {number} pageNumber - 页码
   * @param {Object} rect - 区域 { x, y, width, height }
   * @returns {Promise<string>} base64图片数据（data:image/png;base64,...）
   */
  async capture(pageNumber, rect) {
    // 1. 获取页面Canvas
    const canvas = await this.#getPageCanvas(pageNumber);

    // 2. 提取指定区域
    const regionCanvas = this.#extractRegion(canvas, rect);

    // 3. 转换为base64
    return this.#toBase64(regionCanvas);
  }

  /**
   * 获取PDF页面的Canvas元素
   * @private
   */
  #getPageCanvas(pageNumber) {
    const pageContainer = document.querySelector(
      `[data-page-number="${pageNumber}"]`
    );
    return pageContainer?.querySelector('canvas');
  }

  /**
   * 从完整Canvas中提取指定区域
   * @private
   */
  #extractRegion(sourceCanvas, rect) {
    const regionCanvas = document.createElement('canvas');
    regionCanvas.width = rect.width;
    regionCanvas.height = rect.height;

    const ctx = regionCanvas.getContext('2d');
    ctx.drawImage(
      sourceCanvas,
      rect.x, rect.y, rect.width, rect.height,  // 源区域
      0, 0, rect.width, rect.height             // 目标区域
    );

    return regionCanvas;
  }

  /**
   * 将Canvas转换为base64字符串
   * @private
   */
  #toBase64(canvas) {
    return canvas.toDataURL('image/png');
  }
}
```

### 2. ScreenshotTool类（用户交互）

**职责**：处理用户截图交互，协调截图流程

```javascript
/**
 * 截图工具 - 处理截图标注的创建
 * @file screenshot-tool.js
 */
class ScreenshotTool {
  #eventBus
  #pdfViewerManager
  #capturer
  #qwebChannelBridge  // ✨新增：QWebChannel桥接器
  #isActive = false
  #selectionOverlay = null
  #startPos = null
  #endPos = null

  constructor(eventBus, pdfViewerManager, capturer, qwebChannelBridge) {
    this.#eventBus = eventBus;
    this.#pdfViewerManager = pdfViewerManager;
    this.#capturer = capturer;
    this.#qwebChannelBridge = qwebChannelBridge;
  }

  /**
   * 激活截图模式
   */
  activate() {
    if (this.#isActive) return;

    this.#isActive = true;
    this.#createSelectionOverlay();
    this.#setupMouseEvents();

    // 改变鼠标样式
    document.body.style.cursor = 'crosshair';

    // 发布工具激活事件
    this.#eventBus.emit('annotation-tool:activate:success', {
      tool: 'screenshot'
    });
  }

  /**
   * 停用截图模式
   */
  deactivate() {
    if (!this.#isActive) return;

    this.#cleanup();
    this.#isActive = false;
    document.body.style.cursor = 'default';

    this.#eventBus.emit('annotation-tool:deactivate:success', {
      tool: 'screenshot'
    });
  }

  /**
   * 创建选择遮罩层
   * @private
   */
  #createSelectionOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'screenshot-selection-overlay';
    overlay.style.cssText = [
      'position: fixed',
      'top: 0',
      'left: 0',
      'width: 100%',
      'height: 100%',
      'z-index: 9999',
      'pointer-events: auto'
    ].join(';');

    // 选择矩形
    const rect = document.createElement('div');
    rect.className = 'selection-rect';
    rect.style.cssText = [
      'position: absolute',
      'border: 2px dashed #2196f3',
      'background: rgba(33, 150, 243, 0.1)',
      'display: none'
    ].join(';');

    overlay.appendChild(rect);
    document.body.appendChild(overlay);
    this.#selectionOverlay = overlay;
  }

  /**
   * 设置鼠标事件监听
   * @private
   */
  #setupMouseEvents() {
    const overlay = this.#selectionOverlay;

    overlay.addEventListener('mousedown', (e) => this.#handleMouseDown(e));
    overlay.addEventListener('mousemove', (e) => this.#handleMouseMove(e));
    overlay.addEventListener('mouseup', (e) => this.#handleMouseUp(e));

    // ESC取消
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.#isActive) {
        this.deactivate();
      }
    });
  }

  /**
   * 处理鼠标按下
   * @private
   */
  #handleMouseDown(e) {
    this.#startPos = { x: e.clientX, y: e.clientY };
    this.#endPos = null;

    const rect = this.#selectionOverlay.querySelector('.selection-rect');
    rect.style.display = 'block';
    rect.style.left = `${e.clientX}px`;
    rect.style.top = `${e.clientY}px`;
    rect.style.width = '0px';
    rect.style.height = '0px';
  }

  /**
   * 处理鼠标移动（绘制选择矩形）
   * @private
   */
  #handleMouseMove(e) {
    if (!this.#startPos) return;

    this.#endPos = { x: e.clientX, y: e.clientY };

    const rect = this.#selectionOverlay.querySelector('.selection-rect');
    const bounds = this.#getRectFromPoints(this.#startPos, this.#endPos);

    rect.style.left = `${bounds.x}px`;
    rect.style.top = `${bounds.y}px`;
    rect.style.width = `${bounds.width}px`;
    rect.style.height = `${bounds.height}px`;
  }

  /**
   * 处理鼠标释放
   * @private
   */
  async #handleMouseUp(e) {
    if (!this.#startPos) return;

    this.#endPos = { x: e.clientX, y: e.clientY };
    const rect = this.#getRectFromPoints(this.#startPos, this.#endPos);

    // 最小尺寸检查
    if (rect.width < 10 || rect.height < 10) {
      this.#cleanup();
      return;
    }

    // 捕获截图
    await this.#captureAndSave(rect);

    // 清理
    this.#cleanup();
  }

  /**
   * 捕获截图并保存
   * @private
   */
  async #captureAndSave(rect) {
    try {
      const pageNumber = this.#getCurrentPageNumber();

      // 1. 使用Canvas捕获截图（base64）
      const base64Image = await this.#capturer.capture(pageNumber, rect);

      // 2. 显示预览对话框
      const description = await this.#showPreviewDialog(base64Image);
      if (description === null) {
        // 用户取消
        return;
      }

      // ✨3. 通过QWebChannel发送到PyQt保存
      const saveResult = await this.#saveImageToPyQt(base64Image);

      if (!saveResult.success) {
        throw new Error('Failed to save image to PyQt');
      }

      // ✨4. 创建标注数据（使用PyQt返回的路径）
      const annotationData = {
        type: 'screenshot',
        pageNumber,
        rect,
        imagePath: saveResult.imagePath,    // PyQt返回的路径
        imageHash: saveResult.imageHash,    // 文件hash
        description
      };

      // ✨5. 发送到msgCenter（mock响应）
      this.#eventBus.emit('annotation:create:requested', annotationData);

    } catch (error) {
      console.error('Screenshot capture failed:', error);
      // 显示错误提示
      this.#eventBus.emit('notification:error', {
        message: '截图失败: ' + error.message
      });
    }
  }

  /**
   * ✨通过QWebChannel保存图片到PyQt端
   * @private
   * @param {string} base64Image - base64图片数据
   * @returns {Promise<{success: boolean, imagePath: string, imageHash: string}>}
   */
  async #saveImageToPyQt(base64Image) {
    if (!this.#qwebChannelBridge) {
      // 浏览器模式：使用本地存储模拟
      console.warn('QWebChannel not available, using mock storage');
      return {
        success: true,
        imagePath: '/data/screenshots/mock_' + Date.now() + '.png',
        imageHash: 'mock_hash_' + Math.random().toString(36).substr(2, 9)
      };
    }

    // 发送到PyQt端
    return new Promise((resolve, reject) => {
      this.#qwebChannelBridge.saveScreenshot(
        base64Image,
        (result) => {
          if (result.success) {
            resolve({
              success: true,
              imagePath: result.path,
              imageHash: result.hash
            });
          } else {
            reject(new Error(result.error || 'Unknown error'));
          }
        }
      );
    });
  }

  /**
   * 显示预览对话框
   * @private
   * @param {string} imageData - base64图片数据
   * @returns {Promise<string|null>} 用户输入的描述，或null（取消）
   */
  async #showPreviewDialog(imageData) {
    return new Promise((resolve) => {
      const dialog = document.createElement('div');
      dialog.className = 'screenshot-preview-dialog';
      dialog.style.cssText = [
        'position: fixed',
        'top: 50%',
        'left: 50%',
        'transform: translate(-50%, -50%)',
        'background: white',
        'border-radius: 8px',
        'box-shadow: 0 4px 20px rgba(0,0,0,0.3)',
        'padding: 20px',
        'z-index: 10000',
        'max-width: 600px',
        'max-height: 80vh',
        'overflow: auto'
      ].join(';');

      dialog.innerHTML = `
        <h3 style="margin: 0 0 16px 0; font-size: 16px;">截图预览</h3>
        <img src="${imageData}" style="max-width: 100%; border: 1px solid #ddd; border-radius: 4px;">
        <div style="margin-top: 16px;">
          <label style="display: block; margin-bottom: 8px; font-size: 14px;">
            标注描述（可选）:
          </label>
          <textarea
            id="screenshot-description"
            placeholder="为这个截图添加描述..."
            style="width: 100%; min-height: 80px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; resize: vertical;"
          ></textarea>
        </div>
        <div style="margin-top: 16px; display: flex; gap: 8px; justify-content: flex-end;">
          <button id="screenshot-cancel-btn" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">取消</button>
          <button id="screenshot-save-btn" style="padding: 8px 16px; border: none; background: #2196f3; color: white; border-radius: 4px; cursor: pointer;">保存</button>
        </div>
      `;

      document.body.appendChild(dialog);

      const textarea = dialog.querySelector('#screenshot-description');
      const saveBtn = dialog.querySelector('#screenshot-save-btn');
      const cancelBtn = dialog.querySelector('#screenshot-cancel-btn');

      textarea.focus();

      saveBtn.addEventListener('click', () => {
        const description = textarea.value.trim();
        dialog.remove();
        resolve(description);
      });

      cancelBtn.addEventListener('click', () => {
        dialog.remove();
        resolve(null);
      });
    });
  }

  /**
   * 计算矩形区域
   * @private
   */
  #getRectFromPoints(start, end) {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);

    return { x, y, width, height };
  }

  /**
   * 获取当前页码
   * @private
   */
  #getCurrentPageNumber() {
    // 从PDFViewerManager获取当前页码
    return this.#pdfViewerManager.getCurrentPageNumber() || 1;
  }

  /**
   * 清理资源
   * @private
   */
  #cleanup() {
    if (this.#selectionOverlay) {
      this.#selectionOverlay.remove();
      this.#selectionOverlay = null;
    }
    this.#startPos = null;
    this.#endPos = null;
  }
}
```

### 3. QWebChannel桥接器

**新增组件**：用于与PyQt端通信

```javascript
/**
 * QWebChannel桥接器 - 与PyQt端通信
 * @file qwebchannel-screenshot-bridge.js
 */
class QWebChannelScreenshotBridge {
  #pyqtObject  // PyQt端注入的对象
  #isAvailable

  constructor() {
    this.#isAvailable = typeof qt !== 'undefined' && qt.webChannelTransport;

    if (this.#isAvailable) {
      // 获取PyQt注入的对象
      new QWebChannel(qt.webChannelTransport, (channel) => {
        this.#pyqtObject = channel.objects.screenshotHandler;
      });
    }
  }

  /**
   * 保存截图到PyQt端
   * @param {string} base64Image - base64图片数据
   * @param {Function} callback - 回调函数 (result) => void
   */
  saveScreenshot(base64Image, callback) {
    if (!this.#isAvailable || !this.#pyqtObject) {
      // Mock响应（浏览器模式）
      setTimeout(() => {
        callback({
          success: true,
          path: '/data/screenshots/mock_' + Date.now() + '.png',
          hash: 'mock_' + Math.random().toString(36).substr(2, 9)
        });
      }, 100);
      return;
    }

    // 调用PyQt方法
    this.#pyqtObject.saveScreenshot(base64Image, callback);
  }

  /**
   * 检查QWebChannel是否可用
   */
  isAvailable() {
    return this.#isAvailable;
  }
}
```

### 4. msgCenter Mock响应

**修改AnnotationManager**：添加mock响应逻辑

```javascript
/**
 * 标注管理器 - 处理标注CRUD
 */
class AnnotationManager {
  #eventBus
  #annotations = new Map()
  #useMockBackend = true  // ✨第一期标志：使用mock后端

  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#setupEventListeners();
  }

  #setupEventListeners() {
    // 监听创建标注请求
    this.#eventBus.on(
      'annotation:create:requested',
      (data) => this.#handleCreateAnnotation(data),
      { subscriberId: 'AnnotationManager' }
    );
  }

  async #handleCreateAnnotation(annotationData) {
    try {
      // 生成ID
      const annotation = {
        id: 'ann_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        ...annotationData,
        comments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (this.#useMockBackend) {
        // ✨第一期：直接mock成功响应
        this.#mockSaveToBackend(annotation);
      } else {
        // 未来版本：真实发送到后端
        await this.#saveToBackend(annotation);
      }

    } catch (error) {
      console.error('Failed to create annotation:', error);
      this.#eventBus.emit('annotation:create:failed', {
        error: error.message
      });
    }
  }

  /**
   * ✨Mock保存到后端
   * @private
   */
  #mockSaveToBackend(annotation) {
    // 模拟网络延迟
    setTimeout(() => {
      // 保存到内存
      this.#annotations.set(annotation.id, annotation);

      // 发布创建成功事件
      this.#eventBus.emit('annotation:create:success', {
        annotation
      });

      console.log('[Mock] Annotation saved:', annotation);
    }, 200);
  }

  /**
   * 真实保存到后端（未来实现）
   * @private
   */
  async #saveToBackend(annotation) {
    // 通过WebSocket发送到后端
    // TODO: 第二期实现
    throw new Error('Backend save not implemented yet');
  }
}
```

### 5. 图片显示组件

**AnnotationSidebarUI**：通过HTTP加载图片

```javascript
/**
 * 创建截图标注卡片
 * @private
 */
#createScreenshotCard(annotation) {
  const card = document.createElement('div');
  card.className = 'annotation-card screenshot-card';
  card.dataset.annotationId = annotation.id;

  // ✨使用HTTP URL加载图片
  const imageUrl = this.#getImageUrl(annotation.imagePath);

  card.innerHTML = `
    <div class="annotation-card-header">
      <span class="annotation-icon">📷</span>
      <span class="annotation-type">截图标注</span>
      <button class="card-menu-btn">⋮</button>
    </div>
    <div class="annotation-card-body">
      <img
        src="${imageUrl}"
        alt="截图"
        class="screenshot-thumbnail"
        style="max-width: 100%; border-radius: 4px; margin-bottom: 8px;"
        onerror="this.src='/placeholder.png'"
      >
      <p class="annotation-description">${this.#escapeHtml(annotation.description)}</p>
      <div class="annotation-meta">
        <span>页码: P.${annotation.pageNumber}</span>
        <span>时间: ${this.#formatDate(annotation.createdAt)}</span>
      </div>
    </div>
    <div class="annotation-card-footer">
      <button class="jump-btn">→ 跳转</button>
      <button class="comment-btn">💬 ${annotation.comments.length}条评论</button>
    </div>
  `;

  return card;
}

/**
 * ✨获取图片HTTP URL
 * @private
 * @param {string} imagePath - PyQt返回的图片路径
 * @returns {string} HTTP URL
 */
#getImageUrl(imagePath) {
  // 从runtime-ports.json获取文件服务器端口
  const fileServerPort = this.#getFileServerPort();

  // 构建HTTP URL
  return `http://localhost:${fileServerPort}${imagePath}`;
}

/**
 * 获取文件服务器端口
 * @private
 */
#getFileServerPort() {
  // 从全局配置或runtime-ports.json读取
  return window.APP_CONFIG?.fileServerPort || 8080;
}
```

## PyQt端接口规范

### PyQt需要实现的接口

```python
class ScreenshotHandler(QObject):
    """
    截图处理器 - 通过QWebChannel暴露给JS
    """

    @pyqtSlot(str, 'QVariant')
    def saveScreenshot(self, base64_image: str, callback):
        """
        保存截图到本地文件系统

        Args:
            base64_image: base64编码的图片数据
            callback: JS回调函数

        Returns (通过callback):
            {
                'success': True/False,
                'path': '/data/screenshots/<hash>.png',  # 相对路径
                'hash': '<hash>',                         # 文件hash
                'error': '错误信息'  # 失败时
            }
        """
        try:
            # 1. 解码base64
            image_data = base64.b64decode(base64_image.split(',')[1])

            # 2. 计算hash
            hash_value = hashlib.md5(image_data).hexdigest()

            # 3. 检查文件是否已存在（去重）
            # 使用项目data目录下的screenshots子目录
            screenshot_dir = Path(self.config['data_dir']) / 'screenshots'
            screenshot_dir.mkdir(parents=True, exist_ok=True)

            filename = f"{hash_value}.png"
            filepath = screenshot_dir / filename

            # 4. 保存文件
            if not filepath.exists():
                with open(filepath, 'wb') as f:
                    f.write(image_data)

            # 5. 返回结果
            callback({
                'success': True,
                'path': f'/data/screenshots/{filename}',
                'hash': hash_value
            })

        except Exception as e:
            callback({
                'success': False,
                'error': str(e)
            })
```

## 第一期实现任务清单

### Phase 3-1: Canvas截图捕获（1小时）
- [ ] 实现ScreenshotCapturer类
  - [ ] #getPageCanvas方法
  - [ ] #extractRegion方法
  - [ ] #toBase64方法
- [ ] 测试Canvas截图生成base64

### Phase 3-2: 用户交互实现（2小时）
- [ ] 实现ScreenshotTool类
  - [ ] activate/deactivate方法
  - [ ] #createSelectionOverlay方法
  - [ ] #handleMouseDown/Move/Up方法
  - [ ] #showPreviewDialog方法
- [ ] 实现选择矩形绘制
- [ ] 实现ESC取消功能

### Phase 3-3: QWebChannel通信（1.5小时）
- [ ] 实现QWebChannelScreenshotBridge类
- [ ] 测试PyQt端通信（需要PyQt端配合）
- [ ] 实现浏览器模式Mock

### Phase 3-4: msgCenter Mock响应（1小时）
- [ ] 修改AnnotationManager添加mock逻辑
- [ ] 实现#mockSaveToBackend方法
- [ ] 测试mock响应流程

### Phase 3-5: 图片显示（1小时）
- [ ] 实现#createScreenshotCard方法
- [ ] 实现#getImageUrl方法
- [ ] 测试HTTP图片加载
- [ ] 添加加载失败占位图

### Phase 3-6: 集成测试（0.5小时）
- [ ] 端到端测试完整截图流程
- [ ] 验证图片保存和加载
- [ ] 验证UI更新

**总预计时间**: 7小时（v001为4小时，增加了QWebChannel和mock实现）

## 验收标准

### 功能测试
1. ✅ 点击📷按钮进入截图模式，鼠标变为十字光标
2. ✅ 拖拽鼠标正确绘制选择矩形（蓝色虚线边框）
3. ✅ 释放鼠标显示预览对话框，包含截图预览
4. ✅ 输入描述并点击保存
5. ✅ 截图通过QWebChannel发送到PyQt
6. ✅ PyQt返回保存成功和图片路径
7. ✅ msgCenter mock返回成功（不发送到真实后端）
8. ✅ 标注卡片显示在侧边栏
9. ✅ 卡片显示截图缩略图（通过HTTP加载）
10. ✅ 页码、时间、描述显示正确
11. ✅ ESC键取消截图模式

### 浏览器模式兼容
1. ✅ 在浏览器模式下（无QWebChannel），使用mock数据
2. ✅ mock数据包含模拟的图片路径
3. ✅ UI功能正常，只是图片无法真实保存

### 性能要求
- ✅ 截图生成base64 < 500ms
- ✅ QWebChannel通信往返 < 200ms
- ✅ mock响应延迟 ~200ms（模拟真实延迟）

## 第二期计划（后端真实持久化）

第二期将实现：
1. msgCenter真实发送到后端（不使用mock）
2. 后端保存标注数据到数据库
3. 重新打开PDF时加载历史标注
4. 标注编辑和删除功能
5. 评论功能

## 技术风险与缓解

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| QWebChannel通信失败 | 🟡 中 | 实现浏览器模式mock，保证功能可用 |
| PyQt端保存失败 | 🟡 中 | 错误处理和用户提示，retry机制 |
| 图片路径冲突 | 🟢 低 | 使用MD5 hash去重 |
| HTTP加载图片失败 | 🟡 中 | 提供占位图，onerror处理 |
| mock响应与真实响应不一致 | 🟡 中 | 严格按真实响应格式设计mock |

## 相关文档

- [v001原始规格说明](./v001-spec.md) - 完整功能设计
- [QWebChannel文档](../../../docs/qwebchannel-integration.md) - QWebChannel集成说明
- [PyQt截图处理器实现](../../../src/backend/pyqt/screenshot_handler.py) - PyQt端实现

## 修订历史

- v002 (2025-10-03): 第一期实现方案，添加QWebChannel和mock响应
- v001 (2025-10-02): 初始设计，使用base64直接保存到后端
