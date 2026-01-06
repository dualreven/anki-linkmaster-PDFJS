# Phase 2.1: 后端API集成测试

**阶段**: Phase 2 - 打基础
**子阶段**: 2.1 - 后端API集成测试
**预计工期**: 3-4天
**优先级**: 🔥 高
**前置依赖**: Phase 1完成（所有测试变绿）

---

## 📋 目标

**核心目标**: 建立可靠的后端测试底座，完全绕过浏览器环境差异

**为什么后端测试优先？**
1. ✅ 不依赖浏览器（Playwright vs QtWebEngine差异）
2. ✅ 测试真实的数据库操作
3. ✅ 运行稳定、速度快
4. ✅ 如果后端测试通过，至少保证数据层是对的

**成功标准**:
- 20-30个后端API集成测试
- 覆盖所有CRUD操作
- 至少3个金标准PDF用例
- 测试运行时间 < 1分钟

---

## 🗺️ 任务清单

### 任务1: 建立测试基础设施

**目标**: 搭建后端测试框架和fixture管理

**执行步骤**:

#### 1.1 创建测试目录结构

```bash
# 创建测试目录
mkdir -p src/backend/api/__tests__
mkdir -p src/backend/api/__tests__/fixtures
mkdir -p src/backend/api/__tests__/helpers

# 创建fixture目录（测试PDF和期望结果）
mkdir -p fixtures/outline-golden
```

#### 1.2 准备测试PDF文件

```bash
# fixtures/outline-golden/目录结构
fixtures/outline-golden/
├── simple.pdf              # 简单大纲（2层，英文）
├── simple.expected.json    # 期望的outline结构
├── complex.pdf             # 复杂大纲（5层，中文）
├── complex.expected.json
├── empty.pdf               # 无原生大纲
├── empty.expected.json     # 应返回null
└── README.md              # 说明每个PDF的特征
```

**simple.expected.json示例**:

```json
{
  "description": "简单大纲：2个根级章节，各有1个子章节",
  "outline": [
    {
      "name": "Chapter 1",
      "pageAt": 1,
      "position": 0,
      "children": [
        {
          "name": "Section 1.1",
          "pageAt": 2,
          "position": 0,
          "children": []
        }
      ]
    },
    {
      "name": "Chapter 2",
      "pageAt": 10,
      "position": 0,
      "children": []
    }
  ]
}
```

#### 1.3 创建测试辅助工具

```python
# src/backend/api/__tests__/helpers/test_client.py

"""
API测试客户端
提供便捷的API调用方法，用于集成测试
"""

import json
from pathlib import Path
from typing import List, Dict, Optional


class APITestClient:
    """API测试客户端"""

    def __init__(self, api_instance):
        """
        Args:
            api_instance: PDFLibraryAPI实例
        """
        self.api = api_instance

    def import_pdf(self, pdf_path: str) -> str:
        """
        导入PDF文件

        Args:
            pdf_path: PDF文件路径

        Returns:
            pdf_id: PDF的唯一标识
        """
        # 调用真实的API
        result = self.api.import_pdf_file(pdf_path)
        return result['pdf_id']

    def list_outline_items(self, pdf_id: str) -> Optional[List[Dict]]:
        """
        获取大纲列表

        Args:
            pdf_id: PDF标识

        Returns:
            outline_items: 大纲列表，如果不存在返回None
        """
        result = self.api.list_outline_items(pdf_id)
        return result.get('outline_items')

    def create_outline_item(self, pdf_id: str, data: Dict) -> str:
        """
        创建大纲项

        Args:
            pdf_id: PDF标识
            data: 大纲数据 {name, pageAt, position, parent_id}

        Returns:
            outline_id: 创建的大纲项ID
        """
        result = self.api.create_outline_item(pdf_id, data)
        return result['outline_id']

    def update_outline_item(self, outline_id: str, data: Dict) -> bool:
        """
        更新大纲项

        Args:
            outline_id: 大纲项ID
            data: 更新的数据

        Returns:
            success: 是否成功
        """
        result = self.api.update_outline_item(outline_id, data)
        return result.get('success', False)

    def delete_outline_item(self, outline_id: str) -> bool:
        """
        删除大纲项

        Args:
            outline_id: 大纲项ID

        Returns:
            success: 是否成功
        """
        result = self.api.delete_outline_item(outline_id)
        return result.get('success', False)

    def reorder_outline_items(self, pdf_id: str, order: List[str]) -> bool:
        """
        重新排序大纲

        Args:
            pdf_id: PDF标识
            order: 新的顺序（outline_id列表）

        Returns:
            success: 是否成功
        """
        result = self.api.reorder_outline_items(pdf_id, order)
        return result.get('success', False)
```

