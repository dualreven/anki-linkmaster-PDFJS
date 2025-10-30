# viewer内ID不存在时的 toast 提示 — 执行记录 (20251030000222)

变更内容
- Annotation：已有“标注不存在或未加载，无法跳转”toast（保持不变）。
- Outline：当通过 WS/URL 触发按ID导航，且列表已就绪但未找到该ID时，弹出 toast “大纲项不存在或未加载：<id>”。
  - 列表未就绪时，先记录挂起ID；列表就绪后若仍未找到则弹 toast。

改动文件
- src/frontend/pdf-viewer/features/pdf-outline/index.js：
  - 新增字段 `#listReady`，在初始加载与 FILE.LOAD.SUCCESS 刷新后置为 true
  - `#handleNavigateById` 与 `#tryPendingNavigate` 中根据 `#listReady` 与是否命中来决定 toast/FAILED 事件

自测建议
- 关闭 viewer，GUI(anki模式) 发送一个不存在的 outline-item-id 启动：
  - 初次加载（列表未就绪）不立即toast，待列表加载后如仍不存在 → viewer 右上角弹出错误toast
- 发送不存在的 annotation-id/anchor-id：保持现有“标注不存在或未加载”toast
