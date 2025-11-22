# Context 归档索引

本目录存储历史的 context 记录，**不加载到 AI 上下文中**，仅供查阅和追溯。

---

## 📁 归档文件

### 2025 年

#### 11 月
- 📄 第1周（11-01 ~ 11-07）：[context-2025-11-week1.md](2025-11/context-2025-11-week1.md)
  - 大纲首次导入修复
  - ESLint全量治理
  - Toast问题排查与修复
  - No-op错误处理模式分析

- 📄 第2周（11-08 ~ 11-14）：[context-2025-11-week2.md](2025-11/context-2025-11-week2.md)
  - MsgCenter严格转发策略
  - 测试策略调整（放弃Playwright）
  - GUI模块化（workers.py）
  - WebSocket客户端身份系统

#### 10 月
- 📄 全月记录：[context-2025-10.md](2025-10/context-2025-10.md)
  - GUI启动器拆分
  - 端口管理策略
  - WebSocket连接问题诊断
  - 阅读历史模块设计

---

## 🔍 如何查找历史记录

### 方法一：按日期查找
1. 确定你需要查找的日期范围
2. 打开对应的归档文件
3. 使用编辑器的搜索功能（Ctrl+F）查找关键词

### 方法二：使用 Git 历史
```bash
# 查看 context.md 的完整历史
git log -p -- .kilocode/rules/memory-bank/context.md

# 查看特定时间段的变更
git log --since="2025-10-01" --until="2025-10-31" -- .kilocode/rules/memory-bank/context.md

# 搜索包含特定关键词的提交
git log --all --grep="Outline" -- .kilocode/rules/memory-bank/context.md
```

### 方法三：全文搜索
```bash
# Windows PowerShell
Get-ChildItem -Path docs/context-archive -Recurse -Filter *.md | Select-String "关键词"

# Linux/Mac/Git Bash
grep -r "关键词" docs/context-archive/
```

---

## 📋 归档内容说明

每个归档文件包含以下类型的记录：

### 1. 问题修复记录
- 现象描述
- 根因分析
- 修复方案
- 防回归测试

### 2. 架构变更记录
- 变更背景
- 实施方案
- 影响范围
- 迁移指南

### 3. 技术决策记录
- 决策背景
- 备选方案
- 选择理由
- 后续影响

### 4. 配置变更记录
- 变更项
- 变更原因
- 新旧对比
- 回滚方案

---

## 🗂️ 归档维护规则

### 每周维护（周日）
1. 将 7 天前的变更记录从 `context.md` 移入对应周归档文件
2. 更新本 README 的归档索引
3. 确保 `context.md` 行数 < 200

### 每月维护（月末）
1. 检查当月归档文件是否需要合并
2. 更新归档索引，添加关键主题标签
3. 清理过时的临时记录

### 归档格式要求
- 文件编码：UTF-8
- 换行符：`\n`
- 命名规范：`context-YYYY-MM-weekN.md` 或 `context-YYYY-MM.md`
- 每条记录必须包含日期标题（`### YYYY-MM-DD`）

---

## 📊 归档统计

| 时期 | 文件数 | 主要内容 |
|------|--------|----------|
| 2025-11 | 2 | MsgCenter转发、测试策略、GUI模块化 |
| 2025-10 | 1 | 启动器重构、端口管理、WS诊断 |

**最后更新**：2025-11-14
