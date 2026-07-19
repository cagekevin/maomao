#!/bin/bash
# 一毛AI画布 — 本地工具服务 一键启动脚本
# 用法: ./start.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# 首次运行自动编译
if [ ! -d "dist" ] || [ ! -f "dist/index.js" ]; then
  echo "📦 首次运行，正在编译 TypeScript..."
  npm run build
  echo ""
fi

# 启动服务
echo "🚀 启动 localTool 服务..."
node dist/index.js
