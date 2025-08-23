# PDF-Home模块重构需求澄清文档

## 背景与目标

### 当前问题
- 现有pdf-home模块存在大量未知bug
- 代码架构基于类继承，耦合度高
- 组件加载方式为同步加载，与QtWebEngine异步特性不符
- 业务逻辑、UI逻辑、环境设置逻辑混杂

### 重构目标
1. **架构改进**: 从类继承改为组合方式
2. **加载机制**: 改为事件驱动的异步加载
3. **模块分离**: 清晰分离业务逻辑、UI逻辑、环境设置
4. **测试驱动**: 采用TDD开发流程
5. **逐步重构**: 通过多版迭代逐步替换现有功能

## 功能需求

### 核心功能保持
- PDF文件列表展示
- PDF文件添加/删除
- WebSocket通信
- 调试面板功能
- 键盘快捷键支持

### 新功能需求
- 事件驱动的组件加载
- 模块化的错误处理
- 更好的状态管理
- 可组合的模块系统

## 非功能需求

### 性能要求
- 首次加载时间 < 2s
- 内存使用优化
- 事件响应延迟 < 100ms

### 兼容性要求
- 兼容QtWebEngine异步加载特性
- 保持现有API接口不变
- 支持热重载开发

### 质量要求
- 测试覆盖率 > 80%
- 每个模块独立测试
- 清晰的错误边界

## 技术约束

