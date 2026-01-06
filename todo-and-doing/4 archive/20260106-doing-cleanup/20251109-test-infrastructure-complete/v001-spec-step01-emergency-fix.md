# Phase 1: 应急止血措施

**阶段**: Phase 1
**预计工期**: 1-2天
**优先级**: 🔥 最高
**状态**: 🟡 进行中

---

## 📋 目标

**核心目标**: 立即阻止90%的低级错误，建立测试基线

**成功标准**:
- ✅ 所有测试变绿（`npm test` 0 failed）
- ✅ pre-commit hook运行正常
- ✅ 至少3个快照测试覆盖核心功能

---

## 🗺️ 任务清单

### 任务1: 修复所有失败的测试（优先级最高）

**目标**: 建立"绿色基线"，让测试套件可信

**当前问题**:
- `annotation-sidebar-ui.test.js`: 删除确认未触发
- 其他可能的失败测试（需要全量扫描）

**执行步骤**:

```bash
# 1. 全量运行测试，记录失败列表
npm test 2>&1 | tee test-baseline-$(date +%Y%m%d-%H%M%S).log

# 2. 分析失败原因
npm test -- annotation-sidebar-ui.test.js --verbose

# 3. 逐个修复（优先修功能相关的）
# 如果是测试写错 → 修测试
# 如果是功能真坏了 → 修功能
# 如果是依赖过时 → 重写测试

# 4. 验证全绿
npm test
```

**修复原则**:
1. **先看是功能问题还是测试问题**
   - 手动操作UI，如果功能正常 → 测试写错了
   - 手动操作UI，如果功能异常 → 功能需要修

2. **最小化修改**
   - 只修复让测试通过的最小代码
   - 不要借机重构（现在没有测试保护）

3. **每修一个，跑一次全量测试**
   - 确保修A没有破坏B

**示例：修复annotation-sidebar-ui.test.js**

```javascript
// 问题：expect(confirmSpy).toHaveBeenCalledTimes(1) 失败
// 原因分析：
// 1. 是否正确模拟了confirm？
// 2. 是否deleteBtn正确触发了click？
// 3. 是否confirm真的被调用了？

// 调试步骤：
test('emits delete event when delete button confirmed', () => {
  // 增加调试日志
  const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

  const deleteBtn = container.querySelector('[data-action="delete"]');
  console.log('deleteBtn found:', deleteBtn !== null);

  deleteBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  console.log('confirmSpy called:', confirmSpy.mock.calls.length);
  console.log('eventBus.emit called:', eventBus.emit.mock.calls);

  expect(confirmSpy).toHaveBeenCalledTimes(1);
});

// 根据日志输出，确定问题在哪里
```

**验收标准**:
- [ ] `npm test` 输出 "Tests: XXX passed, 0 failed"
- [ ] 测试失败率从当前值降到0%
- [ ] 记录修复日志到 `AItemp/20251109XXXXXX-AI-Working-log.md`

---

### 任务2: 建立pre-commit hook

**目标**: 提交前自动运行测试，防止破坏性提交

**执行步骤**:

```bash
# 1. 创建pre-commit hook脚本
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

echo "🔍 [Pre-commit] 运行提交前检查..."

# ESLint检查（严格模式）
echo "📝 [Pre-commit] ESLint检查..."
npm run lint -- --max-warnings=0
if [ $? -ne 0 ]; then
  echo "❌ [Pre-commit] ESLint检查失败，请修复后再提交"
  exit 1
fi

# 运行关键测试（快速反馈）
echo "🧪 [Pre-commit] 运行关键测试..."
npm run test:critical
if [ $? -ne 0 ]; then
  echo "❌ [Pre-commit] 测试失败，请修复后再提交"
  exit 1
fi

echo "✅ [Pre-commit] 所有检查通过，允许提交"
EOF

# 2. 赋予执行权限
chmod +x .git/hooks/pre-commit

# 3. 在package.json中定义test:critical
```

**package.json修改**:

```json
{
  "scripts": {
    "test": "jest",
    "test:critical": "jest --testPathPattern='(outline|annotation|anchor)' --bail --maxWorkers=2",
    "test:watch": "jest --watch",
    "lint": "eslint src --ext .js,.jsx,.ts,.tsx,.mjs,.cjs"
  }
}
```

**验证步骤**:

```bash
# 1. 故意破坏代码（引入ESLint错误）
echo "var unused = 1;" >> src/frontend/pdf-viewer/test-commit-hook.js

# 2. 尝试提交
git add .
git commit -m "test: 验证pre-commit hook"

# 3. 应该看到hook运行并阻止提交
# 预期输出: "❌ [Pre-commit] ESLint检查失败，请修复后再提交"

# 4. 删除测试文件
git reset HEAD src/frontend/pdf-viewer/test-commit-hook.js
rm src/frontend/pdf-viewer/test-commit-hook.js
```

