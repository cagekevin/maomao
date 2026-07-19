@echo off
chcp 65001 >nul 2>&1
title 一毛AI画布 — 本地工具服务

cd /d "%~dp0localTool"

:: 首次运行自动安装依赖
if not exist "node_modules" (
    echo 正在安装依赖...
    npm install
    echo.
)

:: 首次运行自动编译
if not exist "dist\index.js" (
    echo 正在编译...
    npm run build
    echo.
)

:: 端口冲突自动清理
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :18080 ^| findstr LISTENING') do (
    echo 端口 18080 被占用 (PID: %%a)，正在关闭...
    taskkill /F /PID %%a >nul 2>&1
    timeout /t 1 /nobreak >nul
)

echo.
echo 启动 localTool 服务 (端口 18080)...
echo 按 Ctrl+C 停止
echo.
node dist\index.js

pause
