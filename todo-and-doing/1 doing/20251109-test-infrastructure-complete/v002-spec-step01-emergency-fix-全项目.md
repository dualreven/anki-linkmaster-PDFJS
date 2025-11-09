# Phase 1: 应急止血（全项目版）

**阶段**: Phase 1
**预计工期**: 2-3天
**优先级**: 🔥 最高
**状态**: 🟡 进行中

---

## 📋 目标

**核心目标**: 建立全项目测试基线，立即阻止90%的低级错误

**成功标准**:
- ✅ 前端测试全绿（`npm test` 0 failed）
- ✅ 后端测试全绿（`pytest` 0 failed）
- ✅ pre-commit hook运行正常
- ✅ 3个核心模块有快照测试

---

## 🗺️ 任务清单

### 任务1: 扫描全项目测试基线（1小时）

**目标**: 了解当前测试状态，建立修复清单

**执行步骤**:

```bash
# 1. 前端测试扫描
cd /path/to/anki-linkmaster-PDFJS
npm test 2>&1 | tee AItemp/test-baseline-frontend-$(date +%Y%m%d-%H%M%S).log

# 2. 后端测试扫描
cd src/backend
pytest -v 2>&1 | tee ../../AItemp/test-baseline-backend-$(date +%Y%m%d-%H%M%S).log

# 3. 生成测试状态报告
cd ../..
cat > AItemp/test-baseline-summary.md << 'EOF'
# 全项目测试基线报告

生成时间: $(date)

## 前端测试状态
- 总测试数: XXX
- 通过: XXX
- 失败: XXX
- 跳过: XXX

### 失败列表
（从日志中提取）

## 后端测试状态
- 总测试数: XXX
- 通过: XXX
- 失败: XXX
- 跳过: XXX

### 失败列表
（从日志中提取）

## 修复优先级
1. [ ] 高优先级失败（阻塞性）
2. [ ] 中优先级失败
3. [ ] 低优先级失败
EOF
```

**分析失败原因**:

```bash
# 前端失败分析
grep "FAIL" AItemp/test-baseline-frontend-*.log | \
  awk '{print $2}' | \
  sort | uniq -c | \
  sort -rn > AItemp/frontend-failures-by-file.txt

# 后端失败分析
grep "FAILED" AItemp/test-baseline-backend-*.log | \
  awk '{print $1}' | \
  sort | uniq -c | \
  sort -rn > AItemp/backend-failures-by-file.txt
```

**输出清单**:

| 清单文件 | 内容 | 用途 |
|---------|------|------|
| `test-baseline-frontend-*.log` | 前端完整测试日志 | 详细错误信息 |
| `test-baseline-backend-*.log` | 后端完整测试日志 | 详细错误信息 |
| `test-baseline-summary.md` | 测试状态摘要 | 快速了解全局 |
| `frontend-failures-by-file.txt` | 前端失败文件统计 | 确定修复优先级 |
| `backend-failures-by-file.txt` | 后端失败文件统计 | 确定修复优先级 |

**验收标准**:
- [ ] 测试基线报告生成完成
- [ ] 失败测试清单已整理
- [ ] 修复优先级已确定

---

### 任务2: 修复所有失败的测试（1-2天）

**目标**: 建立"绿色基线"，让测试套件100%可信

**修复策略**:

#### 策略1: 按优先级修复

**优先级定义**:
1. **🔥 阻塞性失败**（最高优先级）:
   - 影响核心功能（outline、annotation、anchor、search）
   - 数据库操作相关
   - WebSocket通信相关

2. **⭐ 功能性失败**（高优先级）:
   - 影响用户可见功能
   - Feature级别的测试

3. **📝 工具性失败**（中优先级）:
   - 工具函数、辅助类
   - 不影响主流程

**修复顺序示例**:
```bash
# 1. 先修复阻塞性失败
npm test -- src/backend/database/plugins/__tests__/test_outline_*.py -v
npm test -- src/frontend/pdf-viewer/features/pdf-outline/__tests__/*.test.js

# 2. 再修复功能性失败
npm test -- src/frontend/pdf-viewer/features/pdf-annotation/__tests__/*.test.js
npm test -- src/backend/msgCenter_server/handlers/__tests__/*.py

# 3. 最后修复工具性失败
npm test -- src/frontend/common/utils/__tests__/*.test.js
```

#### 策略2: 按模块集中修复

