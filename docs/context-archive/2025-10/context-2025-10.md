# Context 归档 - 2025年10月

**归档日期**：2025-11-14
**来源**：从 context.md 迁移的历史记录

---

## 📝 说明

2025年10月及更早的详细历史记录已从 context.md 移除，以减少主文件体积。

如需查看完整历史记录，请使用 Git 历史：

```bash
# 查看10月的提交记录
git log --since="2025-10-01" --until="2025-10-31" -- .kilocode/rules/memory-bank/context.md

# 恢复10月末的 context.md 版本
git show $(git log --before="2025-11-01" --oneline -- .kilocode/rules/memory-bank/context.md | head -1 | cut -d' ' -f1):.kilocode/rules/memory-bank/context.md
```

---

## 🔑 关键主题索引

### 1. GUI 启动器拆分与重构
- 目标：减小 `gui_launcher.py` 体积，拆分职责
- 新模块：`src/gui_launcher/ui.py`、`controller.py`、`services.py`
- 测试覆盖：可导入性、转发契约

### 2. 端口管理策略
- **runtime-ports.json**：唯一真源
- **端口分配**：`PortManager.allocate_ports()`
- **合并写入**：`merge_runtime_ports()` 避免覆盖
- **探测机制**：端口监听检查（IPv4/IPv6 兼容）

### 3. WebSocket 连接问题诊断
- **问题**：`localhost` 解析为 IPv6 `::1`，后端仅监听 `127.0.0.1`
- **修复**：前端改为 `ws://127.0.0.1:<port>`
- **探针**：`logs/ws-probe.json` 记录真实绑定状态
- **超时策略**：`connect()` 增加 4000ms watchdog

### 4. Dev/Dist 模式职责简化
- **Dev模式**：3个服务（msgcenter/http/vite）
- **Dist模式**：2个服务（msgcenter/http，无vite）
- **相对定位**：以 GUI 脚本目录为根
- **Vite管理**：记录 PID，一键关闭

### 5. 阅读历史模块设计
- **设计决策**：服务端为主，存储在 `json_data.resume`
- **优先级**：显式跳转 > Anchor > resume > 首页
- **数据模型**：`{page, y_percent, zoom, rotation, updated_at}`
- **Fail-Fast**：恢复数据无效时 toast + 回退首页

---

## 📌 相关文件

### GUI 启动器
- `gui_launcher.py`
- `src/gui_launcher/ui.py`
- `src/gui_launcher/controller.py`
- `src/gui_launcher/services.py`

### 端口管理
- `src/launcher/ports.py`
- `ai_scripts/ai_launcher/core/port_manager.py`
- `logs/runtime-ports.json`

### WebSocket
- `src/backend/msgCenter_server/core/ws_server_core.py`
- `src/frontend/common/ws/ws-client.js`
- `logs/ws-probe.json`

### 阅读历史
- `src/frontend/pdf-viewer/features/pdf-resume/`
- `src/backend/api/pdf_library_api.py`

---

**如需查看更详细的记录，请参考 Git 历史。**
