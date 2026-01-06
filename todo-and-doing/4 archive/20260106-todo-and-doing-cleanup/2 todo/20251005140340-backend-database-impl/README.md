# 后端数据库系统实施 - 任务说明

## 📌 任务概述

实现基于 SQLite 的后端数据库系统，采用**插件隔离 + 事件总线**架构。

## 📂 文档结构

```
20251005140340-backend-database-impl/
├── README.md                            # 本文件（任务说明）
├── v001-phase1-abstraction-layer.md     # 数据库抽象层（800+ 行）
├── v001-phase2-plugin-system.md         # 插件隔离架构（1240 行）
├── v001-phase3-pdf-info.md              # PDFInfoTablePlugin（1535 行）
├── v001-phase3-pdf-annotation.md        # PDFAnnotationTablePlugin（1118 行）
├── v001-phase3-pdf-bookmark.md          # PDFBookmarkTablePlugin（750 行）
└── v001-phase3-search-condition.md      # SearchConditionTablePlugin（937 行）
```

**总计**: 6个需求文档，约 6380 行代码和文档

## 📖 核心文档

### v001-phase1 - 数据库抽象层
**文档**: [v001-phase1-abstraction-layer.md](./v001-phase1-abstraction-layer.md)

**第一期开发内容**：
- DatabaseConnectionManager（连接池管理）
- TransactionManager（事务管理）
- SQLExecutor（SQL 执行器）
- 异常定义（5种自定义异常）
- 单元测试要求（覆盖率 ≥90%）

### v001-phase2 - 插件隔离架构
**文档**: [v001-phase2-plugin-system.md](./v001-phase2-plugin-system.md)

**第二期开发内容**：
- TablePlugin 抽象基类（15个方法）
- EventBus 事件总线（三段式命名验证）
- TablePluginRegistry 插件注册中心
- 标准化 CRUD 接口
- 事件命名规范（15种标准事件）

### v001-phase3 - PDFInfoTablePlugin
**文档**: [v001-phase3-pdf-info.md](./v001-phase3-pdf-info.md)

**第三期开发内容**（可并行）：
- PDF 基本信息管理（核心表，无依赖）
- 10个扩展方法（搜索、过滤、标签管理、统计）
- 30+ 测试用例

### v001-phase3 - PDFAnnotationTablePlugin
**文档**: [v001-phase3-pdf-annotation.md](./v001-phase3-pdf-annotation.md)

**第三期开发内容**（可并行）：
- PDF 标注管理（依赖 pdf_info）
- 3种标注类型（screenshot/text-highlight/comment）
- 评论系统支持
- 41+ 测试用例

### v001-phase3 - PDFBookmarkTablePlugin
**文档**: [v001-phase3-pdf-bookmark.md](./v001-phase3-pdf-bookmark.md)

**第三期开发内容**（可并行）：
- PDF 书签管理（依赖 pdf_info）
- 递归子书签结构（无限层级）
- 2种书签类型（page/region）
- 37+ 测试用例

### v001-phase3 - SearchConditionTablePlugin
**文档**: [v001-phase3-search-condition.md](./v001-phase3-search-condition.md)

**第三期开发内容**（可并行）：
- 搜索条件和排序配置管理（无依赖）
- 3种搜索类型（fuzzy/field/composite）
- 4种排序模式（与前端 pdf-sorter 对齐）
- 54+ 测试用例

## 🗓️ 开发计划

### 第一期：数据库抽象层（2天）
- [ ] DatabaseConnectionManager - 连接池管理
- [ ] TransactionManager - 事务管理
- [ ] SQLExecutor - SQL 执行器
- [ ] 异常定义 - 5种自定义异常
- [ ] 单元测试（覆盖率 ≥90%）

### 第二期：插件隔离架构（3天）
- [ ] TablePlugin 基类 - 抽象类定义
- [ ] EventBus - 事件总线（三段式命名）
- [ ] TablePluginRegistry - 插件注册中心
- [ ] 接口规范文档
- [ ] 单元测试（覆盖率 ≥85%）

