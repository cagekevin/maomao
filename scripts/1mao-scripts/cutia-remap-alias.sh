#!/bin/bash
# 2026-09-14 · cutia 搬迁别名重映射（docs/130-cutia搬迁计划书）
# 把搬入代码的 @/xxx 改为 @videoEditor/xxx（按搬运实际落点映射）。
# 顺序要求：长前缀先、短前缀后（否则 @/lib/commands 会被 @/lib 先吃掉）。
set -e
cd "$(dirname "$0")/../.." || exit 1
cd src/components/videoEditor

FILES=$(find engine ui hooks-cutia stores types constants utils -type f \( -name "*.ts" -o -name "*.tsx" \))
echo "文件数: $(echo "$FILES" | wc -l | tr -d ' ')"

echo "$FILES" | xargs sed -i '' \
  -e 's|"@/lib/commands|"@videoEditor/engine/commands|g' \
  -e 's|"@/lib/timeline|"@videoEditor/engine/timeline|g' \
  -e 's|"@/lib/gradients|"@videoEditor/engine/lib/gradients|g' \
  -e 's|"@/lib/media|"@videoEditor/engine/lib/media|g' \
  -e 's|"@/lib/preview|"@videoEditor/engine/lib/preview|g' \
  -e 's|"@/lib/export|"@videoEditor/engine/lib/export|g' \
  -e 's|"@/lib/scenes|"@videoEditor/engine/lib/scenes|g' \
  -e 's|"@/lib/time|"@videoEditor/engine/lib/time|g' \
  -e 's|"@/lib/drag-data|"@videoEditor/engine/lib/drag-data|g' \
  -e 's|"@/core|"@videoEditor/engine/core|g' \
  -e 's|"@/services|"@videoEditor/engine/services|g' \
  -e 's|"@/components|"@videoEditor/ui|g' \
  -e 's|"@/hooks|"@videoEditor/hooks-cutia|g' \
  -e 's|"@/stores|"@videoEditor/stores|g' \
  -e 's|"@/types|"@videoEditor/types|g' \
  -e 's|"@/constants|"@videoEditor/constants|g' \
  -e 's|"@/utils|"@videoEditor/utils|g'

# 单引号形态（部分文件用 '...'）
echo "$FILES" | xargs sed -i '' \
  -e "s|'@/lib/commands|'@videoEditor/engine/commands|g" \
  -e "s|'@/lib/timeline|'@videoEditor/engine/timeline|g" \
  -e "s|'@/lib/|'@videoEditor/engine/lib/|g" \
  -e "s|'@/core|'@videoEditor/engine/core|g" \
  -e "s|'@/services|'@videoEditor/engine/services|g" \
  -e "s|'@/components|'@videoEditor/ui|g" \
  -e "s|'@/hooks|'@videoEditor/hooks-cutia|g" \
  -e "s|'@/stores|'@videoEditor/stores|g" \
  -e "s|'@/types|'@videoEditor/types|g" \
  -e "s|'@/constants|'@videoEditor/constants|g" \
  -e "s|'@/utils|'@videoEditor/utils|g"

echo "=== 剩余 @/ 前缀（未映射部分，需人工处置）==="
grep -rho '"@/[a-zA-Z0-9_/-]*"' engine ui hooks-cutia stores types constants utils 2>/dev/null \
  | sed 's/"@\///' | sed 's|/.*||' | sort | uniq -c | sort -rn
