# PDF-Home模块重构共识确认文档

## 明确的需求描述和验收标准

### 需求描述（最终确认版）

#### 核心需求
将现有的单文件pdf-home模块（1275行）重构为基于组合模式的模块化架构，保持所有现有功能不变，同时提升可维护性、可测试性和QtWebEngine兼容性。

#### 具体需求分解

**1. 架构重构需求**
- 从类继承模式改为对象组合模式
- 从同步加载改为事件驱动的异步加载
- 从单文件结构改为多文件模块结构
- 从紧耦合改为松耦合设计

**2. 模块分离需求**
- 事件系统：独立的事件总线模块
- 日志系统：可配置的日志管理模块
- 错误处理：分层的错误处理模块
- 网络通信：WebSocket客户端模块
- 业务逻辑：PDF文件管理模块
- UI渲染：界面渲染和交互模块
- 应用协调：轻量级应用引导模块

**3. 测试驱动需求**
- 每个模块必须有对应的单元测试
- 测试覆盖率必须>80%
- 必须提供集成测试用例
- 必须支持mock和stub

**4. 兼容性需求**
- 保持现有WebSocket API不变
- 保持现有用户界面不变
- 适配QtWebEngine异步加载特性
- 支持开发时热重载

### 验收标准

#### 功能验收标准
- [ ] 所有现有功能正常工作（文件列表、添加、删除、打开）
- [ ] 键盘快捷键功能保持（Ctrl+D调试、Ctrl+N添加）
- [ ] WebSocket连接和重连机制正常
- [ ] 错误处理和用户提示正常
- [ ] 日志系统输出格式和内容不变

#### 性能验收标准
- [ ] 首次加载时间<2秒（与现有版本对比）
- [ ] 事件响应延迟<100ms
- [ ] 内存使用不高于现有版本20%
- [ ] 无内存泄漏（通过Chrome DevTools验证）

#### 代码质量验收标准
- [ ] 每个模块职责单一（SRP原则）
- [ ] 模块间依赖清晰（通过依赖图验证）
- [ ] 代码覆盖率>80%（通过测试报告验证）
- [ ] 无ESLint错误和警告
- [ ] 代码注释覆盖率>30%

#### 架构验收标准
- [ ] 无类继承关系（除Error类外）
- [ ] 所有依赖通过构造函数注入
- [ ] 所有模块通过事件总线通信
- [ ] 主引导文件<100行
- [ ] 每个模块文件<200行

## 技术实现方案和技术约束

### 技术实现方案

#### 1. 架构设计
```
模块化架构（基于组合模式）
├── index.html                 # 入口HTML（不变）
├── index.js                   # 轻量级引导程序（<100行）
├── config.js                  # 集中配置管理
├── modules/
│   ├── core/
│   │   ├── event-bus.js       # 事件总线（独立模块）
│   │   ├── logger.js          # 日志系统（可配置）
│   │   └── error-handler.js   # 错误处理（分层）
│   ├── services/
│   │   ├── websocket-client.js # WebSocket客户端
│   │   └── pdf-manager.js     # PDF业务逻辑
│   ├── ui/
│   │   ├── pdf-list-renderer.js # PDF列表渲染
│   │   ├── file-uploader.js     # 文件上传UI
│   │   └── debug-panel.js       # 调试面板UI
│   └── utils/
│       ├── dom-utils.js         # DOM操作工具
│       └── validators.js        # 数据验证工具
└── tests/
    ├── unit/                   # 单元测试
    ├── integration/            # 集成测试
    └── mocks/                  # 测试mock数据
```

#### 2. 模块通信协议
**事件命名规范（已确认）**
- 模块事件：`{module}:{action}:{status}`
  - 例：`pdf:load:start`, `pdf:load:success`, `pdf:load:error`
- UI事件：`ui:{component}:{action}`
  - 例：`ui:button:click`, `ui:list:select`
- 系统事件：`sys:{feature}:{state}`
  - 例：`sys:websocket:connected`, `sys:websocket:disconnected`

