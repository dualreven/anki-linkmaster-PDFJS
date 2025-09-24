# 统一通信架构重构规格说明

**功能ID**: 20250923184000-unified-communication-architecture
**优先级**: 高
**版本**: v001
**创建时间**: 2025-09-23 18:40:00
**预计完成**: 2025-09-26
**状态**: 设计中

## 现状说明

### 当前通信层分散问题
- **EventBus**: 前端组件间本地通信，事件驱动架构
- **WebSocket**: 前后端跨进程网络通信，JSON消息协议
- **QWebChannel**: 前端与PyQt应用直接通信，Qt信号槽机制

### 已有基础设施
- 模块化的WebSocket服务器 (StandardWebSocketServer)
- 成熟的前端EventBus系统 (event-bus.js)
- 完善的QWebChannel桥接器 (qwebchannel-bridge.js)
- 统一的会话管理 (SessionManager)

## 存在问题

### 1. 架构分散性问题
- **通信机制重复**: 三套独立的通信系统，职责重叠
- **开发复杂度高**: 开发者需要学习和维护三套不同的API
- **日志分散混乱**: 通信日志分散在多个地方，难以统一追踪
- **错误处理不统一**: 各层级有不同的错误处理和重试机制

### 2. 维护和扩展问题
- **接口不统一**: 同样的功能在不同层级有不同的调用方式
- **降级策略缺失**: 单一通信层失效时缺少自动降级机制
- **扩展性限制**: 添加新的通信需求时需要在多处修改代码

### 3. 实际使用问题
- **文件选择功能缺陷**: 进程隔离导致GUI对话框无法正常显示
- **服务稳定性问题**: WebSocket服务器运行一段时间后自动停机
- **消息协议不统一**: 新旧格式并存，命名规范不一致

## 提出需求

### 核心目标
建立**以WebSocket为中心的星型统一通信架构**，整合现有的三套通信机制，提供统一的开发接口和运维体验。

### 具体需求
1. **统一消息协议**: 建立跨所有通信层的标准消息格式
2. **智能消息路由**: WebSocket服务器作为消息中枢，提供智能路由和降级
3. **统一开发接口**: 为开发者提供简洁一致的事件API
4. **集中日志管理**: 所有跨进程通信在WebSocket服务器统一记录
5. **客户端能力管理**: 动态发现和管理各客户端的功能能力

## 解决方案

### 技术架构设计

#### 1. 星型拓扑结构
```
            📱 JS前端 (EventBus代理)
               ↓↑ WebSocket
    🖥️ PyQt客户端 ← → 🌐 WebSocket服务器 ← → 📊 其他前端
     (能力提供者)    ↓↑ 统一路由器 ↓↑    (能力消费者)
               💾 统一日志中心
```

#### 2. 统一消息协议
```json
{
  "type": "file:selection:request",
  "request_id": "req_12345",
  "timestamp": "2025-09-23T18:40:00Z",
  "source": {
    "type": "js-frontend",
    "id": "pdf-home-ui-123",
    "module": "pdf-home"
  },
  "target": {
    "type": "pyqt-client",
    "capabilities": ["file_dialog"],
    "prefer": "pdf-home-gui-456"
  },
  "data": { "filters": [".pdf"] },
  "meta": {
    "timeout": 30000,
    "retry_count": 0,
    "trace_id": "trace_abc123"
  }
}
```

#### 3. 核心组件设计

##### WebSocket服务器端
- **UnifiedMessageRouter**: 统一消息路由器
- **ClientCapabilityManager**: 客户端能力管理器
- **UnifiedLogger**: 集中日志管理器
- **MessageLifecycleManager**: 消息生命周期管理

##### JS前端
- **UnifiedEventBusProxy**: 统一事件代理
- **ScopeDetector**: 事件范围智能检测
- **WebSocketAdapter**: WebSocket适配器

##### PyQt客户端
- **UnifiedPyQtBridge**: 统一PyQt桥接器
- **CapabilityProvider**: 能力提供器
- **MessageHandler**: 消息处理器

