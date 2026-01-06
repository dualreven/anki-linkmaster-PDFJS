# PDF记录字段扩展规格说明

**功能ID**: 20251002003053-pdf-record-fields-extension
**优先级**: 高
**版本**: v001
**创建时间**: 2025-10-02 04:30:00
**预计完成**: 2025-10-04
**状态**: 设计中

## 现状说明

当前 PDF 管理系统的记录字段较为基础，仅包含 6 个基础字段：
- `id`: PDF唯一标识
- `filename`: 文件名
- `file_path`: 文件路径
- `file_size`: 文件大小（字节）
- `page_count`: 页数
- `created_at`: 文件创建时间（Unix秒）

数据存储在 JSON 文件：`src/backend/data/pdf_records.json`

前后端通过 WebSocket 通信，前端使用 Tabulator 表格展示 PDF 列表。

## 存在问题

1. **缺乏学习管理功能**：无法跟踪 PDF 的使用情况（上次访问时间、复习次数、评分）
2. **缺乏组织能力**：无法通过标签对 PDF 进行分类管理
3. **缺乏时间管理**：无法记录累计学习时长和设置截止日期
4. **缺乏可见性控制**：无法临时隐藏某些 PDF

## 提出需求

新增 **7个字段** 用于学习管理和组织：

| 字段名 | 后端字段名(snake_case) | 类型 | 默认值 | 说明 |
|--------|----------------------|------|--------|------|
| 上次访问时间 | `last_accessed_at` | `int` | `0` | Unix时间戳（秒），0表示从未访问 |
| 复习次数 | `review_count` | `int` | `0` | 累计打开PDF的次数 |
| 评分 | `rating` | `int` | `0` | 0-5星评分，0表示未评分 |
| 标签 | `tags` | `list[str]` | `[]` | 标签列表，用于分类 |
| 可见性 | `is_visible` | `bool` | `True` | 是否在列表中显示 |
| 累计学习时长 | `total_reading_time` | `int` | `0` | 累计学习时长（秒） |
| 截止日期 | `due_date` | `int` | `0` | Unix时间戳（秒），0表示无截止 |

**重要约定**：
- 前后端统一使用 **snake_case** 字段名，不进行命名转换
- 时间戳统一使用 **Unix秒**（不是毫秒）
- 项目未上线，无需考虑向后兼容

## 解决方案

### 技术架构

数据流向：
```
数据库(JSON) <-> 后端(Python) <-> 消息中心(WebSocket) <-> 前端(JavaScript) <-> 表格(Tabulator)
```

分 **4个Phase** 实现，每个环节逐段验证：

1. **Phase 1**: 数据层迁移 - 为现有 JSON 记录添加 7 个新字段
2. **Phase 2**: 后端扩展 - 扩展数据模型和业务逻辑
3. **Phase 3**: 消息中心扩展 - 扩展 WebSocket 消息协议
4. **Phase 4**: 前端和 UI 展示 - 扩展表格列定义

### 开发顺序

1. Phase 1 + 验证1（数据库层）：10分钟
2. Phase 2 + 验证2（数据库<->后端）：40分钟
3. Phase 3 + 验证3（后端<->消息中心）：30分钟
4. Phase 4 + 验证4+5（消息中心<->前端<->表格）：50分钟

**预计总时间**：2小时10分钟

## 约束条件

### 仅修改本模块代码

**允许修改的文件**：
- `src/backend/data/pdf_records.json` - 数据迁移
- `src/backend/services/pdf_service.py` - 业务逻辑扩展
- `src/backend/websocket/handlers.py` - 消息协议扩展
- `src/frontend/pdf-home/table/table-configuration-manager.js` - 表格配置

**允许新建的文件**：
- `src/backend/scripts/migrate_pdf_fields.py` - 数据迁移脚本
- `src/backend/tests/test_pdf_service.py` - 后端测试
- `src/backend/tests/test_websocket_messages.py` - 消息测试
- `src/frontend/pdf-home/table/columns/extended-columns.js` - 扩展列定义
- `src/frontend/pdf-home/table/styles/extended-columns.css` - 扩展样式

**不可修改**：
- 其他模块的代码
- 现有的 6 个字段结构

### 严格遵循代码规范和标准

- 前后端字段名统一使用 **snake_case**
- 时间戳统一使用 **Unix秒**（整数）
- WebSocket 消息格式遵循现有协议规范
- Tabulator 列定义的 `field` 属性直接对应后端字段名

## 可行验收标准

### 逐段验证（5个环节）

#### 验证1: 数据库层独立验证

**测试方法**：
1. 运行迁移脚本 `python src/backend/scripts/migrate_pdf_fields.py`
2. 运行验证脚本检查 JSON 文件

**验收标准**：
- 所有 PDF 记录都包含 7 个新字段
- 默认值符合规格（0, [], True）
- JSON 文件格式正确（可被 Python json.load 解析）

