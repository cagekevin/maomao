#!/bin/bash
# 2026-09-14 · 恢复 TTS 能力（方案甲：文件回来，服务端调用改 localTool 占位）
#
# 背景：搬迁时把 TTS 误判为「AI 相关」删除。
# 实测：代码量小（约 300 行）、依赖干净；但 `lib/tts/service.ts` 调 cutia 的
#       Next 服务端路由 `/api/tts/generate`（转发第三方 api.milorapart.top），
#       我们不搬 Next 服务端 → 改为调 localTool 占位端点（调用即明确报错，不静默）。
# 依据：docs/133 §〇.4（误删审计）；用户 2026-09-14 裁定「按甲」。
set -e
cd "$(dirname "$0")/../.." || exit 1

SRC=/tmp/cutia/apps/web/src
DST=src/components/videoEditor

echo "===== 1. 恢复文件 ====="
cp "$SRC/lib/tts/service.ts"                                   "$DST/engine/lib/tts/service.ts" 2>/dev/null || {
  mkdir -p "$DST/engine/lib/tts"
  cp "$SRC/lib/tts/service.ts" "$DST/engine/lib/tts/service.ts"
}
cp "$SRC/components/editor/panels/properties/text-speech-panel.tsx" "$DST/ui/editor/panels/properties/"
cp "$SRC/constants/tts-constants.ts"                           "$DST/constants/"
echo "  tts/service.ts / text-speech-panel.tsx / tts-constants.ts"

echo "===== 2. 别名映射 ====="
FILES="$DST/engine/lib/tts/service.ts $DST/ui/editor/panels/properties/text-speech-panel.tsx $DST/constants/tts-constants.ts"
echo "$FILES" | tr ' ' '\n' | xargs sed -i '' \
  -e 's|"@/lib/commands|"@videoEditor/engine/commands|g' \
  -e 's|"@/lib/timeline|"@videoEditor/engine/timeline|g' \
  -e 's|"@/lib/|"@videoEditor/engine/lib/|g' \
  -e 's|"@/core|"@videoEditor/engine/core|g' \
  -e 's|"@/services|"@videoEditor/engine/services|g' \
  -e 's|"@/components|"@videoEditor/ui|g' \
  -e 's|"@/hooks|"@videoEditor/hooks-cutia|g' \
  -e 's|"@/stores|"@videoEditor/stores|g' \
  -e 's|"@/types|"@videoEditor/types|g' \
  -e 's|"@/constants|"@videoEditor/constants|g' \
  -e 's|"@/utils|"@videoEditor/utils|g'
echo "  剩余 @/ ：$(grep -ho '"@/[a-zA-Z0-9_/-]*"' $FILES 2>/dev/null | wc -l | tr -d ' ')"

echo "===== 3. TTS 端点改 localTool 占位 ====="
# cutia: fetch("/api/tts/generate", ...)  → 明确报错（待接 localTool）
echo "  待脚本第 4 步处理（python 精确改）"
echo ""
echo "===== 恢复完成，请跑 npm run type-check ====="