### 第三期：数据表实现（5天，**可4人并行**）

**开发者A**: PDFInfoTablePlugin
- [ ] 实现 PDFInfoTablePlugin 类
- [ ] 10个扩展方法（搜索、过滤、标签、统计）
- [ ] 30+ 单元测试

**开发者B**: PDFAnnotationTablePlugin
- [ ] 实现 PDFAnnotationTablePlugin 类
- [ ] 3种标注类型验证
- [ ] 评论系统实现
- [ ] 41+ 单元测试

**开发者C**: PDFBookmarkTablePlugin
- [ ] 实现 PDFBookmarkTablePlugin 类
- [ ] 递归书签树处理
- [ ] 10个扩展方法
- [ ] 37+ 单元测试

**开发者D**: SearchConditionTablePlugin
- [ ] 实现 SearchConditionTablePlugin 类
- [ ] 3种搜索类型验证
- [ ] 4种排序模式支持
- [ ] 54+ 单元测试

**集成测试**（所有开发者）
- [ ] 4个插件协同工作测试
- [ ] 依赖关系测试（annotation/bookmark → pdf_info）
- [ ] 事件总线通信测试

**总工期**: 10天（串行）或 **7天**（第三期4人并行）⚡

## 🎯 设计亮点

### 1. 架构一致性
- 与前端 Feature 架构完全对齐
- 插件隔离 + EventBus 模式
- 统一的生命周期管理

### 2. 并行开发友好
- 第三期可4人同时开发（互不阻塞）
- 标准化接口（所有插件遵循相同规范）
- 事件驱动解耦（插件间通过事件通信）

### 3. 测试驱动
- 第一期测试覆盖率 ≥90%
- 第二期、第三期 ≥85%
- 70+ 测试用例覆盖所有关键路径

### 4. 扩展性强
- 新增数据表只需继承 TablePlugin
- 实现 7 个抽象方法即可
- 自动集成到事件总线

## 📚 参考文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 数据库设计方案 | `AItemp/database-design-final-v2.md` | 表结构、字段、索引 |
| 前端架构说明 | `src/frontend/ARCHITECTURE-EXPLAINED.md` | 插件隔离架构 |
| 前端开发指南 | `src/frontend/HOW-TO-ADD-FEATURE.md` | Feature 开发流程 |

## 🚀 快速开始

1. **阅读需求文档**
   ```bash
   cat v001-spec.md
   ```

2. **创建开发分支**
   ```bash
   git checkout -b feature/backend-database-phase1
   ```

3. **开始第一期开发**
   - 创建 `src/backend/database/` 目录
   - 实现 `connection.py`
   - 实现 `transaction.py`
   - 实现 `executor.py`
   - 实现 `exceptions.py`
   - 编写单元测试

## 📊 进度跟踪

使用 GitHub Projects 或 Trello 看板跟踪进度：

- **列1**: 待办（Backlog）
- **列2**: 进行中（In Progress）
- **列3**: 测试中（Testing）
- **列4**: 已完成（Done）

## ✅ 验收标准

### 代码质量
- ✅ 所有代码有类型注解（Python 3.9+）
- ✅ 所有类和方法有 docstring
- ✅ 通过 pylint/flake8（评分 ≥8.0）
- ✅ 通过 mypy 类型检查

### 测试覆盖
- ✅ 单元测试覆盖率达标
- ✅ 集成测试通过
- ✅ 性能测试达标

### 文档完整性
- ✅ API 文档
- ✅ 使用示例
- ✅ 开发指南

## 🔗 相关链接

- [SQLite JSON 函数文档](https://www.sqlite.org/json1.html)
- [Python typing 文档](https://docs.python.org/3/library/typing.html)
- [pytest 文档](https://docs.pytest.org/)

---

**创建日期**: 2025-10-05
**文档版本**: v1.0
**负责人**: 后端开发团队
