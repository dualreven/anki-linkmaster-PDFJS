**规范名称**: 前端调试指南规范
**规范描述**: 定义前端测试的调试指南，包括查看测试输出、常见问题处理和测试验证方法，确保测试过程可监控和可调试。
**当前版本**: 1.0
**所属范畴**: 测试规范
**适用范围**: 前端测试活动

**详细内容**:
- 测试输出查看：通过 `debug-console-at-[端口号].log` 文件查看，搜索 `[TEST]` 前缀快速定位日志
- 常见问题处理：热更新失败时检查vite配置，WebSocket断开时查看网络状态，测试无输出时确认日志文件正常写入
- 测试验证：通过检查控制台日志中是否包含 `[TEST]` 前缀来验证测试执行
- 实时监控：使用 `tail -f debug-console-at-[端口号].log` 命令实时监控日志

**验证方法**:
- 检查前端代码中是否实现了日志查看功能：通过读取 `debug-console-at-[端口号].log` 文件，并搜索 `[TEST]` 前缀来定位测试日志。
- 验证常见问题处理机制：确保代码中包含对热更新失败、WebSocket断开和日志文件写入异常的处理逻辑，并有相应的错误提示或重试机制。
- 确认测试验证方法：检查是否有函数或脚本能够验证测试执行，通过检查控制台日志中是否存在 `[TEST]` 前缀来判断测试是否运行。
- 确保实时监控功能：验证是否支持使用 `tail -f debug-console-at-[端口号].log` 命令进行实时日志监控，并在代码中集成相关调用。
- 运行集成测试：执行前端测试流程，观察日志输出是否符合规范要求，包括日志格式、错误处理和监控效果。


**正向例子**:
```bash
# 查看测试输出
cat debug-console-at-3000.log | grep "[TEST]"

# 实时监控
tail -f debug-console-at-3000.log

# 测试验证
const verifyTest = () => {
    const logs = document.querySelectorAll('.console-log');
    const testLogs = Array.from(logs).filter(log => 
        log.textContent.includes('[TEST]')
    );
    return testLogs.length > 0;
};
```

**反向例子**:
```bash
# 错误做法：忽略日志查看，无法监控测试结果
# 不处理常见问题，测试失败时无法快速定位原因
# 无测试验证机制，无法确认测试是否执行
```