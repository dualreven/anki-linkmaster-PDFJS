<![CDATA[<!-- DOCUMENTATION-STRUCTURE-001.md -->
- **规范名称**: 文档组织结构规范
- **规范描述**: 定义项目文档的标准组织结构，确保各类文档（规范、API、用户指南、部署说明）有清晰的分类和存放位置，便于团队成员查找和使用。
- **当前版本**: 1.0
- **所属范畴**: 文档规范
- **适用范围**: 所有项目的文档组织结构
- **详细内容**:
  1. `SPEC/` 目录存放开发规范和标准文档
  2. `api/` 目录存放API接口文档和Swagger定义
  3. `user-guide/` 目录存放用户使用指南和教程
  4. `deployment/` 目录存放部署和运维相关文档
  5. 文档应使用Markdown格式，保持格式统一

- **正向例子**:
  ```
  docs/
  ├── SPEC/                # 规范文档
  │   ├── CODING-CLASS-PRINCIPLES-001.md
  │   ├── CODING-COMMENT-PRINCIPLES-001.md
  │   └── BACKEND-STRUCTURE-001.md
  ├── api/                 # API文档
  │   ├── swagger.yaml    # OpenAPI定义
  │   ├── endpoints.md    # 端点说明
  │   └── examples/       # API示例
  ├── user-guide/          # 用户指南
  │   ├── getting-started.md
  │   ├── features.md
  │   └── troubleshooting.md
  └── deployment/          # 部署文档
      ├── local-setup.md
      ├── production.md
      └── monitoring.md
  ```

- **反向例子**:
  ```
  # 文档结构混乱
  documentation/
  ├── specs/              # 命名不一致
  │   ├── class_standard.txt  # 格式不一致
  │   └── naming.md
  ├── api_docs/           # 命名不一致
  │   ├── api.txt         # 格式不一致
  │   └── examples/
  ├── guide/              # 命名不一致
  │   ├── start.md
  │   └── problem.md
  └── deploy/             # 命名不一致
      ├── setup.doc       # 格式不一致
      └── production.txt
  # 缺乏统一的命名和格式规范
  ```

  ```
  # 文档分散在不同位置
  project/
  ├── docs/api.md        # API文档在根目录
  ├── src/README.md      # 说明文档在源码中
  ├── DEPLOYMENT.md      # 部署文档在根目录
  ├── config/guide.txt   # 指南文档在配置目录
  └── .github/SPEC.md    # 规范文档在.github目录
  # 文档分散存放，难以查找和维护
  ```
]]>