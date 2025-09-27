# PDF文件服务器 (pdfFile_server)

PDF文件服务器是一个模块化的HTTP文件服务组件，专门用于提供PDF文件的访问服务。该模块支持CORS跨域访问、Range请求、健康检查等功能，可以独立运行或作为其他系统的组件使用。

## 目录

- [架构概述](#架构概述)
- [模块结构](#模块结构)
- [功能特性](#功能特性)
- [安装与使用](#安装与使用)
- [API接口](#api接口)
- [配置说明](#配置说明)
- [开发指南](#开发指南)
- [故障排除](#故障排除)
- [版本历史](#版本历史)

## 架构概述

PDF文件服务器采用分层模块化架构设计，将功能按职责分解为多个独立的模块：

```
pdfFile_server/
├── config/          # 配置层 - 全局配置和常量
├── utils/           # 工具层 - 日志配置等通用工具
├── handlers/        # 处理层 - HTTP请求处理逻辑
├── server/          # 服务层 - 服务器启动和管理
├── cli/             # 接口层 - 命令行接口
└── __init__.py      # 模块入口
```

### 架构特点

- **模块化设计**: 各层职责清晰，便于维护和扩展
- **配置驱动**: 通过配置文件统一管理所有参数
- **日志规范**: 严格遵循UTF-8编码和覆盖模式
- **向后兼容**: 保持与原有接口的完全兼容性
- **独立运行**: 支持独立启动或作为组件集成

## 模块结构

### 1. 配置模块 (config/)

负责管理所有可配置的参数和系统常量。

**文件结构:**
- `settings.py`: 全局配置定义
- `__init__.py`: 模块初始化

**主要配置:**
```python
# 基础配置
DEFAULT_PORT = 8080
DEFAULT_DATA_DIR = PROJECT_ROOT / "data" / "pdfs"
SERVER_NAME = "PDF-File-Server"

# CORS配置
CORS_ENABLED = True
CORS_ORIGINS = ['*']
CORS_METHODS = ['GET', 'OPTIONS']

# 日志配置
LOG_ENCODING = 'utf-8'
LOG_FILE_MODE = 'w'  # 每次启动覆盖
```

### 2. 工具模块 (utils/)

提供通用的工具函数和配置功能。

**文件结构:**
- `logging_config.py`: 日志配置工具
- `__init__.py`: 模块初始化

**主要功能:**
- 统一的日志配置接口
- UTF-8编码支持
- 文件和控制台双输出
- 日志级别动态配置

### 3. 处理器模块 (handlers/)

实现HTTP请求的具体处理逻辑。

**文件结构:**
- `pdf_handler.py`: PDF文件请求处理器
- `__init__.py`: 模块初始化

**核心功能:**
- PDF文件GET请求处理
- CORS跨域支持
- 健康检查端点
- Range请求支持（继承自SimpleHTTPRequestHandler）

### 4. 服务器模块 (server/)

提供HTTP服务器的启动、停止和管理功能。

**文件结构:**
- `http_server.py`: HTTP服务器实现
- `__init__.py`: 模块初始化

**核心类:**
- `HttpFileServer`: 面向对象的服务器管理类
- `run_server()`: 阻塞式服务器启动函数

### 5. 命令行接口模块 (cli/)

提供命令行参数解析和启动功能。

**文件结构:**
- `main.py`: 命令行接口实现
- `__init__.py`: 模块初始化

**支持参数:**
- `--port`: 服务器端口
- `--directory`: PDF文件目录
- `--log-level`: 日志级别
- `--no-console`: 禁用控制台输出

## 功能特性

### 1. HTTP文件服务
- **PDF文件访问**: 通过 `/pdfs/` 路径访问PDF文件
- **Range请求支持**: 支持HTTP Range头，实现文件分段下载
- **MIME类型检测**: 自动识别PDF文件类型
- **目录遍历**: 支持目录结构的文件访问

### 2. CORS跨域支持
- **预检请求**: 支持OPTIONS预检请求
- **动态CORS**: 基于配置的CORS头部添加
- **多源支持**: 支持配置多个允许的来源
- **头部控制**: 精确控制允许的方法和头部

### 3. 健康检查
- **端点**: `/health`
- **响应格式**: JSON格式的状态信息
- **监控集成**: 便于系统监控和负载均衡

### 4. 日志系统
- **UTF-8编码**: 严格使用UTF-8编码
- **覆盖模式**: 每次启动覆盖日志文件
- **双重输出**: 同时输出到文件和控制台
- **级别控制**: 支持DEBUG、INFO、WARNING、ERROR级别

### 5. 配置管理
- **集中配置**: 所有配置集中在settings.py
- **环境适配**: 支持开发和生产环境配置
- **参数验证**: 启动时验证配置参数有效性

## 安装与使用

### 1. 独立运行

#### 基本使用
```bash
# 切换到模块目录
cd src/backend/pdfFile_server

# 使用默认配置启动
python -m cli.main

# 指定端口启动
python -m cli.main --port 8081

# 指定PDF目录
python -m cli.main --directory /path/to/pdfs

# 组合参数
python -m cli.main --port 8081 --directory ./pdfs --log-level DEBUG
```

#### 高级选项
```bash
# 禁用控制台输出，仅记录到文件
python -m cli.main --no-console

# 自定义日志文件
python -m cli.main --log-file ./my-server.log

# 查看帮助信息
python -m cli.main --help

# 查看版本信息
python -m cli.main --version
```

### 2. 作为模块使用

#### 阻塞式启动
```python
from pdfFile_server import run_server

# 基本启动
run_server(port=8080, directory="./data/pdfs")

# 带参数启动
run_server(
    port=8081,
    directory="/custom/pdf/path",
    blocking=True
)
```

#### 非阻塞式启动
```python
from pdfFile_server import HttpFileServer

# 创建服务器实例
server = HttpFileServer(port=8080, directory="./data/pdfs")

# 启动服务器
if server.start():
    print("服务器启动成功")

    # 检查状态
    status = server.get_status()
    print(f"服务器状态: {status}")

    # 停止服务器
    server.stop()
else:
    print("服务器启动失败")
```

#### 日志配置
```python
from pdfFile_server import setup_logging

# 基本日志配置
logger = setup_logging()

# 自定义日志配置
logger = setup_logging(
    log_file_path="./custom.log",
    console_output=True,
    log_level="DEBUG"
)
```

### 3. 与ai-launcher集成

```python
# 在ai-launcher中使用
from pdfFile_server import HttpFileServer

class PDFServerService:
    def __init__(self, port=8080, directory=None):
        self.server = HttpFileServer(port, directory)

    def start(self):
        return self.server.start()

    def stop(self):
        self.server.stop()

    def is_running(self):
        return self.server.is_running()
```

## API接口

### 1. PDF文件访问

**端点**: `/pdfs/{filename}`

**方法**: GET

**描述**: 访问指定的PDF文件

**示例**:
```bash
# 访问根目录下的文件
curl http://localhost:8080/pdfs/document.pdf

# 访问子目录中的文件
curl http://localhost:8080/pdfs/folder/document.pdf

# Range请求示例
curl -H "Range: bytes=0-1023" http://localhost:8080/pdfs/document.pdf
```

**响应**:
- `200 OK`: 文件存在，返回文件内容
- `206 Partial Content`: Range请求成功
- `404 Not Found`: 文件不存在
- `416 Range Not Satisfiable`: Range请求无效

**响应头**:
```
Content-Type: application/pdf
Access-Control-Allow-Origin: *
Content-Length: <file_size>
Accept-Ranges: bytes
```

### 2. 健康检查

**端点**: `/health`

**方法**: GET

**描述**: 检查服务器运行状态

**示例**:
```bash
curl http://localhost:8080/health
```

**响应**:
```json
{
    "status": "ok",
    "service": "PDF-File-Server"
}
```

### 3. CORS预检

**端点**: 任意路径

**方法**: OPTIONS

**描述**: 处理CORS预检请求

**示例**:
```bash
curl -X OPTIONS \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: GET" \
  http://localhost:8080/pdfs/document.pdf
```

**响应头**:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type, Range
```

## 配置说明

### 1. 基础配置

```python
# 服务器配置
DEFAULT_PORT = 8080              # 默认端口
DEFAULT_HOST = "0.0.0.0"         # 绑定地址
SERVER_NAME = "PDF-File-Server"   # 服务器名称

# 路径配置
DEFAULT_DATA_DIR = PROJECT_ROOT / "data" / "pdfs"  # PDF文件目录
DEFAULT_LOG_DIR = PROJECT_ROOT / "logs"            # 日志目录
```

### 2. 日志配置

```python
# 日志文件配置
LOG_FILE_NAME = "pdf-server.log"  # 日志文件名
LOG_LEVEL = "INFO"                # 日志级别
LOG_FORMAT = '%(asctime)s - %(levelname)s - %(message)s'
LOG_ENCODING = 'utf-8'            # 字符编码
LOG_FILE_MODE = 'w'               # 文件模式（覆盖）
```

### 3. CORS配置

```python
# CORS跨域配置
CORS_ENABLED = True               # 启用CORS
CORS_ORIGINS = ['*']              # 允许的来源
CORS_METHODS = ['GET', 'OPTIONS'] # 允许的方法
CORS_HEADERS = ['Content-Type', 'Range']  # 允许的头部
```

### 4. 安全配置

```python
# 文件安全配置
MAX_FILE_SIZE = 100 * 1024 * 1024    # 最大文件大小 (100MB)
ALLOWED_EXTENSIONS = {'.pdf'}         # 允许的文件扩展名
```

### 5. 性能配置

```python
# 性能参数
THREAD_POOL_SIZE = 10             # 线程池大小
SOCKET_TIMEOUT = 30               # 套接字超时
```

## 开发指南

### 1. 开发环境设置

```bash
# 克隆项目
git clone <project_url>
cd anki-linkmaster-PDFJS

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或
venv\Scripts\activate     # Windows

# 安装依赖
pip install -r requirements.txt
```

### 2. 运行测试

```bash
# 基本功能测试
python -m pytest tests/backend/test_pdfFile_server.py

# 集成测试
python scripts/test_pdfFile_server_integration.py

# 性能测试
python scripts/benchmark_pdfFile_server.py
```

### 3. 代码质量检查

```bash
# 代码风格检查
flake8 src/backend/pdfFile_server/

# 类型检查
mypy src/backend/pdfFile_server/

# 测试覆盖率
coverage run -m pytest
coverage report
```

### 4. 扩展开发

#### 添加新的请求处理器

```python
# 在handlers/目录下创建新的处理器
class CustomHandler(PDFFileHandler):
    def handle_custom_request(self):
        # 自定义处理逻辑
        pass
```

#### 添加新的配置选项

```python
# 在config/settings.py中添加
NEW_FEATURE_ENABLED = True
NEW_FEATURE_TIMEOUT = 60
```

#### 添加新的工具函数

```python
# 在utils/目录下创建新的工具模块
def new_utility_function():
    """新的工具函数"""
    pass
```

### 5. 调试技巧

#### 启用调试日志
```bash
python -m cli.main --log-level DEBUG
```

#### 使用Python调试器
```python
import pdb; pdb.set_trace()
```

#### 监控网络流量
```bash
# 使用netstat监控端口
netstat -tulpn | grep 8080

# 使用tcpdump抓包
tcpdump -i lo port 8080
```

## 故障排除

### 1. 常见问题

#### 端口被占用
**现象**: 启动时报错 "端口已被占用"
**解决方案**:
```bash
# 查找占用端口的进程
netstat -tulpn | grep 8080
# 或
lsof -i :8080

# 杀死占用端口的进程
kill -9 <PID>

# 或使用其他端口启动
python -m cli.main --port 8081
```

#### 文件访问权限
**现象**: 无法访问PDF文件，返回403错误
**解决方案**:
```bash
# 检查文件权限
ls -la data/pdfs/

# 修改文件权限
chmod 644 data/pdfs/*.pdf
chmod 755 data/pdfs/
```

#### 日志文件写入失败
**现象**: 启动时报日志配置错误
**解决方案**:
```bash
# 检查日志目录权限
ls -la logs/

# 创建日志目录
mkdir -p logs
chmod 755 logs/

# 检查磁盘空间
df -h
```

### 2. 性能问题

#### 大文件访问慢
**现象**: PDF文件下载速度慢
**解决方案**:
- 确保启用了Range请求支持
- 检查网络带宽限制
- 考虑使用CDN或文件缓存

#### 并发连接数限制
**现象**: 高并发时连接被拒绝
**解决方案**:
- 调整操作系统的文件描述符限制
- 增加线程池大小
- 使用负载均衡

### 3. 配置问题

#### CORS配置不当
**现象**: 浏览器报跨域错误
**解决方案**:
```python
# 检查CORS配置
CORS_ENABLED = True
CORS_ORIGINS = ['https://your-domain.com']  # 指定具体域名
CORS_METHODS = ['GET', 'OPTIONS']
```

#### 路径配置错误
**现象**: 找不到PDF文件
**解决方案**:
```python
# 检查路径配置
DEFAULT_DATA_DIR = Path("/correct/path/to/pdfs")

# 使用绝对路径
python -m cli.main --directory /absolute/path/to/pdfs
```

### 4. 调试工具

#### 日志分析
```bash
# 实时监控日志
tail -f logs/pdf-server.log

# 搜索错误日志
grep ERROR logs/pdf-server.log

# 分析访问模式
grep "GET /pdfs" logs/pdf-server.log | awk '{print $1}' | sort | uniq -c
```

#### 网络调试
```bash
# 测试健康检查
curl -v http://localhost:8080/health

# 测试文件访问
curl -I http://localhost:8080/pdfs/test.pdf

# 测试CORS
curl -X OPTIONS -H "Origin: https://example.com" http://localhost:8080/pdfs/test.pdf
```

#### 性能监控
```bash
# 监控进程资源使用
top -p <PID>

# 监控网络连接
ss -tulpn | grep 8080

# 监控磁盘I/O
iostat -x 1
```

## 版本历史

### v1.0.0 (2025-09-27)
- **新特性**:
  - 模块化架构重构
  - 完整的CORS跨域支持
  - 健康检查端点
  - UTF-8日志系统
  - 命令行接口完善
  - 面向对象的服务器管理类

- **改进**:
  - 代码结构优化，职责分离清晰
  - 配置管理统一化
  - 错误处理机制完善
  - 文档系统完整

- **兼容性**:
  - 完全向后兼容原有接口
  - 支持原有的HttpFileServer类
  - 保持与ai-launcher的集成

### v0.x (历史版本)
- 基础HTTP文件服务功能
- 简单的PDF文件访问
- 基本的日志记录

---

## 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 支持

如有问题或建议，请通过以下方式联系：

- 创建 [Issue](https://github.com/your-repo/issues)
- 发送邮件至 support@yourproject.com
- 查看 [文档](https://docs.yourproject.com)

---

**PDF文件服务器** - 简单、可靠、高效的PDF文件HTTP服务解决方案