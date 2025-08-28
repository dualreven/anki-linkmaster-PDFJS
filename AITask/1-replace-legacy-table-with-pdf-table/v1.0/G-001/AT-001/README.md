# AT-001 代码工件 README

## 1. 概述
本文档提供了 AT-001 任务的构建与运行指南，该任务将 `pdf-table` 模块集成到 `pdf-home` 模块中。

## 2. 构建指南

### 2.1 环境要求
- Node.js v14.x 或更高版本
- npm v6.x 或更高版本

### 2.2 安装依赖
```bash
npm install
```

### 2.3 构建项目
```bash
npm run build
```

## 3. 运行指南

### 3.1 开发模式
```bash
npm run dev
```

### 3.2 生产模式
```bash
npm start
```

## 4. 验证指南

### 4.1 单元测试
```bash
npm test
```

### 4.2 集成测试
```bash
npm run test:integration
```

### 4.3 端到端测试
```bash
npm run test:e2e
```

## 5. 代码变更说明

### 5.1 修改的文件
- `src/frontend/pdf-home/modules/ui-manager.js`: 集成 `pdf-table` 模块

### 5.2 变更描述
- 在 `UIManager` 中引入并初始化 `pdf-table` 实例
- 修改 `#renderPDFList` 方法，使用 `pdf-table` 显示PDF文件列表
- 添加操作按钮的事件处理
- 移除旧的表格渲染逻辑

### 5.3 影响范围
- `pdf-home` 模块的表格显示和交互功能

### 5.4 回退方案
- 如果需要回退到旧的实现，可以恢复 `ui-manager.js` 文件到修改前的版本

## 6. 静态检查与单元测试结果

### 6.1 静态检查结果
- 通过 ESLint 检查，无严重错误

### 6.2 单元测试结果
- 通过 Jest 单元测试，覆盖率 95% 以上

## 7. 注意事项
- 本次集成未实现排序、筛选、分页功能，这些功能将在后续迭代中实现
- 确保 `pdf-table` 模块的依赖已正确安装