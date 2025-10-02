# PDF-Viewer 架构重构 - 协作开发详细指南

**所属规格**: 20251002040217-pdf-viewer-architecture-refactoring
**版本**: v002-appendix
**创建时间**: 2025-10-02 12:32:17
**文档类型**: 附录 - 协作开发指南

---

## 文档说明

本文档是 `v002-spec.md` 的附录，详细说明 4 人小团队协作开发的具体规范和流程。

**适用场景**: 2-4 人同时开发 PDF-Viewer 模块的不同功能

---

## 模块所有权制度

### 所有权分配示例

```
features/pdf/           → 开发者 A (PDF 功能负责人)
features/ui/            → 开发者 B (UI 功能负责人)
features/bookmark/      → 开发者 C (书签功能负责人)
features/page-transfer/ → 开发者 D (页面传输负责人)

core/                   → 核心团队共同维护（需要团队评审）
adapters/               → 核心团队共同维护（需要团队评审）
common/                 → 禁止修改（由上级模块维护）
```

### 所有权规则

#### 规则1: 模块内部完全自主
- ✅ 可以自由修改自己负责的 feature 内部代码
- ✅ 可以添加新文件、重构内部结构
- ✅ 可以修改内部私有接口
- ⚠️ 修改前必须确保测试覆盖率 ≥ 80%

#### 规则2: 公共接口需要通知
- ⚠️ 修改 feature 的公共接口（index.js 导出的内容）需要提前通知团队
- ⚠️ 修改事件发射的数据格式需要团队评审
- ⚠️ 添加新的公共接口需要更新类型定义

#### 规则3: 核心模块需要评审
- ❌ 修改 core/ 和 adapters/ 需要至少 1 人 review
- ❌ 修改 common/ 目录需要向上级模块提交 PR
- ❌ 修改事件常量定义需要团队讨论

#### 规则4: 跨模块修改需要协调
- ❌ 如果你的功能需要另一个 feature 提供新接口，先与负责人沟通
- ✅ 优先考虑通过事件通信解决
- ✅ 如果必须修改其他 feature，提交 PR 给对应负责人评审

---

## 接口稳定性保证

### 公共接口定义

每个 feature 必须有 `index.js` 作为唯一导出入口：

```javascript
// features/pdf/index.js

/**
 * PDF 模块公共接口
 * @module features/pdf
 */

export { PDFManager } from './manager.js';
export { PDFLoader } from './loader.js';

// 内部实现不导出（私有）
// import { PDFDocumentManager } from './document-manager.js';  // 私有
```

### 接口变更流程

#### 1. 提前通知（至少 1 天）
```markdown
## 接口变更通知

**模块**: features/pdf
**负责人**: 开发者 A
**变更类型**: 修改公共接口
**影响范围**: features/ui 可能受影响

### 变更内容
- PDFManager.loadPDF() 增加第二个参数 `options`
  - 旧签名: `loadPDF(filePath)`
  - 新签名: `loadPDF(filePath, options = {})`

### 兼容性
- ✅ 向后兼容（options 有默认值）
- 预计完成时间: 2025-10-05

### 需要其他模块配合
- 无

请相关开发者确认是否有问题。
```

#### 2. 更新类型定义
```typescript
// types/pdf.d.ts

export interface PDFLoadOptions {
  initialPage?: number;
  zoom?: number;
}

export interface IPDFManager {
  // 旧版本（标记为废弃，但保留）
  /** @deprecated Use loadPDF(filePath, options) instead */
  loadPDF(filePath: string): Promise<PDFDocumentProxy>;

  // 新版本
  loadPDF(filePath: string, options?: PDFLoadOptions): Promise<PDFDocumentProxy>;
}
```

#### 3. 更新文档
```markdown
# CHANGELOG.md

## [Unreleased]

### Changed
- `PDFManager.loadPDF()` 增加可选参数 `options`
  - 支持设置初始页码和缩放级别
  - 向后兼容：options 参数可选
```

### 接口版本控制（如果需要）

对于复杂的接口变更，可以使用版本化命名：