```python
# src/backend/api/__tests__/helpers/fixtures.py

"""
Fixture加载工具
用于加载测试数据（PDF和期望结果）
"""

import json
from pathlib import Path
from typing import Dict, Optional


FIXTURES_DIR = Path(__file__).parent.parent.parent.parent.parent / 'fixtures' / 'outline-golden'


def load_fixture_pdf(name: str) -> Path:
    """
    加载测试PDF文件

    Args:
        name: PDF名称（不含扩展名），如 'simple', 'complex'

    Returns:
        pdf_path: PDF文件的绝对路径
    """
    pdf_path = FIXTURES_DIR / f'{name}.pdf'
    if not pdf_path.exists():
        raise FileNotFoundError(f'Fixture PDF not found: {pdf_path}')
    return pdf_path


def load_expected_outline(name: str) -> Optional[Dict]:
    """
    加载期望的大纲结构

    Args:
        name: PDF名称（不含扩展名）

    Returns:
        expected: 期望的大纲结构，如果是None则返回None
    """
    json_path = FIXTURES_DIR / f'{name}.expected.json'
    if not json_path.exists():
        raise FileNotFoundError(f'Expected outline not found: {json_path}')

    data = json.loads(json_path.read_text(encoding='utf-8'))
    return data.get('outline')


def normalize_outline(outline: Optional[list]) -> Optional[list]:
    """
    规范化大纲数据用于对比
    去除不稳定字段（id、timestamp等）

    Args:
        outline: 原始大纲数据

    Returns:
        normalized: 规范化后的数据
    """
    if outline is None:
        return None

    def normalize_item(item):
        normalized = {
            'name': item['name'],
            'pageAt': item['pageAt'],
            'position': item.get('position', 0)
        }
        if 'children' in item and item['children']:
            normalized['children'] = [normalize_item(child) for child in item['children']]
        else:
            normalized['children'] = []
        return normalized

    return [normalize_item(item) for item in outline]
```

**验收标准**:
- [ ] 测试目录结构创建完成
- [ ] 至少3个测试PDF准备完成（simple、complex、empty）
- [ ] 每个PDF的expected.json已人工验证正确
- [ ] 测试辅助工具代码编写完成

---

### 任务2: Outline CRUD完整流程测试

**目标**: 测试大纲的完整生命周期：创建→读取→更新→删除

**测试文件**: `src/backend/api/__tests__/test_outline_crud.py`

