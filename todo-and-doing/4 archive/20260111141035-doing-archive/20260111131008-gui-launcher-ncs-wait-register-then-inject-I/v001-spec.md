# GUI Launcher - 打开 NCS 后等待注册再注入（减少 pending-forward）

**功能ID**: 20260111131008-gui-launcher-ncs-wait-register-then-inject-I  
**优先级**: P1（提升人工验收体验，减少“注入排队但看不到效果”）  
**版本**: v001  
**创建时间**: 2026-01-11 13:10  
**状态**: doing  

## 需求 / 交付
在 `gui_launcher` 的 CardPlanner 测试入口增加一个按钮或流程：
1) 一键：打开/激活 `new-card-scheduler`
2) 等待：检测 `new-card-scheduler` 注册成功（可通过 MsgCenter/WS 的 register ack 或 status 查询实现）
3) 再执行：注入样例草稿卡（避免频繁出现 `pending-forward`）

## 约束（隔离 scope，禁止重叠）
### 允许修改/新增（仅限）
- 修改：`src/gui_launcher/**`
- 修改/新增测试：`src/gui_launcher/__tests__/**`

### 禁止修改
- 禁止修改：`src/frontend/new-card-scheduler/**`
- 禁止修改：`.kilocode/rules/memory-bank/**`

## 测试建议（DoD 必须满足）
- `python -m pytest -q src/gui_launcher/__tests__/test_gui_launcher_card_planner_manual_inject.py`
  - 新增用例：模拟“先 open，再 wait-register，再 inject”的调用链（可以 mock WS 回执/状态查询）。

## 完成定义（DoD）
- 必须提交 git，并在 `working-log.md` 写明 **commit hash**。
- 必须补回归测试。

