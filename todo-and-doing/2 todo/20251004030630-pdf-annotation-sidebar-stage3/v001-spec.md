# PDF Viewer 标注栏功能规格说明（第三期:后端支持）

**功能ID**: 20251004030630-pdf-annotation-sidebar-stage3
**优先级**: 高
**版本**: v001
**创建时间**: 2025-10-04 03:06:30
**预计完成**: 2025-10-15
**状态**: 设计中
**依赖需求**:
- 20251002213000-pdf-annotation-sidebar (第一期)
- 20251004030600-pdf-annotation-sidebar-stage2 (第二期)

## 现状说明

### 当前系统状态
- ✅ 第一期已完成：基础标注功能（截图、选字、批注）
- ✅ 第二期已完成：UI深化（筛选、排序、ID复制）
- ✅ 前端标注管理已实现
- ⚠️ 后端数据持久化仅有基础实现（临时方案）

### 已有功能基础
1. **前端标注系统**: 完整的标注创建、编辑、删除、评论功能
2. **WebSocket通信**: 前后端消息传递机制已建立
3. **临时存储方案**: 使用JSON文件存储标注数据
4. **标注数据模型**: 完整的数据结构定义

### 临时存储方案的问题
- **数据分散**: 每个PDF文件一个JSON文件，管理困难
- **查询效率低**: 无法快速查询多个PDF的标注
- **并发问题**: 多进程/多用户可能导致数据覆盖
- **无备份机制**: 文件损坏则数据丢失
- **无历史记录**: 删除/修改后无法恢复

## 存在问题

### 数据持久化问题
1. **数据安全**: JSON文件易损坏，无事务保证
2. **性能问题**: 大量标注时加载和保存慢
3. **查询能力弱**: 无法跨PDF查询标注
4. **扩展性差**: 无法支持高级功能（搜索、统计）
5. **备份困难**: 无自动备份和恢复机制

### 数据管理问题
1. **无增量更新**: 每次保存整个标注列表
2. **无冲突检测**: 并发修改可能导致数据丢失
3. **无历史版本**: 误删除后无法恢复
4. **无数据迁移**: 升级数据结构困难

## 提出需求

### 核心功能需求（第三期）

#### 1. 标注数据的保存

**数据库设计**

##### 数据库选型
- **SQLite**: 轻量级、无需服务器、支持事务、跨平台
- **表结构**: annotations（标注）、comments（评论）、annotation_history（历史）

##### 表结构设计

**annotations表**
```sql
CREATE TABLE annotations (
    id TEXT PRIMARY KEY,                    -- 标注ID (UUID)
    pdf_path TEXT NOT NULL,                 -- PDF文件路径
    type TEXT NOT NULL,                     -- 标注类型 (screenshot|text-highlight|comment)
    page_number INTEGER NOT NULL,           -- 页码
    data TEXT NOT NULL,                     -- 类型特定数据 (JSON格式)
    created_at TEXT NOT NULL,               -- 创建时间 (ISO 8601)
    updated_at TEXT NOT NULL,               -- 修改时间 (ISO 8601)
    deleted_at TEXT,                        -- 软删除时间 (NULL表示未删除)
    version INTEGER DEFAULT 1               -- 版本号（用于冲突检测）
);

-- 索引
CREATE INDEX idx_pdf_path ON annotations(pdf_path);
CREATE INDEX idx_page_number ON annotations(page_number);
CREATE INDEX idx_type ON annotations(type);
CREATE INDEX idx_created_at ON annotations(created_at);
CREATE INDEX idx_deleted_at ON annotations(deleted_at);
```

**data字段JSON格式示例**:
```javascript
// 截图标注
{
  "rect": { "x": 100, "y": 200, "width": 300, "height": 200 },
  "imageData": "data:image/png;base64,...",
  "description": "这是一个重要的图表"
}

// 选字标注
{
  "selectedText": "这是被选中的文本...",
  "textRanges": [{ "start": 120, "end": 180 }],
  "highlightColor": "#ffff00",
  "note": "这段话很重要"
}

// 批注标注
{
  "position": { "x": 150, "y": 300 },
  "content": "这里需要进一步研究"
}
```

**comments表**
```sql
CREATE TABLE comments (
    id TEXT PRIMARY KEY,                    -- 评论ID (UUID)
    annotation_id TEXT NOT NULL,            -- 关联的标注ID
    content TEXT NOT NULL,                  -- 评论内容
    created_at TEXT NOT NULL,               -- 创建时间
    deleted_at TEXT,                        -- 软删除时间
    FOREIGN KEY (annotation_id) REFERENCES annotations(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX idx_annotation_id ON comments(annotation_id);
CREATE INDEX idx_deleted_at_comment ON comments(deleted_at);
```

**annotation_history表**（历史记录）
```sql
CREATE TABLE annotation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    annotation_id TEXT NOT NULL,            -- 标注ID
    operation TEXT NOT NULL,                -- 操作类型 (CREATE|UPDATE|DELETE)
    data_before TEXT,                       -- 操作前的数据 (JSON)
    data_after TEXT,                        -- 操作后的数据 (JSON)
    timestamp TEXT NOT NULL,                -- 操作时间
    user TEXT DEFAULT 'default'             -- 用户标识（未来扩展）
);

-- 索引
CREATE INDEX idx_annotation_id_history ON annotation_history(annotation_id);
CREATE INDEX idx_timestamp ON annotation_history(timestamp);
```