```python
"""
Outline CRUD集成测试
测试大纲的完整生命周期，使用真实数据库
"""

import pytest
from .helpers.test_client import APITestClient
from .helpers.fixtures import load_fixture_pdf, normalize_outline


class TestOutlineCRUD:
    """大纲CRUD操作集成测试"""

    def test_create_read_workflow(self, api_client: APITestClient, db, sample_pdf_id):
        """测试：创建大纲项 → 读取验证"""

        # 1. 初始状态：数据库无记录
        outline = api_client.list_outline_items(sample_pdf_id)
        assert outline is None, "初始状态应返回None"

        # 2. 创建第一个大纲项
        item_id_1 = api_client.create_outline_item(sample_pdf_id, {
            'name': 'Chapter 1',
            'pageAt': 1,
            'position': 0
        })
        assert item_id_1 is not None

        # 3. 读取验证
        outline = api_client.list_outline_items(sample_pdf_id)
        assert outline is not None
        assert len(outline) == 1
        assert outline[0]['id'] == item_id_1
        assert outline[0]['name'] == 'Chapter 1'
        assert outline[0]['pageAt'] == 1

        # 4. 创建第二个大纲项
        item_id_2 = api_client.create_outline_item(sample_pdf_id, {
            'name': 'Chapter 2',
            'pageAt': 10,
            'position': 1
        })

        # 5. 读取验证（应有2个）
        outline = api_client.list_outline_items(sample_pdf_id)
        assert len(outline) == 2
        assert outline[1]['id'] == item_id_2

    def test_update_workflow(self, api_client: APITestClient, db, sample_pdf_id):
        """测试：创建 → 修改 → 验证持久化"""

        # 1. 创建
        item_id = api_client.create_outline_item(sample_pdf_id, {
            'name': 'Original Name',
            'pageAt': 1,
            'position': 0
        })

        # 2. 修改名称
        success = api_client.update_outline_item(item_id, {
            'name': 'Updated Name'
        })
        assert success is True

        # 3. 验证修改成功
        outline = api_client.list_outline_items(sample_pdf_id)
        assert outline[0]['name'] == 'Updated Name'
        assert outline[0]['id'] == item_id  # ID不变

        # 4. 修改页码
        success = api_client.update_outline_item(item_id, {
            'pageAt': 5
        })
        assert success is True

        # 5. 验证页码修改
        outline = api_client.list_outline_items(sample_pdf_id)
        assert outline[0]['pageAt'] == 5
        assert outline[0]['name'] == 'Updated Name'  # 名称保持不变

    def test_delete_workflow(self, api_client: APITestClient, db, sample_pdf_id):
        """测试：创建 → 删除 → 验证清空"""

        # 1. 创建2个大纲项
        item_id_1 = api_client.create_outline_item(sample_pdf_id, {
            'name': 'Chapter 1',
            'pageAt': 1,
            'position': 0
        })
        item_id_2 = api_client.create_outline_item(sample_pdf_id, {
            'name': 'Chapter 2',
            'pageAt': 10,
            'position': 1
        })

        # 2. 删除第一个
        success = api_client.delete_outline_item(item_id_1)
        assert success is True

        # 3. 验证只剩1个
        outline = api_client.list_outline_items(sample_pdf_id)
        assert len(outline) == 1
        assert outline[0]['id'] == item_id_2

        # 4. 删除第二个
        success = api_client.delete_outline_item(item_id_2)
        assert success is True

        # 5. 验证为空数组（有记录但为空）
        outline = api_client.list_outline_items(sample_pdf_id)
        assert outline == [], "删除所有项后应返回[]而非None"

    def test_full_crud_workflow(self, api_client: APITestClient, db, sample_pdf_id):
        """测试：完整的CRUD流程"""

        # 1. 初始：None
        outline = api_client.list_outline_items(sample_pdf_id)
        assert outline is None

        # 2. 创建
        item_id = api_client.create_outline_item(sample_pdf_id, {
            'name': 'Test Chapter',
            'pageAt': 1,
            'position': 0
        })

        # 3. 读取
        outline = api_client.list_outline_items(sample_pdf_id)
        assert len(outline) == 1

        # 4. 更新
        api_client.update_outline_item(item_id, {'name': 'Updated'})

        # 5. 验证更新
        outline = api_client.list_outline_items(sample_pdf_id)
        assert outline[0]['name'] == 'Updated'

        # 6. 删除
        api_client.delete_outline_item(item_id)

        # 7. 验证删除
        outline = api_client.list_outline_items(sample_pdf_id)
        assert outline == []


@pytest.fixture
def sample_pdf_id(api_client, db):
    """创建一个测试用的PDF记录"""
    pdf_path = load_fixture_pdf('simple')
    pdf_id = api_client.import_pdf(str(pdf_path))
    return pdf_id
```

