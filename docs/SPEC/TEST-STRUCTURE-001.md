<![CDATA[<!-- TEST-STRUCTURE-001.md -->
- **规范名称**: 测试代码结构规范
- **规范描述**: 定义测试代码的组织结构规范，确保测试文件与源代码结构保持一致，便于测试的维护和执行，支持不同层次的测试类型。
- **当前版本**: 1.0
- **所属范畴**: 测试规范
- **适用范围**: 所有项目的测试代码组织结构
- **详细内容**:
  1. 测试目录结构应镜像源代码结构
  2. 后端测试分为单元测试和集成测试
  3. 前端测试分为组件单元测试和端到端测试
  4. 测试数据放在专门的 `fixtures/` 目录中
  5. 测试文件命名遵循约定（`.spec.js`, `.test.py`）

- **正向例子**:
  ```
  tests/
  ├── backend/              # 后端测试
  │   ├── unit/            # 单元测试
  │   └── integration/     # 集成测试
  ├── frontend/            # 前端测试
  │   ├── unit/            # 组件单元测试
  │   └── e2e/            # 端到端测试
  └── fixtures/            # 测试数据
      ├── pdfs/           # PDF测试文件
      ├── images/         # 图片测试文件
      └── json/           # JSON测试数据
  ```

- **反向例子**:
  ```
  # 测试结构混乱
  test/
  ├── back/               # 命名不一致
  │   ├── test_models.py  # 单元测试
  │   └── api_test.py     # 集成测试混合
  ├── front/              # 命名不一致
  │   ├── component.test.js # 单元测试
  │   └── e2e/           # 端到端测试
  ├── data/              # 测试数据分散
  │   ├── test.pdf       # 在多个位置
  │   └── sample.json
  # 缺乏清晰的结构分层
  ```

  ```
  # 测试与源码结构不匹配
  src/
  ├── backend/
  │   ├── services/
  │   └── models/
  tests/
  ├── unit/
  │   ├── service_test.py # 服务测试
  │   └── model_test.py   # 模型测试
  ├── integration/
  │   └── api_test.py     # API测试
  # 测试结构没有镜像源码结构，难以定位对应测试
  ```
]]>