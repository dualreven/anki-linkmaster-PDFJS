# 启动器单例化（pdf-home / pdf-viewer）— 设计与实现记录（2025-10-29 16:10）

需求
- pdf-home：全局仅一个实例；若再次收到启动指令，激活已有窗口。
- pdf-viewer：按 pdf-id 单例；收到启动指令时，若实例已存在则激活，否则创建。

实现
- 运行时注册表：`src/backend/launcher_core/session_registry.py`
  - `AppSessionRegistry` 保存 pdf-home 实例与按 pdf-id 的 viewer 实例；
  - `activate_window(win)` 最佳努力调用 `show()/raise_()/activateWindow()`；

- 启动路径：`src/launcher/runner.py`
  - 新增：`ensure_pdf_home_hosted(...)` / `ensure_pdf_viewer_hosted(...)`；
    - 已存在 → 激活并返回 0；
    - 不存在 → 与 `start_*_hosted` 等价的 Hosted 初始化，完成后注册到单例表；
    - viewer 支持参数：`pdf_id/page_at/position/anchor_id/annotation_id/outline_item_id/enable_outline`；
  - 保留原 `start_*_hosted`（建议迁移至 ensure_*）。

- WS 调度：`src/backend/launcher_core/pyqt_launcher.py`
  - `pdf-library:viewer:requested` → 调用 `ensure_pdf_viewer_hosted(...)`，实现“先激活，后创建”。

不做/后续
- 激活不包含“激活即导航”行为；若需要，可增加：当请求包含新的 `page_at/anchor_id` 时，通过 MsgCenter 定向发送 `pdf-viewer:navigate:requested` 到对应 viewer。
- 关闭窗口的清理钩子可后续接入，以在窗口关闭时从注册表移除实例。