**保存流程**

```
前端创建标注
    ↓
发送 annotation:create 消息
    ↓
后端接收消息
    ↓
验证数据（必填字段、格式）
    ↓
插入 annotations 表
    ↓
插入 annotation_history 表（操作=CREATE）
    ↓
返回 annotation:created 消息
    ↓
广播 annotation:list:updated 消息（可选）
```

**并发冲突处理**
- 使用version字段实现乐观锁
- 更新时检查version是否匹配
- 不匹配则返回冲突错误，要求客户端刷新数据

#### 2. 标注数据的读取

**读取方式**

##### 2.1 按PDF路径加载全部标注
```python
def load_annotations(pdf_path):
    """
    加载指定PDF的所有标注

    参数:
        pdf_path (str): PDF文件路径

    返回:
        List[dict]: 标注列表
    """
    query = """
        SELECT id, pdf_path, type, page_number, data,
               created_at, updated_at, version
        FROM annotations
        WHERE pdf_path = ? AND deleted_at IS NULL
        ORDER BY created_at DESC
    """
    # 执行查询...
```

**WebSocket消息格式**:
```javascript
// 请求
{
  type: 'annotation:load',
  data: {
    pdfPath: '/path/to/document.pdf'
  }
}

// 响应
{
  type: 'annotation:loaded',
  data: {
    annotations: [
      {
        id: 'ann_001',
        type: 'screenshot',
        pageNumber: 23,
        data: { rect: {...}, imageData: '...' },
        createdAt: '2025-10-04T10:30:00Z',
        updatedAt: '2025-10-04T10:30:00Z',
        version: 1
      },
      // ...
    ]
  }
}
```

##### 2.2 按页码加载标注（懒加载优化）
```python
def load_annotations_by_page(pdf_path, page_number):
    """
    加载指定页的标注（懒加载优化）

    参数:
        pdf_path (str): PDF文件路径
        page_number (int): 页码

    返回:
        List[dict]: 标注列表
    """
    query = """
        SELECT id, pdf_path, type, page_number, data,
               created_at, updated_at, version
        FROM annotations
        WHERE pdf_path = ? AND page_number = ? AND deleted_at IS NULL
        ORDER BY created_at DESC
    """
    # 执行查询...
```

##### 2.3 批量加载评论
```python
def load_comments(annotation_ids):
    """
    批量加载评论

    参数:
        annotation_ids (List[str]): 标注ID列表

    返回:
        Dict[str, List[dict]]: {annotation_id: [comments]}
    """
    query = """
        SELECT id, annotation_id, content, created_at
        FROM comments
        WHERE annotation_id IN ({}) AND deleted_at IS NULL
        ORDER BY created_at ASC
    """.format(','.join(['?'] * len(annotation_ids)))
    # 执行查询，按annotation_id分组...
```

**性能优化**
- **索引**: 在pdf_path、page_number、created_at上建立索引
- **分页加载**: 支持limit和offset参数
- **懒加载**: 仅加载当前页和附近页的标注
- **缓存**: 后端缓存最近访问的标注（LRU Cache）

#### 3. 标注数据的更新

**更新流程**

```
前端修改标注
    ↓
发送 annotation:update 消息
    ↓
后端接收消息
    ↓
查询当前数据（含version）
    ↓
检查version是否匹配
    ↓ (不匹配)
返回冲突错误 → 前端刷新数据
    ↓ (匹配)
更新 annotations 表（version+1）
    ↓
插入 annotation_history 表（操作=UPDATE）
    ↓
返回 annotation:updated 消息
    ↓
广播 annotation:list:updated 消息
```

**WebSocket消息格式**:
```javascript
// 请求
{
  type: 'annotation:update',
  data: {
    id: 'ann_001',
    changes: {
      data: { description: '更新后的描述' }
    },
    version: 1  // 当前版本号（用于冲突检测）
  }
}

// 成功响应
{
  type: 'annotation:updated',
  data: {
    annotation: {
      id: 'ann_001',
      // ... 完整数据
      version: 2  // 版本号+1
    }
  }
}

// 冲突响应
{
  type: 'annotation:update:conflict',
  data: {
    id: 'ann_001',
    currentVersion: 3,  // 数据库中的最新版本
    message: '标注已被修改，请刷新后重试'
  }
}
```