**验收标准**:
- [ ] 所有CRUD测试通过
- [ ] 测试覆盖空值契约（None vs []）
- [ ] 测试运行时间 < 10秒

---

### 任务3: 空值契约测试（关键！）

**目标**: 明确测试"无记录"vs"有记录但为空"的语义差异

**测试文件**: `src/backend/api/__tests__/test_outline_null_contract.py`

```python
"""
Outline空值契约测试
核心问题：None vs [] 的语义必须明确
"""

import pytest
from .helpers.test_client import APITestClient
from .helpers.fixtures import load_fixture_pdf


class TestOutlineNullContract:
    """大纲空值契约测试"""

    def test_no_pdf_record_returns_none(self, api_client: APITestClient, db):
        """测试：PDF不存在 → 返回None（或抛异常）"""

        outline = api_client.list_outline_items('non-existent-pdf-id')

        # 根据你的API设计，选择一个：
        # 方案1：返回None
        assert outline is None, "PDF不存在应返回None"

        # 方案2：抛异常（如果你的API设计是这样）
        # with pytest.raises(PDFNotFoundError):
        #     api_client.list_outline_items('non-existent-pdf-id')

    def test_pdf_exists_but_no_outline_record_returns_none(
        self, api_client: APITestClient, db, sample_pdf_id
    ):
        """测试：PDF存在，但数据库无大纲记录 → 返回None"""

        outline = api_client.list_outline_items(sample_pdf_id)

        assert outline is None, "数据库无大纲记录应返回None（区别于[]）"

    def test_pdf_exists_outline_exists_but_empty_returns_empty_array(
        self, api_client: APITestClient, db, sample_pdf_id
    ):
        """测试：PDF存在，有大纲记录，但被全部删除 → 返回[]"""

        # 1. 创建一个大纲项
        item_id = api_client.create_outline_item(sample_pdf_id, {
            'name': 'Chapter 1',
            'pageAt': 1,
            'position': 0
        })

        # 2. 删除它
        api_client.delete_outline_item(item_id)

        # 3. 此时应返回[]（有记录但为空）
        outline = api_client.list_outline_items(sample_pdf_id)

        assert outline == [], "有记录但为空应返回[]（区别于None）"

    def test_null_vs_empty_array_semantics(
        self, api_client: APITestClient, db, sample_pdf_id
    ):
        """测试：明确None和[]的语义差异"""

        # 场景1：初始状态 → None
        outline_initial = api_client.list_outline_items(sample_pdf_id)
        assert outline_initial is None, "初始状态：数据库无记录 → None"

        # 场景2：创建后再删除 → []
        item_id = api_client.create_outline_item(sample_pdf_id, {
            'name': 'Test',
            'pageAt': 1,
            'position': 0
        })
        api_client.delete_outline_item(item_id)

        outline_deleted = api_client.list_outline_items(sample_pdf_id)
        assert outline_deleted == [], "删除后：有记录但为空 → []"

        # 语义验证
        assert outline_initial is not outline_deleted, "None ≠ []"

        # 前端行为验证
        # None → 需要从PDF提取原生大纲
        # []   → 直接渲染空态（不提取）
```

**这个测试为什么重要？**

这是你之前遇到的核心问题之一：
```
后端返回[] → 前端认为"有记录但为空" → 不提取原生大纲 → 用户看到空白
后端返回None → 前端认为"无记录" → 触发提取原生大纲 → 用户看到大纲
```

**验收标准**:
- [ ] 空值契约测试全部通过
- [ ] 文档明确记录None vs []的语义
- [ ] 后端代码严格遵守契约

---

### 任务4: 金标准PDF测试

**目标**: 使用真实PDF，验证大纲提取的正确性

**测试文件**: `src/backend/api/__tests__/test_outline_golden.py`

