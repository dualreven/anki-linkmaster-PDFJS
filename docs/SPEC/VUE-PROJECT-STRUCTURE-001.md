<!-- VUE-PROJECT-STRUCTURE-001.md -->
- **规范名称**: Vue项目结构规范
- **规范描述**: 定义Vue前端项目的标准目录结构，采用组件化架构组织代码，确保组件、状态管理、服务调用等各部分的清晰分离，提高前端代码的可维护性和可复用性。此规范仅适用于Vue框架项目。
- **当前版本**: 1.1
- **所属范畴**: 文件规范
- **适用范围**: 仅适用于Vue前端项目结构组织，不适用于纯JavaScript或其他框架项目
- **详细内容**:
  1. `components/` 目录存放通用可复用组件
  2. `views/` 目录存放页面级组件
  3. `stores/` 目录存放状态管理相关代码
  4. `services/` 目录存放API服务调用
  5. `utils/` 目录存放工具函数和辅助类
  6. `assets/` 目录存放静态资源文件
  7. `public/` 目录存放公共资源文件
  8. `tests/` 目录存放对应的测试代码

- **正向例子**:
  ```
  src/frontend/
  ├── src/
  │   ├── components/        # 通用组件
  │   ├── views/            # 页面组件
  │   ├── stores/           # 状态管理
  │   ├── services/         # API服务
  │   ├── utils/            # 工具函数
  │   └── assets/           # 静态资源
  ├── public/               # 公共资源
  └── tests/               # 测试文件
  ```

- **反向例子**:
  ```
  # 结构混乱的前端目录
  src/
  ├── vue/                  # 组件混合存放
  │   ├── Home.vue         # 页面组件
  │   ├── Button.vue       # 通用组件
  │   └── store.js         # 状态管理
  ├── api/                 # API调用
  ├── helpers/             # 工具函数命名不一致
  ├── images/              # 静态资源分散
  └── test/                # 测试目录命名不规范
  ```

  ```
  # 组件组织不合理的结构
  src/
  ├── components/
  │   ├── HomePage.vue     # 页面组件不应在components中
  │   ├── UserList.vue     # 页面组件
  │   └── Button.vue       # 通用组件
  ├── store/              # 状态管理
  ├── api/               # API服务
  └── utils/             # 工具函数
  # 页面组件和通用组件混合，缺乏清晰的分类
  ```
