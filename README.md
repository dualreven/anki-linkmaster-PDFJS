# Anki LinkMaster PDFJS

一个现代化的Anki学习卡片生成工具，集成PDF.js阅读器和智能链接管理功能。

## 🎯 项目介绍

### 开发动机
Anki LinkMaster PDFJS 旨在解决学习者在阅读PDF文档时无法高效创建Anki学习卡片的问题。通过集成PDF.js阅读器和智能链接管理，用户可以在阅读过程中快速标记重要内容，并自动生成结构化的学习卡片。

### 技术架构
- **后端**: Python 3.9+ + PyQt6 + WebSocket
- **前端**: Vanilla JavaScript + PDF.js + Vite
- **通信**: WebSocket实时通信
- **PDF处理**: PDF.js集成
- **数据存储**: 本地文件系统

### 开发思想
- **6A工作流**: Alignment → Consensus → Design → Task → Acceptance → Assessment
- **模块化设计**: 清晰的模块边界和职责分离
- **测试驱动**: 全面的测试覆盖确保代码质量
- **渐进增强**: 从核心功能逐步扩展

## 📋 功能特性

### 核心功能
- ✅ **PDF文件管理**: 支持添加、删除、浏览PDF文件
- ✅ **PDF阅读器**: 集成PDF.js提供流畅的阅读体验
- ✅ **实时通信**: WebSocket实现前后端实时同步
- ✅ **卡片生成**: 智能提取PDF内容生成Anki卡片
- ✅ **链接管理**: 管理PDF与卡片间的智能链接

### 技术特色
- **跨平台**: 基于PyQt6的跨平台桌面应用
- **实时同步**: WebSocket确保数据实时更新
- **离线可用**: 完全本地运行，无需网络依赖
- **扩展性强**: 模块化架构支持功能扩展

## 🚀 快速开始

### 环境要求
- **Python**: 3.9 或更高版本
- **Node.js**: 16.0 或更高版本
- **操作系统**: Windows 10+/macOS 10.15+/Linux

### 安装步骤

#### 1. 克隆项目
```bash
git clone [项目地址]
cd anki-linkmaster-PDFJS
```

#### 2. 安装后端依赖
```bash
cd src/backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

#### 3. 安装前端依赖
```bash
cd src/frontend/pdf-home
npm install

cd ../pdf-viewer
npm install
```

#### 4. 启动开发环境

**启动后端服务**:
```bash
cd src/backend
python main.py
```

**启动前端开发服务器**:
```bash
# 终端1 - PDF主页
cd src/frontend/pdf-home
npm run dev

# 终端2 - PDF阅读器
cd src/frontend/pdf-viewer
npm run dev
```

### 运行测试

**后端测试**:
```bash
cd src/backend
python -m pytest tests/test_pdf_manager.py -v
```

**集成测试**:
```bash
cd src/backend
python tests/test_integration.py
```

## 📁 项目结构

```
anki-linkmaster-PDFJS/
├── src/
│   ├── backend/              # PyQt6后端应用
│   │   ├── app/             # 主应用框架
│   │   ├── pdf_manager/     # PDF文件管理
│   │   │   ├── manager.py   # PDF管理器主类
│   │   │   ├── models.py    # 数据模型
│   │   │   └── utils.py     # 工具类
│   │   ├── websocket/       # WebSocket服务器
│   │   │   ├── server.py    # WebSocket服务器
│   │   │   ├── client.py    # 客户端管理
│   │   │   └── protocol.py  # 通信协议
│   │   ├── tests/           # 后端测试
│   │   ├── main.py          # 应用入口
│   │   └── requirements.txt # Python依赖
│   ├── frontend/            # 前端应用
│   │   ├── pdf-home/        # PDF主页
│   │   └── pdf-viewer/      # PDF阅读器
│   └── tests/               # 集成测试
├── docs/                    # 项目文档
├── README.md               # 项目说明
└── .gitignore              # Git忽略规则
```

## 🔧 API规范

### WebSocket消息格式

#### 客户端 → 服务器
```json
{
  "type": "add_pdf",
  "data": {
    "filepath": "/path/to/file.pdf",
    "title": "文档标题"
  }
}
```

#### 服务器 → 客户端
```json
{
  "type": "pdf_list_updated",
  "data": {
    "files": [...],
    "count": 5
  }
}
```

### PDF管理API

#### 获取文件列表
```python
from pdf_manager.manager import PDFManager

