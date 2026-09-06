#!/bin/bash
# =====================================================================
# 猫猫画布 — 菜单栏 / Dock 常驻工具：一键编译并装进 .app
# ---------------------------------------------------------------------
# 用法（在 packaging/mac/menubar/ 下执行）：
#   ./build.sh
#
# 行为：
#   1. swiftc 编译 main.swift → 项目根 猫猫画布.app/Contents/MacOS/launcher
#   2. xattr -cr 清除隔离标记（否则首次双击被 Gatekeeper 拦）
#   3. 提示：若需要图标源，见 packaging/README
# =====================================================================
set -e

HERE="$(cd "$(dirname "$0")" && pwd)"
# menubar 在 packaging/mac/menubar/ → 项目根 = 上三级
ProjectRoot="$(cd "$HERE/../../.." && pwd)"

APP_DIR="$ProjectRoot/猫猫画布.app"
LAUNCHER="$APP_DIR/Contents/MacOS/launcher"

if [ ! -d "$APP_DIR" ]; then
  echo "❌ 未找到 app 包：$APP_DIR"
  echo "   请先在项目根构建猫猫画布.app 结构，或检查路径。"
  exit 1
fi

echo "🛠️  编译 main.swift → $LAUNCHER ..."
cd "$HERE"
swiftc -O main.swift -o "$LAUNCHER"

echo "🧹 清除隔离标记 (xattr -cr) ..."
xattr -cr "$APP_DIR"

echo "✅ 编译完成：$LAUNCHER"
echo "   双击 $APP_DIR 启动（菜单栏猫猫图标；右键出菜单）。"
echo "   若修改了代码，重新运行本脚本即可热更新。"