**乐观锁实现**
```python
def update_annotation(annotation_id, changes, expected_version):
    """
    更新标注（乐观锁）

    参数:
        annotation_id (str): 标注ID
        changes (dict): 要更新的字段
        expected_version (int): 期望的版本号

    返回:
        (bool, dict): (是否成功, 更新后的数据或错误信息)
    """
    # 查询当前数据
    current = db.query("SELECT * FROM annotations WHERE id = ?", annotation_id)

    if current['version'] != expected_version:
        return (False, {
            'error': 'VERSION_CONFLICT',
            'currentVersion': current['version']
        })

    # 更新数据
    db.execute("""
        UPDATE annotations
        SET data = ?, updated_at = ?, version = version + 1
        WHERE id = ? AND version = ?
    """, json.dumps(changes['data']), now(), annotation_id, expected_version)

    # 插入历史记录
    db.execute("""
        INSERT INTO annotation_history (annotation_id, operation, data_before, data_after, timestamp)
        VALUES (?, 'UPDATE', ?, ?, ?)
    """, annotation_id, json.dumps(current), json.dumps(changes), now())

    # 返回更新后的数据
    updated = db.query("SELECT * FROM annotations WHERE id = ?", annotation_id)
    return (True, updated)
```

#### 4. 标注数据的删除

**软删除机制**
- 不真正删除数据，而是设置`deleted_at`字段
- 查询时过滤`deleted_at IS NULL`的记录
- 保留历史记录，支持恢复

**删除流程**

```
前端删除标注
    ↓
发送 annotation:delete 消息
    ↓
后端接收消息
    ↓
查询当前数据
    ↓
软删除（设置deleted_at）
    ↓
插入 annotation_history 表（操作=DELETE）
    ↓
返回 annotation:deleted 消息
    ↓
广播 annotation:list:updated 消息
```

**WebSocket消息格式**:
```javascript
// 请求
{
  type: 'annotation:delete',
  data: {
    id: 'ann_001'
  }
}

// 响应
{
  type: 'annotation:deleted',
  data: {
    id: 'ann_001',
    deletedAt: '2025-10-04T15:00:00Z'
  }
}
```

**Python实现**:
```python
def delete_annotation(annotation_id):
    """
    软删除标注

    参数:
        annotation_id (str): 标注ID

    返回:
        bool: 是否成功
    """
    # 查询当前数据
    current = db.query("SELECT * FROM annotations WHERE id = ? AND deleted_at IS NULL", annotation_id)

    if not current:
        return False

    # 软删除
    now_time = datetime.now().isoformat()
    db.execute("""
        UPDATE annotations
        SET deleted_at = ?, version = version + 1
        WHERE id = ?
    """, now_time, annotation_id)

    # 插入历史记录
    db.execute("""
        INSERT INTO annotation_history (annotation_id, operation, data_before, timestamp)
        VALUES (?, 'DELETE', ?, ?)
    """, annotation_id, json.dumps(current), now_time)

    return True
```

#### 5. 评论的增加

**添加评论流程**

```
前端添加评论
    ↓
发送 annotation:comment:add 消息
    ↓
后端接收消息
    ↓
验证标注是否存在
    ↓
插入 comments 表
    ↓
更新标注的 updated_at 字段
    ↓
返回 annotation:comment:added 消息
    ↓
广播评论更新（可选）
```

**WebSocket消息格式**:
```javascript
// 请求
{
  type: 'annotation:comment:add',
  data: {
    annotationId: 'ann_001',
    content: '这是一条评论'
  }
}

// 响应
{
  type: 'annotation:comment:added',
  data: {
    comment: {
      id: 'comment_001',
      annotationId: 'ann_001',
      content: '这是一条评论',
      createdAt: '2025-10-04T16:00:00Z'
    }
  }
}
```

**Python实现**:
```python
def add_comment(annotation_id, content):
    """
    添加评论

    参数:
        annotation_id (str): 标注ID
        content (str): 评论内容

    返回:
        dict: 创建的评论
    """
    # 验证标注存在
    annotation = db.query("SELECT id FROM annotations WHERE id = ? AND deleted_at IS NULL", annotation_id)
    if not annotation:
        raise ValueError("标注不存在")

    # 创建评论
    comment_id = generate_uuid()
    now_time = datetime.now().isoformat()

    db.execute("""
        INSERT INTO comments (id, annotation_id, content, created_at)
        VALUES (?, ?, ?, ?)
    """, comment_id, annotation_id, content, now_time)

    # 更新标注的修改时间
    db.execute("""
        UPDATE annotations
        SET updated_at = ?
        WHERE id = ?
    """, now_time, annotation_id)

    return {
        'id': comment_id,
        'annotationId': annotation_id,
        'content': content,
        'createdAt': now_time
    }
```

#### 6. 评论的删除

**删除评论流程**

```
前端删除评论
    ↓
发送 annotation:comment:delete 消息
    ↓
后端接收消息
    ↓
软删除评论（设置deleted_at）
    ↓
返回 annotation:comment:deleted 消息
```

**WebSocket消息格式**:
```javascript
// 请求
{
  type: 'annotation:comment:delete',
  data: {
    commentId: 'comment_001'
  }
}

// 响应
{
  type: 'annotation:comment:deleted',
  data: {
    commentId: 'comment_001'
  }
}
```

**Python实现**:
```python
def delete_comment(comment_id):
    """
    软删除评论

    参数:
        comment_id (str): 评论ID

    返回:
        bool: 是否成功
    """
    now_time = datetime.now().isoformat()

    rows_affected = db.execute("""
        UPDATE comments
        SET deleted_at = ?
        WHERE id = ? AND deleted_at IS NULL
    """, now_time, comment_id)

    return rows_affected > 0
```

