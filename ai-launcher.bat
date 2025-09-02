@echo off
chcp 65001 >nul
echo ===================================
echo Anki LinkMaster PDFJS - AI专用启动器
echo ===================================
echo.

:: 设置工作目录
cd /d "%~dp0"

:: 创建日志目录
if not exist "logs" mkdir logs

:: 检查是否为停止命令
if "%1"=="stop" goto stop_processes
if "%1"=="kill" goto kill_processes

:: 启动三个进程
echo 正在启动开发环境...

:: 1. 启动 npm run dev (后台运行)
echo [1/3] 启动 npm run dev...
start "npm-dev" cmd /c "npm run dev > logs/npm-dev.log 2>&1"

:: 等待npm服务启动
echo 等待npm服务启动...
timeout /t 5 /nobreak >nul

:: 2. 启动 debug.py (端口9222)
echo [2/3] 启动 debug.py...
start "debug-py" cmd /c "python debug.py --port 9222 > logs/debug.log 2>&1"

:: 等待debug服务启动
echo 等待debug服务启动...
timeout /t 2 /nobreak >nul

:: 3. 启动 app.py (主程序)
echo [3/3] 启动 app.py...
start "main-app" cmd /c "python app.py > logs/app.log 2>&1"

echo.
echo ===================================
echo 所有服务已启动！
echo ===================================
echo.
echo 服务信息：
echo - npm dev server: http://localhost:3000
echo - Debug console: 端口 9222
echo - 主应用: 已启动
echo.
echo 日志文件位置：
echo - npm日志: logs\npm-dev.log
echo - debug日志: logs\debug.log
echo - app日志: logs\app.log
echo.
echo 使用方法：
echo - %~nx0 stop  : 停止所有服务
echo - %~nx0 kill   : 强制终止所有服务
echo.
echo 提示：请等待几秒钟让所有服务完全启动
goto end

:stop_processes
echo 正在停止所有服务...
taskkill /FI "WINDOWTITLE eq npm-dev*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq debug-py*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq main-app*" /F >nul 2>&1

:: 额外终止可能的进程
taskkill /IM node.exe /F >nul 2>&1
taskkill /IM python.exe /F >nul 2>&1

echo 所有服务已停止
goto end

:kill_processes
echo 正在强制终止所有相关进程...
taskkill /IM node.exe /F >nul 2>&1
taskkill /IM python.exe /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq npm-dev*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq debug-py*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq main-app*" /F >nul 2>&1

echo 所有进程已强制终止
goto end

:end
echo.
pause