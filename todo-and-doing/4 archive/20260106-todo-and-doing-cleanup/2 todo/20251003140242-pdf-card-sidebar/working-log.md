# PDF Viewer 卡片栏功能 - 工作日志

**功能ID**: 20251003140242-pdf-card-sidebar
**当前版本**: v001
**当前状态**: 需求设计完成，待开发

---

## 2025-10-03 14:02 - 需求创建

### 工作内容
- 创建需求文档 `v001-spec.md`
- 定义第一期目标：容器 UI 设计与基础架构
- 规划未来 4 期扩展功能

### 核心设计决策

#### 1. 分期开发策略
采用渐进式开发，避免一次性实现所有功能导致风险过高：
- **第一期（本期）**: 仅实现 UI 容器和基础架构，留好扩展接口
- **第二期**: 集成 Anki，加载卡片数据
- **第三期**: 实现快速制卡工具
- **第四期**: 实现完整制卡窗口
- **第五期**: 实现复习功能

#### 2. 技术架构选择
- **插件化架构**: 遵循 Feature-based 模式，与现有架构一致
- **事件驱动**: 通过 EventBus 解耦各模块
- **服务分层**: CardManager（业务层）+ AnkiAdapter（适配层）
- **接口预留**: 第一期定义所有接口，未来逐步实现

#### 3. UI 设计原则
- **参考现有组件**: 借鉴 BookmarkSidebarUI 的实现
- **简洁明了**: Header 5 个按钮，功能清晰
- **占位提示**: Body 显示开发计划，避免空白页面
- **响应式布局**: 固定宽度 320px，适配不同屏幕

### 关键技术点

#### Anki 集成方案（第二期）
- **方案 A**: AnkiConnect 插件 (推荐)
  - 优点：无需修改 Anki，HTTP API 简单易用
  - 缺点：需要用户安装插件
- **方案 B**: 直接调用 Anki Python API
  - 优点：不依赖插件
  - 缺点：需要深入理解 Anki 内部 API，兼容性风险高

**决策**: 优先使用 AnkiConnect，提供安装指南

#### 卡片关联方案
通过自定义字段 `pdf_id` 关联：
```python
# Anki 卡片字段
{
  "front": "问题内容",
  "back": "答案内容",
  "pdf_id": "abc123",          # 关联的 PDF 文档 ID
  "pdf_page": 42,              # 来源页码
  "source_type": "screenshot"  # 来源类型
}
```

#### 截图实现方案（第三期）
使用 Canvas API 截取 PDF 页面：
```javascript
const canvas = document.querySelector('#pdf-canvas');
const rect = { x: 100, y: 200, width: 300, height: 200 };
const imageData = canvas.getContext('2d').getImageData(
  rect.x, rect.y, rect.width, rect.height
);
// 转为 base64 或 Blob 上传
```

### 风险评估

| 风险项 | 等级 | 应对措施 |
|-------|------|---------|
| Anki API 兼容性 | 中 | 优先支持最新版，提供降级方案 |
| 截图质量问题 | 低 | 使用高分辨率 Canvas |
| 临时牌组管理复杂 | 中 | 完善错误处理，提供手动清理选项 |
| 性能问题（大量卡片） | 中 | 实现虚拟滚动，按需加载 |

---

## 下一步计划

### 开发任务清单（第一期）
- [ ] 创建 Feature 目录结构
- [ ] 实现 `events.js` 事件常量定义
- [ ] 实现 `feature.config.js` 配置文件
- [ ] 实现 `CardSidebarUI` 组件
  - [ ] Header 按钮组
  - [ ] Body 占位内容
  - [ ] 显示/隐藏动画
- [ ] 实现 `CardManager` 服务（仅接口）
- [ ] 实现 `AnkiAdapter` 服务（仅接口）
- [ ] 实现 `PDFCardFeature` 主类
- [ ] 编写样式文件 `card-sidebar.css`
- [ ] 在 `app-bootstrap-feature.js` 中注册 Feature
- [ ] 在主 UI 添加「卡片」按钮
- [ ] 编写单元测试
- [ ] 集成测试
- [ ] 文档更新

### 预计工作量
- **总计**: 6 个工作日
- **核心开发**: 3 天
- **测试调试**: 2 天
- **文档完善**: 1 天

---

## 参考资料

### 已查阅文档
- ✅ `src/frontend/HOW-TO-ADD-FEATURE.md` - Feature 开发指南
- ✅ `.kilocode/rules/FEATURE-REGISTRATION-RULES.md` - 注册规则
- ✅ `src/frontend/pdf-viewer/features/pdf-bookmark/` - 侧边栏参考

### 待查阅资料
- [ ] AnkiConnect API 文档
- [ ] Anki 数据模型文档
- [ ] Canvas API 截图最佳实践

---

**最后更新**: 2025-10-03 14:02:42
**负责人**: AI Assistant
**审核人**: 待定
