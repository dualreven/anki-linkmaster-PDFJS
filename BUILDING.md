# 构建与运行指南（UTF-8）

本项目将前端拆分为两个独立模块构建：pdf-home 与 pdf-viewer；后端单独打包到 dist/latest 下。所有命令均以 UTF-8 方式执行（`python -X utf8`）。

## 环境准备

- Python 3.9+，可执行 `python`（或 `py -3`）
- Node.js 18+ 与 pnpm（或 npm/yarn），本地已安装依赖（node_modules 存在）
- Windows/PowerShell 下建议使用本仓库提供的脚本直接构建

## 目录结构（产物）

- `dist/latest/pdf-home/` 前端 pdf-home 产物（index.html、assets/、vendor/）
- `dist/latest/pdf-viewer/` 前端 pdf-viewer 产物（index.html、assets/、vendor/）
- `dist/latest/src/backend/` 后端可运行代码（launcher、服务）
- `dist/latest/src/frontend/` 前端 Python 启动器/桥接代码（按模块复制）
- `dist/latest/logs/` 运行日志（`backend-launcher.log`、`pdf-home-js.log` 等）

## 后端构建

1) 构建后端（保持文件结构复制到 dist/latest）：

```
python -X utf8 build.backend.py
```

2) 启动后端服务：

```
python -X utf8 dist/latest/src/backend/launcher.py start
```

3) 停止后端服务：

```
python -X utf8 dist/latest/src/backend/launcher.py stop
```

## 前端构建（推荐：分模块）

pdf-home 与 pdf-viewer 独立构建，互不共享 `assets/` 索引，便于部署与排错。

- 仅构建 pdf-home（输出至 `dist/latest/pdf-home/`）：

```
python -X utf8 build.frontend.pdf_home.py --out-dir dist/latest/pdf-home
```

- 仅构建 pdf-viewer（输出至 `dist/latest/pdf-viewer/`）：

```
python -X utf8 build.frontend.pdf_viewer.py --out-dir dist/latest/pdf-viewer
```

说明：
- 两个脚本均会：
  - 复制 `node_modules/pdfjs-dist` 到模块内 `./vendor/pdfjs-dist/`
  - 向各自 `index.html` 注入 `window.__PDFJS_VENDOR_BASE__='./vendor/pdfjs-dist/'`
  - 复制对应模块的前端 Python 启动相关文件到 `dist/latest/src/frontend/`
- pdf-home 额外复制 `src/frontend/pdf-home/config/*.json` 到 `dist/latest/pdf-home/config/`

（可选）全量构建（旧脚本）：

```
python -X utf8 build.frontend.py --out-dir dist/latest --skip-install
```

注意：不要使用 `--emptyOutDir` 清空 `dist/latest`，以免清掉已构建的后端与另一前端模块。

## 启动前端（生产环境）

- 启动 pdf-home 窗口：

```
python -X utf8 dist/latest/src/frontend/pdf-home/launcher.py --prod
```

- 启动 pdf-viewer 窗口（如有 viewer 独立入口）：

```
python -X utf8 dist/latest/src/frontend/pdf-viewer/launcher.py --prod
```

## 运行时路由与 MIME（生产）

- 后端静态路由：
  - `/pdf-home/` → `dist/latest/pdf-home/`
  - `/pdf-viewer/` → `dist/latest/pdf-viewer/`
  - 各自 `./assets` 与 `./vendor` 独立提供（不再重写到共享 `/assets`）
  - `/js/qwebchannel.js` 仍可用（兼容路径）
- MIME 已修复：`.js/.mjs → text/javascript`、`.css → text/css`、`.pdf → application/pdf`

## 日志与排错

- 后端：`dist/latest/logs/backend-launcher.log`、`runtime-ports.json`
- 前端（pdf-home）：`dist/latest/logs/pdf-home-js.log`、`dist/latest/logs/pdf-home.log`
- 常见问题：
  - 资源 404：确认模块是否使用了对应模块内的 `./assets/` 与 `./vendor/`
  - 严格 MIME 报错：确认服务器返回 `text/javascript`（本项目已处理）
  - pdf.js Worker/CMAP：默认走 `./vendor/pdfjs-dist/`；若需打包 Worker，请先在 pdf-viewer 单独验证

## 开发模式（可选）

使用 Vite 开发服务器（多入口）：

```
pnpm exec vite
```

或仅构建某一入口（环境变量）：

```
set VITE_BUILD_ONLY=pdf-home && pnpm exec vite build
```

## 注意事项

- 所有 Python 命令均使用 `-X utf8` 保证 UTF-8
- 不建议在生产模式开启 source map（已默认关闭）；远程调试端口由启动器管理
- Windows 环境如遇端口占用，后端启动器会自动尝试相邻端口并保存到 `logs/runtime-ports.json`