#### 验证2: 数据库 <-> 后端通信验证

**测试方法**：
运行 `python src/backend/tests/test_pdf_service.py`

**验收标准**：
- 后端能从 JSON 读取 7 个新字段
- 后端能修改新字段并写回 JSON
- `record_access()` 方法能正确更新 `last_accessed_at`、`review_count`、`total_reading_time`

#### 验证3: 后端 <-> 消息中心通信验证

**测试方法**：
1. 启动 WebSocket 服务器
2. 运行 `python src/backend/tests/test_websocket_messages.py`

**验收标准**：
- WebSocket 消息可序列化为 JSON
- 消息包含所有 7 个新字段
- 字段名使用 snake_case

#### 验证4: 消息中心 <-> 前端通信验证

**测试方法**：
在浏览器 Console 中监听 WebSocket 消息

**验收标准**：
- 前端能接收 `pdf:list:updated` 消息
- 消息中的记录包含 7 个新字段
- 字段值类型正确（整数、数组、布尔）

#### 验证5: 前端 <-> 表格显示验证

**测试方法**：
1. 打开 http://localhost:3000
2. 检查表格列和数据

**验收标准**：
- 表格显示 7 个新字段的列（除 `is_visible` 外，共 6 列可见）
- 列标题正确
- 格式化显示正确（星星、徽章、相对时间等）
- CSS 样式生效

### 端到端测试

#### 测试1: 添加PDF并验证新字段

**步骤**：
1. 启动开发服务器
2. 点击"添加PDF"按钮
3. 选择一个 PDF 文件

**验收标准**：
- 表格新增一行
- 7 个新字段显示默认值（"从未访问"、"新文档"、☆☆☆☆☆、"无标签"、"-"、"无截止"）

#### 测试2: 打开PDF并验证访问记录

**步骤**：
1. 双击表格中的 PDF 记录
2. 关闭 PDF 阅读器
3. 刷新表格

**验收标准**：
- "复习次数" 从 "新文档" 变为 "1 次"
- "上次访问" 显示相对时间（如 "刚刚"）

## 接口实现

### 接口1: migrate_records

**函数**: `migrate_records() -> bool`

**描述**: 迁移 PDF 记录，为所有记录添加 7 个新字段

**参数**: 无

**返回值**:
- `bool`: 迁移成功返回 True，失败返回 False

**文件**: `src/backend/scripts/migrate_pdf_fields.py`

**行为**：
1. 读取 `src/backend/data/pdf_records.json`
2. 备份原文件（添加时间戳后缀）
3. 为每条记录添加缺失的新字段及默认值
4. 写回 JSON 文件

**副作用**：
- 创建备份文件 `pdf_records.json.backup.YYYYMMDDhhmmss`
- 修改 `pdf_records.json` 文件

---

### 接口2: record_access

**函数**: `PDFService.record_access(pdf_id: str, reading_time: int = 0) -> None`

**描述**: 记录 PDF 访问，自动更新访问时间、复习次数、学习时长

**参数**:
- `pdf_id` (str): PDF 唯一标识
- `reading_time` (int): 本次阅读时长（秒），默认 0

**返回值**: 无

**副作用**：
- `last_accessed_at` 更新为当前时间戳
- `review_count` 自增 1
- `total_reading_time` 增加 `reading_time`
- 保存到 JSON 文件

---

### 接口3: update_rating

**函数**: `PDFService.update_rating(pdf_id: str, rating: int) -> None`

**描述**: 更新 PDF 评分

**参数**:
- `pdf_id` (str): PDF 唯一标识
- `rating` (int): 评分（0-5）

**返回值**: 无

**异常**:
- `ValueError`: 如果 rating 不在 0-5 范围内

---

### 接口4: update_tags

**函数**: `PDFService.update_tags(pdf_id: str, tags: List[str]) -> None`

**描述**: 更新 PDF 标签列表

**参数**:
- `pdf_id` (str): PDF 唯一标识
- `tags` (List[str]): 标签列表

**返回值**: 无

---

### 接口5: set_visibility

**函数**: `PDFService.set_visibility(pdf_id: str, visible: bool) -> None`

**描述**: 设置 PDF 可见性

**参数**:
- `pdf_id` (str): PDF 唯一标识
- `visible` (bool): 是否可见

**返回值**: 无

---

### 接口6: update_due_date

**函数**: `PDFService.update_due_date(pdf_id: str, due_date: int) -> None`

**描述**: 更新 PDF 截止日期

**参数**:
- `pdf_id` (str): PDF 唯一标识
- `due_date` (int): 截止日期（Unix 秒）

**返回值**: 无

## 类实现

### 类1: PDFRecord

**类**: `PDFRecord`

**描述**: PDF 记录数据模型