**验收标准**:
- [ ] pre-commit hook文件存在且可执行
- [ ] 破坏代码后提交被阻止
- [ ] 正常代码可以正常提交
- [ ] hook运行时间 < 30秒（快速反馈）

---

### 任务3: 添加快照测试（核心功能）

**目标**: 为关键功能建立"金标准"，任何变化立即可见

**覆盖模块**:
1. Outline初始化与渲染
2. Annotation CRUD操作
3. Anchor创建与导航

**示例1: Outline快照测试**

```javascript
// src/frontend/pdf-viewer/features/pdf-outline/__tests__/outline-snapshot.test.js

import { OutlineManager } from '../../../outline/outline-manager.js';

describe('Outline快照测试', () => {

  test('Outline初始化后的数据结构应符合快照', async () => {
    // 准备：真实的测试数据
    const testData = [
      {
        id: 'outline-1',
        name: 'Chapter 1',
        pageAt: 1,
        position: 0,
        children: [
          { id: 'outline-1-1', name: 'Section 1.1', pageAt: 2, position: 0, children: [] }
        ]
      },
      {
        id: 'outline-2',
        name: 'Chapter 2',
        pageAt: 10,
        position: 0,
        children: []
      }
    ];

    // 执行：初始化
    const manager = new OutlineManager({ disableAutoLoad: true });
    await manager.replaceFromRemote(testData);

    // 验证：数据结构快照（去除不稳定字段）
    const snapshot = normalizeForSnapshot(manager.getItems());

    expect(snapshot).toMatchSnapshot();
  });

  test('Outline空状态快照', async () => {
    const manager = new OutlineManager({ disableAutoLoad: true });
    await manager.replaceFromRemote([]);

    const snapshot = normalizeForSnapshot(manager.getItems());

    expect(snapshot).toMatchSnapshot();
  });

  test('Outline null状态快照（未初始化）', async () => {
    const manager = new OutlineManager({ disableAutoLoad: true });
    await manager.replaceFromRemote(null);

    const snapshot = normalizeForSnapshot(manager.getItems());

    expect(snapshot).toMatchSnapshot();
  });
});

/**
 * 规范化数据用于快照对比
 * 去除不稳定字段（如时间戳、随机ID）
 */
function normalizeForSnapshot(items) {
  if (items === null || items === undefined) {
    return null;
  }

  return items.map(item => ({
    name: item.name,
    pageAt: item.pageAt,
    position: item.position,
    childCount: item.children?.length || 0,
    children: item.children ? normalizeForSnapshot(item.children) : []
  }));
}
```

**首次运行生成快照**:

```bash
# 1. 运行测试生成快照
npm test -- outline-snapshot.test.js

# 2. 查看生成的快照文件
cat src/frontend/pdf-viewer/features/pdf-outline/__tests__/__snapshots__/outline-snapshot.test.js.snap

# 3. 人工验证快照是否正确
# 如果正确 → 提交
# 如果错误 → 修复代码，删除快照，重新生成

# 4. 提交快照到版本控制
git add src/frontend/pdf-viewer/features/pdf-outline/__tests__/__snapshots__/
git commit -m "test: 添加Outline快照测试"
```

**快照失败时的处理**:

```bash
# 如果后续修改导致快照失败：

# 1. 查看差异
npm test -- outline-snapshot.test.js

# 输出会显示：
# Received value does not match stored snapshot
# - Expected
# + Received

# 2. 判断是否是期望的变化
# 如果是故意修改 → 更新快照
npm test -- outline-snapshot.test.js -u

# 如果是意外破坏 → 修复代码，重新测试
```

**示例2: Annotation快照测试**

```javascript
// src/frontend/pdf-viewer/features/pdf-annotation/__tests__/annotation-snapshot.test.js

describe('Annotation快照测试', () => {

  test('创建文本高亮批注后的数据结构', async () => {
    const manager = new AnnotationManager();

    const annotation = await manager.createTextHighlight({
      pageAt: 1,
      position: { x: 100, y: 200 },
      text: 'Test highlight',
      color: '#FFFF00'
    });

    const snapshot = normalizeAnnotation(annotation);
    expect(snapshot).toMatchSnapshot();
  });

  test('批注列表快照（包含多种类型）', async () => {
    const manager = new AnnotationManager();

    await manager.createTextHighlight({ /* ... */ });
    await manager.createComment({ /* ... */ });
    await manager.createScreenshot({ /* ... */ });

    const snapshot = manager.getAll().map(normalizeAnnotation);
    expect(snapshot).toMatchSnapshot();
  });
});

function normalizeAnnotation(annotation) {
  return {
    type: annotation.type,
    pageAt: annotation.pageAt,
    position: annotation.position,
    text: annotation.text,
    color: annotation.color
    // 排除id、timestamp等不稳定字段
  };
}
```

**验收标准**:
- [ ] 至少3个模块有快照测试（Outline、Annotation、Anchor）
- [ ] 每个模块至少2个快照场景（正常态、空态）
- [ ] 快照文件已提交到版本控制
- [ ] 快照测试通过