**事件Payload格式**
```javascript
{
  type: 'event_name',
  data: { /* 事件数据 */ },
  timestamp: '2024-01-01T00:00:00.000Z',
  source: 'module_name'
}
```

#### 3. 依赖注入模式
```javascript
// 构造函数注入
class PDFManager {
  constructor({ eventBus, websocketClient, logger }) {
    this.eventBus = eventBus;
    this.websocketClient = websocketClient;
    this.logger = logger;
  }
}

// 工厂函数创建
function createPDFManager(dependencies) {
  return new PDFManager(dependencies);
}
```

#### 4. 异步加载实现
```javascript
// 模块异步加载器
class ModuleLoader {
  async loadModule(modulePath) {
    const module = await import(modulePath);
    return module.default || module;
  }
  
  async loadModules(moduleMap) {
    const modules = {};
    for (const [name, path] of Object.entries(moduleMap)) {
      modules[name] = await this.loadModule(path);
    }
    return modules;
  }
}
```

### 技术约束

#### 1. 环境约束
- **运行环境**：QtWebEngine（必须支持异步加载）
- **JavaScript版本**：ES2020+
- **构建工具**：Vite（已配置）
- **测试框架**：Jest（推荐）或原生测试

#### 2. 编码约束
- **无类继承**：除Error类外，禁止使用class extends
- **纯函数优先**：优先使用纯函数和对象组合
- **不可变数据**：状态更新必须返回新对象
- **错误边界**：每个模块必须有错误边界

#### 3. 接口约束
- **WebSocket API**：保持现有消息格式不变
- **DOM接口**：保持现有HTML结构和CSS类名
- **全局对象**：保持window.app和window.eventBus暴露

## 任务边界限制

### 明确边界

#### 包含的任务
1. **前端重构**：仅限JavaScript代码重构
2. **模块拆分**：将单文件拆分为多文件模块
3. **测试编写**：为每个模块编写单元测试
4. **文档更新**：更新相关技术文档
5. **验证测试**：确保功能一致性

#### 排除的任务
1. **后端修改**：不涉及Python后端代码
2. **UI重设计**：不修改HTML结构和CSS样式
3. **功能增强**：不添加新功能特性
4. **性能优化**：不做超越现有性能的提升
5. **构建配置**：不修改Vite配置

### 版本管理策略

#### 版本命名
- **当前版本**：v1（单文件原型）
- **重构版本**：v2（模块化架构）
- **目录结构**：
  ```
  src/frontend/
  ├── pdf-home-v1/    # 备份当前版本
  └── pdf-home/       # 重构版本
  ```

#### 迁移流程
1. **备份阶段**：复制pdf-home为pdf-home-v1
2. **重构阶段**：在pdf-home中实施重构
3. **验证阶段**：逐项验证功能一致性
4. **回滚准备**：保留回滚方案

## 验收标准具体化

### 功能验证清单

#### 1. PDF文件管理
- [ ] 文件列表正确显示（文件名、大小、日期、页数）
- [ ] 文件添加功能正常（通过WebSocket触发选择）
- [ ] 文件删除功能正常（支持确认对话框）
- [ ] 文件打开功能正常（支持本地和viewer打开）
- [ ] 批量删除功能正常（支持多选和确认）

#### 2. 实时通信
- [ ] WebSocket连接建立正常
- [ ] 连接断开时显示错误提示
- [ ] 消息队列功能正常（离线消息缓存）
- [ ] 重连机制正常（最多5次尝试）

#### 3. 用户交互
- [ ] 键盘快捷键正常（Ctrl+D调试、Ctrl+N添加）
- [ ] 调试面板正常显示/隐藏
- [ ] 错误提示正常显示（3秒自动消失）
- [ ] 加载状态正确显示

#### 4. 日志和调试
- [ ] 日志级别控制正常（debug/info/warn/error）
- [ ] 日志格式保持一致（时间戳+模块+级别+消息）
- [ ] 调试信息正确显示在面板中
- [ ] 全局错误捕获正常

