# Vite虚拟路由系统工作日志

## 项目基本信息
- **功能ID**: 20250923161500-vite-virtual-routing
- **开始时间**: 2025-09-23 16:15:00
- **负责人**: AI-Assistant
- **当前状态**: 需求设计阶段

## 工作日志

### 2025-09-23 16:15:00 - 需求分析和设计

#### 🔍 需求来源
- 用户提出需要实现前端Vite虚拟路由功能
- 希望实现 `localhost:viteport/module-name/` 转向 `src/frontend/module-name/`

#### 📋 问题识别
1. **命名冲突**:
   - URL期望使用横杠 (`pdf-home`)
   - 文件系统使用下划线 (`pdf_home`)
   - Python导入路径不能包含横杠

2. **架构不一致**:
   - Vite配置假设连字符路径
   - 实际目录使用下划线
   - 缺少统一的模块路由机制

#### 💡 解决方案设计
- **双重映射系统**: URL横杠 + 目录下划线
- **自动转换中间件**: 请求时动态转换路径
- **模块自动发现**: 扫描前端目录自动生成路由

#### 📊 技术调研结果

**当前项目结构**:
```
src/frontend/
├── pdf-home/           # 实际目录(下划线)
├── pdf_viewer/         # 实际目录(下划线)
├── common/
└── test_modules/
```

**期望URL访问**:
```
localhost:3000/pdf-home/     → src/frontend/pdf-home/
localhost:3000/pdf-viewer/   → src/frontend/pdf_viewer/
localhost:3000/common/       → src/frontend/common/
```

**现有Vite配置分析**:
- Root设置为 `src/frontend`
- 构建配置假设连字符路径
- 已有代理配置处理PDF和API请求

#### 🎯 核心技术决策
1. **保持目录下划线命名** - 满足Python导入要求
2. **URL使用横杠** - 符合Web标准和用户体验
3. **中间件自动转换** - 透明处理映射转换
4. **模块自动发现** - 减少手动配置，提升扩展性

#### ⚠️ 风险识别
- 与现有构建配置的兼容性
- 热重载功能的影响
- Python导入路径的保护

#### 📝 下一步计划
1. 创建详细的技术实现方案
2. 编写URL映射中间件
3. 实现模块自动发现功能
4. 集成到现有Vite配置
5. 全面测试兼容性

## 技术笔记

### Python导入约束验证
```python
# ✅ 有效的导入路径
from src.frontend.pdf_home import launcher

# ❌ 无效的导入路径 (包含横杠)
from src.frontend.pdf-home import launcher  # SyntaxError
```

### Vite中间件设计思路
```javascript
// 核心转换逻辑
const urlToPath = (url) => {
  return url.replace(/\/([^\/]+)-([^\/]+)/g, '/$1_$2');
};

// 示例转换
'/pdf-home/' → '/pdf-home/'
'/test-modules/' → '/test_modules/'
```

## 问题记录

### 已解决
- ✅ 确认了Python导入约束的存在
- ✅ 分析了当前项目结构的命名模式
- ✅ 设计了双重映射解决方案

### 待解决
- ⏳ 具体的Vite中间件实现方案
- ⏳ 模块自动发现的实现细节
- ⏳ 与现有代理配置的集成方式

## 相关资源

### 文档参考
- Vite配置文档: https://vitejs.dev/config/server-options.html
- Node.js中间件: Express middleware patterns
- Python import system: PEP 8 naming conventions

### 项目文件
- `vite.config.js` - 主要修改目标
- `src/frontend/` - 模块扫描目录
- `package.json` - 构建脚本配置

### 相关代码
- 现有的代理配置逻辑
- PDF和WebSocket的路由处理
- 模块构建和热重载机制