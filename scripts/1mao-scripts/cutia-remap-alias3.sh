#!/bin/bash
# 2026-09-14 · cutia 搬迁别名重映射 · 第三批（对全量搬入文件做统一收敛）
# 前两批按目录分批映射，导致 engine/lib 内部文件的 @/constants 等未被覆盖。本批统一补齐。
# 幂等：已映射为 @videoEditor/ 的字符串不会被再改（模式只匹配 `"@/`）。
set -e
cd "$(dirname "$0")/../.." || exit 1
cd src/components/videoEditor

FILES=$(find engine ui hooks-cutia stores types constants utils data -type f \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null)
echo "文件数: $(echo "$FILES" | wc -l | tr -d ' ')"

# 顺序：长前缀先、短前缀后
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
  -e 's|"@/utils|"@videoEditor/utils|g' \
  -e 's|"@/data/|"@videoEditor/data/|g'

echo "=== 剩余 @/ 引用（应为 0）==="
grep -rho '"@/[a-zA-Z0-9_/-]*"' engine ui hooks-cutia stores types constants utils data 2>/dev/null | sort -u || echo "(无)"
