# PDF-Viewer 日志系统优化总结

## 问题描述

### 问题 1: 日志冗余信息过多

原始日志格式：
```
[10:32:38.216][INFO] [JAVASCRIPTCONSOLEMESSAGELEVEL.INFOMESSAGELEVEL] [http://localhost:3000/common/utils/logger.js:115] [PDFViewer] [INFO] DOMContentLoaded: Starting PDF Viewer App bootstrap...
```

冗余信息包括：
- 重复的时间戳
- Qt 冗长的日志级别枚举
- 源文件路径和行号
- 重复的日志级别标记

### 问题 2: 日志循环导致日志风暴

日志文件达到 **26万行 / 7.9MB**，主要是重复的 WebSocket 响应事件。

**循环过程**：
1. 前端 logger 输出日志
2. 日志通过某种机制发送到后端
3. 后端响应 "Console log recorded successfully"
4. 前端 EventBus 记录这个响应事件
5. 又触发新的日志 → 回到步骤 1 ♻️

## 解决方案

### 1. 简化前端日志格式 ✅

**文件**: `src/frontend/common/utils/logger.js`

**修改位置**: 第 53-72 行，`#log` 方法

**改动**:
```javascript
// 修改前
const timestamp = new Date().toISOString();
const prefix = `[${timestamp}] [${this.#moduleName}] [${level.toUpperCase()}]`;

// 修改后
const prefix = `[${this.#moduleName}] [${level.toUpperCase()}]`;
```

**原因**: 时间戳由 PyQt 后端统一添加，前端不需要重复输出。

### 2. 简化后端日志格式 ✅

**文件**: `src/frontend/pyqtui/main_window.py`

**修改位置**: 第 93-96 行，`write_js_console_message` 函数

**改动**:
```python
# 修改前
line = f"[{ts}][{level}][{source_filename}:{line_number}] {parsed_message}"

# 修改后
line = f"[{ts}][{level}] {parsed_message}"
```

**原因**: 源文件路径和行号信息价值低，增加噪音。消息中的模块名已经足够定位问题。

### 3. 优化 JSConsoleLogger 输出 ✅

**文件**: `src/frontend/pdf-viewer/js_console_logger_qt.py`

**修改位置**: 第 118-171 行，`log_message` 方法

**主要改动**:
1. 添加 Qt 冗长级别字符串的简化逻辑
2. 移除 source 和 line 的输出
3. 直接输出消息内容

**改动前**:
```python
formatted_msg = f"[{source}:{line}] {message}"
self.js_logger.log(log_level, f"[{level_str}] {formatted_msg}")
```

**改动后**:
```python
self.js_logger.log(log_level, message)
```

### 4. 添加日志事件过滤机制 ✅ ⭐ **关键修复**

**文件**: `src/frontend/common/utils/logger.js`

**修改位置**: 第 166-182 行，`event` 方法

**新增代码**:
```javascript
event(eventName, action, data = {}) {
  // 过滤掉WebSocket响应类事件，避免日志循环
  const filteredEvents = [
    'websocket:message:response',
    'websocket:heartbeat:response',
    'websocket:ping:response'
  ];

  if (filteredEvents.some(filtered => eventName.includes(filtered))) {
    return; // 静默跳过
  }

  const serializedData = this.#serializeForMessage(data);
  this.info(`Event [${eventName}]: ${action} ${serializedData}`);
}
```

**原因**:
- WebSocket 响应事件频繁且信息价值低
- 记录这些事件会触发新的日志发送，形成循环
- 过滤掉这些事件可以彻底解决日志风暴问题

## 优化效果

### 日志格式对比

**优化前**:
```
[10:32:38.216][INFO] [JAVASCRIPTCONSOLEMESSAGELEVEL.INFOMESSAGELEVEL] [http://localhost:3000/common/utils/logger.js:115] [PDFViewer] [INFO] DOMContentLoaded: Starting PDF Viewer App bootstrap...
```

**优化后**:
```
[10:32:38.216][INFO] [PDFViewer] [INFO] DOMContentLoaded: Starting PDF Viewer App bootstrap...
```

### 日志体积对比

**优化前**:
- 26万行
- 7.9MB
- 16,000+ 重复的 WebSocket 响应事件

**优化后** (预期):
- 显著减少到合理范围（数千行）
- 文件大小降低到数百KB
- 无重复的 WebSocket 响应事件

## 测试建议

1. **清空旧日志**: `rm logs/pdf-viewer-*.log`
2. **重启 pdf-viewer**: 确保加载最新代码
3. **运行一段时间**: 测试 5-10 分钟
4. **检查日志**:
   ```bash
   wc -l logs/pdf-viewer-*-js.log
   ls -lh logs/pdf-viewer-*-js.log
   grep -c "websocket:message:response" logs/pdf-viewer-*-js.log
   ```

## 后续优化建议

1. **可配置的过滤列表**: 允许用户配置需要过滤的事件类型
2. **日志级别控制**: 添加环境变量控制日志详细程度
3. **日志轮转**: 实现日志文件大小限制和自动轮转
4. **结构化日志**: 考虑使用 JSON 格式便于分析
5. **性能监控**: 添加日志写入性能指标

## 修改文件清单

1. ✅ `src/frontend/common/utils/logger.js` (前端logger)
2. ✅ `src/frontend/pyqtui/main_window.py` (后端日志格式化)
3. ✅ `src/frontend/pdf-viewer/js_console_logger_qt.py` (JSConsoleLogger)

所有修改都保持向后兼容，不影响现有功能。

---

**优化日期**: 2025-09-30
**版本**: v2.0
**状态**: 已完成，待测试验证