### 技术栈
- **框架**: 原生JavaScript
- **通信**: WebSocket (ws://localhost:8765)
- **环境**: QtWebEngine (异步加载特性)
- **构建**: Vite构建系统

### 编码规范
- 遵循项目JavaScript代码规范（详见下方"编码规范摘要",更多信息可查看docs\SPEC\javascript_code_standard.md）
- 使用ES6模块系统
- 优先使用const/let，避免var
- 使用async/await处理异步操作

### 架构约束
- **事件驱动**: 所有组件加载必须通过事件触发
- **组合优先**: 使用对象组合而非类继承
- **单一职责**: 每个模块职责单一

## 已确认的技术细节

### 事件命名规范
采用统一的事件命名约定：
- **模块事件**: `{module}:{action}:{status}`
  - 例: `pdf:load:start`, `pdf:load:success`, `pdf:load:error`
- **UI事件**: `ui:{component}:{action}`
  - 例: `ui:button:click`, `ui:list:select`
- **系统事件**: `sys:{feature}:{state}`
  - 例: `sys:websocket:connected`, `sys:websocket:disconnected`

### 错误处理策略
采用模块级错误处理机制：
- **错误分类**: 业务错误、网络错误、系统错误
- **错误传播**: 通过事件总线传播错误事件
- **错误处理**: 每个模块独立处理自己的错误
- **错误日志**: 所有错误通过debug日志服务器记录

### 状态管理
**不引入**外部状态管理库，采用：
- **模块内状态**: 每个模块管理自己的状态
- **事件同步**: 通过事件实现模块间状态同步
- **单向数据流**: 父模块通过事件通知子模块状态变化

### 日志级别控制
- **调试日志**: 尽可能详细，包括函数调用栈
- **日志输出**: 通过debug日志服务器同步到`debug-console.log`
- **日志清理**: 每次页面刷新自动清空日志文件
- **日志格式**: `[时间戳] [模块名] [级别] 消息内容`

### 热重载支持
- **模块级热替换**: 支持单个模块的热更新
- **状态保持**: 热重载时保持模块状态
- **自动刷新**: 检测到文件变化时自动重新加载

## 已确认的业务逻辑

### WebSocket重连策略
**暂时不考虑**WebSocket重连问题，采用：
- **一次性连接**: 页面加载时建立连接
- **错误提示**: 连接断开时显示错误提示
- **手动刷新**: 用户手动刷新页面重新建立连接

### 文件操作机制
- **文件存储**: PDF文件保存到根目录`/data`文件夹
- **文件命名**: 使用UUID作为文件名，避免重名
- **映射记录**: `pdf-mapping.json`文件记录UUID到原始文件名的映射
- **文件操作**: 添加文件时复制到data目录，删除时从data目录移除

### 缓存策略
**不启用**PDF列表缓存，采用：
- **实时加载**: 每次刷新页面都从服务器获取最新列表
- **内存缓存**: 仅在当前会话中保持PDF列表状态
- **无持久化**: 不将PDF列表状态保存到本地存储

### 权限控制
**不实现**文件操作权限检查，采用：
- **开放访问**: 所有用户都可以添加/删除PDF文件
- **本地操作**: 仅限本地文件系统操作
- **无用户认证**: 不区分不同用户的权限

## 版本管理规则

### 目录结构规范
```
frontend/
├── 📁 common/                     # 公共组件和工具（重构对象）
│   ├── app-manager.js            # 应用管理器
│   ├── business-logic-manager.js  # 业务逻辑管理
│   ├── debug-tools.js            # 调试工具
│   ├── error-collector.js        # 错误收集器
│   ├── index.js                  # 公共模块入口
│   ├── qtwebengine-adapter.js    # QtWebEngine适配器
│   ├── ui-manager.js             # UI管理器
│   ├── websocket-manager.js      # WebSocket管理器
│   └── 📁 pdf-table/             # PDF表格组件
│       ├── pdf-table.js          # 主表格组件
│       ├── pdf-table-*.js        # 各种功能模块
│       └── pdf-table-styles.css  # 表格样式
├── 📁 pdf-home/                   # PDF主页应用
│   ├── index.html                # 主页HTML（**不可重命名**）
│   ├── index.js                  # 主页入口
│   ├── pdf-home-app.js          # 主页应用类
│   ├── pdf-home-business-logic.js # 业务逻辑
│   ├── pdf-home-ui.js           # 主页UI
│   └── style.css                # 主页样式
```

### 版本命名规则
- **主版本**: `v1`, `v2`, `v3`... 对应每次重大重构
- **小版本**: `v1.1`, `v1.2`... 对应同一版本下的模块优化
- **目录命名**: 当前版本保持`pdf-home`，上一版本重命名为`pdf-home-v{版本号}`

### 版本迁移流程
1. **创建新版本** 使用复制命令,复制当前`pdf-home`为`pdf-home-v{当前版本}`
2. **开发新版本**: 在`pdf-home`目录中开发新版本
3. **功能验证**: 确保新版本功能完整
4. **旧版本保留**: 保留旧版本用于回滚

## 编码规范摘要

### 核心规范要点

#### 1. 代码格式
- **缩进**: 2个空格
- **引号**: 单引号优先
- **行长度**: 最大100字符
- **分号**: 必须使用分号

#### 2. 命名规范
- **变量/函数**: 小驼峰命名 `getUserName()`
- **常量**: 全大写 + 下划线 `MAX_FILE_SIZE`
- **类/组件**: 大驼峰命名 `PdfViewer`
- **文件**: 小写 + 连字符 `pdf-viewer.js`

#### 3. 导入导出
```javascript
// 导入顺序：内置 -> 第三方 -> 本地模块
import { ref } from 'vue';                    // 内置
import axios from 'axios';                   // 第三方
import { usePdfStore } from '@/stores/pdf';  // 本地

// 优先使用具名导出
export { processPdf, validatePdf };
```

#### 4. 异步操作
```javascript
// 使用async/await
async function loadPdf(url) {
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error('加载失败:', error);
    throw error;
  }
}
```

#### 5. 错误处理
```javascript
// 每个异步操作都要有错误处理
class PdfManager {
  async loadDocument(id) {
    this.loading = true;
    this.error = null;
    
    try {
      const doc = await api.getPdf(id);
      this.currentDoc = doc;
    } catch (error) {
      this.error = error.message;
      this.emit('pdf:load:error', error);
    } finally {
      this.loading = false;
    }
  }
}
```

## 开发流程

### 版本迭代策略: 原型开发→模块逐个打包分离

#### 核心理念
采用渐进式重构策略，从单一文件原型开始，逐步将功能模块分离出去，最终使主文件成为轻量级引导程序。

#### 第1版: 单文件原型 (v1)
**目标**: 在单个index.js中实现完整功能原型
**时间**: 1-2天
**文件结构**:
```
pdf-home/
├── index.html         # 基础HTML结构
├── index.js           # 包含所有功能的单文件原型
└── style.css          # 基础样式
```

**开发重点**:
1. **快速原型**: 所有代码写在index.js中，快速验证功能
2. **功能完整**: 包含事件系统、文件管理、UI渲染、WebSocket通信
3. **日志调试**: 通过console.log输出详细调试信息到debug-console.log
4. **手动测试**: 在浏览器中直接验证每个功能点

#### 第2版: 首次模块分离 (v2)
**目标**: 分离出事件总线模块
**时间**: 1-2天
**文件结构**:
```
pdf-home/
├── index.html
├── index.js           # 主引导文件，职责简化
├── modules/
│   └── event-bus.js   # 独立的事件总线模块
├── utils/
│   └── logger.js      # 日志工具
└── style.css
```

**分离策略**:
1. **提取事件总线**: 将index.js中的事件相关代码移到event-bus.js
2. **保持兼容**: index.js通过import使用事件总线，保持功能不变
3. **验证功能**: 确保事件系统分离后所有功能正常
4. **逐步验证**: 每分离一个模块立即在页面中测试

#### 第3版: 业务逻辑分离 (v3)
**目标**: 分离PDF文件管理和WebSocket通信
**时间**: 2-3天
**文件结构**:
```
pdf-home/
├── index.html
├── index.js           # 更轻量的引导文件
├── modules/
│   ├── event-bus.js
│   ├── pdf-manager.js # PDF文件管理模块
│   └── ws-client.js   # WebSocket客户端模块
├── utils/
│   ├── logger.js
│   └── dom-utils.js   # DOM操作工具
└── style.css
```

**分离重点**:
1. **PDF管理**: 提取文件添加、删除、列表管理功能
2. **通信模块**: 提取WebSocket连接和消息处理
3. **工具函数**: 提取通用的DOM操作和工具函数
4. **接口清晰**: 每个模块提供清晰的API接口

#### 第4版: UI组件分离 (v4)
**目标**: 分离UI渲染和交互逻辑
**时间**: 2-3天
**文件结构**:
```
pdf-home/
├── index.html
├── index.js           # 仅负责初始化和模块协调
├── modules/
│   ├── event-bus.js
│   ├── pdf-manager.js
│   ├── ws-client.js
│   ├── ui-renderer.js # UI渲染模块
│   └── components/    # 可复用的UI组件
│       ├── pdf-list.js
│       ├── file-uploader.js
│       └── debug-panel.js
├── utils/
│   ├── logger.js
│   └── dom-utils.js
└── styles/
    ├── main.css
    └── components/    # 组件专用样式
        ├── pdf-list.css
        └── uploader.css
```

**分离策略**:
1. **渲染逻辑**: 提取所有DOM操作和UI更新逻辑
2. **组件化**: 将UI拆分为独立、可复用的组件
3. **样式分离**: 按组件分离CSS样式
4. **事件委托**: 使用事件委托减少DOM操作

#### 第5版: 引导程序优化 (v5)
**目标**: index.js成为轻量级引导程序
**时间**: 1-2天
**文件结构**:
```
pdf-home/
├── index.html
├── index.js           # 仅负责模块初始化和协调
├── config.js          # 配置文件
├── modules/
│   ├── index.js       # 模块统一导出
│   ├── core/          # 核心模块
│   │   ├── event-bus.js
│   │   └── app-core.js
│   ├── services/      # 业务服务
│   │   ├── pdf-manager.js
│   │   └── ws-client.js
│   ├── components/    # UI组件
│   │   ├── pdf-list.js
│   │   ├── file-uploader.js
│   │   └── debug-panel.js
│   └── utils/         # 工具函数
│       ├── logger.js
│       └── dom-utils.js
└── styles/
    ├── main.css
    └── components/
```

**最终目标**:
1. **index.js最小化**: 仅包含模块初始化和基本配置
2. **模块解耦**: 所有功能模块完全独立，可单独测试
3. **按需加载**: 支持模块的按需加载
4. **清晰架构**: 建立清晰的模块依赖关系

### 每版开发步骤
1. **备份旧版本**: 将当前版本重命名为v{版本号}
2. **创建新版本**: 在新目录中开始开发
3. **模块分离**: 按策略提取指定模块
4. **功能验证**: 立即在浏览器中测试所有功能
5. **日志检查**: 通过debug-console.log确认无错误
6. **回滚准备**: 保留回滚方案，确保可随时回退

## 开发约束与边界

### AI开发边界
- **前端专用**: AI只负责前端JavaScript代码，不操作其他文件
- **环境预设**: Vite、app.py、qtwebengine-debug-listener已启动，AI无需关注
- **调试方式**: 通过debug-console.log查看HTML页面console输出
- **文件限制**: 仅修改前端目录下的.js、.html、.css文件

### 测试方式
- **手动验证**: 通过实际页面操作验证功能
- **日志调试**: 使用debug-console.log观察运行状态
- **逐步验证**: 每完成一个功能立即在页面中测试
- **回滚机制**: 保留旧版本文件，出现问题可快速回滚

## 风险评估与缓解

### 高风险项
1. **QtWebEngine兼容性**: 异步加载可能导致时序问题
   - **缓解策略**: 专门测试异步加载场景，提供降级方案
2. **WebSocket稳定性**: 连接管理复杂性增加
   - **缓解策略**: 简化连接逻辑，增加连接状态监控
3. **状态同步**: 模块间状态同步的复杂性
   - **缓解策略**: 使用事件驱动状态同步，避免直接状态共享

### 中风险项
1. **性能退化**: 重构可能导致性能下降
   - **缓解策略**: 每个版本都进行性能基准测试
2. **功能回退**: 重构过程中可能遗漏功能
   - **缓解策略**: 完整的功能测试清单，逐项验证
3. **测试复杂性**: 异步测试编写难度较高
   - **缓解策略**: 提供异步测试模板和工具函数

### 低风险项
1. **代码风格不一致**: 多人协作可能产生风格差异
   - **缓解策略**: 使用ESLint + Prettier自动格式化
2. **文档不同步**: 代码变更后文档更新不及时
   - **缓解策略**: 文档即代码，文档与代码同步提交

