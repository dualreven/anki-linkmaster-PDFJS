// 自动文档生成配置（前端关键模块）
// 说明：此配置只声明输入/输出，实际运行需要本地安装 jsdoc：
//   pnpm add -D jsdoc
//   pnpm run docs:frontend

module.exports = {
  source: {
    include: [
      "src/frontend/common/event/event-bus.js",
      "src/frontend/common/ws/ws-client.js",
      "src/frontend/common/ws/ws-gate-utils.js",
      "src/frontend/common/ws/ws-gate-runner.js",
      "src/frontend/pdf-viewer/container/app-container.js",
      "src/frontend/pdf-viewer/adapters/websocket-adapter.js",
      "src/frontend/pdf-viewer/adapters/ws-inbound-bridge.js",
      "src/frontend/pdf-home/container/app-container.js"
    ],
    includePattern: ".js$"
  },
  opts: {
    destination: "AItemp/docs/frontend-api",
    recurse: false,
    encoding: "utf8"
  },
  plugins: [],
  templates: {
    default: {
      includeDate: false
    }
  }
};

