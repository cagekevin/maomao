@echo off
REM 本机启动网关，供无限画布（APIMart 客户端）调用。
REM 监听 127.0.0.1:8000，仅本机可访问；凭据从同目录 .env 读取（KEY=VALUE 逐行）。
cd /d "%~dp0"
REM 逐行读取 .env 并 set 到当前环境（忽略空行与 # 注释）
for /f "usebackq tokens=* eol=#" %%i in (".env") do (
    set "line=%%i"
    if not "%%i"=="" set %%i
)
uvicorn main:app --host 127.0.0.1 --port 9004