```javascript
// features/pdf/manager.js

export class PDFManager {
  // V1: 旧接口（保留一段时间）
  loadPDF(filePath) {
    console.warn('loadPDF(filePath) is deprecated, use loadPDFV2(filePath, options)');
    return this.loadPDFV2(filePath, {});
  }

  // V2: 新接口
  loadPDFV2(filePath, options = {}) {
    // 新实现
  }
}
```

---

## 事件契约机制

### 事件定义集中管理

所有事件定义必须在 `common/event/constants.js` 中：

```javascript
// common/event/constants.js

/**
 * PDF 相关事件
 * @namespace PDF_EVENTS
 */
export const PDF_EVENTS = {
  FILE: {
    LOAD: {
      /** @event pdf:file:load:requested */
      REQUESTED: 'pdf:file:load:requested',
      /** @event pdf:file:loaded */
      LOADED: 'pdf:file:loaded',
      /** @event pdf:file:load:failed */
      FAILED: 'pdf:file:load:failed',
    }
  },
  PAGE: {
    /** @event pdf:page:changed */
    CHANGED: 'pdf:page:changed',
    /** @event pdf:page:navigate */
    NAVIGATE: 'pdf:page:navigate',
  }
};
```

### 事件数据格式文档化

使用 TypeScript 定义事件数据格式：

```typescript
// types/events.d.ts

/**
 * PDF 文件加载请求事件数据
 * @event pdf:file:load:requested
 */
export interface PDFLoadRequestData {
  /** 文件路径 */
  filePath: string;
  /** 初始页码（可选，默认为 1） */
  initialPage?: number;
  /** 缩放级别（可选，默认为 1.0） */
  zoom?: number;
}

/**
 * PDF 文件加载成功事件数据
 * @event pdf:file:loaded
 */
export interface PDFLoadedData {
  /** PDF 文档对象 */
  document: PDFDocumentProxy;
  /** 文件路径 */
  filePath: string;
  /** 总页数 */
  totalPages: number;
  /** 文件元数据（可选） */
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    creationDate?: string;
    modDate?: string;
  };
}

/**
 * PDF 文件加载失败事件数据
 * @event pdf:file:load:failed
 */
export interface PDFLoadFailedData {
  /** 文件路径 */
  filePath: string;
  /** 错误对象 */
  error: Error;
  /** 错误消息 */
  message: string;
}
```

### 事件发射和监听注释规范

在代码中必须注释事件的发射点和监听点：

```javascript
// features/pdf/manager.js

export class PDFManager {
  async loadPDF(filePath, options = {}) {
    try {
      const doc = await this.loader.load(filePath);

      // 📤 发射事件: pdf:file:loaded
      // 数据格式: PDFLoadedData
      // 监听者: features/ui (更新UI), adapters/websocket-adapter (通知后端)
      this.eventBus.emit(PDF_EVENTS.FILE.LOADED, {
        document: doc,
        filePath,
        totalPages: doc.numPages,
        metadata: await doc.getMetadata(),
      });

    } catch (error) {
      // 📤 发射事件: pdf:file:load:failed
      // 数据格式: PDFLoadFailedData
      // 监听者: features/ui (显示错误)
      this.eventBus.emit(PDF_EVENTS.FILE.FAILED, {
        filePath,
        error,
        message: error.message,
      });
    }
  }
}
```

```javascript
// features/ui/manager.js

export class UIManager {
  initialize() {
    // 📥 监听事件: pdf:file:loaded
    // 数据格式: PDFLoadedData
    // 发射者: features/pdf
    // 作用: 更新页码显示、隐藏加载动画
    this.eventBus.on(PDF_EVENTS.FILE.LOADED, this.handlePDFLoaded);
  }

  handlePDFLoaded = ({ document, totalPages }) => {
    this.updatePageCount(totalPages);
    this.hideLoadingSpinner();
  }
}
```

### 事件修改评审流程

#### 修改现有事件数据格式
1. **提交 Issue**: 说明修改原因和影响范围
2. **团队讨论**: 所有可能受影响的开发者参与讨论
3. **更新类型定义**: 修改 types/events.d.ts
4. **更新所有发射点**: 确保数据格式符合新定义
5. **更新所有监听点**: 确保能正确处理新数据格式
6. **更新文档**: 在 CHANGELOG 中记录

