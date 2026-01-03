# PDF Translator Sidebar（TranslatorSidebarUI）拆分说明

目标：将 `TranslatorSidebarUI.js` 从“面条式 UI + 业务逻辑混杂”拆成若干职责单一的模块，并保持对外导出与运行时行为不变。

## 文件结构与职责

- `src/frontend/pdf-viewer/features/pdf-translator/components/TranslatorSidebarUI.js`
  - 侧边栏生命周期：`initialize()`/`destroy()`
  - 事件订阅：监听 `PDF_TRANSLATOR_EVENTS.TRANSLATE.COMPLETED|FAILED`
  - 状态：`#currentTranslation`、`#translationHistory`
  - 装配/委托：渲染委托给 renderer；按钮/列表点击委托给 dom-bindings；业务动作委托给 actions；history 更新委托给 translator-history

- `src/frontend/pdf-viewer/features/pdf-translator/components/translator-history.js`
  - 纯逻辑：将新翻译结果 prepend 到历史，并截断到 `DEFAULT_TRANSLATION_HISTORY_MAX=50`
  - Fail-Fast：输入不合法直接抛错（便于测试与定位契约问题）

- `src/frontend/pdf-viewer/features/pdf-translator/components/translator-sidebar-renderer.js`
  - 只负责渲染 DOM/HTML（settings/result/history + error UI）
  - Fail-Fast：`translation.original/translation.translation` 等关键字段不是 string 会抛错（契约不匹配应尽早暴露）

- `src/frontend/pdf-viewer/features/pdf-translator/components/translator-sidebar-dom-bindings.js`
  - 只负责 DOM 事件绑定（按钮点击、历史点击）
  - 绑定时不生成事件名字符串；所有事件名仍由常量命名空间提供（满足 `custom/event-name-format`）

- `src/frontend/pdf-viewer/features/pdf-translator/components/translator-sidebar-actions.js`
  - 只负责动作：创建标注、创建卡片、复制、朗读、来源信息构造
  - 事件名使用常量：`PDF_VIEWER_EVENTS.ANNOTATION.CREATE`、`PDF_TRANSLATOR_EVENTS.CARD.CREATE_REQUESTED`

## 关键数据契约（TranslatorSidebarUI 依赖）

渲染依赖：
- `translation.original: string`
- `translation.translation: string`

创建标注依赖（缺失会 showError 并返回）：
- `translation.pageNumber`
- `translation.position`
- `translation.rangeData: Array`

创建卡片使用：
- `translation.language?.source`（缺省为 `"unknown"`）
- `translation.extras`（缺省为 `{}`）

## 回归测试

- `src/frontend/pdf-viewer/features/pdf-translator/__tests__/translator-history.test.js`
  - 覆盖：prepend 顺序、timestamp 注入、默认/自定义 max 截断、输入非法 fail-fast

