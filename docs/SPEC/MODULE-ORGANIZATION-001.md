<![CDATA[<!-- MODULE-ORGANIZATION-001.md -->
- **规范名称**: 模块化组织规范
- **规范描述**: 定义项目模块化组织的标准方式，采用功能模块划分代码结构，每个功能模块包含完整的组件、状态和工具，确保代码的高内聚和低耦合。
- **当前版本**: 1.0
- **所属范畴**: 文件规范
- **适用范围**: 大型项目的模块化组织结构
- **详细内容**:
  1. 按功能领域划分模块，每个模块代表一个完整的业务功能
  2. 每个模块包含自身的组件、状态管理、工具函数
  3. 模块内部保持高内聚，模块之间保持低耦合
  4. 共享代码放在 `shared/` 目录中供多个模块使用
  5. 模块目录结构应镜像整体项目结构

- **正向例子**:
  ```
  src/
  ├── pdf-viewer/           # PDF查看器模块
  │   ├── components/       # 模块专用组件
  │   ├── stores/          # 模块状态管理
  │   └── utils/           # 模块工具函数
  ├── anki-generator/       # Anki生成器模块
  │   ├── components/
  │   ├── stores/
  │   └── utils/
  └── shared/              # 共享模块
      ├── components/      # 共享组件
      ├── utils/           # 共享工具
      └── types/           # 共享类型定义
  ```

- **反向例子**:
  ```
  # 模块划分不清晰的结构
  src/
  ├── components/          # 所有组件混合
  │   ├── PdfViewer.vue   # PDF相关
  │   ├── AnkiCard.vue    # Anki相关
  │   └── CommonButton.vue # 通用组件
  ├── stores/             # 所有状态混合
  │   ├── pdf.js         # PDF状态
  │   ├── anki.js        # Anki状态
  │   └── user.js        # 用户状态
  └── utils/              # 所有工具混合
  # 缺乏模块化组织，功能相关的代码分散在不同目录
  ```

  ```
  # 模块耦合度过高的结构
  src/
  ├── pdf-module/
  │   ├── components/
  │   ├── stores/
  │   └── anki-utils.js   # 包含其他模块的逻辑
  ├── anki-module/
  │   ├── components/
  │   ├── stores/
  │   └── pdf-helpers.js  # 包含其他模块的逻辑
  # 模块之间存在不必要的依赖，耦合度过高
  ```
]]>