---

### 任务4: 测试质量验证（故意改错法）

**目标**: 确保测试是真正有效的，不是假通过

**验证流程**:

```bash
# 对每个关键测试执行"故意改错法"

# 1. 选择一个测试
TEST_FILE="src/frontend/pdf-viewer/features/pdf-outline/__tests__/outline-sync-with-ws.test.js"

# 2. 运行测试，确保通过
npm test -- $TEST_FILE

# 3. 故意破坏被测代码
# 例如：注释掉Outline的保存逻辑
# src/frontend/pdf-viewer/features/pdf-outline/index.js

# 原代码：
# await this.wsClient.send('outline-update', payload);

# 破坏后：
# // await this.wsClient.send('outline-update', payload);

# 4. 再次运行测试
npm test -- $TEST_FILE

# 5. 验证测试是否失败
# 如果测试失败 ✅ → 测试有效
# 如果测试仍通过 ❌ → 测试是假的，需要重写
```

**测试质量检查清单**:

对每个测试，检查以下项：

- [ ] **测试真实行为，而非实现细节**
  - ❌ `expect(spy).toHaveBeenCalled()`（只测调用）
  - ✅ `expect(getOutlineItems()).toEqual(expected)`（测结果）

- [ ] **测试用真实数据**
  - ❌ `const mockData = { id: 1 }`（假数据）
  - ✅ `const data = loadFixture('real-outline.json')`（真数据）

- [ ] **测试覆盖边界情况**
  - ❌ 只测`data = [...]`（正常情况）
  - ✅ 也测`data = null`、`data = []`、`data = invalid`

- [ ] **故意改错法验证**
  - ❌ 破坏代码后测试仍通过
  - ✅ 破坏代码后测试必然失败

**重写假测试的示例**:

```javascript
// ❌ 假测试（只测了调用）
test('outline保存', async () => {
  const spy = jest.spyOn(wsClient, 'send');
  await manager.save(data);
  expect(spy).toHaveBeenCalled();  // 测试通过，但功能可能坏了
});

// ✅ 真测试（测了结果）
test('outline保存后应能重新加载', async () => {
  // 1. 保存
  await manager.save(testData);

  // 2. 清空内存
  manager.clear();

  // 3. 重新加载
  await manager.load(pdfId);

  // 4. 验证数据一致
  expect(manager.getItems()).toEqual(testData);

  // 如果保存逻辑坏了，这个测试必然失败
});
```

**验收标准**:
- [ ] 对至少5个关键测试执行故意改错法
- [ ] 所有被验证的测试：破坏代码后必然失败
- [ ] 发现的假测试已重写
- [ ] 记录测试质量检查报告

---

## 📊 验收标准（Phase 1总体）

### 功能验收

- [ ] 所有测试通过（`npm test` 全绿）
- [ ] pre-commit hook正常工作
- [ ] 提交破坏性代码会被阻止

### 测试验收

- [ ] 测试失败率：0%
- [ ] 快照测试覆盖：至少3个核心模块
- [ ] 测试质量验证：至少5个测试通过故意改错法

### 文档验收

- [ ] 测试基线日志已保存
- [ ] 测试质量检查报告已输出
- [ ] 工作日志已记录

---

## 📝 工作日志模板

```markdown
# [2025-11-09 HHMMSS] AI Working Log - Phase 1 应急止血

## 任务目标
- 修复所有失败的测试
- 建立pre-commit hook
- 添加快照测试

## 执行过程

### 1. 测试基线扫描
- 运行全量测试，记录失败列表
- 失败测试数量：X个
- 主要失败原因：...

### 2. 测试修复
- 修复 annotation-sidebar-ui.test.js
  - 问题：...
  - 修复方案：...
  - 结果：✅ 通过

### 3. pre-commit hook
- 创建hook脚本
- 验证阻止破坏性提交：✅ 成功

### 4. 快照测试
- Outline快照测试：✅ 完成
- Annotation快照测试：✅ 完成
- Anchor快照测试：✅ 完成

### 5. 测试质量验证
- 验证outline-sync-with-ws.test.js：✅ 有效
- 验证annotation-create.test.js：✅ 有效
- 重写1个假测试：...

## 结果
- [ ] 所有任务完成
- [ ] 验收标准达成
- [ ] 进入Phase 2

## 下一步
- 阅读Phase 2.1规范
- 开始编写后端API集成测试
```

---

## 🚀 快速开始

```bash
# 1. 进入项目根目录
cd /path/to/anki-linkmaster-PDFJS

# 2. 开始任务1：扫描测试基线
npm test 2>&1 | tee test-baseline-$(date +%Y%m%d-%H%M%S).log

# 3. 查看失败列表
grep "FAIL" test-baseline-*.log

# 4. 开始修复第一个失败的测试
npm test -- annotation-sidebar-ui.test.js --verbose
```

---

**文档版本**: v001
**最后更新**: 2025-11-09
**状态**: 🟡 进行中
