#!/bin/bash
# 一键启动 APIMart-Lovart 网关（端口 9004）
# 双击运行：若端口 9004 已有进程，先关闭再启动。
# 启动后服务完全脱离本终端，关闭终端窗口也不会停止。

# 加载 shell 配置，确保能找到 pyenv 管理的 python / uvicorn
export PATH="$HOME/.pyenv/bin:$PATH"
eval "$(pyenv init -)" 2>/dev/null
export PATH="$HOME/.local/bin:$PATH"

# 切到脚本自身所在目录（与 main.py / .env 同目录）
cd "$(dirname "$0")"

PORT=9004
LOG="/tmp/apimart_${PORT}.log"

echo "============================================"
echo "   APIMart-Lovart 网关启动器"
echo "============================================"
echo ""

# ────────────────────────────────────────────
# 1. 关闭旧进程（按进程名 + 按端口），必须先关再启
# ────────────────────────────────────────────
echo "[1/4] 关闭端口 $PORT 上的旧进程（如有）..."

# 按 uvicorn 进程名杀
if pkill -f "uvicorn main:app" 2>/dev/null; then
    echo "      ✅ 已终止旧的 uvicorn 进程"
else
    echo "      ℹ️  未发现 uvicorn 进程"
fi

# 按端口杀（macOS 用 lsof）
if command -v lsof >/dev/null 2>&1; then
    PIDS=$(lsof -ti tcp:$PORT 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        echo "      端口 $PORT 仍被占用 (PID: $PIDS)，强制终止..."
        kill $PIDS 2>/dev/null || true
        sleep 1
        kill -9 $PIDS 2>/dev/null || true
    fi
fi

# 等待端口真正释放，避免 "address already in use"
echo "      等待端口 $PORT 释放..."
for i in $(seq 1 10); do
    if command -v lsof >/dev/null 2>&1; then
        REMAIN=$(lsof -ti tcp:$PORT 2>/dev/null || true)
        if [ -z "$REMAIN" ]; then break; fi
    else
        break
    fi
    sleep 1
done
echo "      ✅ 端口已清理"
echo ""

# ────────────────────────────────────────────
# 2. 加载 .env（含 OPEN_RELAY / LOVART_* 等配置）
# ────────────────────────────────────────────
echo "[2/4] 加载 .env 配置..."
if [ -f .env ]; then
    set -a
    source .env
    set +a
    echo "      ✅ 已加载 .env"
else
    echo "      ⚠️  未找到 .env，将使用代码内默认值"
fi
echo ""

# ────────────────────────────────────────────
# 3. 启动网关（完全脱离终端，日志写入 $LOG）
# ────────────────────────────────────────────
echo "[3/4] 启动网关 (0.0.0.0:$PORT)..."
nohup python3 -m uvicorn main:app --host 0.0.0.0 --port $PORT > "$LOG" 2>&1 &
disown
echo "      日志： $LOG"
echo ""

# ────────────────────────────────────────────
# 4. 健康检查
# ────────────────────────────────────────────
echo "[4/4] 健康检查..."
sleep 3
if pgrep -f "uvicorn main:app" >/dev/null 2>&1; then
    CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/health" 2>/dev/null || echo "000")
    echo "      ✅ 进程已启动, /health -> HTTP $CODE"
    echo "      Base URL: http://127.0.0.1:$PORT"
    echo "      API Key:  随便填即可（OPEN_RELAY=true）"
else
    echo "      ❌ 进程未启动，最后日志："
    tail -n 15 "$LOG" 2>/dev/null
fi
echo ""
echo "============================================"
echo "   启动完成。关闭此终端窗口不会停止服务。"
echo "   停止服务： pkill -f 'uvicorn main:app'"
echo "============================================"
echo ""
read -p "按回车键退出..."
