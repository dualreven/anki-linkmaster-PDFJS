# Doing Archive - 20260110110206

- 已合并验收：A/B/C/D/E（用户人工验收通过：2026-01-10）。
- main 合并提交（cherry-pick）：
  - A：`71de621` + `e851ffa`
  - B：`a816aaf` + `57ff907`
  - C：`2b3eccd`
  - D：`2577b32` + `3ef11c7`
  - E：`1225e30` + `ed0174e`
- 机器验收命令：
  - `pnpm exec jest --runTestsByPath <相关测试路径> -i`
  - `pnpm -s run lint`
