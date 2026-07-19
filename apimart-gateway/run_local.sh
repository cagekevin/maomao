#!/bin/bash
# 本机启动网关，供无限画布（APIMart 客户端）调用。
# 监听 127.0.0.1:8000，仅本机可访问；凭据从同目录 .env 读取。
set -a
source "$(dirname "$0")/.env"
set +a
cd "$(dirname "$0")"
exec uvicorn main:app --host 127.0.0.1 --port 9004