### 实现策略

#### 阶段1: 协议和路由 (2-3天)
1. 定义统一消息协议格式
2. 实现WebSocket服务器的统一路由器
3. 建立客户端注册和能力管理机制

#### 阶段2: 前端集成 (2-3天)
1. 实现JS端的EventBus代理层
2. 建立智能事件范围检测
3. 适配现有EventBus代码

#### 阶段3: PyQt集成 (2-3天)
1. 实现PyQt端的统一桥接器
2. 整合现有QWebChannel功能
3. 建立能力注册和处理机制

#### 阶段4: 日志和监控 (1-2天)
1. 实现集中化日志系统
2. 建立消息追踪和调试工具
3. 添加性能监控指标

#### 阶段5: 测试和优化 (2-3天)
1. 全面测试各通信场景
2. 性能优化和错误处理
3. 文档编写和示例代码

## 约束条件

### 仅修改通信层代码
仅修改WebSocket服务器、前端通信组件和PyQt桥接器，不可修改业务逻辑代码

### 严格遵循向后兼容性
必须保持现有EventBus、WebSocket和QWebChannel代码的向后兼容，确保现有功能不受影响

### 保持现有技术栈
- 前端继续使用JavaScript和现有EventBus架构
- 后端继续使用PyQt和QWebSocket
- 不引入新的外部依赖

## 可行验收标准

### 单元测试
- 统一消息协议的序列化/反序列化测试
- 消息路由器的路由逻辑测试
- 客户端能力管理的注册/发现测试
- 事件范围检测的准确性测试

### 集成测试
1. **文件选择功能**
   - JS前端发起文件选择请求
   - 自动路由到有GUI能力的PyQt客户端
   - 正确返回选择的文件列表

2. **PDF管理功能**
   - 前端发起PDF添加/删除请求
   - 通过WebSocket服务器路由到PDF管理服务
   - 更新结果正确广播到所有客户端

3. **跨客户端通信**
   - PDF-Home客户端发起操作
   - 消息正确路由到PDF-Viewer客户端
   - 双向通信功能完整

### 接口实现

#### 接口1: 统一事件发射
**函数**: `eventBus.emit(eventType, data, options)`
**描述**: 统一的事件发射接口，自动判断事件范围并路由
**参数**:
- `eventType`: 事件类型 (string) "domain:action:status"格式
- `data`: 事件数据 (object) 任意数据对象
- `options`: 选项 (object) {scope, target, timeout, fallback}
**返回值**: Promise<result> 事件处理结果

#### 接口2: 客户端能力注册
**函数**: `registerCapabilities(capabilities)`
**描述**: PyQt客户端向服务器注册自身能力
**参数**:
- `capabilities`: 能力列表 (array) ["file_dialog", "notification", "pdf_display"]
**返回值**: Promise<registration_id> 注册ID

#### 接口3: 消息路由解析
**函数**: `routeMessage(message, sourceClient)`
**描述**: WebSocket服务器的核心路由功能
**参数**:
- `message`: 统一消息对象 (object)
- `sourceClient`: 源客户端ID (string)
**返回值**: Promise<routing_result> 路由结果

### 类实现

#### 类1: UnifiedMessageRouter
**类**: `UnifiedMessageRouter`
**描述**: WebSocket服务器的统一消息路由器
**属性**:
- `clients`: 客户端注册表 (Map)
- `messageHandlers`: 消息处理器映射 (Map)
- `logger`: 统一日志记录器 (Logger)
**方法**:
- `routeMessage(message, source)`: 路由消息到目标客户端
- `registerClient(clientInfo)`: 注册新客户端
- `resolveTargetClients(targetInfo)`: 解析目标客户端列表

