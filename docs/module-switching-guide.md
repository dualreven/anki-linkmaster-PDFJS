# Anki LinkMaster PDFJS 模块切换指南（已对齐 ai_launcher）

## 概述

Anki LinkMaster PDFJS 通过统一启动器 `ai_launcher.py` 切换并启动不同的前端模块。请始终使用 `ai_launcher.py`（禁止直接运行 `python app.py` 或手工 `npm run dev`）。

## 使用方法

### 基本用法

```bash
# 启动 pdf-home 模块
python ai_launcher.py start --module pdf-home --logs-dir logs

# 启动 pdf-viewer 模块（可选：携带文档标识）
python ai_launcher.py start --module pdf-viewer --pdf-id sample --logs-dir logs
```

### 指定Vite端口

```bash
# 使用默认端口3000加载 pdf-home
python ai_launcher.py start --module pdf-home --logs-dir logs

# 指定 Vite 端口为 3001
python ai_launcher.py start --module pdf-home --vite-port 3001 --logs-dir logs

# 组合使用模块与端口参数
python ai_launcher.py start --module pdf-home --vite-port 3001 --logs-dir logs
```

说明
- `--logs-dir` 为必填参数（统一日志与进程信息输出目录），建议设为 `logs`。
- 其他端口：`--msgServer-port`（WS）、`--pdfFileServer-port`（HTTP）。

## 参数说明

| 参数 | 可选值 | 默认值 | 说明 |
|------|--------|--------|------|
| `--module` | `pdf-home`, `pdf-viewer` | 无 | 选择要加载的前端模块 |
| `--vite-port` | 任意整数 | 3000 | Vite 开发服务器端口 |
| `--msgServer-port` | 任意整数 | 8765 | WebSocket 端口 |
| `--pdfFileServer-port` | 任意整数 | 8080 | PDF 文件服务器端口 |
| `--pdf-id` | 字符串 | 无 | viewer 打开目标文档标识 |
| `--logs-dir` | 目录 | 必填 | 日志与进程信息输出目录 |

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

模块切换与服务编排通过以下组件实现：

1. **ai_launcher.py** - 根级统一启动器（参数解析、端口分配、进程生命周期管理、日志目录）
2. **src/frontend/** 各模块 `launcher.py` - 前端 Qt 容器与参数消费
3. **ai_scripts/** - 端口/日志/服务管理的可复用单元（若可用）

### URL生成规则

应用会根据模块和端口参数生成对应的URL：
```
http://127.0.0.1:{port}/{module}/index.html
```

例如：
- `--module pdf-home --vite-port 3000` → `http://127.0.0.1:3000/pdf-home/index.html`
- `--module pdf-viewer --vite-port 3001` → `http://127.0.0.1:3001/pdf-viewer/index.html`

> 背景：Windows + QtWebEngine 下 `localhost` 的 IPv4/IPv6 解析不稳定，可能导致“页面能打开但动态 import 拉取失败”。开发模式统一使用 `127.0.0.1` 规避该类问题。

## 注意事项

1. **Vite服务器**：确保Vite开发服务器正在运行，并且端口与参数指定的端口一致
2. **模块可用性**：确保对应的模块在Vite服务器中可用
3. **端口冲突**：如果端口被占用，应用可能无法正常加载前端页面
4. **统一入口**：仅使用 `ai_launcher.py`，不要直接执行 `python app.py` / `npm run dev`

## 故障排除

### Loopback Host 一致性检查（建议作为必做验收）

当出现如下报错时优先执行本节：
- `Failed to fetch dynamically imported module: http://localhost:<vite_port>/pdf-home/index.js`
- 或前端日志出现类似：`[BOOT] import index.js failed`

在 PowerShell 中执行（把端口替换为实际 `vite_port`/`url_port`）：

```powershell
# 1) 确认 Vite HMR 客户端可访问（200）
curl.exe -I "http://127.0.0.1:3000/@vite/client"

# 2) 确认模块入口 JS 可访问（200）
curl.exe -I "http://127.0.0.1:3000/pdf-home/index.js"

# 3) 可选：确认 index.html 可访问（200）
curl.exe -I "http://127.0.0.1:3000/pdf-home/index.html"
```

若 `127.0.0.1` 访问失败但 `localhost` 访问成功，说明 Vite 可能监听在 `::1`（IPv6 loopback）。本项目 dev 默认使用 `127.0.0.1`，如需手工覆盖请设置环境变量：

```powershell
$env:VITE_HOST="127.0.0.1"
pnpm -s run dev
```

并确认窗口侧加载的 URL 也是 `http://127.0.0.1:<port>/...`（以 `logs/runtime-ports.json` 与窗口日志为准）。

### 常见问题

1. **页面无法加载**：检查Vite服务器是否运行在指定端口
2. **模块不存在**：确认前端模块已正确构建和部署
3. **端口冲突**：使用 `--port` 参数指定其他可用端口

### 调试技巧

使用开发者工具（F12）查看网络请求和错误信息，例如：
```bash
python ai_launcher.py start --module pdf-home --logs-dir logs
```

## 版本历史

- **v1.1.0** (2025-11-03): 对齐统一入口 `ai_launcher.py`；移除 `app.py` 与短参示例
- **v1.0.0** (2025-09-14): 初始版本，支持模块切换功能
