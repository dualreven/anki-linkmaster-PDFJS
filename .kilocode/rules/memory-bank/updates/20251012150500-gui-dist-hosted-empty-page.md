# GUI 启动 dist 出现空白页（Hosted）- 记忆更新

时间
- 2025-10-12 15:05:00

问题摘要
- 现象：GUI 启动 dist/latest（Hosted）后，PDF-Home 页面空白；CLI 启动 `dist/latest/src/frontend/pdf-home/launcher.py --prod` 正常。
- 伴随日志：
  - 有时出现 “No module named 'src.frontend.common'”（dist 包缺少 common 模块）。
  - 停止后端回退 CLI 时 QThread 崩溃（Destroyed while thread is still running）。
  - backend 日志显示已加载 HTML，但 /static 资源 404 或 QWebChannel 未设置（web_page 为 None）。

根因拆解
- 包加载优先级污染：
  - 进程中若先加载源码 `src.*`，导入与数据路径会落到源码目录，导致与 dist 混淆。
  - 解决：GUI 中清空 `sys.modules` 的 `src.*`/`core_utils.*`，并将 `dist/latest/src` 置于 `sys.path[0]`。
- 静态路由缺失：
  - 生产 HTML 引用 `/static/*.js|css`，但嵌入式 HTTP 服务器未挂 `/static`，导致 404。
  - 解决：在后端启动器 `mounts` 增加 `"/static": static_dir`（已同步到源码 src/backend/launcher.py，重建后 dist 自带）。
- QtWebEngine 初始化顺序：
  - 早期导入 `src/qt/compat` 可能让 `QWebEngineView` 为 None，导致 `web_page` 未创建 → 完全空白。
  - 解决：GUI 启动前 reload `src.qt.compat`，并初始化 QtWebEngine（禁用 GPU、软件 OpenGL、禁用 sandbox）。
- 线程销毁崩溃：
  - 回退 CLI 的子进程线程未持有引用，被 GC 时仍在运行 → 崩溃。
  - 解决：持有线程引用、done 后 wait/deleteLater、closeEvent 等待线程退出。
- 构建产物缺模块：
  - `src/frontend/common/launch_config.py` 未打入 dist，Hosted 导入失败。
  - 解决：构建脚本复制 `src/frontend/common/*.py` → `dist/latest/src/frontend/common`；同时复制 GUI 启动器 → `dist/latest/gui_launcher_dist.py`。

落地改动（关键）
- GUI 启动器（源码）: `scripts/gui_launcher_dist.py`
  - 切换到 dist 包优先、清理模块缓存、reload compat、修复线程管理。
  - 构建后复制至 `dist/latest/gui_launcher_dist.py`。
- 构建脚本：
  - `build.frontend.pdf_home.py` / `build.frontend.pdf_viewer.py` / `build.frontend.py`
  - 复制 `scripts/gui_launcher_dist.py` → `dist/latest/`
  - 复制 `src/frontend/common/*.py` → `dist/latest/src/frontend/common`
- 后端启动器（源码）：`src/backend/launcher.py`
  - `mounts` 增加 `"/static": static_dir`
- 诊断日志（dist/latest/logs）：
  - `runtime-ports.json`（端口）
  - `http-server-meta.json`（host/port/root_dir/static_root/pdfs_root/mounts）
  - `route-summary.json`（静态映射概要）
  - `pdf-home-route.debug.log`（/pdf-home 解析细节）
  - `request-map.log`（method path → 文件路径）

建议操作
1) 一键重建（不拷贝到 Anki 插件，观察 dist）：
   - `python -X utf8 rebuilda_all.py --no-copy-to-anki`
   - 或仅前端：
     - `python -X utf8 build.frontend.pdf_home.py --out-dir dist/latest/pdf-home`
     - `python -X utf8 build.frontend.pdf_viewer.py --out-dir dist/latest/src/frontend/pdf-viewer`
2) 启动后端（Hosted）→ 启动 PDF-Home：
   - `python -X utf8 dist/latest/gui_launcher_dist.py`
   - GUI 内先“停止后端”，再“启动后端”，最后“启动 PDF-Home”。
3) 验证 /static 资源：
   - `http://127.0.0.1:<pdfFile_port>/static/pdf-home-*.js` 应 200
   - `http://127.0.0.1:<pdfFile_port>/static/pdf-home-*.css` 应 200
4) 若仍空白：
   - 提供 `dist/latest/logs/backend-launcher.log` 尾部
   - 提供 `dist/latest/logs/http-server-meta.json` 与 `route-summary.json`
   - 提供 `dist/latest/logs/pdf-home-route.debug.log` 尾部 20 行