**前端模块**:
```bash
# common库（高优先级）
npm test -- src/frontend/common/__tests__/*.test.js
npm test -- src/frontend/common/event/__tests__/*.test.js
npm test -- src/frontend/common/ws/__tests__/*.test.js

# pdf-viewer核心（高优先级）
npm test -- src/frontend/pdf-viewer/features/infra-app/__tests__/*.test.js
npm test -- src/frontend/pdf-viewer/features/infra-ws-adapter/__tests__/*.test.js
npm test -- src/frontend/pdf-viewer/features/pdf-outline/__tests__/*.test.js
npm test -- src/frontend/pdf-viewer/features/pdf-annotation/__tests__/*.test.js

# pdf-home（中优先级）
npm test -- src/frontend/pdf-home/features/search/__tests__/*.test.js
npm test -- src/frontend/pdf-home/features/add-files/__tests__/*.test.js
```

**后端模块**:
```bash
# database层（最高优先级）
cd src/backend
pytest database/plugins/__tests__/test_pdf_outline_plugin.py -v
pytest database/plugins/__tests__/test_pdf_annotation_plugin.py -v
pytest database/plugins/__tests__/test_pdf_bookanchor_plugin.py -v

# api层（高优先级）
pytest api/__tests__/test_pdf_library_api.py -v
pytest api/pdf-home/__tests__/ -v
pytest api/pdf-viewer/__tests__/ -v

# msgCenter层（高优先级）
pytest msgCenter_server/handlers/__tests__/ -v
pytest msgCenter_server/core/__tests__/ -v
```

#### 修复原则

**原则1: 最小化修改**
```bash
# ❌ 错误：借机重构
# 看到代码不好，顺便改了一堆

# ✅ 正确：只修让测试通过的最小代码
# 如果是测试写错了 → 只改测试
# 如果是功能真坏了 → 只修复功能
```

**原则2: 逐个验证**
```bash
# 每修复一个测试，立即验证
npm test -- path/to/fixed-test.test.js

# 然后跑全量测试，确保没破坏其他
npm test

# 如果全量测试失败，立即回滚刚才的修改
git diff
git checkout -- path/to/file
```

**原则3: 记录修复日志**

为每个修复创建简短记录：
```markdown
## 修复记录

### 1. annotation-sidebar-ui.test.js
- **问题**: expect(confirmSpy).toHaveBeenCalledTimes(1) 失败
- **根因**: 未正确mock window.confirm
- **修复**: 添加 jest.spyOn(window, 'confirm').mockReturnValue(true)
- **验证**: ✅ 测试通过

### 2. outline-crud.py
- **问题**: KeyError: 'outline_id'
- **根因**: 后端API返回字段不一致
- **修复**: 统一使用 outline_id 字段
- **验证**: ✅ 测试通过
```

**验收标准**:
- [ ] `npm test` 全绿（0 failed）
- [ ] `pytest` 全绿（0 failed）
- [ ] 修复日志已记录到工作日志
- [ ] 没有跳过的测试（或已明确标注为何跳过）

---

### 任务3: 建立pre-commit hook（30分钟）

**目标**: 提交前自动运行测试，防止破坏性提交

**完整hook脚本**:

```bash
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

echo "🔍 [Pre-commit] 运行提交前检查..."
echo ""

# 检测是否是Python或JS文件的修改
CHANGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)
HAS_PY_CHANGES=$(echo "$CHANGED_FILES" | grep -E '\.py$' | wc -l)
HAS_JS_CHANGES=$(echo "$CHANGED_FILES" | grep -E '\.(js|jsx|ts|tsx)$' | wc -l)

# 前端检查（如果有JS变更）
if [ "$HAS_JS_CHANGES" -gt 0 ]; then
  echo "📝 [Pre-commit] ESLint检查前端代码..."
  npm run lint -- --max-warnings=0
  if [ $? -ne 0 ]; then
    echo "❌ [Pre-commit] ESLint检查失败，请修复后再提交"
    exit 1
  fi

  echo "🧪 [Pre-commit] 运行前端关键测试..."
  npm run test:critical
  if [ $? -ne 0 ]; then
    echo "❌ [Pre-commit] 前端测试失败，请修复后再提交"
    echo "💡 提示：运行 'npm test' 查看详细错误"
    exit 1
  fi
fi

# 后端检查（如果有Python变更）
if [ "$HAS_PY_CHANGES" -gt 0 ]; then
  echo "🐍 [Pre-commit] 运行后端关键测试..."

  # 只运行变更文件相关的测试
  CHANGED_PY_MODULES=$(echo "$CHANGED_FILES" | grep -E '\.py$' | grep -v __pycache__ | grep -v __tests__)

  if [ -n "$CHANGED_PY_MODULES" ]; then
    cd src/backend
    pytest --lf --maxfail=3 -q
    if [ $? -ne 0 ]; then
      echo "❌ [Pre-commit] 后端测试失败，请修复后再提交"
      echo "💡 提示：运行 'cd src/backend && pytest -v' 查看详细错误"
      cd ../..
      exit 1
    fi
    cd ../..
  fi
fi

echo ""
echo "✅ [Pre-commit] 所有检查通过，允许提交"
EOF

chmod +x .git/hooks/pre-commit
```

