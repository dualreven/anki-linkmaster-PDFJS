# PDF 数据格式文档

## 后端返回的PDF数据结构

根据 `pdf-list/feature.config.js` 中的列配置，后端返回的PDF数据对象包含以下字段：

### 基本信息
- **id**: `string` - PDF记录ID（唯一标识）
- **title**: `string` - PDF标题
- **author**: `string` - 作者
- **subject**: `string` - 主题
- **keywords**: `string` - 关键词

### 文件信息
- **file_size**: `number` - 文件大小（字节）
  - 显示格式: `(bytes / (1024 * 1024)).toFixed(2) + ' MB'`
- **page_count**: `number` - 页数

### 时间信息
- **created_time**: `string` - 创建时间
- **modified_time**: `string` - 修改时间
- **last_accessed_at**: `number` - 最后访问时间（Unix时间戳，秒）
  - 显示格式: `new Date(timestamp * 1000).toLocaleDateString() + toLocaleTimeString()`

### 学习数据
- **rating**: `number` - 评分
- **review_count**: `number` - 复习次数
- **total_reading_time**: `number` - 总阅读时长（秒）
  - 显示格式: `(seconds / 3600).toFixed(2) + '小时'`
- **due_date**: `number` - 到期日期（Unix时间戳，秒）

### 扩展信息
- **tags**: `Array<string>` - 标签数组
  - 显示格式: 蓝色圆角小标签，`#e3f2fd` 背景，`#1976d2` 文字
- **notes**: `string` - 备注

## 数据示例

```javascript
{
  "id": "pdf_123456",
  "title": "JavaScript高级程序设计",
  "author": "Nicholas C. Zakas",
  "subject": "编程",
  "keywords": "JavaScript, 前端开发",
  "file_size": 5242880,  // 5MB
  "page_count": 800,
  "created_time": "2024-01-15 10:30:00",
  "modified_time": "2024-02-20 15:45:00",
  "last_accessed_at": 1708502400,  // 2024-02-21 16:00:00
  "rating": 5,
  "review_count": 3,
  "total_reading_time": 7200,  // 2小时
  "due_date": 1709222400,  // 2024-02-29
  "tags": ["JavaScript", "前端", "必读"],
  "notes": "重点章节：第6章、第13章"
}
```

## UI设计考虑

### 主要显示字段（优先级高）
1. **title** - 标题（最重要，大号字体）
2. **tags** - 标签（快速识别分类）
3. **author** - 作者
4. **page_count** - 页数
5. **file_size** - 文件大小
6. **last_accessed_at** - 最后访问时间

### 次要显示字段（优先级中）
7. **rating** - 评分
8. **review_count** - 复习次数
9. **notes** - 备注（摘要形式）

### 隐藏字段（可通过展开查看）
- subject
- keywords
- created_time
- modified_time
- total_reading_time
- due_date
