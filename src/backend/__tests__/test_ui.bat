@echo off
REM Windows批处理脚本 - 启动带UI的后端服务器测试
REM
REM 功能: 使用命令行参数 --show-ui 启动测试

echo.
echo ========================================
echo   启动测试UI (--show-ui)
echo ========================================
echo.

REM 运行测试脚本，传递 --show-ui 参数
python src\backend\__tests__\manual_test_ui.py --show-ui

pause