```python
"""
Outline金标准测试
使用人工验证过的PDF，确保提取结果正确
"""

import pytest
from .helpers.test_client import APITestClient
from .helpers.fixtures import (
    load_fixture_pdf,
    load_expected_outline,
    normalize_outline
)


class TestOutlineGolden:
    """大纲金标准测试"""

    @pytest.mark.parametrize('pdf_name', ['simple', 'complex', 'empty'])
    def test_native_outline_extraction(
        self, pdf_name: str, api_client: APITestClient, db
    ):
        """测试：从PDF提取原生大纲 → 结果符合金标准"""

        # 1. 加载测试PDF
        pdf_path = load_fixture_pdf(pdf_name)
        pdf_id = api_client.import_pdf(str(pdf_path))

        # 2. 触发大纲提取（根据你的API设计）
        # 方式1：自动提取
        # extracted = api_client.extract_outline(pdf_id)

        # 方式2：通过特定API
        # api_client.import_native_outline(pdf_id)

        # 3. 获取提取结果
        outline = api_client.list_outline_items(pdf_id)

        # 4. 加载金标准
        expected = load_expected_outline(pdf_name)

        # 5. 规范化后对比
        assert normalize_outline(outline) == normalize_outline(expected), \
            f"提取的大纲不符合金标准: {pdf_name}"

    def test_simple_pdf_structure(self, api_client: APITestClient, db):
        """测试：simple.pdf的结构验证"""

        pdf_path = load_fixture_pdf('simple')
        pdf_id = api_client.import_pdf(str(pdf_path))

        # 触发提取（根据你的实现）
        # ...

        outline = api_client.list_outline_items(pdf_id)

        # 详细验证
        assert len(outline) == 2, "应该有2个根级章节"

        # 第一章验证
        chapter1 = outline[0]
        assert chapter1['name'] == 'Chapter 1'
        assert chapter1['pageAt'] == 1
        assert len(chapter1.get('children', [])) == 1

        # 子章节验证
        section1_1 = chapter1['children'][0]
        assert section1_1['name'] == 'Section 1.1'
        assert section1_1['pageAt'] == 2

        # 第二章验证
        chapter2 = outline[1]
        assert chapter2['name'] == 'Chapter 2'
        assert chapter2['pageAt'] == 10
        assert len(chapter2.get('children', [])) == 0

    def test_empty_pdf_returns_null_or_empty(
        self, api_client: APITestClient, db
    ):
        """测试：无原生大纲的PDF → 返回null或[]"""

        pdf_path = load_fixture_pdf('empty')
        pdf_id = api_client.import_pdf(str(pdf_path))

        # 触发提取
        # ...

        outline = api_client.list_outline_items(pdf_id)

        # 无原生大纲应返回None或[]（根据你的设计）
        assert outline in (None, []), \
            "无原生大纲应返回None或[]"
```

**验收标准**:
- [ ] 至少3个金标准PDF测试通过
- [ ] 提取结果100%符合人工验证的标准
- [ ] 测试覆盖：简单结构、复杂结构、无大纲

---

### 任务5: 刷新后持久化测试

**目标**: 验证修改后刷新不会回退（你之前遇到的问题）

**测试文件**: `src/backend/api/__tests__/test_outline_persistence.py`

