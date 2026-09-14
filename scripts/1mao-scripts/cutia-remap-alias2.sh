#!/bin/bash
# 2026-09-14 · cutia 搬迁别名重映射 · 第二批（补齐 engine/lib 剩余 + data）
# 依据：docs/130-cutia搬迁计划书 · 用户裁定「全搬，多余再删」。
set -e
cd "$(dirname "$0")/../.." || exit 1
cd src/components/videoEditor

FILES=$(find engine ui hooks-cutia stores types constants utils data -type f \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null)
echo "文件数: $(echo "$FILES" | wc -l | tr -d ' ')"

# 双引号形态
echo "$FILES" | xargs sed -i '' \
  -e 's|"@/lib/|"@videoEditor/engine/lib/|g' \
  -e 's|"@/data/|"@videoEditor/data/|g'
# 单引号形态
echo "$FILES" | xargs sed -i '' \
  -e "s|'@/lib/|'@videoEditor/engine/lib/|g" \
  -e "s|'@/data/|'@videoEditor/data/|g"

echo "=== 剩余未映射 @/（应为 0）==="
grep -rho '"@/[a-zA-Z0-9_/-]*"' engine ui hooks-cutia stores types constants utils data 2>/dev/null \
  | sed 's/"@\///' | sed 's|/.*||' | sort | uniq -c | sort -rn || true
echo "=== 裸 @/ 引用（非字符串开头，如 dynamic import）==="
grep -rn "import(\"@/\|import('@/" engine ui hooks-cutia stores types constants utils 2>/dev/null | head -10 || true