### 高级功能需求

#### 7. 历史记录和恢复

**查看历史记录**
```python
def get_annotation_history(annotation_id):
    """
    获取标注的历史记录

    参数:
        annotation_id (str): 标注ID

    返回:
        List[dict]: 历史记录列表
    """
    query = """
        SELECT id, operation, data_before, data_after, timestamp
        FROM annotation_history
        WHERE annotation_id = ?
        ORDER BY timestamp DESC
    """
    return db.query_all(query, annotation_id)
```

**恢复已删除的标注**
```python
def restore_annotation(annotation_id):
    """
    恢复已删除的标注

    参数:
        annotation_id (str): 标注ID

    返回:
        dict: 恢复后的标注
    """
    db.execute("""
        UPDATE annotations
        SET deleted_at = NULL, version = version + 1
        WHERE id = ?
    """, annotation_id)

    # 插入历史记录
    db.execute("""
        INSERT INTO annotation_history (annotation_id, operation, timestamp)
        VALUES (?, 'RESTORE', ?)
    """, annotation_id, datetime.now().isoformat())

    return db.query("SELECT * FROM annotations WHERE id = ?", annotation_id)
```

#### 8. 数据备份和导出

**导出为JSON**
```python
def export_annotations(pdf_path, format='json'):
    """
    导出标注数据

    参数:
        pdf_path (str): PDF文件路径
        format (str): 导出格式 ('json'|'markdown'|'csv')

    返回:
        str: 导出的数据
    """
    annotations = load_annotations(pdf_path)

    if format == 'json':
        return json.dumps(annotations, indent=2, ensure_ascii=False)

    elif format == 'markdown':
        # 生成Markdown格式
        lines = [f"# {pdf_path} 标注\n"]
        for ann in annotations:
            lines.append(f"## 页码 {ann['page_number']}\n")
            lines.append(f"- **类型**: {ann['type']}\n")
            lines.append(f"- **时间**: {ann['created_at']}\n")
            # ...
        return '\n'.join(lines)

    elif format == 'csv':
        # 生成CSV格式
        import csv
        # ...
```

**导入标注数据**
```python
def import_annotations(pdf_path, data, format='json'):
    """
    导入标注数据

    参数:
        pdf_path (str): PDF文件路径
        data (str): 导入的数据
        format (str): 数据格式

    返回:
        int: 导入的标注数量
    """
    if format == 'json':
        annotations = json.loads(data)

        count = 0
        for ann in annotations:
            # 创建标注
            create_annotation(ann)
            count += 1

        return count
```

#### 9. 数据统计

**统计标注数量**
```python
def get_annotation_stats(pdf_path=None):
    """
    获取标注统计信息

    参数:
        pdf_path (str, optional): PDF文件路径（None表示全部）

    返回:
        dict: 统计信息
    """
    if pdf_path:
        query = """
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN type = 'screenshot' THEN 1 ELSE 0 END) as screenshots,
                SUM(CASE WHEN type = 'text-highlight' THEN 1 ELSE 0 END) as highlights,
                SUM(CASE WHEN type = 'comment' THEN 1 ELSE 0 END) as comments
            FROM annotations
            WHERE pdf_path = ? AND deleted_at IS NULL
        """
        result = db.query(query, pdf_path)
    else:
        query = """
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN type = 'screenshot' THEN 1 ELSE 0 END) as screenshots,
                SUM(CASE WHEN type = 'text-highlight' THEN 1 ELSE 0 END) as highlights,
                SUM(CASE WHEN type = 'comment' THEN 1 ELSE 0 END) as comments,
                COUNT(DISTINCT pdf_path) as pdf_count
            FROM annotations
            WHERE deleted_at IS NULL
        """
        result = db.query(query)

    return result
```

### 性能要求
- **数据库查询时间**: < 100ms（1000个标注）
- **插入/更新时间**: < 50ms（单条记录）
- **批量加载时间**: < 500ms（加载100个标注及评论）
- **导出时间**: < 2秒（1000个标注）
- **备份时间**: < 5秒（完整数据库备份）

### 数据安全要求
- 使用事务保证数据一致性
- 定期自动备份数据库（每日备份）
- 数据库文件权限控制（仅应用可读写）
- SQL注入防护（使用参数化查询）
- 敏感数据加密（base64图片数据压缩）

## 解决方案

### 技术架构

#### 后端目录结构
```
src/backend/
├── database/
│   ├── __init__.py
│   ├── connection.py            # 数据库连接管理
│   ├── migrations/              # 数据库迁移脚本
│   │   ├── 001_create_tables.sql
│   │   ├── 002_add_indexes.sql
│   │   └── ...
│   ├── models/
│   │   ├── annotation.py        # Annotation ORM模型
│   │   ├── comment.py           # Comment ORM模型
│   │   └── history.py           # History ORM模型
│   └── repositories/
│       ├── annotation_repository.py  # 标注数据访问层
│       ├── comment_repository.py     # 评论数据访问层
│       └── history_repository.py     # 历史数据访问层
├── services/
│   ├── annotation_service.py    # 标注业务逻辑层
│   ├── comment_service.py       # 评论业务逻辑层
│   ├── backup_service.py        # 备份服务
│   └── migration_service.py     # 数据迁移服务
├── websocket/
│   ├── annotation_handler.py    # WebSocket消息处理器
│   └── ...
└── utils/
    ├── uuid_generator.py        # UUID生成工具
    └── date_helper.py           # 日期处理工具
```

