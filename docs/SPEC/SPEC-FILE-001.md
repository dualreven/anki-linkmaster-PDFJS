<!-- SPEC-FILE-001.md -->
- 规范名称: 文件结构规范
- 规范描述: 规定项目中文件和目录的组织结构，确保项目结构清晰、易于维护
- 当前版本: 1.0
- 所属范畴: 编码规范
- 适用范围: 全项目所有文件和目录的组织
- 正向例子:
  ```
  # 项目根目录结构
  anki-linkmaster-PDFJS/
  ├── src/                    # 源代码
  ├── docs/                   # 文档
  ├── tests/                  # 测试
  ├── logs/                   # 日志
  ├── temp/                   # 临时文件
  ├── package.json            # 前端依赖
  ├── requirements.txt        # 后端依赖
  ├── app.py                 # 主入口
  └── .gitignore             # Git忽略文件
  
  # 后端结构 (Python)
  src/backend/
  ├── api/                    # API接口层
  │   ├── routes/            # 路由定义
  │   │   ├── pdf_routes.py
  │   │   └── user_routes.py
  │   ├── middleware/        # 中间件
  │   │   ├── auth.py
  │   │   └── cors.py
  │   └── validators/        # 请求验证
  │       ├── pdf_validator.py
  │       └── user_validator.py
  ├── services/              # 业务逻辑
  │   ├── pdf_service.py
  │   └── user_service.py
  ├── models/                # 数据模型
  │   ├── pdf_model.py
  │   └── user_model.py
  ├── repositories/          # 数据访问
  │   ├── pdf_repository.py
  │   └── user_repository.py
  ├── utils/                 # 工具函数
  │   ├── file_utils.py
  │   └── string_utils.py
  └── tests/                 # 单元测试
      ├── test_pdf_service.py
      └── test_user_service.py
  
  # 前端结构 (Vue)
  src/frontend/
  ├── src/
  │   ├── components/        # 通用组件
  │   │   ├── PdfViewer.vue
  │   │   └── FileUploader.vue
  │   ├── views/            # 页面组件
  │   │   ├── HomeView.vue
  │   │   └── PdfView.vue
  │   ├── stores/           # 状态管理
  │   │   ├── pdf_store.js
  │   │   └── user_store.js
  │   ├── services/         # API服务
  │   │   ├── pdf_service.js
  │   │   └── user_service.js
  │   ├── utils/            # 工具函数
  │   │   ├── file_utils.js
  │   │   └── string_utils.js
  │   └── assets/           # 静态资源
  │       ├── images/
  │       └── styles/
  ├── public/               # 公共资源
  │   ├── favicon.ico
  │   └── index.html
  └── tests/               # 测试文件
      ├── components/
      │   ├── PdfViewer.spec.js
      │   └── FileUploader.spec.js
      └── views/
          ├── HomeView.spec.js
          └── PdfView.spec.js
  
  # 模块组织
  src/
  ├── pdf-viewer/           # PDF查看器模块
  │   ├── components/       # 子组件
  │   │   ├── PdfToolbar.vue
  │   │   └── PdfPage.vue
  │   ├── stores/          # 模块状态
  │   │   └── pdf_viewer_store.js
  │   └── utils/           # 模块工具
  │       └── pdf_utils.js
  ├── anki-generator/       # Anki生成器模块
  │   ├── components/
  │   ├── stores/
  │   └── utils/
  └── shared/              # 共享模块
      ├── components/
      ├── utils/
      └── constants/
  
  # 测试结构
  tests/
  ├── backend/              # 后端测试
  │   ├── unit/            # 单元测试
  │   │   ├── test_pdf_service.py
  │   │   └── test_user_service.py
  │   └── integration/     # 集成测试
  │       ├── test_pdf_api.py
  │       └── test_user_api.py
  ├── frontend/            # 前端测试
  │   ├── unit/            # 组件测试
  │   │   ├── PdfViewer.spec.js
  │   │   └── FileUploader.spec.js
  │   └── e2e/            # 端到端测试
  │       ├── pdf-viewer.spec.js
  │       └── file-upload.spec.js
  └── fixtures/            # 测试数据
      ├── sample.pdf
      └── test_data.json
  
  # 文档结构
  docs/
  ├── SPEC/                # 规范文档
  │   ├── SPEC-HEAD-001.yml
  │   ├── SPEC-NAMING-FILE-001.md
  │   └── ...
  ├── api/                 # API文档
  │   ├── pdf-api.md
  │   └── user-api.md
  ├── user-guide/          # 用户指南
  │   ├── installation.md
  │   └── usage.md
  └── deployment/          # 部署文档
      ├── docker.md
      └── production.md
  ```
- 反向例子:
  ```
  # 错误的项目根目录结构
  anki-linkmaster-PDFJS/
  ├── code/                # 不明确的目录名
  ├── docs/                # 文档
  ├── files/               # 不明确的目录名
  ├── package.json
  ├── requirements.txt
  ├── main.py             # 不规范的入口文件名
  └── server.py           # 多个入口文件
  
  # 错误的后端结构
  src/backend/
  ├── pdf.py              # 单文件包含所有功能
  ├── user.py
  ├── database.py         # 数据库逻辑分散
  ├── api.py              # API逻辑分散
  └── utils.py           # 所有工具函数混在一起
  
  # 错误的前端结构
  src/frontend/
  ├── src/
  │   ├── components/     # 组件未分类
  │   │   ├── PdfViewer.vue
  │   │   ├── UserList.vue
  │   │   ├── FileUpload.vue
  │   │   └── Navigation.vue
  │   ├── views/          # 视图未分类
  │   │   ├── Home.vue
  │   │   ├── Pdf.vue
  │   │   ├── User.vue
  │   │   └── Settings.vue
  │   ├── api.js          # 所有API调用混在一起
  │   ├── store.js        # 所有状态混在一起
  │   └── utils.js        # 所有工具函数混在一起
  ├── public/
  └── tests/              # 测试文件未分类
      ├── test.js
      └── e2e.js
  
  # 错误的模块组织
  src/
  ├── pdf/                # 模块名不明确
  ├── anki/               # 模块名不明确
  ├── common/             # 通用模块名不明确
  └── shared/             # 重复的通用模块
  
  # 错误的测试结构
  tests/
  ├── test_pdf.py         # 测试文件未分类
  ├── test_user.py
  ├── test_api.py
  ├── test_frontend.js
  └── test_e2e.js
  
  # 错误的文档结构
  docs/
  ├── spec.md             # 单文件包含所有规范
  ├── api.md              # 单文件包含所有API文档
  ├── guide.md            # 单文件包含所有指南
  └── deploy.md           # 单文件包含所有部署信息
  
  # 错误的文件命名
  src/
  ├── PdfViewer.js        # 混合大小写
  ├── pdf_viewer.js       # 下划线而非kebab-case
  ├── PDFViewer.vue       # 混合大小写
  ├── pdfViewer.vue       # 小驼峰
  └── pdf-viewer.Vue      # 大写扩展名
  
  # 错误的目录命名
  src/
  ├── PdfViewer/          # 混合大小写
  ├── pdf_viewer/         # 下划线而非kebab-case
  ├── PDFViewer/          # 混合大小写
  ├── pdfViewer/          # 小驼峰
  └── pdf-viewer/         # 正确的kebab-case