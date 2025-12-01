# 测试指南（迁移说明）

本仓库测试文档已整合为三份中文文档，请以以下文档为准：

- 《docs/TESTING-OVERVIEW.md》：测试模块使用指南总览（分层/命名/目录/配置/常用命令）
- 《docs/TESTING-INTEG-GUIDE.md》：集成测试指南（integ + 契约测试）
- 《docs/TESTING-E2E-GUIDE.md》：端到端测试指南（流程编排、产物与汇总报告）

统一约束：不使用环境变量（仅 JSON/CLI 参数）；UTF-8 编码与 `\n` 换行；产物写入 `AItemp/`；Python 以 `tests/e2e/config/local.json.python_exe` 指定虚拟环境解释器直接调用（不激活 venv，具体文件名以当前 tests 配置目录为准）。
