# gui_launcher（anki模式）严格ID校验 — 执行与验证 (20251029235247)

变更内容
- 在 `src/gui_launcher.py` 的 anki 模式 WS 发送前增加 ID 严格校验：
  - anchor：`pdfanchor-[0-9a-fA-F]{12}`；
  - annotation：`pdfannotation-[A-Za-z0-9_-]{16}`；
  - outline：非空字符串（建议以 bmk_/out_ 前缀，但本次仅校验“非空”）。
- 类型与ID不匹配时，直接阻断请求并在 GUI 日志窗输出 `[ERROR]`。

如何验证
- 运行 hosted 后，选择 anki 模式，填入 WS 端口，点击“启动 PDF-Viewer (Hosted)”。
- 分别尝试：
  1) 选择“anchor”，粘贴 annotation 的ID → 期望日志报错并不发送 WS；
  2) 选择“annotation”，粘贴合法的 `pdfannotation-XXXXXXXXXXXXXX` → 发送 WS，后端应激活+导航。

相关日志
- GUI：`dist/latest/logs/gui-launcher.log`
- 后端：`dist/latest/logs/backend-launcher.log`（应出现 `[MsgDispatch] Forward navigate`）
- Viewer：`dist/latest/logs/pdf-viewer-<pdf-id>-js.log`（应记录 `URLJumpDispatcher`/`AnnotationFeature` 导航日志）