### 核心类设计

#### AnnotationRepository类
```python
"""
标注数据访问层
"""
class AnnotationRepository:
    def __init__(self, db_connection):
        self.db = db_connection

    def create(self, annotation: dict) -> dict:
        """创建标注"""
        pass

    def find_by_id(self, annotation_id: str) -> dict:
        """根据ID查询标注"""
        pass

    def find_by_pdf_path(self, pdf_path: str) -> list:
        """根据PDF路径查询所有标注"""
        pass

    def find_by_page(self, pdf_path: str, page_number: int) -> list:
        """根据页码查询标注"""
        pass

    def update(self, annotation_id: str, changes: dict, expected_version: int) -> tuple:
        """更新标注（乐观锁）"""
        pass

    def soft_delete(self, annotation_id: str) -> bool:
        """软删除标注"""
        pass

    def restore(self, annotation_id: str) -> dict:
        """恢复已删除的标注"""
        pass

    def count_by_type(self, pdf_path: str = None) -> dict:
        """统计标注数量"""
        pass
```

#### AnnotationService类
```python
"""
标注业务逻辑层
"""
class AnnotationService:
    def __init__(self, annotation_repo, comment_repo, history_repo):
        self.annotation_repo = annotation_repo
        self.comment_repo = comment_repo
        self.history_repo = history_repo

    def create_annotation(self, data: dict) -> dict:
        """
        创建标注
        - 验证数据
        - 调用repository保存
        - 记录历史
        - 返回结果
        """
        pass

    def update_annotation(self, annotation_id: str, changes: dict, version: int) -> dict:
        """
        更新标注
        - 乐观锁检查
        - 更新数据
        - 记录历史
        """
        pass

    def delete_annotation(self, annotation_id: str) -> bool:
        """
        删除标注
        - 软删除
        - 记录历史
        """
        pass

    def load_annotations(self, pdf_path: str, page_number: int = None) -> list:
        """
        加载标注
        - 支持全部加载或按页加载
        - 批量加载评论
        """
        pass

    def add_comment(self, annotation_id: str, content: str) -> dict:
        """添加评论"""
        pass

    def delete_comment(self, comment_id: str) -> bool:
        """删除评论"""
        pass

    def get_history(self, annotation_id: str) -> list:
        """获取历史记录"""
        pass

    def restore_annotation(self, annotation_id: str) -> dict:
        """恢复已删除的标注"""
        pass
```

#### AnnotationHandler类（WebSocket）
```python
"""
WebSocket消息处理器
"""
class AnnotationHandler:
    def __init__(self, annotation_service):
        self.service = annotation_service

    async def handle_create(self, message: dict, websocket):
        """处理创建标注消息"""
        try:
            data = message['data']
            annotation = self.service.create_annotation(data)

            # 返回成功消息
            await websocket.send(json.dumps({
                'type': 'annotation:created',
                'data': {'annotation': annotation}
            }))

            # 广播列表更新
            await self.broadcast_list_updated(data['pdfPath'])

        except Exception as e:
            # 返回错误消息
            await websocket.send(json.dumps({
                'type': 'annotation:create:error',
                'data': {'error': str(e)}
            }))

    async def handle_update(self, message: dict, websocket):
        """处理更新标注消息"""
        try:
            data = message['data']
            annotation = self.service.update_annotation(
                data['id'],
                data['changes'],
                data['version']
            )

            await websocket.send(json.dumps({
                'type': 'annotation:updated',
                'data': {'annotation': annotation}
            }))

        except VersionConflictError as e:
            # 返回冲突消息
            await websocket.send(json.dumps({
                'type': 'annotation:update:conflict',
                'data': {
                    'id': data['id'],
                    'currentVersion': e.current_version,
                    'message': '标注已被修改，请刷新后重试'
                }
            }))

    async def handle_delete(self, message: dict, websocket):
        """处理删除标注消息"""
        pass

    async def handle_load(self, message: dict, websocket):
        """处理加载标注消息"""
        pass

    async def handle_comment_add(self, message: dict, websocket):
        """处理添加评论消息"""
        pass

    async def handle_comment_delete(self, message: dict, websocket):
        """处理删除评论消息"""
        pass
```

