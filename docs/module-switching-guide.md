# Anki LinkMaster PDFJS 模块切换指南

## 概述

Anki LinkMaster PDFJS 现在支持通过命令行参数轻松切换不同的前端模块。您可以在启动应用时选择加载 `pdf-home` 或 `pdf-viewer` 模块。

## 使用方法

### 基本用法

```bash
# 默认加载 pdf-viewer 模块
python app.py

# 加载 pdf-home 模块
python app.py --module pdf-home

# 加载 pdf-viewer 模块
python app.py --module pdf-viewer
```

### 指定Vite端口

```bash
# 使用默认端口3000加载pdf-home模块
python app.py --module pdf-home

# 指定Vite端口为3001
python app.py --port 3001

# 组合使用模块和端口参数
python app.py --module pdf-home --port 3001
```

### 简写参数

```bash
# 使用简写参数
python app.py -m pdf-home -p 3001
```

## 参数说明

| 参数 | 简写 | 可选值 | 默认值 | 说明 |
|------|------|--------|--------|------|
| `--module` | `-m` | `pdf-home`, `pdf-viewer` | `pdf-viewer` | 选择要加载的前端模块 |
| `--port` | `-p` | 任意整数 | `3000` | Vite开发服务器端口 |

## 模块功能

### pdf-home 模块
- PDF文件管理界面
- 文件列表展示
- 文件添加/删除操作
- 表格视图

### pdf-viewer 模块
- PDF文档阅读器
- PDF.js集成
- 页面导航和缩放
- 文档预览

## 开发说明

### 技术实现

模块切换功能通过以下文件实现：

1. **app.py** - 添加命令行参数解析
2. **src/backend/main.py** - 修改main函数接受参数
3. **src/backend/app/application.py** - 修改run方法支持动态模块加载

### URL生成规则

应用会根据模块和端口参数生成对应的URL：
```
http://localhost:{port}/{module}/index.html
```

例如：
- `--module pdf-home --port 3000` → `http://localhost:3000/pdf-home/index.html`
- `--module pdf-viewer --port 3001` → `http://localhost:3001/pdf-viewer/index.html`

## 注意事项

1. **Vite服务器**：确保Vite开发服务器正在运行，并且端口与参数指定的端口一致
2. **模块可用性**：确保对应的模块在Vite服务器中可用
3. **端口冲突**：如果端口被占用，应用可能无法正常加载前端页面

## 故障排除

### 常见问题

1. **页面无法加载**：检查Vite服务器是否运行在指定端口
2. **模块不存在**：确认前端模块已正确构建和部署
3. **端口冲突**：使用 `--port` 参数指定其他可用端口

### 调试技巧

使用开发者工具（F12）查看网络请求和错误信息：
```bash
python app.py --module pdf-home
```

## 版本历史

- **v1.0.0** (2025-09-14): 初始版本，支持模块切换功能