# PDF-Home 筛选条件序列化规格说明

**功能ID**: 20251005195400-pdf-search-filter-serialization
**优先级**: 中
**版本**: v001
**创建时间**: 2025-10-05 19:54:00
**预计完成**: 2025-10-13
**状态**: 设计中

## 现状说明
- FilterManager 支持 IFilterCondition 结构，但仅用于本地 match。
- SearchService 需要将条件树传给后端 SQL，实现字段筛选。

## 存在问题
- 条件对象缺乏 	oPayload() 功能，无法描述操作符、字段、常量。
- 缺少对区间、布尔、标签集合的标准化表达。

## 提出需求
- 为 FieldCondition、FuzzySearchCondition、CompositeCondition 增加序列化方法，输出后端可解析的 JSON。
- FilterManager 提供 uildFilterPayload()，返回 { type, operator, field, value } 树。
- 集成 SearchService：清除本地过滤结果，改为请求后端。

## 解决方案
- 修改文件：
  - eatures/filter/services/filter-conditions.js
  - eatures/filter/services/filter-condition-factory.js
  - eatures/filter/services/filter-manager.js
- 序列化协议：
  `json
  {
    "type": "composite",
    "operator": "AND",
    "conditions": [
      { "type": "field", "field": "rating", "operator": "gte", "value": 3 },
      { "type": "field", "field": "tags", "operator": "has_any", "value": ["AI"] }
    ]
  }
  `
- 支持操作符：
  - 数值：eq/ne/gt/gte/lt/lte/between
  - 字符串：contains/not_contains/starts_with/ends_with
  - 标签：has_any/has_all
  - 布尔：is_true/is_false
- FilterManager API：
  - setDataSource 保留缓存（供 UI 展示），但搜索时只发送 filter payload。
  - 新增事件 ilter:payload:changed 供 SearchService 感知。
- 后端 SQL 任务负责解析该 JSON。

## 约束条件
### 仅修改本模块代码
限制在 eatures/filter/services 范围内，避免影响其他 Feature。

### 严格遵循代码规范和标准
遵循 SPEC-HEAD-PDFHome.json 与插件文档；新增方法需写 JSDoc；保持 UTF-8。

## 可行验收标准
### 单元测试
- Jest：构造多种条件组合，验证 serialize() 输出；
- 反序列化后生成同样的 payload。

### 端到端测试
- 与 SearchService 联调：设置标签 + 评分筛选，确认请求 payload 正确。

### 接口实现
#### 接口1:
函数: FilterManager.buildFilterPayload() -> Object | null
描述: 提供当前条件的 JSON 序列化结果。
参数: 无
返回值: 序列化对象或 null

### 类实现
#### 类1
类: FieldCondition
描述: 扩展 serialize() / deserialize()。
属性: ield, operator, alue
方法: serialize, deserialize, 	oSQLFragment（可选）

### 事件规范
#### 事件1
描述: ilter:payload:changed（全局事件），在条件调整时发送。
参数: { filterPayload }
返回值: 无
