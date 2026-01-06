# EventBus消息调用链追踪功能规格说明

**功能ID**: 20250922200000-eventbus-trace
**优先级**: 中
**版本**: v001
**创建时间**: 2025-09-22 20:00:00
**预计完成**: 2025-09-26
**状态**: 设计中

## 现状说明
- 当前EventBus已实现发布-订阅模式，支持事件验证和基础日志
- 具备调用者推断功能(#inferActorId)和订阅者管理
- 使用module:action:status格式的事件命名规范
- 通过EventBusManager管理多个模块的EventBus实例

## 存在问题
- 复杂事件流难以调试，无法追踪消息传播路径
- 回调执行出错时难以定位问题根源
- 无法分析事件级联触发的完整调用链
- 缺少性能分析工具，无法识别性能瓶颈

## 提出需求
- 为每个消息生成唯一标识和调用链ID
- 追踪消息从发布到所有订阅者的完整路径
- 记录回调执行状态、耗时和错误信息
- 支持级联事件的调用链继承
- 提供调用链查询和分析API

## 解决方案
- 在EventBus的emit()方法中添加消息追踪机制
- 为每个消息生成messageId和traceId
- 记录发布者、订阅者、执行时间等详细信息
- 实现调用链树构建和性能统计功能

## 约束条件
### 仅修改本模块代码
仅修改 common/event 模块中的代码,不可修改其他模块的代码

### 严格遵循代码规范和标准
必须优先阅读和理解 `common/event/docs/SPEC/SPEC-HEAD-event.json` 下的代码规范

## 可行验收标准
### 单元测试
所有新增代码通过单元测试

### 端到端测试
验证消息追踪功能不影响现有事件系统正常工作

### 接口实现
#### 接口1: 生成消息ID
函数: generateMessageId()
描述: 生成唯一的消息标识符
参数: 无
返回值: string - 唯一消息ID

#### 接口2: 获取消息追踪
函数: getMessageTrace(messageId)
描述: 获取指定消息的完整追踪信息
参数: messageId: string - 消息ID
返回值: Object - 消息追踪对象

#### 接口3: 获取调用链树
函数: getTraceTree(traceId)
描述: 获取完整调用链的树形结构
参数: traceId: string - 调用链ID
返回值: Object - 调用链树

#### 接口4: 清理追踪数据
函数: clearTraceData(olderThan)
描述: 清理指定时间之前的追踪数据
参数: olderThan: number - 时间戳
返回值: number - 清理的记录数

### 类实现
#### 类1: MessageTracer
类: MessageTracer
描述: 消息追踪管理器，负责追踪数据的存储和查询
属性:
- messageTraces: Map - 消息追踪记录存储
- maxTraceSize: number - 最大追踪记录数
方法:
- recordMessage(messageTrace): 记录消息追踪
- getTrace(messageId): 获取消息追踪
- buildTraceTree(traceId): 构建调用链树
- getStats(event): 获取性能统计

### 事件规范
#### 事件1: 追踪数据变化
描述: 当追踪数据发生变化时触发，用于调试工具更新
参数:
- operation: string - 操作类型(add/remove/clear)
- messageId: string - 相关消息ID
返回值: 无