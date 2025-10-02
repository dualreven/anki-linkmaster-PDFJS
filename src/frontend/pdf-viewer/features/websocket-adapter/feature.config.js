export const WebSocketAdapterFeatureConfig = {
  name: 'websocket-adapter',
  version: '1.0.0',
  dependencies: [],
  description: 'WebSocket适配器 - 连接管理和消息路由',
  
  events: {
    WS_CONNECTED: '@websocket/connected',
    WS_DISCONNECTED: '@websocket/disconnected',
    WS_MESSAGE: '@websocket/message'
  },
  
  metadata: { phase: 'Phase 1', priority: 'high' }
};
