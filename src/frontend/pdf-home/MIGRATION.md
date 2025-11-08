# PDF-Home 功能域架构迁移计划

## 迁移策略：渐进式迁移

### 核心原则

1. **向后兼容**：保持现有代码正常工作
2. **渐进式**：新旧架构并存，逐步迁移
3. **Feature Flag 控制**：通过配置切换新旧架构
4. **最小化修改**：不破坏现有代码，只新增文件

---

## 现有架构分析

### 当前文件结构
```
pdf-home/
├── index.js                    # 入口文件
├── bootstrap/
│   └── app-bootstrap.js       # 应用启动
├── core/
│   ├── pdf-home-app.js        # 核心应用类
│   └── managers/              # 专门的管理器
│       ├── app-initialization-manager.js
│       ├── table-configuration-manager.js
│       └── websocket-event-manager.js
├── ui/
│   ├── ui-manager.js          # UI 管理器
│   └── handlers/              # 各种处理器
├── table/
│   ├── table-wrapper.js       # 表格封装
│   ├── table-lifecycle-manager.js
│   └── table-data-handler.js
└── container/
    └── app-container.js       # 旧的容器（将被废弃）
```

### 当前启动流程
1. `index.js` → `bootstrapPDFHomeApp()`
2. 创建 `PDFHomeApp` 实例
3. 初始化各种管理器（组合模式）
4. 调用 `app.initialize()`
5. 设置 `window.app`

---

## 新架构设计

### 目标文件结构
```
pdf-home/
├── index.js                    # 入口文件（保持不变）
├── bootstrap/
│   ├── app-bootstrap.js       # 旧启动程序（保留）
│   └── app-bootstrap-v2.js    # 新启动程序（功能域架构）
├── core/
│   ├── pdf-home-app.js        # 旧应用类（保留）
│   ├── pdf-home-app-v2.js     # 新应用类（功能域架构）
│   ├── dependency-container.js # 新容器（已实现）
│   ├── feature-registry.js     # 功能注册中心（已实现）
│   ├── state-manager.js        # 状态管理器（已实现）
│   └── feature-flag-manager.js # Feature Flag（已实现）
├── features/                   # 功能域目录（新增）
│   ├── pdf-list/              # PDF 列表功能域
│   │   ├── index.js           # 功能入口（已实现框架）
│   │   ├── feature.config.js  # 功能配置
│   │   ├── components/        # UI 组件（迁移目标）
│   │   ├── services/          # 业务逻辑（迁移目标）
│   │   └── state/             # 状态管理（迁移目标）
│   ├── (已移除) pdf-editor/            # PDF 编辑功能域（历史候选，现由 pdf-edit 提供）
│   └── pdf-sorter/            # PDF 排序功能域
└── config/
    └── feature-flags.json     # Feature Flag 配置
```

---

## 迁移分阶段计划

### 阶段 1: 基础设施准备（已完成 ✅）
- ✅ DependencyContainer
- ✅ ScopedEventBus
- ✅ FeatureRegistry
- ✅ StateManager
- ✅ FeatureFlagManager
- ✅ 功能域框架（PDFEditorFeature, PDFSorterFeature, PDFListFeature已移除）

### 阶段 2: 新应用类实现（当前阶段）
**目标**: 创建新的启动流程，使功能域架构可运行

**任务**:
1. 创建 `PDFHomeAppV2` 类
2. 创建 `app-bootstrap-v2.js`
3. 修改 `index.js` 支持双模式
4. 创建 Feature Flag 配置文件

**文件清单**:
- [ ] `core/pdf-home-app-v2.js` - 新应用类
- [ ] `bootstrap/app-bootstrap-v2.js` - 新启动程序
- [ ] `config/feature-flags.json` - Feature Flag 配置
- [ ] 修改 `index.js` - 支持双模式启动

### 阶段 3: PDF 列表功能迁移
**目标**: ~~将 PDF 列表相关代码迁移到 PDFListFeature~~

**状态**: ✅ **已完成 - PDFListFeature已移除**
**原因**: SearchResultsFeature 已经完整实现了PDF列表的展示功能，PDFListFeature是重复的实现

**实际使用**:
- 搜索结果展示由 `SearchResultsFeature` 负责
- PDF列表增删改查功能通过事件系统与后端通信
- 无需额外的PDFListFeature

### 阶段 4: PDF 编辑功能迁移
**目标**: 实现 PDFEditorFeature 的实际功能

**迁移内容**:
- 创建编辑模态框 UI
- 实现星标、标签、备注编辑
- 集成到 PDF 列表（双击打开编辑）

### 阶段 5: WebSocket 集成
**目标**: 将 WebSocket 通信集成到功能域

**任务**:
- WebSocketManager 注册到 DependencyContainer
- 功能域通过容器获取 WebSocketManager
- 统一消息协议

### 阶段 6: 完全切换
**目标**: 移除旧代码，完全使用新架构

**任务**:
- 删除旧的 PDFHomeApp
- 删除旧的 app-container.js
- 更新文档

---

## 迁移检查清单

### 功能完整性
- [ ] PDF 列表显示
- [ ] PDF 添加/删除
- [ ] PDF 双击打开
- [ ] PDF 元数据编辑
- [ ] PDF 排序
- [ ] PDF 筛选
- [ ] WebSocket 通信
- [ ] 错误处理

### 性能要求
- [ ] 加载时间 < 500ms
- [ ] 表格渲染 < 100ms
- [ ] 事件响应 < 50ms
- [ ] 内存占用不增加 >20%

### 测试覆盖
- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试全部通过
- [ ] 端到端测试通过
- [ ] 浏览器兼容性测试

---

## 风险和缓解措施

### 风险 1: 破坏现有功能
**缓解**: 保持旧代码不动，新代码通过 Feature Flag 控制

### 风险 2: 性能下降
**缓解**: 进行性能基准测试，对比新旧架构

### 风险 3: 学习成本
**缓解**: 编写详细文档和示例代码

### 风险 4: 迁移时间过长
**缓解**: 分阶段迁移，每个阶段可独立验证

---

## 回滚计划

如果新架构出现问题，可以：
1. 修改 Feature Flag 配置，禁用新架构
2. 重启应用，自动切换回旧架构
3. 无需重新部署代码

---

## 参考文档

- [需求规格说明](../../todo-and-doing/2%20todo/20251002130000-pdf-home-collaborative-architecture/v001-spec.md)
- [架构集成测试](__tests__/architecture-integration.test.js)
- [Feature Flag 示例配置](config/feature-flags.example.json)

---

**最后更新**: 2025-10-02
**状态**: 🚧 阶段 2 进行中

