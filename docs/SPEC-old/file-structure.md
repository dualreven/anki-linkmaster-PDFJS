# 文件结构规范

## 项目根目录
```
anki-linkmaster-PDFJS/
├── src/                    # 源代码
├── docs/                   # 文档
├── tests/                  # 测试
├── logs/                   # 日志
├── temp/                   # 临时文件
├── package.json            # 前端依赖
├── requirements.txt        # 后端依赖
└── app.py                 # 主入口
```

## 后端结构 (Python)
```
src/backend/
├── api/                    # API接口层
│   ├── routes/            # 路由定义
│   ├── middleware/        # 中间件
│   └── validators/        # 请求验证
├── services/              # 业务逻辑
├── models/                # 数据模型
├── repositories/          # 数据访问
├── utils/                 # 工具函数
└── tests/                 # 单元测试
```

## 前端结构 (Vue)
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

## 模块组织
```
src/
├── pdf-viewer/           # PDF查看器模块
│   ├── components/       # 子组件
│   ├── stores/          # 模块状态
│   └── utils/           # 模块工具
├── anki-generator/       # Anki生成器模块
└── shared/              # 共享模块
```

## 测试结构
```
tests/
├── backend/              # 后端测试
│   ├── unit/            # 单元测试
│   └── integration/     # 集成测试
├── frontend/            # 前端测试
│   ├── unit/            # 组件测试
│   └── e2e/            # 端到端测试
└── fixtures/            # 测试数据
```

## 文档结构
```
docs/
├── SPEC/                # 规范文档
├── api/                 # API文档
├── user-guide/          # 用户指南
└── deployment/          # 部署文档
```

## 命名规则
| 类型 | 格式 | 示例 |
|---|---|---|
| 目录 | kebab-case | `pdf-viewer/`, `user-service/` |
| 文件 | kebab-case | `pdf-parser.js`, `user_model.py` |
| 测试 | `.spec.js` `.test.py` | `pdf-viewer.spec.js` |

## 检查清单
- [ ] 功能相关的文件放在一起
- [ ] 测试文件镜像源码结构
- [ ] 配置文件按环境分离
- [ ] 临时文件在.gitignore中忽略
- [ ] 目录层级不超过4层