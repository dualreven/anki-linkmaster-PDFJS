# v001 规格说明 — pdf_library_api 拆分与修复（2025-10-28 12:58:28）

## 背景
- `src/backend/api/pdf_library_api.py` 先前为超长文件（≈1221 行），后续被临时桩替换，导致实现缺失与语法错误。
- 需求：将实现拆分为稳定门面与实际实现，保持 API 对外路径不变，严格遵循“禁止兜底”的开发原则，保证测试通过。

## 目标
- 将 `pdf_library_api` 拆分为：
  - 门面：`src/backend/api/pdf_library_api.py`（仅重导出）
  - 实现：`src/backend/api/pdf_library_api_impl.py`（≤500 行）
  - 领域委托：`src/backend/api/pdf_library/*`、`src/backend/api/pdf-viewer/*`
- 去除 legacy 与临时桩，实现严格输入校验与异常返回。
- 保持对外契约稳定（书签 API 对外仍提供 `pageNumber` 字段；DB 内部采用 `pageAt/position`）。
- 保证 msgCenter 测试集通过；新增 API 层最小烟雾测试。

## 不做事项
- 不修改数据库插件的表结构与已发布事件名。
- 不改动 msgCenter 的协议与路由注册表。

## 交付物
- `src/backend/api/pdf_library_api_impl.py`（~406 行）
- `src/backend/api/pdf_library_api.py`（重导出 1 行）
- 修复 `src/backend/api/pdf_library/utils.py` 相对导入
- 新增测试：`src/backend/api/__tests__/test_pdf_library_api_smoke.py`
- backlog 与 memory bank 文档更新

## 验收标准
- msgCenter 相关测试全部通过。
- 新增烟雾测试通过。
- `pdf_library_api_impl.py` 行数 ≤ 500。
- 遵循 UTF-8 与 `\n` 换行规范。