#### DatabaseConnection类
```python
"""
数据库连接管理
"""
import sqlite3
from contextlib import contextmanager

class DatabaseConnection:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.connection = None

    def connect(self):
        """建立连接"""
        self.connection = sqlite3.connect(self.db_path)
        self.connection.row_factory = sqlite3.Row  # 返回字典格式
        return self.connection

    def close(self):
        """关闭连接"""
        if self.connection:
            self.connection.close()

    @contextmanager
    def transaction(self):
        """事务上下文管理器"""
        try:
            yield self.connection
            self.connection.commit()
        except Exception as e:
            self.connection.rollback()
            raise e

    def execute(self, query: str, params: tuple = ()):
        """执行SQL（INSERT/UPDATE/DELETE）"""
        cursor = self.connection.cursor()
        cursor.execute(query, params)
        return cursor.rowcount

    def query_one(self, query: str, params: tuple = ()):
        """查询单条记录"""
        cursor = self.connection.cursor()
        cursor.execute(query, params)
        row = cursor.fetchone()
        return dict(row) if row else None

    def query_all(self, query: str, params: tuple = ()):
        """查询多条记录"""
        cursor = self.connection.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
```

#### MigrationService类
```python
"""
数据库迁移服务
"""
class MigrationService:
    def __init__(self, db_connection):
        self.db = db_connection

    def run_migrations(self):
        """执行所有待执行的迁移"""
        # 创建migrations表（记录已执行的迁移）
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                executed_at TEXT NOT NULL
            )
        """)

        # 获取已执行的迁移
        executed = self.db.query_all("SELECT name FROM migrations")
        executed_names = [m['name'] for m in executed]

        # 加载迁移文件
        migration_files = self._load_migration_files()

        # 执行未执行的迁移
        for name, sql in migration_files:
            if name not in executed_names:
                print(f"执行迁移: {name}")
                self.db.execute(sql)
                self.db.execute(
                    "INSERT INTO migrations (name, executed_at) VALUES (?, ?)",
                    (name, datetime.now().isoformat())
                )

    def _load_migration_files(self):
        """加载迁移文件"""
        import os
        migration_dir = os.path.join(os.path.dirname(__file__), 'migrations')
        files = sorted(os.listdir(migration_dir))

        migrations = []
        for filename in files:
            if filename.endswith('.sql'):
                path = os.path.join(migration_dir, filename)
                with open(path, 'r', encoding='utf-8') as f:
                    sql = f.read()
                    migrations.append((filename, sql))

        return migrations
```

#### BackupService类
```python
"""
备份服务
"""
import shutil
from datetime import datetime

class BackupService:
    def __init__(self, db_path: str, backup_dir: str):
        self.db_path = db_path
        self.backup_dir = backup_dir

    def create_backup(self):
        """创建备份"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_name = f"annotations_backup_{timestamp}.db"
        backup_path = os.path.join(self.backup_dir, backup_name)

        # 复制数据库文件
        shutil.copy2(self.db_path, backup_path)

        print(f"备份已创建: {backup_path}")
        return backup_path

    def restore_backup(self, backup_path: str):
        """恢复备份"""
        # 验证备份文件存在
        if not os.path.exists(backup_path):
            raise FileNotFoundError(f"备份文件不存在: {backup_path}")

        # 备份当前数据库（以防恢复失败）
        self.create_backup()

        # 恢复备份
        shutil.copy2(backup_path, self.db_path)

        print(f"备份已恢复: {backup_path}")

    def list_backups(self):
        """列出所有备份"""
        import glob
        pattern = os.path.join(self.backup_dir, 'annotations_backup_*.db')
        backups = glob.glob(pattern)
        return sorted(backups, reverse=True)

    def cleanup_old_backups(self, keep_days: int = 30):
        """清理旧备份（保留最近N天）"""
        import time
        cutoff_time = time.time() - (keep_days * 24 * 60 * 60)

        for backup_path in self.list_backups():
            if os.path.getmtime(backup_path) < cutoff_time:
                os.remove(backup_path)
                print(f"已删除旧备份: {backup_path}")
```

### 数据库迁移脚本

#### 001_create_tables.sql
```sql
-- 创建标注表
CREATE TABLE IF NOT EXISTS annotations (
    id TEXT PRIMARY KEY,
    pdf_path TEXT NOT NULL,
    type TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    version INTEGER DEFAULT 1
);

-- 创建评论表
CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    annotation_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY (annotation_id) REFERENCES annotations(id) ON DELETE CASCADE
);

-- 创建历史记录表
CREATE TABLE IF NOT EXISTS annotation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    annotation_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    data_before TEXT,
    data_after TEXT,
    timestamp TEXT NOT NULL,
    user TEXT DEFAULT 'default'
);
```

#### 002_add_indexes.sql
```sql
-- 标注表索引
CREATE INDEX IF NOT EXISTS idx_pdf_path ON annotations(pdf_path);
CREATE INDEX IF NOT EXISTS idx_page_number ON annotations(page_number);
CREATE INDEX IF NOT EXISTS idx_type ON annotations(type);
CREATE INDEX IF NOT EXISTS idx_created_at ON annotations(created_at);
CREATE INDEX IF NOT EXISTS idx_deleted_at ON annotations(deleted_at);

-- 评论表索引
CREATE INDEX IF NOT EXISTS idx_annotation_id ON comments(annotation_id);
CREATE INDEX IF NOT EXISTS idx_deleted_at_comment ON comments(deleted_at);

-- 历史表索引
CREATE INDEX IF NOT EXISTS idx_annotation_id_history ON annotation_history(annotation_id);
CREATE INDEX IF NOT EXISTS idx_timestamp ON annotation_history(timestamp);
```

