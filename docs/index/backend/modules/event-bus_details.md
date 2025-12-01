# event-bus 模块 — 细节层

> 注意：下面提到的 `src/frontend/pdf-home/ui-manager.js` 为旧版 pdf-home v1 中的示例使用代码，当前结构已不再包含该文件。此处引用仅用于说明典型调用方式，具体实现请以 `src/frontend/common/event/event-bus.js` 以及各 Feature 内的订阅代码为准。

接口：
- publish(topic, payload)
  - 参考：kilocode/system-prompt-agent-fact-review.yaml:5
  - 作用：将事件发布到本地订阅者，附带 metadata。
- subscribe(topic, callback)
  - 参考（旧版示例）：src/frontend/pdf-home/ui-manager.js:78
  - 作用：注册订阅回调。

事件格式：
- { topic: 'pdf:list:updated', payload: {request_id, items, summary}, metadata }

实现要点：
- 确保发布/订阅操作为非阻塞，使用异步回调或微任务队列。
- 在发布前对 payload 做最小化复制以避免外部副作用。

测试：
- 模拟订阅者并验证 publish 时回调被调用，且 payload 未被意外修改。