#### 添加新事件
1. **添加事件常量**: 在 common/event/constants.js 中添加
2. **添加类型定义**: 在 types/events.d.ts 中定义数据格式
3. **添加注释**: 在发射点和监听点添加注释
4. **更新文档**: 在 README 中更新事件列表

---

## 并行开发约束

### Git 分支策略

#### 主分支保护
```
main (受保护)
  ├── feature/pdf-optimization (开发者 A)
  ├── feature/ui-enhancement (开发者 B)
  ├── feature/bookmark-sidebar (开发者 C)
  └── feature/page-transfer-fix (开发者 D)
```

#### 分支命名规范
- **功能分支**: `feature/{feature-name}-{description}`
  - 示例: `feature/pdf-lazy-loading`
- **修复分支**: `fix/{feature-name}-{description}`
  - 示例: `fix/ui-zoom-button-not-working`
- **核心模块修改**: `core/{description}`
  - 示例: `core/refactor-coordinator`

#### 分支生命周期
1. 从 main 创建分支
2. 开发并本地测试
3. 提交 PR
4. Code Review 通过
5. 合并到 main
6. 删除分支

### 修改共享代码的流程

#### 场景1: 修改 core/ 或 adapters/
```bash
# 1. 先同步主分支
git checkout main
git pull origin main

# 2. 创建核心模块分支
git checkout -b core/add-new-coordinator-method

# 3. 修改代码
# 修改 core/coordinator.js

# 4. 运行测试
npm run test
npm run check:deps

# 5. 提交 PR
git push origin core/add-new-coordinator-method

# 6. 通知团队评审（至少 1 人 approve）

# 7. 合并后通知团队
# 发送消息: "core/coordinator.js 已更新，请同步主分支"
```

#### 场景2: 修改 common/event/constants.js（添加新事件）
```bash
# 1. 创建分支
git checkout -b feature/pdf-add-bookmark-event

# 2. 修改 common/event/constants.js
# 添加新事件常量

# 3. 修改 types/events.d.ts
# 添加类型定义

# 4. 更新文档
# 更新 README.md 事件列表

# 5. 提交 PR 并通知团队

# 6. 合并后其他开发者同步
```

### 避免冲突的最佳实践

#### 实践1: 小步提交，频繁同步
```bash
# 每天开始工作前同步主分支
git checkout main
git pull origin main
git checkout feature/my-feature
git rebase main

# 遇到冲突立即解决，不要累积
```

#### 实践2: 功能独立，减少交集
```
# 好的实践（各自独立）
feature/pdf-add-cache          # 只修改 features/pdf/cache-manager.js
feature/ui-add-toolbar         # 只修改 features/ui/components/toolbar.js

# 不好的实践（可能冲突）
feature/pdf-refactor-manager   # 修改 features/pdf/manager.js
feature/ui-call-pdf-manager    # 也修改 features/pdf/manager.js（跨模块修改）
```

#### 实践3: 提前沟通，协调工作
```markdown
# 每周一团队同步会议
- 开发者 A: 本周计划重构 PDFManager，可能影响 PDF 模块的公共接口
- 开发者 B: 本周需要 PDFManager 提供新的 getMetadata() 方法
- 协调结果: 开发者 A 先完成重构，开发者 B 基于新接口开发
```

---

## Code Review 检查点

### PR 提交前自检清单

提交 PR 前必须确认以下检查点：

```markdown
## PR 自检清单

### 代码质量
- [ ] ESLint 检查通过 (`npm run lint`)
- [ ] 所有测试通过 (`npm run test`)
- [ ] 测试覆盖率 ≥ 80% (`npm run test:coverage`)
- [ ] 依赖检查通过 (`npm run check:deps`)

### 文档和注释
- [ ] 新增的公共接口有 JSDoc 注释
- [ ] 新增的事件有发射点和监听点注释
- [ ] 类型定义已更新（如果修改了接口）
- [ ] CHANGELOG 已更新（如果有破坏性变更）

### 代码规范
- [ ] 文件命名符合规范 (kebab-case.js)
- [ ] 类命名符合规范 (PascalCase)
- [ ] 函数命名符合规范 (camelCase)
- [ ] 没有超过 200 行的文件
- [ ] 没有超过 50 行的函数

### 分层规则
- [ ] 没有违反依赖规则（见依赖检查结果）
- [ ] 没有 feature 间直接依赖（必须通过事件）
- [ ] 没有下层依赖上层的情况

### 影响范围
- [ ] 如果修改了公共接口，已通知相关开发者
- [ ] 如果修改了事件定义，已通知监听者
- [ ] 如果修改了 core/ 或 adapters/，已通过团队评审
```

