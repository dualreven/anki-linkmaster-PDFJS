# GUI Launcher：Vite 启动改为 ensure_vite + 修复 pdf-home 动态 import 失败（E）规格说明

**功能ID**: 20260111010855-gui-launcher-vite-loopback-host-and-pdf-home-reliability-E  
**优先级**: 高（P0）  
**版本**: v001  
**创建时间**: 2026-01-11 01:08（本地）  
**状态**: doing  

## 现状说明（用户反馈）
- 现象（2026-01-10 16:41）：pdf-home 打开后 console 报错：
  - `[BOOT] import index.js failed TypeError: Failed to fetch dynamically imported module: http://localhost:3000/pdf-home/index.js`
- 该类问题在 Windows + QtWebEngine 上高度可疑与 loopback host（localhost ↔ 127.0.0.1 / IPv6）有关。
- 当前仓库已有明确规范：开发模式 loopback host 必须统一 `127.0.0.1`（见 `.kilocode/rules/memory-bank/tech.md`）。

## 责任范围猜测（需要验证）
- GUI 启动 Vite 的路径目前由 `gui_launcher` 直接调用 `ai_launcher._start_vite(...)`，该路径不保证注入 `VITE_HOST=127.0.0.1`，可能导致：
  - Vite 实际监听/重定向到 `localhost`（引入 IPv6/IPv4 不确定性）
  - 最终在 QtWebEngine 里出现“HTML 能加载但动态 import fetch 失败”的不稳定表现

## 提出需求（目标）
1) 将 GUI 的 Vite 启动改为统一走 `src.launcher.dev_server.ensure_vite`（通过 `src.gui_launcher.services.ensure_vite` 转发），确保：
   - 强制注入 `VITE_HOST=127.0.0.1` / `VITE_PORT` / `VITE_STRICT_PORT`
   - 端口不可用时严格失败（不误判为“已启动”）
2) 补齐至少 2 条回归测试（Python）：
   - GUI 启动 Vite：不再调用 `ai_launcher._start_vite`，而是调用 services.ensure_vite（可用 monkeypatch 断言）
   - `ensure_vite` 调用参数包含 `logs_dir/component_root` 且返回端口被用于后续流程（最小可测）
3) 给出人工验收步骤：启动 GUI → 启动 Vite → 打开 pdf-home → 不再出现动态 import fetch 失败。

## 约束条件（严格代码隔离）
### 允许修改（scope）
- `src/gui_launcher/workers.py`
- `src/gui_launcher/services.py`（如需补转发/参数）
- `src/launcher/dev_server.py`（仅当需要加强 Vite 启动/就绪判定；禁止做与本问题无关的重构）
- `src/gui_launcher/__tests__/**` 与/或 `src/launcher/__tests__/**`
- （可选）仅补充一处文档说明：`.kilocode/rules/memory-bank/tech.md` 中“人工验收命令/排障”条目（必须保持精简）

### 禁止修改
- 禁止修改 `src/frontend/**`（避免与 A/B/C/D 以及其他窗口任务冲突）

## 规范必读
- `.kilocode/rules/memory-bank/tech.md`（loopback host 规则）
- `docs/engineering/build-run.md`（如需引用启动方式）

## 可行验收标准（DoD：没有 commit hash 就不算完成）
- 必须提交 git 并提供 **commit hash**（工作区干净）。
- 必须新增/更新 ≥2 个测试用例，并给出定向命令：
  - `python -m pytest -q <测试文件1> <测试文件2>`
- `pnpm -s run lint` 通过（确保 memory-bank/前端门禁未被破坏）。
- `working-log.md` 必须写明：复现方式、修复点、以及人工验收步骤。

