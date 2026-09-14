#!/bin/bash
# 2026-09-14 · cutia 搬迁 · 删除范围外模块（整站壳 / 后端 / 角色库 / 移动端 / 孤立原语）
# 依据：docs/130-cutia搬迁计划书 · 用户裁定「删」。
# 原则：只删"打开编辑器看不见"的东西；编辑器主链路（engine/ui/editor）不动。
set -e
cd "$(dirname "$0")/../.." || exit 1
cd src/components/videoEditor

echo "===== A. 整站壳（cutia 官网）====="
rm -rf ui/landing
rm -f  ui/header.tsx ui/footer.tsx ui/theme-toggle.tsx ui/language-toggle.tsx
rm -f  ui/gitHub-contribute-section.tsx
rm -rf ui/providers
echo "  已删 13 项"

echo "===== B. 后端 / 基础设施 ====="
rm -rf engine/lib/auth engine/lib/db engine/lib/r2
rm -f  engine/lib/rate-limit.ts engine/lib/navigation.ts
rm -rf engine/services/feedback engine/services/transcription
rm -rf engine/lib/transcription
echo "  已删"

echo "===== C. characters（AI 角色库）====="
rm -rf ui/characters
echo "  已删"

echo "===== D. mobile（手机端编辑器）====="
rm -rf ui/editor/mobile
echo "  已删"

echo "===== E. 孤立 shadcn 原语（仅整站壳使用）====="
rm -f ui/ui/chart.tsx              # 依赖 recharts
rm -f ui/ui/calendar.tsx           # 依赖 react-day-picker
rm -f ui/ui/phone-input.tsx        # 依赖 react-phone-number-input
rm -f ui/ui/form.tsx               # 依赖 react-hook-form
rm -f ui/ui/react-markdown-wrapper.tsx
echo "  已删 5 项"

echo "===== F. feedback 对话框（依赖 react-hook-form）====="
rm -rf ui/feedback
rm -f  constants/feedback-constants.ts
echo "  已删"

echo "===== G. 测试文件（引用 bun:test / 旧 monorepo 路径）→ 移入 _legacy ====="
mkdir -p _legacy/tests-cutia
find engine ui stores -type d -name "__tests__" 2>/dev/null | while read -r d; do
  rel=$(echo "$d" | tr '/' '_')
  mv "$d" "_legacy/tests-cutia/$rel" 2>/dev/null && echo "  moved: $d"
done
find engine ui stores -name "*.test.ts" -o -name "*.test.tsx" 2>/dev/null | while read -r f; do
  mv "$f" "_legacy/tests-cutia/$(basename "$f")" 2>/dev/null && echo "  moved: $f"
done
# engine/lib/__tests__ 也一并处理
[ -d engine/lib/__tests__ ] && mv engine/lib/__tests__ _legacy/tests-cutia/engine_lib___tests__ 2>/dev/null || true
echo "  已移"

echo ""
echo "===== 清理完成，请运行 npm run type-check ====="
