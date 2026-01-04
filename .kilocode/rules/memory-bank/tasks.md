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

---

## 已取消：标注管理器（anno-manager）
**更新时间：** 2026-01-04  
**说明：** anno-manager 已按需求从代码与启动链路中移除；如未来需要“标注管理器/标注查询聚合”，请以新需求重新立项并补齐 SPEC 与事件契约。