## 约束条件

### 仅修改后端代码
仅修改 `src/backend/` 中的代码，前端接口保持兼容

### 向后兼容
- 支持从JSON文件迁移到数据库
- WebSocket消息格式保持兼容
- 不破坏第一期和第二期功能

### 数据安全
- 使用事务保证一致性
- SQL注入防护
- 定期自动备份
- 软删除机制

### 性能优化
- 使用索引加速查询
- 支持懒加载和分页
- 批量操作优化

## 可行验收标准

### 单元测试

#### AnnotationRepository测试
- ✅ create正确插入标注
- ✅ find_by_id正确查询标注
- ✅ find_by_pdf_path正确查询所有标注
- ✅ find_by_page正确按页查询
- ✅ update乐观锁正常工作
- ✅ soft_delete正确软删除
- ✅ restore正确恢复已删除标注

#### AnnotationService测试
- ✅ create_annotation创建标注并记录历史
- ✅ update_annotation版本冲突检测
- ✅ delete_annotation软删除并记录历史
- ✅ add_comment正确添加评论
- ✅ load_annotations批量加载评论

#### DatabaseConnection测试
- ✅ transaction事务回滚正常工作
- ✅ execute正确执行SQL
- ✅ query_one返回字典格式
- ✅ query_all返回列表

#### BackupService测试
- ✅ create_backup创建备份文件
- ✅ restore_backup恢复备份
- ✅ cleanup_old_backups清理旧备份

### 集成测试

#### 测试1: 完整CRUD流程
1. 创建标注
2. 验证：数据库中有记录，历史表有CREATE记录
3. 更新标注
4. 验证：version+1，历史表有UPDATE记录
5. 删除标注
6. 验证：deleted_at不为空，历史表有DELETE记录
7. 恢复标注
8. 验证：deleted_at为空，历史表有RESTORE记录

#### 测试2: 并发冲突检测
1. 加载标注（version=1）
2. 模拟另一个客户端更新（version变为2）
3. 尝试更新（使用version=1）
4. 验证：返回冲突错误，version未改变

#### 测试3: 评论关联删除
1. 创建标注和3条评论
2. 删除标注
3. 验证：标注和评论都被软删除

#### 测试4: 性能测试
1. 插入1000个标注
2. 验证：插入时间 < 5秒
3. 查询所有标注
4. 验证：查询时间 < 100ms
5. 批量加载评论
6. 验证：加载时间 < 500ms

#### 测试5: 备份和恢复
1. 创建10个标注
2. 创建备份
3. 验证：备份文件存在
4. 删除所有标注
5. 恢复备份
6. 验证：10个标注恢复

#### 测试6: 数据迁移
1. 准备JSON文件（第一期格式）
2. 运行迁移脚本
3. 验证：所有标注导入数据库
4. 验证：数据完整性

### 端到端测试

#### 测试7: WebSocket通信
1. 前端发送创建标注消息
2. 后端处理并返回
3. 验证：数据库有记录
4. 前端发送更新消息
5. 后端处理并返回
6. 验证：数据库已更新
7. 前端发送删除消息
8. 后端处理并返回
9. 验证：数据库软删除

#### 测试8: 多PDF管理
1. 打开PDF A，创建5个标注
2. 打开PDF B，创建3个标注
3. 切换回PDF A
4. 验证：仅显示A的5个标注
5. 查询统计
6. 验证：总共8个标注，2个PDF

### 接口实现

#### 函数：create_annotation
```python
def create_annotation(data: dict) -> dict:
    """
    创建标注

    参数:
        data (dict): 标注数据
            - pdf_path (str): PDF路径
            - type (str): 标注类型
            - page_number (int): 页码
            - data (dict): 类型特定数据

    返回:
        dict: 创建的标注（含id, version, createdAt等）

    异常:
        ValueError: 数据验证失败
    """
```

#### 函数：update_annotation
```python
def update_annotation(annotation_id: str, changes: dict, expected_version: int) -> dict:
    """
    更新标注

    参数:
        annotation_id (str): 标注ID
        changes (dict): 要更新的字段
        expected_version (int): 期望的版本号

    返回:
        dict: 更新后的标注

    异常:
        VersionConflictError: 版本冲突
        NotFoundError: 标注不存在
    """
```

#### 函数：load_annotations
```python
def load_annotations(pdf_path: str, page_number: int = None) -> list:
    """
    加载标注

    参数:
        pdf_path (str): PDF路径
        page_number (int, optional): 页码（None表示全部）

    返回:
        List[dict]: 标注列表（含评论）
    """
```

### 类实现

#### 类：AnnotationRepository
```python
class AnnotationRepository:
    def create(self, annotation: dict) -> dict
    def find_by_id(self, annotation_id: str) -> dict
    def find_by_pdf_path(self, pdf_path: str) -> list
    def update(self, annotation_id: str, changes: dict, version: int) -> tuple
    def soft_delete(self, annotation_id: str) -> bool
```