**package.json配置**:

```json
{
  "scripts": {
    "test": "jest",
    "test:critical": "jest --testPathPattern='(outline|annotation|anchor|search|event|ws)' --bail --maxWorkers=2",
    "test:watch": "jest --watch",
    "lint": "eslint src --ext .js,.jsx,.ts,.tsx,.mjs,.cjs",
    "lint:fix": "eslint src --ext .js,.jsx,.ts,.tsx,.mjs,.cjs --fix"
  }
}
```

**验证hook**:

```bash
# 1. 故意引入ESLint错误
echo "var unused = 1;" >> src/frontend/test-hook.js

# 2. 尝试提交
git add src/frontend/test-hook.js
git commit -m "test: 验证pre-commit hook"

# 3. 应该看到hook运行并阻止提交
# 预期输出: "❌ [Pre-commit] ESLint检查失败，请修复后再提交"

# 4. 清理测试文件
git reset HEAD src/frontend/test-hook.js
rm src/frontend/test-hook.js
```

**优化hook性能**:

```bash
# 如果测试运行太慢，可以只运行变更相关的测试

# 前端：只测试变更的Feature
CHANGED_FEATURES=$(echo "$CHANGED_FILES" | grep -E 'features/' | cut -d'/' -f5 | sort -u)

# 后端：使用pytest的--lf（last-failed）和--ff（failed-first）
pytest --lf --ff -q
```

**验收标准**:
- [ ] pre-commit hook文件存在且可执行
- [ ] 破坏代码后提交被阻止
- [ ] 正常代码可以正常提交
- [ ] hook运行时间 < 1分钟（关键测试）

---

### 任务4: 添加快照测试（3个核心模块）（2-3小时）

**目标**: 为最关键的3个模块建立"金标准"

#### 模块1: common/event-bus（前端核心）

```javascript
// src/frontend/common/event/__tests__/event-bus-snapshot.test.js

import { EventBus } from '../event-bus.js';

describe('EventBus快照测试', () => {

  test('事件订阅和发布的完整流程', () => {
    const bus = new EventBus();
    const events = [];

    // 订阅多个事件
    bus.on('module:action:requested', (data) => {
      events.push({ type: 'requested', data });
    });

    bus.on('module:action:completed', (data) => {
      events.push({ type: 'completed', data });
    });

    // 发布事件
    bus.emit('module:action:requested', { id: 1 });
    bus.emit('module:action:completed', { id: 1, result: 'success' });

    // 快照验证
    expect(events).toMatchSnapshot();
  });

  test('事件取消订阅', () => {
    const bus = new EventBus();
    let callCount = 0;

    const handler = () => { callCount++; };
    bus.on('test:event:fired', handler);
    bus.emit('test:event:fired');

    bus.off('test:event:fired', handler);
    bus.emit('test:event:fired');

    expect(callCount).toBe(1);
    expect(callCount).toMatchSnapshot();
  });

  test('全局事件vs局部事件', () => {
    const bus = new EventBus();
    const globalEvents = [];
    const localEvents = [];

    bus.onGlobal('global:event:fired', (data) => {
      globalEvents.push(data);
    });

    bus.on('local:event:fired', (data) => {
      localEvents.push(data);
    });

    bus.emitGlobal('global:event:fired', { source: 'test' });
    bus.emit('local:event:fired', { source: 'test' });

    expect({ globalEvents, localEvents }).toMatchSnapshot();
  });
});
```

