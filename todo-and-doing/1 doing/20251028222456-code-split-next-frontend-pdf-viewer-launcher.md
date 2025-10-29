# 拆分任务（进行中）— src/frontend/pdf-viewer/launcher.py
- 目标：≤ 500 行；保持对外 API/启动契约不变；禁止兜底。
- 预估拆分边界：
  - env/path 解析 + URL 构建 → modules/url_bootstrap.py
  - 参数解析/校验（仅 pageAt，不兼容 pageNumber） → modules/params.py
  - 事件总线桥接（全局与作用域） → modules/event_bus_bridge.py
  - 注解/锚点/大纲跳转适配层 → modules/navigation/*.py
  - 启动器外壳保留 CLI/Qt 入口，委托到子模块
- 验收：dist 与 src 两条路径均能启动查看器并完成 URL 跳转；JS 日志含关键路径。