#### 类：AnnotationService
```python
class AnnotationService:
    def create_annotation(self, data: dict) -> dict
    def update_annotation(self, annotation_id: str, changes: dict, version: int) -> dict
    def delete_annotation(self, annotation_id: str) -> bool
    def load_annotations(self, pdf_path: str, page_number: int = None) -> list
    def add_comment(self, annotation_id: str, content: str) -> dict
```

### 事件规范

#### WebSocket消息：annotation:create
- **请求**: `{ type: 'annotation:create', data: { pdfPath, type, pageNumber, data } }`
- **响应**: `{ type: 'annotation:created', data: { annotation } }`
- **错误**: `{ type: 'annotation:create:error', data: { error } }`

#### WebSocket消息：annotation:update
- **请求**: `{ type: 'annotation:update', data: { id, changes, version } }`
- **响应**: `{ type: 'annotation:updated', data: { annotation } }`
- **冲突**: `{ type: 'annotation:update:conflict', data: { id, currentVersion } }`

## 实现计划

### Phase 1: 数据库设计和迁移（4小时）
- [ ] 设计表结构（annotations, comments, history）
- [ ] 编写迁移脚本（001, 002）
- [ ] 实现MigrationService
- [ ] 测试迁移
- [ ] 提交commit

### Phase 2: Repository层（6小时）
- [ ] 实现DatabaseConnection
- [ ] 实现AnnotationRepository
- [ ] 实现CommentRepository
- [ ] 实现HistoryRepository
- [ ] 编写单元测试
- [ ] 提交commit

### Phase 3: Service层（8小时）
- [ ] 实现AnnotationService
- [ ] 实现CommentService
- [ ] 实现乐观锁机制
- [ ] 实现历史记录
- [ ] 编写单元测试
- [ ] 提交commit

### Phase 4: WebSocket Handler（6小时）
- [ ] 实现AnnotationHandler
- [ ] 处理创建/更新/删除消息
- [ ] 处理评论消息
- [ ] 处理加载消息
- [ ] 编写集成测试
- [ ] 提交commit

### Phase 5: 备份和恢复（4小时）
- [ ] 实现BackupService
- [ ] 实现自动备份定时任务
- [ ] 实现恢复功能
- [ ] 编写单元测试
- [ ] 提交commit

### Phase 6: 数据迁移工具（4小时）
- [ ] 实现JSON到数据库的迁移脚本
- [ ] 实现数据验证
- [ ] 实现进度报告
- [ ] 测试迁移1000+标注
- [ ] 提交commit

### Phase 7: 高级功能（6小时）
- [ ] 实现历史查看和恢复
- [ ] 实现数据导出（JSON/Markdown/CSV）
- [ ] 实现数据导入
- [ ] 实现统计功能
- [ ] 提交commit

### Phase 8: 性能优化（4小时）
- [ ] 添加数据库索引
- [ ] 实现查询缓存
- [ ] 实现懒加载
- [ ] 性能测试和优化
- [ ] 提交commit

### Phase 9: 端到端测试（6小时）
- [ ] 测试完整CRUD流程
- [ ] 测试并发冲突
- [ ] 测试备份恢复
- [ ] 测试数据迁移
- [ ] 测试WebSocket通信
- [ ] 提交commit

### Phase 10: 文档和部署（2小时）
- [ ] 编写README.md
- [ ] 编写API文档
- [ ] 编写部署指南
- [ ] 最终测试
- [ ] 提交最终commit

**总预计时间**: 50小时

## 风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| 数据迁移失败 | 🔴 高 | 详细测试，备份旧数据，支持回滚 |
| 并发冲突复杂 | 🟡 中 | 使用成熟的乐观锁方案，详细测试 |
| 性能问题 | 🟡 中 | 建立索引，实现缓存，性能测试 |
| 备份文件过大 | 🟢 低 | 压缩备份文件，清理旧备份 |
| SQLite限制 | 🟢 低 | 单用户场景足够，未来可迁移PostgreSQL |
| 数据库锁 | 🟡 中 | 使用WAL模式，优化事务 |

## 后续版本规划（不在第三期实现）

### 第四期功能（高级查询）
- 全文搜索（使用FTS5）
- 高级筛选（多条件组合）
- 数据分析和报告
- 标注关系图谱

### 第五期功能（协作和同步）
- 多用户支持
- 云端同步
- 实时协作
- 冲突解决策略

## 参考资料

### 数据库文档
- [SQLite官方文档](https://www.sqlite.org/docs.html)
- [SQLite FTS5全文搜索](https://www.sqlite.org/fts5.html)
- [SQLite WAL模式](https://www.sqlite.org/wal.html)

### 项目文档
- [标注栏第一期规格说明](../20251002213000-pdf-annotation-sidebar/v001-spec.md)
- [标注栏第二期规格说明](../20251004030600-pdf-annotation-sidebar-phase2/v001-spec.md)

### 设计参考
- [Notion数据库架构](https://www.notion.so)
- [Evernote标注系统](https://evernote.com)
- [Adobe Acrobat云端同步](https://acrobat.adobe.com)