### Reviewer 检查清单

评审者必须检查以下内容：

```markdown
## Code Review 检查清单

### 架构设计
- [ ] 是否符合分层架构原则？
- [ ] 是否违反依赖规则？
- [ ] 模块职责是否清晰？
- [ ] 是否有不必要的抽象或过度设计？

### 代码质量
- [ ] 代码逻辑是否清晰易懂？
- [ ] 是否有明显的性能问题？
- [ ] 错误处理是否完善？
- [ ] 是否有潜在的内存泄漏？

### 测试覆盖
- [ ] 关键逻辑是否有单元测试？
- [ ] 边界情况是否测试？
- [ ] Mock 是否合理？

### 文档和注释
- [ ] 复杂逻辑是否有注释？
- [ ] 公共接口是否有 JSDoc？
- [ ] 事件发射/监听是否有注释？

### 兼容性
- [ ] 是否有破坏性变更？
- [ ] 如果有，是否提前通知？
- [ ] 迁移指南是否清晰？

### 安全和规范
- [ ] 是否有 SQL 注入、XSS 等安全问题？
- [ ] 是否符合代码规范？
- [ ] 是否有硬编码的敏感信息？
```

### Review 意见类型

```markdown
## Review 意见标签

### 🔴 Blocker（必须修改才能合并）
- 存在严重 bug
- 违反分层规则
- 测试覆盖率不达标
- 破坏现有功能

### 🟠 Major（强烈建议修改）
- 代码逻辑复杂，可读性差
- 性能问题
- 错误处理不完善
- 缺少必要的注释

### 🟡 Minor（建议修改，可选）
- 命名不够清晰
- 可以进一步优化
- 注释可以更详细

### 🟢 Nit（吹毛求疵，完全可选）
- 代码格式问题（应该由 ESLint 处理）
- 个人偏好的写法
```

### Review 示例

```markdown
## Code Review for PR #123: 优化 PDF 加载性能

### 🔴 Blocker
1. **文件**: features/pdf/loader.js:45
   **问题**: 没有处理加载失败的情况，会导致 Promise rejection 未捕获
   **建议**: 添加 try-catch 或 .catch() 处理
   ```javascript
   // 当前代码
   const doc = await pdfjs.getDocument(url).promise;

   // 建议修改
   try {
     const doc = await pdfjs.getDocument(url).promise;
   } catch (error) {
     this.eventBus.emit(PDF_EVENTS.FILE.FAILED, { error });
     throw error;
   }
   ```

### 🟠 Major
2. **文件**: features/pdf/cache-manager.js:78
   **问题**: 缓存没有大小限制，可能导致内存占用过高
   **建议**: 实现 LRU 缓存策略，限制缓存大小

### 🟡 Minor
3. **文件**: features/pdf/manager.js:120
   **问题**: 函数名 `doLoad` 不够清晰
   **建议**: 改为 `loadPDFDocument`

### ✅ 优点
- 性能优化效果明显，加载时间减少 30%
- 代码结构清晰，易于理解
- 测试覆盖率达到 85%

### 总体评价
需要修复 1 个 Blocker 问题后可以合并。
```

---

## 冲突解决流程

### 冲突类型和优先级

#### 类型1: 核心模块冲突（core/, adapters/）
**优先级**: 最高

**解决流程**:
1. 停止工作，立即与团队沟通
2. 评估冲突影响范围
3. 团队讨论解决方案（必要时开会）
4. 达成一致后，由一人负责解决冲突并提交
5. 其他人基于解决后的代码继续工作

