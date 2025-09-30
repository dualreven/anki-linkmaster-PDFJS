# Vite虚拟路由系统规格说明

**功能ID**: 20250923161500-vite-virtual-routing
**优先级**: 高
**版本**: v001
**创建时间**: 2025-09-23 16:15:00
**预计完成**: 2025-09-24
**状态**: 设计中

## 现状说明
- 当前前端模块使用下划线命名：`src/frontend/pdf-home/`, `src/frontend/pdf_viewer/`
- Vite配置中的构建路径假设使用连字符：`src/frontend/pdf-home/index.html`
- 实际访问需要直接指向具体的HTML文件，缺少统一的模块路由机制
- URL访问不够标准化和用户友好

## 存在问题
- **命名不一致**: 文件系统使用下划线，URL期望使用横杠
- **Python导入约束**: 目录名必须使用下划线才能被Python导入
- **缺少模块路由**: 无法通过 `localhost:3000/module-name/` 直接访问模块
- **扩展性差**: 新增模块需要手动配置路由规则

## 提出需求
- **URL标准化**: 实现 `localhost:3000/pdf-home/` → `src/frontend/pdf-home/` 的自动映射
- **模块化路由**: 支持所有前端模块的统一访问方式
- **Python兼容**: 保持目录下划线命名以支持Python导入
- **自动发现**: 新增模块时自动支持路由，无需手动配置

## 解决方案

### 核心设计
**URL横杠 + 目录下划线的双重映射系统**

### 技术方案
1. **Vite中间件实现URL到路径的映射转换**
   - URL使用横杠：`/pdf-home/`, `/pdf-viewer/`
   - 文件系统使用下划线：`pdf-home/`, `pdf_viewer/`
   - 通过中间件自动转换：横杠 → 下划线

2. **映射规则**
   ```
   URL: localhost:3000/pdf-home/     → 文件系统: src/frontend/pdf-home/
   URL: localhost:3000/pdf-viewer/   → 文件系统: src/frontend/pdf_viewer/
   URL: localhost:3000/test-modules/ → 文件系统: src/frontend/test_modules/
   ```

3. **自动模块发现**
   - 扫描 `src/frontend/` 目录下的所有模块目录
   - 为每个包含 `index.html` 的目录自动创建路由
   - 支持嵌套模块结构

## 约束条件

### 仅修改前端构建模块代码
仅修改 `vite.config.js` 和相关构建配置，不可修改其他模块的代码

### 严格遵循代码规范和标准
必须优先阅读和理解现有的Vite配置规范，保持向后兼容性

### 保持Python导入兼容性
- 目录命名必须使用下划线以支持Python导入
- 不能破坏现有的Python模块导入路径
- 保持 `from src.frontend.pdf_home import module` 的导入方式

## 可行验收标准

### 单元测试
- URL映射转换逻辑的单元测试
- 路由规则解析的测试用例
- 模块自动发现功能测试

### 端到端测试
1. **基础路由测试**
   - `localhost:3000/pdf-home/` 正确加载 PDF-Home 模块
   - `localhost:3000/pdf-viewer/` 正确加载 PDF-Viewer 模块
   - 静态资源路径正确解析

2. **兼容性测试**
   - 现有的直接文件访问方式仍然有效
   - Python导入功能不受影响
   - 构建输出结果保持不变

3. **扩展性测试**
   - 新增模块目录后自动支持路由
   - 嵌套模块结构正确处理

### 接口实现

#### 接口1: URL映射中间件
**函数**: `urlPathMapper(req, res, next)`
**描述**: 将URL中的横杠转换为文件系统路径中的下划线
**参数**:
- `req.url`: 请求URL路径
**返回值**: 修改后的请求对象，路径已映射到正确的文件系统路径

#### 接口2: 模块发现器
**函数**: `discoverModules(basePath)`
**描述**: 自动扫描前端目录，发现所有可路由的模块
**参数**:
- `basePath`: 扫描的基础路径 (`src/frontend`)
**返回值**: 模块映射表对象 `{ 'url-name': 'fs_name' }`

### 类实现

#### 类1: ModuleRouter
**类**: `ModuleRouter`
**描述**: 管理前端模块的路由映射和自动发现
**属性**:
- `moduleMap`: 存储URL到文件系统路径的映射
- `basePath`: 前端模块的基础路径
**方法**:
- `register(urlName, fsName)`: 手动注册模块映射
- `discover()`: 自动发现并注册所有模块
- `resolve(urlPath)`: 解析URL路径到文件系统路径

### 事件规范

#### 事件1: 模块路由解析
**描述**: 当接收到模块路由请求时触发路径解析
**参数**:
- `originalUrl`: 原始URL路径
- `targetModule`: 目标模块名称
**返回值**:
- `resolvedPath`: 解析后的文件系统路径
- `success`: 解析是否成功

### 配置规范

#### 映射表配置
```javascript
const moduleMapping = {
  'pdf-home': 'pdf_home',
  'pdf-viewer': 'pdf_viewer',
  'test-modules': 'test_modules',
  'common': 'common'
};
```

#### 路由中间件配置
```javascript
server: {
  configureServer(server) {
    server.middlewares.use('/[module-name]', moduleRouter);
  }
}
```

## 性能要求
- URL映射转换延迟 < 1ms
- 模块自动发现时间 < 100ms
- 不影响现有的构建和热重载性能

## 兼容性要求
- 保持与现有Vite配置的完全兼容
- 支持现有的代理配置和构建规则
- 不破坏Python模块的导入功能

## 后续扩展考虑
- 支持模块级别的路由配置文件
- 支持动态模块加载和卸载
- 集成模块权限管理机制