**文件**: `src/backend/services/pdf_service.py`

**属性**:
```python
# 原有字段
id: str                    # PDF唯一标识
filename: str              # 文件名
file_path: str             # 文件路径
file_size: int             # 文件大小（字节）
page_count: int            # 页数
created_at: int            # 创建时间（Unix秒）

# 新增字段
last_accessed_at: int      # 上次访问时间（Unix秒）
review_count: int          # 复习次数
rating: int                # 评分（0-5）
tags: List[str]            # 标签列表
is_visible: bool           # 是否可见
total_reading_time: int    # 累计学习时长（秒）
due_date: int              # 截止日期（Unix秒）
```

**方法**:
- `to_dict() -> dict`: 转换为字典（用于 JSON 序列化）
- `from_dict(data: dict) -> PDFRecord`: 从字典创建实例（类方法）

---

### 类2: PDFService

**类**: `PDFService`

**描述**: PDF 服务类，管理 PDF 记录的增删改查

**文件**: `src/backend/services/pdf_service.py`

**属性**:
- `data_path: Path` - JSON 文件路径
- `records: List[PDFRecord]` - 所有 PDF 记录

**方法**:
- `__init__(data_path: str)` - 初始化服务，加载记录
- `_load_records()` - 从 JSON 加载所有记录
- `_save_records()` - 保存所有记录到 JSON
- `get_record_by_id(pdf_id: str) -> PDFRecord` - 根据 ID 获取记录
- `record_access(pdf_id: str, reading_time: int)` - 记录 PDF 访问
- `update_rating(pdf_id: str, rating: int)` - 更新评分
- `update_tags(pdf_id: str, tags: List[str])` - 更新标签
- `set_visibility(pdf_id: str, visible: bool)` - 设置可见性
- `update_due_date(pdf_id: str, due_date: int)` - 更新截止日期

## 事件规范

### 事件1: pdf:list:updated

**描述**: 后端广播 PDF 列表更新

**方向**: 后端 → 前端

**触发时机**:
- PDF 添加/删除后
- 字段更新后（评分、标签、可见性等）

**消息格式**:
```javascript
{
  type: 'pdf:list:updated',
  data: {
    records: [
      {
        id: string,
        filename: string,
        // ... 其他原有字段
        last_accessed_at: number,    // 新增
        review_count: number,         // 新增
        rating: number,               // 新增
        tags: string[],               // 新增
        is_visible: boolean,          // 新增
        total_reading_time: number,   // 新增
        due_date: number              // 新增
      }
    ]
  }
}
```

---

### 事件2: pdf:access:record

**描述**: 前端请求记录 PDF 访问

**方向**: 前端 → 后端

**触发时机**: PDF 阅读器关闭时

**消息格式**:
```javascript
{
  type: 'pdf:access:record',
  data: {
    pdf_id: string,          // PDF唯一标识
    reading_time: number     // 本次阅读时长（秒）
  }
}
```

**响应**: 后端会广播 `pdf:list:updated` 消息

---

### 事件3: pdf:added

**描述**: 后端通知前端 PDF 添加成功

**方向**: 后端 → 前端

**触发时机**: 用户添加 PDF 后

**消息格式**:
```javascript
{
  type: 'pdf:added',
  data: {
    id: string,
    filename: string,
    // ... 所有字段（包含 7 个新字段的默认值）
  }
}
```

## 单元测试

### 测试1: test_read_from_json

**描述**: 测试后端从 JSON 读取新字段

**断言**:
- PDFRecord 实例包含 7 个新字段属性
- 默认值正确

---

### 测试2: test_write_to_json

**描述**: 测试后端写回 JSON

**断言**:
- 修改新字段后能成功保存
- 重新加载后值正确

---

### 测试3: test_record_access

**描述**: 测试 record_access 方法

**断言**:
- `review_count` 正确自增
- `last_accessed_at` 已更新
- `total_reading_time` 正确累加

---

### 测试4: test_websocket_message_format

**描述**: 测试 WebSocket 消息格式

**断言**:
- 消息可序列化为 JSON
- 消息包含 7 个新字段
- 字段名使用 snake_case

## 风险和注意事项

1. **时间戳单位**：务必使用秒而非毫秒，前后端保持一致
2. **字段命名**：前后端统一使用 snake_case，禁止转换为 camelCase
3. **数据备份**：迁移前自动备份 JSON 文件，防止数据丢失
4. **is_visible 字段**：当前仅存储，UI 暂不实现筛选功能（由筛选系统功能负责）
5. **标签编辑**：当前仅显示，编辑功能是另一个独立需求
6. **WebSocket 断线**：前端应处理 WebSocket 重连后的数据同步

---

**文档完成时间**: 2025-10-02 04:45:00
**文档状态**: ✅ 完整自洽，可直接用于开发
