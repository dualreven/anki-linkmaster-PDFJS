# 20260110175029-pdf-home-loopback-host-verify-A 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 17:50:29
### 工作内容:
- 补齐“loopback host 一致性”人工验收与文档收敛。
### 工作步骤:
1. 复现/确认：检查 `localhost` 与 `127.0.0.1` 访问差异
2. 点检 gui_launcher 启动 `pdf-home/pdf-viewer/new-card-scheduler`
3. 更新启动指南文档，写入排障步骤
### 工作结果:
- 待开始
### 存在问题:
- 待开始
### 下一步计划:
- 完成点检并提交文档更新

## 工作记录2
**时间**: 2026-01-10 18:12
### 工作内容:
- 文档收敛：开发模式统一 loopback host 使用 `127.0.0.1`；补齐可脚本化的 HTTP 检查与排障步骤（避免 Windows + QtWebEngine 下 localhost IPv4/IPv6 解析差异导致动态 import fetch 失败）。

### 工作步骤:
1. 更新 `docs/module-switching-guide.md`：
   - URL 规则从 `localhost` 改为 `127.0.0.1`
   - 新增 “Loopback Host 一致性检查” 小节（`/@vite/client` 与 `/<module>/index.js` 200）
2. 更新 `docs/LAUNCHER-DUAL-MODE-GUIDE.md`：
   - 新增 Windows+QtWebEngine 场景说明、验收命令与 `VITE_HOST` 覆盖方法
3. 自验：`pnpm -s run lint`

### 工作结果:
- 提交：待提交（文档更新）
- 人工验收建议（按 v001）：
  - PowerShell：`curl.exe -I "http://127.0.0.1:<vite_port>/@vite/client"` → 200
  - PowerShell：`curl.exe -I "http://127.0.0.1:<vite_port>/pdf-home/index.js"` → 200
  - 用 `gui_launcher` 打开 `pdf-home` / `pdf-viewer` / `new-card-scheduler`，确认不再出现 `[BOOT] import index.js failed`

### 存在问题:
- 待你在本机按上述步骤点检反馈（此任务为文档 + 验收流程收敛）。