#### 类2: UnifiedEventBusProxy
**类**: `UnifiedEventBusProxy`
**描述**: JS前端的统一事件代理
**属性**:
- `wsClient`: WebSocket客户端 (WSClient)
- `localBus`: 本地事件总线 (EventBus)
- `messageHandlers`: 远程消息处理器 (Map)
**方法**:
- `emit(eventType, data, options)`: 统一事件发射
- `determineScope(eventType, options)`: 智能范围判断
- `sendRemoteMessage(eventType, data, options)`: 发送远程消息

#### 类3: UnifiedPyQtBridge
**类**: `UnifiedPyQtBridge`
**描述**: PyQt客户端的统一桥接器
**属性**:
- `wsClient`: WebSocket客户端连接 (object)
- `capabilities`: 客户端能力列表 (list)
- `messageHandlers`: 消息处理器字典 (dict)
**方法**:
- `registerClient()`: 向服务器注册客户端能力
- `handleMessage(message)`: 处理来自服务器的消息
- `provideCapability(capabilityType, handler)`: 提供特定能力的处理器

### 事件规范

#### 事件1: 文件选择事件
**事件类型**: `file:selection:request` / `file:selection:response`
**描述**: 文件选择对话框的请求和响应事件
**请求参数**:
- `filters`: 文件过滤器列表 (array)
- `multiple`: 是否允许多选 (boolean)
- `title`: 对话框标题 (string)
**响应参数**:
- `files`: 选择的文件路径列表 (array)
- `success`: 操作是否成功 (boolean)

#### 事件2: 客户端注册事件
**事件类型**: `client:register:request` / `client:register:response`
**描述**: 客户端向服务器注册能力的事件
**请求参数**:
- `clientType`: 客户端类型 (string) "js-frontend" | "pyqt-client"
- `module`: 所属模块 (string)
- `capabilities`: 能力列表 (array)
- `pid`: 进程ID (number)
**响应参数**:
- `clientId`: 分配的客户端ID (string)
- `success`: 注册是否成功 (boolean)

#### 事件3: 消息路由事件
**事件类型**: `message:route:*`
**描述**: 消息在路由过程中的状态事件
**状态类型**:
- `message:route:started`: 开始路由
- `message:route:resolved`: 目标解析完成
- `message:route:delivered`: 消息投递完成
- `message:route:failed`: 路由失败

## 性能要求
- 消息路由延迟 < 10ms (本地网络)
- 客户端注册时间 < 100ms
- 支持并发消息处理 (>100 msg/s)
- 内存使用稳定，无内存泄漏

## 兼容性要求
- 完全兼容现有EventBus代码
- 完全兼容现有WebSocket通信
- 完全兼容现有QWebChannel桥接
- 支持渐进式迁移，新旧API并存

## 安全性要求
- 客户端身份验证和授权
- 消息完整性检查
- 敏感数据传输加密
- 防止消息伪造和重放攻击

## 监控和调试要求
- 完整的消息流追踪日志
- 客户端状态实时监控
- 性能指标收集和报告
- 错误率统计和告警

## 后续扩展考虑
- 支持分布式WebSocket集群
- 支持消息持久化和离线处理
- 集成更多通信协议 (gRPC, REST API)
- 支持插件化的消息处理中间件

## 风险评估和缓解措施

### 高风险项
1. **向后兼容性破坏**
   - 风险: 现有代码无法正常工作
   - 缓解: 分阶段迁移，保持API兼容

2. **性能回归**
   - 风险: 统一架构引入额外开销
   - 缓解: 性能基准测试，优化关键路径

3. **复杂性增加**
   - 风险: 架构过于复杂，难以维护
   - 缓解: 充分文档化，提供调试工具

### 中风险项
1. **客户端发现机制**
   - 风险: 动态客户端发现可能不稳定
   - 缓解: 提供手动配置选项

2. **消息序列化开销**
   - 风险: JSON序列化可能成为瓶颈
   - 缓解: 考虑二进制协议优化

## 成功度量标准
- 开发效率提升: 新功能开发时间减少30%
- 代码复杂度降低: 通信相关代码行数减少20%
- 故障率下降: 通信相关错误减少50%
- 开发者满意度: 新API易用性评分 >8/10