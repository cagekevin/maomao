#!/bin/bash
# 猫猫AI画布 — 本地工具 启动/构建 脚本
# 双击运行进入菜单；也可带参数: ./start-localtool.command 1 (启动) | 2 (构建)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── 构建主项目 dist (v1) ──
# ⚠️ 唯一合法构建命令：npm run build（CLAUDE.md 铁律，禁止 npx vite build）
build_dist() {
  echo "🔨 正在构建 dist (v1)..."
  cd "$SCRIPT_DIR" || exit 1

  # 首次运行自动安装依赖
  if [ ! -d "node_modules" ]; then
    echo "📦 首次运行，正在安装依赖..."
    npm install
    echo ""
  fi

  # 双击运行时 shell 未加载 npm 环境，需把本项目 node_modules/.bin 加入 PATH，
  # 否则 cross-env / vite 解析不到（sh: cross-env: command not found）
  export PATH="$SCRIPT_DIR/node_modules/.bin:$PATH"
  npm run build || { echo "❌ 构建失败，请检查上方报错"; exit 1; }
  echo "✅ dist 构建完成"
}

# ── 启动 localTool 服务 ──
start_service() {
  cd "$SCRIPT_DIR/localTool" || exit 1

  # 首次运行自动安装依赖
  if [ ! -d "node_modules" ]; then
    echo "📦 首次运行，正在安装依赖..."
    npm install
    echo ""
  fi

  # 首次运行自动编译
  if [ ! -f "dist/index.js" ]; then
    echo "📦 正在编译 TypeScript..."
    npm run build
    echo ""
  fi

  # 端口冲突自动清理
  PORT=18080
  PID=$(lsof -ti :$PORT 2>/dev/null || true)
  if [ -n "$PID" ]; then
    echo "⚠️  端口 $PORT 被占用 (PID: $PID)，正在关闭旧进程..."
    kill $PID 2>/dev/null
    sleep 1
    PID2=$(lsof -ti :$PORT 2>/dev/null || true)
    if [ -n "$PID2" ]; then
      kill -9 $PID2 2>/dev/null
      sleep 0.5
    fi
    echo "✅ 旧进程已关闭"
    echo ""
  fi

  echo "🚀 启动 localTool 服务 (端口 $PORT)..."
  echo "   按 Ctrl+C 停止"
  echo ""
  node dist/index.js
}

# ── 带参数直接执行（非交互）──
case "$1" in
  1) start_service; exit 0 ;;
  2) build_dist; exit 0 ;;
esac

# ── 交互菜单 ──
echo "=================================="
echo "   猫猫AI画布 — 本地工具"
echo "=================================="
echo "   [1] 启动 localTool 服务"
echo "   [2] 构建 dist (v1)"
echo "   [q] 退出"
echo "=================================="
read -r -p "请选择 (1/2/q): " CHOICE
case "$CHOICE" in
  1) start_service ;;
  2) build_dist ;;
  q|Q) echo "已退出"; exit 0 ;;
  *) echo "❌ 无效选择"; exit 1 ;;
esac

# 防止双击运行时窗口秒关
read -r -p "按回车键退出..."
