# AI专用启动器使用说明

本项目提供了三个版本的AI专用启动器，用于解决AI调用时终端阻塞的问题。

## 启动器文件

1. **ai-launcher.bat** - Windows批处理版本
   - 优点：无需额外依赖，双击即可运行
   - 缺点：进程管理较简单

2. **ai-launcher.ps1** - PowerShell版本（推荐）
   - 优点：功能完整，进程管理精确
   - 缺点：需要PowerShell环境

3. **ai-launcher.py** - Python版本（最强大）
   - 优点：跨平台，功能最丰富
   - 缺点：需要Python环境和psutil模块

## 安装依赖

如果使用Python版本，需要安装psutil：

```bash
pip install psutil
```

## 使用方法

### Windows批处理版本

```bash
# 启动所有服务
ai-launcher.bat

# 停止所有服务
ai-launcher.bat stop

# 强制终止所有进程
ai-launcher.bat kill
```

### PowerShell版本

```powershell
# 启动所有服务
.\ai-launcher.ps1 start

# 停止所有服务
.\ai-launcher.ps1 stop

# 检查服务状态
.\ai-launcher.ps1 status

# 查看日志
.\ai-launcher.ps1 logs
```

### Python版本

```bash
# 启动所有服务
python ai-launcher.py start

# 停止所有服务
python ai-launcher.py stop

# 检查服务状态
python ai-launcher.py status

# 查看日志
python ai-launcher.py logs

# 监控服务状态
python ai-launcher.py monitor
```

## 功能特点

1. **非阻塞启动** - 所有服务都在后台运行，不会阻塞AI终端
2. **进程管理** - 记录所有进程信息，可以精确停止服务
3. **日志记录** - 每个服务的输出都记录到独立的日志文件
4. **状态检查** - 可以随时检查服务运行状态
5. **清理功能** - 自动清理残留进程

## AI集成建议

1. **快速启动** - AI可以通过简单的命令启动整个开发环境
2. **自动等待** - 启动器会自动等待服务完全启动
3. **日志访问** - AI可以通过读取日志文件了解服务运行情况
4. **一键停止** - 完成工作后可以一键停止所有服务

## 服务说明

启动器会依次启动三个服务：

1. **npm run dev** - 前端开发服务器 (端口 3000)
2. **python debug.py --port 9222** - 调试控制台监听器
3. **python app.py** - 主应用程序

## 故障排除

1. **端口占用** - 如果端口被占用，请先停止相关进程
2. **权限问题** - 确保有足够的权限启动进程
3. **依赖缺失** - 确保已安装Node.js和Python
4. **日志查看** - 通过logs命令查看详细错误信息