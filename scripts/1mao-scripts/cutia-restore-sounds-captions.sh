#!/bin/bash
# 2026-09-14 · 恢复误删的原生能力：音效库 + 字幕（本地 Whisper）
#
# 背景：搬迁时把 sounds / captions / transcription 误判为「AI 相关」删除。
# 实测证据：它们零 AI 依赖、零后端依赖（字幕走浏览器内 Worker + transformers.js）。
# 依据：docs/133 §〇.4（误删审计）。
set -e
cd "$(dirname "$0")/../.." || exit 1

SRC=/tmp/cutia/apps/web/src
DST=src/components/videoEditor

echo "===== 1. 音效库 ====="
cp "$SRC/components/editor/panels/assets/views/sounds.tsx" "$DST/ui/editor/panels/assets/views/"
cp "$SRC/stores/sounds-store.ts"                            "$DST/stores/"
cp "$SRC/types/sounds.ts"                                   "$DST/types/"
echo "  sounds.tsx / sounds-store.ts / types/sounds.ts"

echo "===== 2. 字幕（本地 Whisper）====="
cp "$SRC/components/editor/panels/assets/views/captions.tsx" "$DST/ui/editor/panels/assets/views/"
cp "$SRC/constants/transcription-constants.ts"                "$DST/constants/"
# types/transcription.ts 已在（迁移时未删），不覆盖
mkdir -p "$DST/engine/lib/transcription" "$DST/engine/services/transcription"
cp "$SRC/lib/transcription/caption.ts"                        "$DST/engine/lib/transcription/"
cp "$SRC/services/transcription/worker.ts"                    "$DST/engine/services/transcription/"
cp "$SRC/services/transcription/service.ts"                   "$DST/engine/services/transcription/"
echo "  captions.tsx / transcription-constants / caption / worker / service"

echo "===== 3. 别名映射（@/ → @videoEditor/）====="
FILES=$(find "$DST/ui" "$DST/stores" "$DST/types" "$DST/constants" "$DST/engine" -type f \
  \( -name "sounds.tsx" -o -name "sounds-store.ts" -o -name "sounds.ts" \
     -o -name "captions.tsx" -o -name "transcription-constants.ts" -o -name "transcription.ts" \
     -o -name "caption.ts" -o -name "worker.ts" -o -name "service.ts" \) 2>/dev/null)

echo "$FILES" | xargs sed -i '' \
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

echo "  剩余 @/ 引用（应为 0）：$(grep -rho '"@/[a-zA-Z0-9_/-]*"' $FILES 2>/dev/null | wc -l | tr -d ' ')"
echo ""
echo "===== 恢复完成，请跑 npm run type-check ====="
