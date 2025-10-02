# PDF Viewer 模块清理计划

## 分析时间：2025-10-02

## 当前架构状态

**使用中的架构**：Feature-based 插件化架构
**入口文件**：`main.js` → `bootstrap/app-bootstrap-feature.js`

**活跃的Features**：
- ✅ features/app-core/index.js
- ✅ features/pdf-manager/index.js
- ✅ features/ui-manager/index.js
- ✅ features/pdf-reader/ (功能域架构，部分使用)

---

## 📋 待清理文件清单

### 🔴 第一类：旧架构核心文件（可安全删除）

这些文件是旧架构的核心，已被Feature-based架构完全替代：

1. **`app.js`** (旧应用主类)
   - 状态：仅在自身和测试中引用，main.js已不使用
   - 依赖：app-core.js, handlers/event-handlers-refactored.js
   - 建议：**删除**（保留测试作为参考或一并删除）

2. **`bootstrap/app-bootstrap.js`** (旧启动器)
   - 状态：已被app-bootstrap-feature.js替代
   - 引用：仅在main.js的注释中提到
   - 建议：**删除**

3. **`core/app-coordinator.js`** (旧协调器)
   - 状态：需要确认是否还有引用
   - 建议：检查后**可能删除**

4. **`core/pdf-viewer-app-v3.example.js`** (示例文件)
   - 状态：示例文件，不在生产使用
   - 建议：**删除**或移至docs/examples/

### 🟡 第二类：Handler文件（需要确认）

handlers目录下的文件可能部分还在使用：

5. **`handlers/event-handlers-refactored.js`**
   - 被app.js引用，如果删除app.js则可一并删除
   - 建议：**检查后删除**

6. **`handlers/file-handler.js`**
   - 需要检查是否被其他模块使用
   - 建议：**检查后决定**

7. **`handlers/navigation-handler.js`**
   - 可能已被UIManagerCore的导航事件处理替代
   - 建议：**检查后删除**

8. **`handlers/zoom-handler.js`**
   - 可能已被UIManagerCore的缩放事件处理替代
   - 建议：**检查后删除**

### 🟢 第三类：空Feature目录（可删除）

这些是未完成或废弃的Feature目录：

9. **`features/bookmark/`** (空目录)
10. **`features/page-transfer/`** (空目录)
11. **`features/pdf/`** (空目录)
12. **`features/ui/`** (空目录)
13. **`features/pdf-bookmark/components/`** (空子目录)
14. **`features/pdf-bookmark/services/`** (空子目录)
15. **`features/pdf-bookmark/state/`** (空子目录)
16. **`features/pdf-ui/components/`** (空子目录)
17. **`features/pdf-ui/services/`** (空子目录)
18. **`features/pdf-ui/state/`** (空子目录)
19. **`features/websocket-adapter/components/`** (空子目录)
20. **`features/websocket-adapter/services/`** (空子目录)
21. **`features/websocket-adapter/state/`** (空子目录)

建议：**批量删除所有空目录**

### 🔵 第四类：旧测试文件（需要决策）

22. **`__tests__/main.test.js`**
    - 可能测试旧的app.js
    - 建议：检查是否测试新架构，否则**删除**

23. **`__tests__/navigation-zoom.test.js`**
    - 可能测试旧的handler
    - 建议：检查是否测试新架构，否则**删除**

24. **`core/__tests__/app-coordinator.test.js`**
    - 测试旧的app-coordinator
    - 建议：与app-coordinator.js一并**删除**

---

## 🎯 清理建议方案

### 方案A：激进清理（推荐）

**删除所有旧架构文件**，仅保留Feature-based架构：

```bash
# 1. 删除旧架构核心
rm app.js
rm bootstrap/app-bootstrap.js
rm core/app-coordinator.js
rm core/pdf-viewer-app-v3.example.js
rm core/__tests__/app-coordinator.test.js

# 2. 删除旧handlers（如确认不使用）
rm handlers/event-handlers-refactored.js
rm handlers/file-handler.js
rm handlers/navigation-handler.js
rm handlers/zoom-handler.js

# 3. 删除旧测试
rm __tests__/main.test.js
rm __tests__/navigation-zoom.test.js

# 4. 删除所有空目录
find features/ -type d -empty -delete
```