#### 模块2: database/pdf_outline_plugin（后端核心）

```python
# src/backend/database/plugins/__tests__/test_outline_snapshot.py

import pytest
import json
from pathlib import Path


class TestOutlinePluginSnapshot:
    """大纲插件快照测试"""

    def test_create_outline_structure_snapshot(self, outline_plugin, db, sample_pdf_id):
        """测试：创建大纲后的完整结构快照"""

        # 创建2层大纲结构
        root_id = outline_plugin.create_outline_item(
            sample_pdf_id,
            name='Chapter 1',
            page_at=1,
            position=0
        )

        child_id = outline_plugin.create_outline_item(
            sample_pdf_id,
            name='Section 1.1',
            page_at=2,
            position=0,
            parent_id=root_id
        )

        # 获取完整结构
        outline = outline_plugin.list_outline_items(sample_pdf_id)

        # 规范化（去除不稳定字段）
        snapshot = self._normalize_outline(outline)

        # 保存快照
        snapshot_path = Path(__file__).parent / '__snapshots__' / 'outline_structure.json'
        snapshot_path.parent.mkdir(exist_ok=True)

        if not snapshot_path.exists():
            # 首次运行：生成快照
            snapshot_path.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False))
        else:
            # 后续运行：对比快照
            expected = json.loads(snapshot_path.read_text())
            assert snapshot == expected, \
                f"大纲结构不符合快照\n期望: {expected}\n实际: {snapshot}"

    def test_empty_outline_snapshot(self, outline_plugin, db, sample_pdf_id):
        """测试：空大纲的快照"""

        # 初始状态
        outline = outline_plugin.list_outline_items(sample_pdf_id)

        assert outline is None, "初始应返回None"

        # 创建后删除
        item_id = outline_plugin.create_outline_item(
            sample_pdf_id,
            name='Temp',
            page_at=1,
            position=0
        )
        outline_plugin.delete_outline_item(item_id)

        # 删除后应为空数组
        outline_after_delete = outline_plugin.list_outline_items(sample_pdf_id)

        assert outline_after_delete == [], "删除后应返回[]"

    @staticmethod
    def _normalize_outline(outline):
        """规范化大纲数据用于快照对比"""
        if outline is None:
            return None

        def normalize_item(item):
            return {
                'name': item['name'],
                'pageAt': item['page_at'],
                'position': item['position'],
                'children': [normalize_item(child) for child in item.get('children', [])]
            }

        return [normalize_item(item) for item in outline]
```

#### 模块3: msgCenter_server/handlers/outline（通信核心）

```python
# src/backend/msgCenter_server/handlers/__tests__/test_outline_handler_snapshot.py

import pytest
import json


class TestOutlineHandlerSnapshot:
    """大纲处理器快照测试"""

    async def test_outline_list_message_format_snapshot(
        self, handler, mock_websocket, sample_pdf_id
    ):
        """测试：outline-list消息格式快照"""

        # 发送请求
        request = {
            'type': 'pdf-viewer:outline-list:requested',
            'payload': {'pdf_id': sample_pdf_id}
        }

        response = await handler.handle_outline_list(request)

        # 规范化响应
        snapshot = {
            'type': response['type'],
            'payload_keys': sorted(response['payload'].keys()),
            'outline_items_type': type(response['payload']['outline_items']).__name__
        }

        # 验证快照
        expected = {
            'type': 'pdf-viewer:outline-list:completed',
            'payload_keys': ['outline_items', 'pdf_id'],
            'outline_items_type': 'NoneType'  # 初始为None
        }

        assert snapshot == expected

    async def test_outline_create_message_format_snapshot(
        self, handler, mock_websocket, sample_pdf_id
    ):
        """测试：outline-create消息格式快照"""

        request = {
            'type': 'pdf-viewer:outline-create:requested',
            'payload': {
                'pdf_id': sample_pdf_id,
                'name': 'Test Chapter',
                'pageAt': 1,
                'position': 0
            }
        }

        response = await handler.handle_outline_create(request)

        snapshot = {
            'type': response['type'],
            'success': response.get('success'),
            'has_outline_id': 'outline_id' in response.get('data', {})
        }

        expected = {
            'type': 'pdf-viewer:outline-create:completed',
            'success': True,
            'has_outline_id': True
        }

        assert snapshot == expected
```

**快照测试最佳实践**:

