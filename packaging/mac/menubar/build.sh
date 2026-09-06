#!/bin/bash
# =====================================================================
# 猫猫画布 — 菜单栏常驻工具：一键编译并打包进 .app（可复现，无需预置 .app）
# ---------------------------------------------------------------------
# 用法（在 packaging/mac/menubar/ 下执行）：
#   ./build.sh
#
# 行为：
#   1. 若项目根 猫猫画布.app 不存在，自动用本目录 assets/ 资源搭标准骨架
#      （Contents/MacOS、Contents/Resources、生成 Info.plist，含 LSUIElement/bundle id）
#   2. swiftc 编译 main.swift → Contents/MacOS/launcher
#   3. codesign 重签整个 .app（绑定 Info.plist + bundle id，否则通知授权静默失败）
#   4. xattr -cr 清除隔离标记（否则首次双击被 Gatekeeper 拦）
#
# 说明：
#   - 成品是「纯菜单栏工具」(LSUIElement/accessory)：无 Dock 图标、不进 Cmd+Tab，
#     只在顶部菜单栏显示猫猫图标。
#   - .app 被 .gitignore 忽略，不入版本库；但 assets/ 与 Info.plist 由本脚本从
#     可复现资源生成，任何环境跑一次 build.sh 都能得到一致成品。
# =====================================================================
set -e

HERE="$(cd "$(dirname "$0")" && pwd)"
# menubar 在 packaging/mac/menubar/ → 项目根 = 上三级
ProjectRoot="$(cd "$HERE/../../.." && pwd)"

APP_NAME="猫猫画布"
BUNDLE_ID="com.maomao.launcher"
APP_DIR="$ProjectRoot/$APP_NAME.app"
LAUNCHER="$APP_DIR/Contents/MacOS/launcher"
INFO_PLIST="$APP_DIR/Contents/Info.plist"
RES_DIR="$APP_DIR/Contents/Resources"
ASSETS_DIR="$HERE/assets"

# ── 1. 确保 .app 骨架存在（缺了也能从 assets 重建）──────────────────
if [ ! -d "$APP_DIR" ]; then
  echo "📦 未发现 $APP_DIR，正在用 assets/ 重建标准 .app 骨架..."
  mkdir -p "$APP_DIR/Contents/MacOS" "$RES_DIR"

  # 资源：图标 + 菜单栏小图
  cp "$ASSETS_DIR/app.icns"    "$RES_DIR/app.icns"
  cp "$ASSETS_DIR/menubar.png" "$RES_DIR/menubar.png"

  # 生成 Info.plist（纯菜单栏 agent：LSUIElement=true）
  cat > "$INFO_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>$APP_NAME</string>
  <key>CFBundleDisplayName</key>
  <string>$APP_NAME</string>
  <key>CFBundleExecutable</key>
  <string>launcher</string>
  <key>CFBundleIdentifier</key>
  <string>$BUNDLE_ID</string>
  <key>CFBundleVersion</key>
  <string>1.0</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>LSMinimumSystemVersion</key>
  <string>11.0</string>
  <key>CFBundleIconFile</key>
  <string>app.icns</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSPrincipalClass</key>
  <string>NSApplication</string>
  <key>LSUIElement</key>
  <true/>
</dict>
</plist>
PLIST
  echo "✅ 已重建 $APP_DIR 骨架 (Info.plist 含 LSUIElement / bundle id)"
else
  echo "✅ 已存在 $APP_DIR，沿用（若想重置骨架可删除后重跑本脚本）"
  # 资源兜底：骨架在但资源被误删时补回
  mkdir -p "$RES_DIR"
  [ -f "$RES_DIR/app.icns" ]    || cp "$ASSETS_DIR/app.icns"    "$RES_DIR/app.icns"
  [ -f "$RES_DIR/menubar.png" ] || cp "$ASSETS_DIR/menubar.png" "$RES_DIR/menubar.png"
fi

# ── 2. 编译 ─────────────────────────────────────────────────────────
echo "🛠️  编译 main.swift → $LAUNCHER ..."
cd "$HERE"
swiftc -O main.swift -o "$LAUNCHER"

# ── 3. 重签名（绑定 Info.plist + bundle id）──────────────────────────
# swiftc 直编后的 ad-hoc 签名不含 Info.plist 绑定，通知/系统功能会异常。
echo "🔏 重签名 (codesign --deep --sign -，绑定 Info.plist/bundle id) ..."
codesign --force --deep --sign - --identifier "$BUNDLE_ID" "$APP_DIR"

# ── 4. 清隔离标记 ───────────────────────────────────────────────────
echo "🧹 清除隔离标记 (xattr -cr) ..."
xattr -cr "$APP_DIR"

echo "✅ 打包完成：$APP_DIR"
echo "   双击启动（纯菜单栏工具，无 Dock/Cmd+Tab，顶部菜单栏出猫猫图标）"
echo "   若修改了 main.swift，重新运行本脚本即可热更新。"