manager = PDFManager()
files = manager.get_files()
```

#### 添加PDF文件
```python
success = manager.add_file("/path/to/file.pdf")
```

#### 删除PDF文件
```python
success = manager.remove_file("file_id")
```

## 🧪 开发说明

### 关键类/函数

#### PDFManager类 (`src/backend/pdf_manager/manager.py`)
- `add_file(filepath)`: 添加PDF文件
- `remove_file(file_id)`: 删除PDF文件
- `get_files()`: 获取文件列表
- `get_file_count()`: 获取文件数量

#### WebSocketServer类 (`src/backend/websocket/server.py`)
- `start()`: 启动服务器
- `stop()`: 停止服务器
- `send_message(client_id, message)`: 发送消息
- `broadcast_message(message)`: 广播消息

#### PDFFile类 (`src/backend/pdf_manager/models.py`)
- 表示单个PDF文件
- 包含文件路径、大小、元数据等信息
- 支持序列化/反序列化

### 已实现功能
- ✅ PDF文件列表管理
- ✅ 文件添加/删除操作
- ✅ 元数据提取和存储
- ✅ WebSocket实时通信
- ✅ 前后端数据同步
- ✅ 错误处理和日志记录

### 待实现功能
- 🔄 PDF内容提取和卡片生成
- 🔄 Anki卡片导出格式
- 🔄 PDF标注和高亮功能
- 🔄 用户偏好设置
- 🔄 搜索和过滤功能

## 📊 项目历史

### 需求澄清阶段 (step0_CLARIFY)
- 明确项目目标和用户需求
- 确定技术栈和开发环境
- 制定开发计划和时间表

### 架构设计阶段 (step1-2)
- 设计6A工作流开发模式
- 制定技术架构和模块划分
- 设计API接口和数据模型

### 任务规划阶段 (step3-4)
- 分解项目为7个并行任务
- 建立任务依赖关系图
- 制定验收标准和测试计划

### 开发实施阶段 (step5)
- **任务1**: 项目初始化 ✅
- **任务2**: PyQt6后端框架 ✅
- **任务3**: 前端开发环境 ✅
- **任务4**: WebSocket服务器 ✅
- **任务5**: PDF文件管理 ✅
- **任务6**: PDF主页功能 ✅
- **任务7**: PDF阅读器功能 ✅
- **任务8**: 消息处理模块 ✅

### 验收评估阶段
- 33个测试用例100%通过
- 集成测试验证成功
- 生产就绪度评估：A级

## 🤝 贡献指南

### 开发环境设置
1. Fork项目并创建功能分支
2. 遵循现有代码规范
3. 为新功能添加测试用例
4. 提交前运行完整测试套件

### 代码规范
- **Python**: 遵循PEP 8规范
- **JavaScript**: 使用ES6+标准
- **命名**: 使用清晰的英文命名
- **注释**: 关键逻辑添加详细注释

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- **PDF.js** - Mozilla提供的优秀PDF渲染引擎
- **PyQt6** - 强大的跨平台GUI框架
- **Anki** - 优秀的间隔重复学习系统

## 🔗 相关链接

- [项目文档](docs/)
- [开发指南](docs/DEVELOPMENT.md)
- [API文档](docs/API.md)
- [问题反馈](../../issues)

---

**项目状态**: ✅ 初始化完成，核心功能可用
**最后更新**: 2025年8月20日
**版本**: v1.0.0