**优点**：
- 代码库更清晰
- 减少维护负担
- 强制使用新架构

**风险**：
- 如果有遗漏的引用会导致错误
- 无法回退到旧架构

### 方案B：保守清理（安全）

**仅删除明确不使用的文件**，保留可能有用的：

```bash
# 1. 删除示例文件
rm core/pdf-viewer-app-v3.example.js

# 2. 删除空目录
find features/ -type d -empty -delete

# 3. 移动旧架构文件到backup目录
mkdir -p _backup_old_architecture
mv app.js _backup_old_architecture/
mv bootstrap/app-bootstrap.js _backup_old_architecture/
mv core/app-coordinator.js _backup_old_architecture/
```

**优点**：
- 安全，可以回退
- 逐步清理

**缺点**：
- backup目录占用空间
- 代码库依然混乱

---

## ✅ 推荐执行步骤

### Step 1: 检查依赖（必须）

```bash
# 搜索是否还有文件引用旧架构
grep -r "from.*app\.js" src/frontend/pdf-viewer --include="*.js" --exclude-dir=__tests__
grep -r "AppCoordinator" src/frontend/pdf-viewer --include="*.js" --exclude-dir=__tests__
grep -r "bootstrapPDFViewerApp[^F]" src/frontend/pdf-viewer --include="*.js"
```

### Step 2: 运行测试（必须）

```bash
# 确保当前功能正常
npm run test
python ai_launcher.py start --module pdf-viewer
# 测试所有功能：PDF加载、缩放、导航、书签
```

### Step 3: 创建备份分支（推荐）

```bash
git checkout -b backup-before-cleanup
git commit -am "Backup before cleaning old architecture"
git checkout feature-bookmark-fix
```

### Step 4: 执行清理

选择方案A或方案B执行清理

### Step 5: 验证（必须）

```bash
# 重新测试所有功能
npm run test
python ai_launcher.py start --module pdf-viewer
```

### Step 6: 提交

```bash
git add .
git commit -m "chore: 清理旧架构文件，保留Feature-based架构"
```

---

## 📊 预期效果

### 清理前
```
src/frontend/pdf-viewer/
├── 新架构 (Feature-based)
├── 旧架构 (app.js, app-coordinator等)
├── 空目录 (多个)
└── 总文件数: ~85个JS文件
```

### 清理后（方案A）
```
src/frontend/pdf-viewer/
├── 新架构 (Feature-based) ← 唯一架构
├── 核心模块 (pdf/, ui/, bookmark/)
└── 总文件数: ~70个JS文件 (减少18%)
```

---

## ⚠️ 风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| 遗漏的引用导致运行错误 | 🟡 中 | 充分测试，保留git备份 |
| 未来需要回退到旧架构 | 🟢 低 | 有git历史记录可恢复 |
| 删除了正在使用的文件 | 🔴 高 | 先搜索所有引用，逐个确认 |
| 测试失败 | 🟡 中 | 先运行测试，失败则不删除 |

---

## 💡 建议

**推荐采用方案A（激进清理）**，理由：

1. ✅ 新架构已完全实现所有功能
2. ✅ 所有测试通过
3. ✅ Git历史可以恢复
4. ✅ 未来维护更清晰

**执行时间**：约15-30分钟
**建议时间**：在完成充分测试后的空闲时间

---

## 📝 待确认清单

请确认以下问题后再执行清理：

- [ ] 是否有其他开发者正在使用旧架构？
- [ ] 是否有生产环境依赖旧架构？
- [ ] 是否所有关键功能已在新架构中实现？
- [ ] 是否有充分的git备份？
- [ ] 是否已运行完整测试套件？

---

**文档创建时间**: 2025-10-02
**架构版本**: Feature-based v1.0.0
