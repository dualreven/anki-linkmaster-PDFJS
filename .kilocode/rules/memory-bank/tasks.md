## PDF.js 集成到前端架构
**上次执行：** 2025-09-14
**需修改文件：**
- `src/frontend/pdf-viewer/pdf-manager.js`
- `src/frontend/pdf-viewer/page-transfer-manager.js`
- `src/frontend/common/event/pdf-viewer-constants.js`
- `vite.config.js`
- `babel.config.js`
- `src/frontend/pdf-viewer/index.html`

**步骤：**
1. 引入 PDF.js CDN 并配置 worker
2. 实现 LRU 页面缓存（page-transfer-manager.js）
3. 集成 WebGL 检测与 Canvas 回退（webgl-detector.js）
4. 通过 EventBus 发布 `FILE.LOAD.SUCCESS/ERROR` 事件
5. 配置 Babel 支持私有字段（`#setupResizeObserver`）
6. 编写测试：`qtwebengine-compatibility.test.js`、`webgl-integration.test.js`

**重要说明：**
- 必须使用 `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/` 版本
- 所有事件必须使用命名导入，禁止默认导入
- 所有 `emit(undefined)` 必须替换为 `emit(null)`
- 必须通过 `qtwebengine-compatibility.test.js` 验证 QtWebEngine 环境兼容性