```python
"""
Outline持久化测试
核心：修改后刷新不回退
"""

import pytest
from .helpers.test_client import APITestClient


class TestOutlinePersistence:
    """大纲持久化测试"""

    def test_create_persists_after_refresh(
        self, api_client: APITestClient, db, sample_pdf_id
    ):
        """测试：创建后模拟刷新，数据应保持"""

        # 1. 创建大纲项
        item_id = api_client.create_outline_item(sample_pdf_id, {
            'name': 'Persistent Chapter',
            'pageAt': 1,
            'position': 0
        })

        # 2. 第一次读取
        outline1 = api_client.list_outline_items(sample_pdf_id)
        assert len(outline1) == 1

        # 3. 模拟页面刷新（重新请求）
        outline2 = api_client.list_outline_items(sample_pdf_id)

        # 4. 验证数据一致
        assert len(outline2) == 1
        assert outline2[0]['id'] == item_id
        assert outline2[0]['name'] == 'Persistent Chapter'

    def test_update_persists_after_refresh(
        self, api_client: APITestClient, db, sample_pdf_id
    ):
        """测试：修改后刷新，应保持修改后的值（不回退）"""

        # 1. 创建
        item_id = api_client.create_outline_item(sample_pdf_id, {
            'name': 'Original Name',
            'pageAt': 1,
            'position': 0
        })

        # 2. 修改
        api_client.update_outline_item(item_id, {
            'name': 'Updated Name'
        })

        # 3. 第一次读取（修改后）
        outline1 = api_client.list_outline_items(sample_pdf_id)
        assert outline1[0]['name'] == 'Updated Name'

        # 4. 模拟刷新
        outline2 = api_client.list_outline_items(sample_pdf_id)

        # 5. 验证不回退
        assert outline2[0]['name'] == 'Updated Name', \
            "刷新后应保持修改后的值，不能回退到Original Name"

    def test_delete_persists_after_refresh(
        self, api_client: APITestClient, db, sample_pdf_id
    ):
        """测试：删除后刷新，应保持删除状态"""

        # 1. 创建2个
        item_id_1 = api_client.create_outline_item(sample_pdf_id, {
            'name': 'Chapter 1',
            'pageAt': 1,
            'position': 0
        })
        item_id_2 = api_client.create_outline_item(sample_pdf_id, {
            'name': 'Chapter 2',
            'pageAt': 10,
            'position': 1
        })

        # 2. 删除第一个
        api_client.delete_outline_item(item_id_1)

        # 3. 第一次读取
        outline1 = api_client.list_outline_items(sample_pdf_id)
        assert len(outline1) == 1

        # 4. 模拟刷新
        outline2 = api_client.list_outline_items(sample_pdf_id)

        # 5. 验证删除持久化
        assert len(outline2) == 1
        assert outline2[0]['id'] == item_id_2, \
            "刷新后删除应保持，不能恢复已删除的项"
```

**验收标准**:
- [ ] 所有持久化测试通过
- [ ] 刷新后数据不回退
- [ ] 测试覆盖创建、更新、删除

---

## 📊 验收标准（Phase 2.1总体）

### 测试覆盖

- [ ] 后端API集成测试：20-30个
- [ ] CRUD操作：100%覆盖
- [ ] 空值契约：明确测试
- [ ] 金标准PDF：至少3个
- [ ] 持久化测试：覆盖所有修改操作

### 质量标准

- [ ] 所有测试通过
- [ ] 测试运行时间 < 1分钟
- [ ] 无Mock（使用真实数据库）
- [ ] 故意改错法验证：破坏后端代码，测试必然失败

### 文档标准

- [ ] 空值契约文档（None vs []语义）
- [ ] 金标准PDF说明文档
- [ ] 测试辅助工具使用说明

---

## 🚀 快速开始

```bash
# 1. 准备测试PDF
mkdir -p fixtures/outline-golden
# 复制3个测试PDF到该目录

# 2. 创建expected.json（手动验证）
cat > fixtures/outline-golden/simple.expected.json << 'EOF'
{
  "description": "简单大纲测试",
  "outline": [
    { "name": "Chapter 1", "pageAt": 1, "position": 0, "children": [] }
  ]
}
EOF

# 3. 创建测试文件
touch src/backend/api/__tests__/test_outline_crud.py

# 4. 运行测试
cd src/backend
pytest api/__tests__/test_outline_crud.py -v

# 5. 查看覆盖率
pytest api/__tests__/ --cov=api --cov-report=term-missing
```

---

**文档版本**: v001
**最后更新**: 2025-11-09
**状态**: ⚪ 待开始（依赖Phase 1完成）
