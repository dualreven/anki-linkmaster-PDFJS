# 20260110185158-card-planner-gui-launcher-ack-meta-parse-F 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 18:51
### 工作内容:
-修复 gui_launcher 的 ACK_META 解析兼容性（顶层字段）。
### 工作步骤:
1) 兼容 ack 顶层与 data 内层字段
2) pytest 覆盖 202/404 两类 ACK
### 工作结果:
-已完成：ACK_META 支持顶层与 data 形态；pytest 覆盖顶层 202/404 与 data 兼容形态。
### 存在问题:
-无
### 下一步计划:
-提交 commit hash + 测试命令

## 工作记录2
**时间**: 2026-01-10 19:26
### 工作内容:
-修复 `[ACK_META]` 解析字段来源：支持从 ACK 顶层或 `ack.data` 读取 `code/status/message/error_code`，避免全部为 None。
### 关键变更:
- `gui_launcher.py`：ACK_META 解析优先读顶层，缺失再回退到 `ack.data`；缺字段会输出 `[WARN] ACK_META 字段缺失(...)`
- `src/gui_launcher/__tests__/test_gui_launcher_card_planner_manual_inject.py`：新增/更新测试覆盖顶层 202、顶层 404(NO_TARGET_FOUND)、data 内层形态兼容
### 验收命令与结果:
1) `pnpm -s run lint` ✅
2) `python -m pytest -q src/gui_launcher/__tests__/test_gui_launcher_card_planner_manual_inject.py` ✅
### 提交:
- commit: `5fa84856`
