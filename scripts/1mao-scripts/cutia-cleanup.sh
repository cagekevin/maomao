#!/bin/bash
# 2026-09-14 · cutia 搬迁 · 范围外清理 + 图标替换 + next/image 去化
# 依据：docs/130-cutia搬迁计划书-2026-09-14.md §S3/§S4；用户裁定「全搬，多余再删」。
# 本脚本只做**机械删除/替换**；任何需要设计判断的一律不在此做。
set -e
cd "$(dirname "$0")/../.." || exit 1
cd src/components/videoEditor

echo "===== 1. 删除范围外目录 ====="
# 后端/整站/AI 相关（编辑器主链路不依赖；依赖它们的 UI 一并删，见下）
rm -rf engine/lib/auth engine/lib/db engine/lib/r2 engine/lib/rate-limit.ts
rm -rf engine/services/feedback engine/services/transcription
rm -rf constants/feedback-constants.ts
rm -rf ui/landing ui/footer.tsx ui/header.tsx ui/gitHub-contribute-section.tsx ui/theme-toggle.tsx
rm -rf ui/feedback ui/characters
rm -rf ui/editor/mobile
rm -rf ui/editor/panels/agent ui/editor/onboarding.tsx
echo "  完成"

echo "===== 2. 删除引用范围外依赖的孤立 UI 原语 ====="
# 这些 shadcn 原语只服务整站壳，编辑器不用；删掉可省 5 个依赖
rm -f ui/ui/chart.tsx             # recharts
rm -f ui/ui/calendar.tsx          # react-day-picker
rm -f ui/ui/phone-input.tsx       # react-phone-number-input
rm -f ui/ui/react-markdown-wrapper.tsx  # react-markdown
echo "  完成"

echo "===== 3. next/image → <img>（编辑器主链路）====="
FILES=$(grep -rl 'from "next/image"' ui/ 2>/dev/null || true)
for f in $FILES; do
  sed -i '' \
    -e '/^import Image from "next\/image";$/d' \
    -e 's|<Image\b|<img|g' "$f"
done
# 删除 <img> 不支持的属性（fill/sizes/priority）。BSD sed 无 \b，用显式边界。
grep -rl '<img' ui/ 2>/dev/null | while read -r f; do
  sed -i '' \
    -e 's| fill={true}||g' \
    -e 's| fill={false}||g' \
    -e 's| fill||g' \
    -e 's| sizes="[^"]*"||g' \
    -e 's| priority||g' "$f"
done
echo "  剩余 next/image 引用：$(grep -rn 'next/image' ui/ 2>/dev/null | wc -l | tr -d ' ')"

echo "===== 4. hugeicons → lucide-react ====="
# 10 个图标的映射（见 docs/130 附录 §S3.2）
ICON_MAP="s/Bookmark02Icon/Bookmark/g;s/Delete02Icon/Trash2/g;s/MinusSignIcon/Minus/g;s/PauseIcon/Pause/g;s/PlayIcon/Play/g;s/PlusSignIcon/Plus/g;s/Settings05Icon/Settings/g;s/TransitionTopIcon/ArrowUpToLine/g;s/UploadIcon/Upload/g;s/UserIcon/User/g"
FILES=$(grep -rl "@hugeicons" ui/ stores/ constants/ 2>/dev/null || true)
echo "  待处理文件数：$(echo "$FILES" | grep -c . || echo 0)"
for f in $FILES; do
  # 图标名替换
  sed -i '' -e "$ICON_MAP" "$f"
  # 删掉 HugeiconsIcon / IconSvgElement import 行
  sed -i '' \
    -e '/from "@hugeicons\/core-free-icons"/d' \
    -e '/from "@hugeicons\/react"/d' "$f"
done
echo "  剩余 hugeicons 引用：$(grep -rn 'hugeicons' ui/ stores/ constants/ 2>/dev/null | wc -l | tr -d ' ')"

echo "===== 5. sonner 的 next-themes 依赖去除 ====="
if [ -f ui/ui/sonner.tsx ]; then
  sed -i '' -e '/from "next-themes"/d' -e 's|useTheme()|({ theme: "system" })|' ui/ui/sonner.tsx
fi
echo "  完成"
echo ""
echo "===== 清理完毕，请运行 npm run type-check 查看剩余缺口 ====="
