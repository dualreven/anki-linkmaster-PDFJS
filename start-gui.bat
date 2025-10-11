@echo off
REM ===================================================
REM  Anki LinkMaster PDFJS - GUI启动器
REM ===================================================
REM
REM  功能：启动图形化启动器
REM  支持：后端启动模式切换（子进程 / Qt线程）
REM        前端窗口启动（双模式架构）
REM
REM ===================================================

echo.
echo ===================================================
echo   Anki LinkMaster PDFJS - GUI启动器
echo ===================================================
echo.
echo   支持功能:
echo   - 启动 Vite 开发服务器
echo   - 启动后端服务器（两种模式可选）
echo   - 启动 PDF-Home / PDF-Viewer
echo.
echo   后端启动模式:
echo   ^> 子进程模式: 使用 subprocess (稳定可靠)
echo   ^> Qt线程模式: 使用 BackendLauncher (推荐用于Anki)
echo.
echo ===================================================
echo.

REM 检查Python环境
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Python，请先安装 Python 3.8+
    pause
    exit /b 1
)

REM 检查文件是否存在
if not exist "gui_launcher.py" (
    echo [错误] 找不到 gui_launcher.py
    echo.
    echo 请确保在项目根目录运行此脚本
    pause
    exit /b 1
)

REM 启动GUI启动器
echo [启动] 正在启动GUI启动器...
echo.
python gui_launcher.py

if errorlevel 1 (
    echo.
    echo [错误] GUI启动器运行失败
    echo.
    echo 可能的原因:
    echo   - Python 依赖缺失 (请运行: pip install PyQt6)
    echo   - 端口被占用
    echo   - 系统资源不足
    echo.
    pause
    exit /b 1
)

echo.
echo [完成] GUI启动器已退出
pause
