@echo off
REM Windows批处理脚本 - 启动不带UI的后端服务器测试
REM
REM 功能: 使用命令行参数 --no-ui 启动测试

echo.
echo ========================================
echo   启动测试（无UI模式 --no-ui）
echo ========================================
echo.

REM 运行测试脚本，传递 --no-ui 参数
python src\backend\__tests__\manual_test_ui.py --no-ui

pause