### 测试验证清单

#### 1. 单元测试
- [ ] EventBus模块测试（发布/订阅/取消）
- [ ] Logger模块测试（各级别日志输出）
- [ ] ErrorHandler模块测试（错误分类和处理）
- [ ] WebSocketClient测试（连接/消息/重连）
- [ ] PDFManager测试（CRUD操作和数据映射）
- [ ] UIRenderer测试（DOM操作和事件绑定）

#### 2. 集成测试
- [ ] 模块间通信测试（事件传递）
- [ ] 端到端功能测试（完整用户流程）
- [ ] 错误场景测试（网络断开、服务器错误）
- [ ] 性能基准测试（加载时间、内存使用）

### 代码质量验证

#### 1. 静态分析
```bash
# ESLint检查
npm run lint

# 复杂度分析
npm run analyze-complexity

# 依赖分析
npm run analyze-deps
```

#### 2. 测试报告
```bash
# 测试覆盖率
npm run test:coverage

# 性能基准
npm run test:performance

# 内存泄漏检测
npm run test:memory
```

### 最终验证步骤

#### 1. 手动验证流程
1. **启动应用**：确认无控制台错误
2. **加载列表**：确认PDF列表正确显示
3. **添加文件**：通过WebSocket模拟添加
4. **删除文件**：测试单个和批量删除
5. **打开文件**：测试本地和viewer打开
6. **错误场景**：断开网络测试重连
7. **调试功能**：测试调试面板和快捷键

#### 2. 自动化验证
```bash
# 运行所有测试
npm test

# 运行性能测试
npm run test:performance

# 验证构建产物
npm run build && npm run validate-build
```

## 不确定性已解决

### 关键决策确认

#### 1. 模块粒度（已解决）
**决策**：采用功能类型+业务领域混合粒度
- **事件系统**：独立模块（core级别）
- **业务服务**：按业务领域分离（PDF管理、WebSocket通信）
- **UI组件**：按功能分离（列表渲染、文件上传、调试面板）

#### 2. 状态管理（已解决）
**决策**：继续事件驱动，但标准化事件格式
- 保持现有事件驱动架构
- 制定严格的事件命名和payload规范
- 提供事件调试工具

#### 3. 错误边界（已解决）
**决策**：采用分层处理策略
- **模块级**：处理预期错误，提供降级方案
- **应用级**：处理未预期错误，统一日志和提示
- **全局级**：处理系统级错误，防止应用崩溃

#### 4. 配置管理（已解决）
**决策**：集中配置+模块配置结合
- **全局配置**：config.js管理所有配置
- **模块配置**：各模块接收配置对象
- **环境配置**：支持开发/生产环境差异

#### 5. 异步加载（已解决）
**决策**：采用模块异步加载器
- 使用动态import()实现异步加载
- 提供加载状态指示
- 支持错误处理和重试
- 保持与QtWebEngine兼容性

### 风险缓解措施

#### 1. 技术风险
- **QtWebEngine兼容性**：专门测试异步加载场景
- **性能退化**：每步重构都进行性能对比
- **功能回退**：完整的回归测试清单

#### 2. 项目风险
- **进度风险**：采用小步快跑，每2天一个里程碑
- **质量风险**：强制测试覆盖率检查
- **回滚风险**：保留完整回滚方案和备份

### 最终确认

#### 所有不确定性已解决
✅ 架构模式：组合模式已确认
✅ 模块粒度：功能+业务混合粒度已确认
✅ 状态管理：事件驱动已确认
✅ 错误处理：分层策略已确认
✅ 配置管理：集中+模块已确认
✅ 异步加载：模块加载器已确认
✅ 测试策略：TDD已确认
✅ 版本管理：v2版本已确认

#### 开发准备就绪
- 技术方案已确定
- 验收标准已明确
- 风险缓解已制定
- 可以开始重构实施