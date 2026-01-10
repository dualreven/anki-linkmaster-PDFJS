# pdf-search DOMManager 抽取规格说明

**功能ID**: 20260110175029-pdf-search-dom-manager-extract-D  
**优先级**: 中（P1）  
**版本**: v001  
**创建时间**: 2026-01-10 17:50:29  
**状态**: 设计中

## 现状说明
- `pdf-search/components/search-box-dom-bindings.js` 中 DOM 事件绑定与业务逻辑混杂（scan-D 指出）。

## 存在问题
- 难测试：必须同时构造 DOM + 业务对象才能覆盖分支。
- 生命周期不清晰：destroy/cleanup 的覆盖面难确认，容易引入泄漏。

## 提出需求
1) 抽取 `SearchBoxDOMManager`（只管理 DOM：init/cleanup + 事件绑定/解绑）。
2) `SearchManager`/业务侧只注入回调（onInput/onNext/onPrev/onOpen/…），禁止直接操作 DOM。
3) 新增 Jest 回归测试：JSDOM 下验证 init/cleanup 正确绑定/解绑且回调被调用。

## 解决方案
- 新文件：`src/frontend/pdf-viewer/features/pdf-search/components/search-box-dom-manager.js`
- 迁移：`search-box-dom-bindings.js` 逐步退役或变为薄封装（可删除）

## 约束条件
### 仅修改本模块代码
- 仅允许修改：`src/frontend/pdf-viewer/features/pdf-search/**`

### Fail-Fast
- DOM 必要节点缺失必须抛错（不允许静默跳过）。

## 可行验收标准
### 单元测试
- `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/features/pdf-search/**/__tests__/*.test.js -i` 通过（新增测试必须列在 working-log）。

