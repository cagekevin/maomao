# Agent 独立服务启动入口（不依赖 main.py）
# 用法：python agent_server.py  [--port 8788] [--host 0.0.0.0]
import argparse
import os
import sys

import uvicorn

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agent.app import app

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AI 生图 Agent 独立服务")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8788)
    args = parser.parse_args()
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