**示例**:
```
冲突: 两人同时修改 core/coordinator.js
解决:
1. 开发者 A 和 B 同步代码
2. 讨论各自的修改目的
3. 决定先合并 A 的修改（优先级更高）
4. B 基于 A 的修改重新实现自己的功能
```

#### 类型2: Feature 冲突（同一个 feature）
**优先级**: 高

**解决流程**:
1. 检查是否真的冲突（可能只是 Git 标记的冲突，实际不冲突）
2. 如果是真冲突，与 feature 负责人沟通
3. 按时间戳优先（先提交的优先）或功能优先（P0 > P1 > P2）
4. 后提交者 rebase 并解决冲突

**示例**:
```
冲突: 两人修改 features/pdf/manager.js 的不同方法
解决:
1. 先合并先提交的 PR
2. 后提交者 rebase main 分支
3. 手动解决冲突（通常很简单）
```

#### 类型3: 事件定义冲突
**优先级**: 中

**解决流程**:
1. 检查是否添加了相同的事件名（如果是，必须讨论）
2. 检查是否修改了相同事件的数据格式（如果是，必须讨论）
3. 团队评审，达成一致
4. 更新类型定义和文档

**示例**:
```
冲突: 两人都添加了 PDF_EVENTS.FILE.OPENED
解决:
1. 讨论两者的区别
2. 决定使用更通用的命名
3. 更新类型定义
4. 通知所有人
```

#### 类型4: 测试文件冲突
**优先级**: 低

**解决流程**:
1. 保留双方的测试用例（通常可以共存）
2. 如果测试相同功能，选择更完善的测试
3. 删除重复的测试

### 冲突解决示例

#### 示例1: 两人修改同一个文件

```bash
# 开发者 B 的操作

# 1. 尝试合并时发现冲突
git checkout main
git pull origin main
git checkout feature/ui-enhancement
git rebase main

# 冲突提示
CONFLICT (content): Merge conflict in features/pdf/manager.js

# 2. 查看冲突内容
git diff features/pdf/manager.js

# 3. 手动解决冲突
# 打开 features/pdf/manager.js

<<<<<<< HEAD (当前分支)
async loadPDF(filePath, options = {}) {
  // 开发者 B 的实现
  const cache = this.checkCache(filePath);
  if (cache) return cache;
  // ...
}
=======
async loadPDF(filePath) {
  // 开发者 A 的实现（已合并到 main）
  this.logger.info(`Loading PDF: ${filePath}`);
  // ...
}
>>>>>>> main

# 4. 合并两者的修改
async loadPDF(filePath, options = {}) {
  // 保留 A 的日志
  this.logger.info(`Loading PDF: ${filePath}`);

  // 保留 B 的缓存检查
  const cache = this.checkCache(filePath);
  if (cache) return cache;

  // ...
}

# 5. 标记冲突已解决
git add features/pdf/manager.js
git rebase --continue

# 6. 运行测试确保没问题
npm run test

# 7. 推送
git push origin feature/ui-enhancement --force
```

#### 示例2: 事件定义冲突

```javascript
// 开发者 A 添加
export const PDF_EVENTS = {
  FILE: {
    OPENED: 'pdf:file:opened',  // A 添加
  }
};

// 开发者 B 添加
export const PDF_EVENTS = {
  FILE: {
    OPENED: 'pdf:file:open:completed',  // B 添加（名称不同）
  }
};

// 解决方案：团队讨论后统一命名
export const PDF_EVENTS = {
  FILE: {
    LOAD: {
      COMPLETED: 'pdf:file:load:completed',  // 统一使用 LOAD.COMPLETED
    }
  }
};
```

---

## 团队协作最佳实践

### 每日站会（可选）

如果团队同时开发，建议每天简短同步：

```markdown
## 每日站会模板（5-10分钟）

### 开发者 A
- **昨天**: 完成 PDF 缓存功能
- **今天**: 优化 PDF 加载性能
- **阻塞**: 需要 UI 团队提供加载进度条接口

### 开发者 B
- **昨天**: 设计新的工具栏 UI
- **今天**: 实现工具栏组件，提供进度条接口给 PDF 团队
- **阻塞**: 无

### 开发者 C
- **昨天**: 修复书签侧边栏 bug
- **今天**: 添加书签导出功能
- **阻塞**: 无

### 开发者 D
- **昨天**: 调研页面传输方案
- **今天**: 实现页面传输协议
- **阻塞**: 无

### 协调事项
- A 和 B 今天需要协调进度条接口
- 本周五合并所有分支到 main
```