1. **去除不稳定字段**:
```javascript
function normalizeForSnapshot(data) {
  return {
    ...data,
    id: undefined,        // 去除ID
    timestamp: undefined, // 去除时间戳
    createdAt: undefined  // 去除创建时间
  };
}
```

2. **首次运行生成快照**:
```bash
# 前端
npm test -- event-bus-snapshot.test.js

# 后端
cd src/backend
pytest database/plugins/__tests__/test_outline_snapshot.py -v
```

3. **人工验证快照**:
```bash
# 查看生成的快照文件
cat src/frontend/common/event/__tests__/__snapshots__/event-bus-snapshot.test.js.snap

# 确认结构正确后提交
git add src/frontend/common/event/__tests__/__snapshots__/
git commit -m "test: 添加EventBus快照测试"
```

4. **快照失败时的处理**:
```bash
# 如果是故意的修改 → 更新快照
npm test -- event-bus-snapshot.test.js -u

# 如果是意外的破坏 → 修复代码
# （不要轻易更新快照，先确认是否真的应该变化）
```

**验收标准**:
- [ ] 3个核心模块的快照测试已添加
- [ ] 快照文件已人工验证正确
- [ ] 快照测试全部通过
- [ ] 快照文件已提交到版本控制

---

## 📊 Phase 1验收标准（总体）

### 功能验收

- [ ] `npm test` 全绿（0 failed）
- [ ] `pytest` 全绿（0 failed）
- [ ] pre-commit hook正常工作
- [ ] 提交破坏性代码会被阻止

### 测试验收

- [ ] 测试失败率：0%
- [ ] 快照测试覆盖：3个核心模块
- [ ] 测试基线报告已生成

### 文档验收

- [ ] 测试基线报告：`AItemp/test-baseline-summary.md`
- [ ] 修复日志：记录在工作日志中
- [ ] 快照文件：已提交到`__snapshots__/`目录

---

## 📝 工作日志模板

```markdown
# [2025-11-09 HHMMSS] AI Working Log - Phase 1 应急止血（全项目）

## 任务目标
- 扫描全项目测试基线（前端+后端）
- 修复所有失败的测试
- 建立pre-commit hook
- 添加3个核心模块的快照测试

## 执行过程

### 1. 测试基线扫描
**前端**：
- 总测试数：XXX
- 失败：XXX个
- 主要失败模块：...

**后端**：
- 总测试数：XXX
- 失败：XXX个
- 主要失败模块：...

### 2. 测试修复
**前端修复**（按优先级）：
- [ ] common/event-bus.js - XXX个测试
- [ ] pdf-viewer/pdf-outline - XXX个测试
- ...

**后端修复**（按优先级）：
- [ ] database/pdf_outline_plugin - XXX个测试
- [ ] msgCenter/outline_handler - XXX个测试
- ...

### 3. pre-commit hook
- [x] 创建hook脚本
- [x] 验证阻止破坏性提交

### 4. 快照测试
- [x] common/event-bus快照测试
- [x] database/pdf_outline_plugin快照测试
- [x] msgCenter/outline_handler快照测试

## 结果
- [ ] 前端测试全绿：XXX个通过
- [ ] 后端测试全绿：XXX个通过
- [ ] pre-commit hook运行正常
- [ ] 3个核心模块快照测试已添加

## 下一步
- 进入Phase 2.1：数据库层测试建设
```

---

## 🚀 立即开始

```bash
# 1. 进入项目根目录
cd /path/to/anki-linkmaster-PDFJS

# 2. 开始任务1：扫描测试基线
npm test 2>&1 | tee AItemp/test-baseline-frontend-$(date +%Y%m%d-%H%M%S).log

# 3. 扫描后端
cd src/backend
pytest -v 2>&1 | tee ../../AItemp/test-baseline-backend-$(date +%Y%m%d-%H%M%S).log

# 4. 生成失败清单
cd ../..
grep "FAIL" AItemp/test-baseline-frontend-*.log > AItemp/frontend-failures.txt
grep "FAILED" AItemp/test-baseline-backend-*.log > AItemp/backend-failures.txt

# 5. 查看失败清单
cat AItemp/frontend-failures.txt
cat AItemp/backend-failures.txt
```

---

**文档版本**: v002-Phase1
**最后更新**: 2025-11-09
**状态**: 🟡 进行中
**预计完成**: 2-3天后
