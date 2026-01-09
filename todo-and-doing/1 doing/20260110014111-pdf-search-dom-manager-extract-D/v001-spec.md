# [pdf-viewer][D] pdf-search：抽离 SearchBoxDOMManager 规格说明

**功能ID**: 20260110014111-pdf-search-dom-manager-extract-D  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-10 01:41:11  
**状态**: 开发中

## 现状说明
- 扫描报告指出：`pdf-search` DOM 绑定与业务逻辑混杂，难测试、难维护。

## 存在问题
- 业务逻辑与 `addEventListener/removeEventListener` 交织，容易出现解绑不对称与泄漏。

## 提出需求
- 抽离一个 `SearchBoxDOMManager`（或等价命名）：
  - 只负责 DOM 查询/事件绑定/解绑；
  - 通过回调把输入/点击事件交给业务逻辑层；
  - 提供明确 `init()`/`destroy()`。
- 必须补 1 条 DOM manager 单测（JSDOM）覆盖 init/cleanup 对称性。

## 解决方案（建议）
- 先写测试：验证 init 后点击/输入会调用回调；destroy 后事件不再触发回调。
- 再做拆分：把现有 DOM 绑定从 manager/feature 中迁移到 DOMManager。

## 约束条件
### 仅修改本模块代码
- 仅允许修改：`src/frontend/pdf-viewer/features/pdf-search/**`

### 严格遵循代码规范和标准
- 必须阅读：`docs/SPEC/SPEC-HEAD-pdf-viewer.json`
- 禁止兜底：缺失 DOM 元素必须显式报错。

## 可行验收标准
### 单元测试（必须新增）
- 新增 JSDOM 单测：init/cleanup 对称 + 事件回调调用/不调用。

### 门禁
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath <本任务新增测试文件路径>` ✅