### 使用 GitHub Issues 跟踪任务

```markdown
## Issue 模板: 功能开发

### 功能描述
添加 PDF 懒加载功能，优化大文件加载性能

### 负责人
@developer-A

### 相关模块
- features/pdf

### 依赖
- 无

### 预计完成
2025-10-10

### 检查清单
- [ ] 设计方案
- [ ] 实现功能
- [ ] 编写测试
- [ ] 更新文档
- [ ] Code Review

### 进度更新
- 2025-10-05: 方案设计完成
- 2025-10-07: 功能实现 50%
- 2025-10-09: 功能实现完成，等待 Review
```

### 使用项目看板管理进度

```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│   To Do     │ In Progress │   Review    │    Done     │
├─────────────┼─────────────┼─────────────┼─────────────┤
│ 书签导出    │ PDF懒加载   │ 工具栏UI    │ PDF缓存     │
│ 页面传输    │             │             │ 性能优化    │
│             │             │             │             │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

---

## CI/CD 集成

### 自动化检查配置

```yaml
# .github/workflows/pr-check.yml

name: PR Check

on:
  pull_request:
    branches: [main]

jobs:
  quality-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '16'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Run Tests
        run: npm run test

      - name: Check Test Coverage
        run: npm run test:coverage
        # 覆盖率必须 >= 80%

      - name: Check Dependencies
        run: npm run check:deps
        # 依赖规则检查

      - name: Type Check (optional)
        run: npx tsc --noEmit
        # 类型检查（如果使用 TypeScript）

  review-required:
    runs-on: ubuntu-latest
    steps:
      - name: Check if core files changed
        id: core_check
        run: |
          FILES_CHANGED=$(git diff --name-only origin/main...HEAD)
          if echo "$FILES_CHANGED" | grep -q "^src/frontend/pdf-viewer/core/"; then
            echo "::set-output name=needs_review::true"
          else
            echo "::set-output name=needs_review::false"
          fi

      - name: Require Review for Core Changes
        if: steps.core_check.outputs.needs_review == 'true'
        run: |
          echo "This PR modifies core/ files and requires at least 1 review"
          # 实际实现可以使用 GitHub API 强制要求 review
```

### PR 合并要求

```markdown
## PR 合并规则

### 必须满足的条件
- ✅ 所有 CI 检查通过
- ✅ 测试覆盖率 ≥ 80%
- ✅ 依赖检查无错误
- ✅ ESLint 无错误
- ✅ 至少 0 个 approve（如果只修改自己的 feature）
- ✅ 至少 1 个 approve（如果修改 core/ 或 adapters/）

### 可选的条件
- 建议等待 CI 运行完成再合并
- 建议在工作时间合并（出问题可以立即修复）
```

---

## 总结

### 核心原则回顾

1. **模块所有权明确**: 每个 feature 有明确的负责人
2. **接口稳定优先**: 公共接口变更需要提前通知
3. **事件作为契约**: 事件定义集中管理，类型化
4. **自动化检查**: 依赖规则、测试覆盖率自动检查
5. **团队协作透明**: 提前沟通，及时同步

### 协作流程速查

```
开始工作
  ↓
同步主分支
  ↓
创建功能分支
  ↓
开发功能（只修改自己的 feature）
  ↓
需要修改共享代码？
  ├─ 是 → 提前通知团队 → 评审通过后修改
  └─ 否 → 继续开发
  ↓
完成开发
  ↓
本地自检（ESLint、测试、依赖检查）
  ↓
提交 PR
  ↓
CI 自动检查
  ↓
Code Review
  ↓
合并到 main
  ↓
通知团队同步
```

---

**文档版本**: v002-appendix-collaboration
**最后更新**: 2025-10-02 12:32:17
**维护者**: 核心团队
