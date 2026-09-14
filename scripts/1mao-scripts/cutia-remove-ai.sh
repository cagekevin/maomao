#!/bin/bash
# 2026-09-14 · cutia 搬迁 · 删除 AI 域（用户裁定）
# 范围：agent 面板 + ai.tsx + tts + captions + 相关 stores + engine/lib/ai
# 依据：docs/130-cutia搬迁计划书；用户 2026-09-14 确认
#   「删 agent面板 + ai.tsx + tts + captions + 相关 stores」
set -e
cd "$(dirname "$0")/../.." || exit 1
cd src/components/videoEditor

echo "===== 1. AI 面板与视图 ====="
rm -rf ui/editor/panels/assets/views/agent
rm -f  ui/editor/panels/assets/views/ai.tsx
rm -f  ui/editor/panels/assets/views/captions.tsx
rm -f  ui/editor/panels/assets/views/sounds.tsx   # 音效库依赖 AI 生成（sounds-store 用 ai 域）

echo "===== 2. AI 相关 stores ====="
rm -f stores/agent-store.ts
rm -f stores/ai-generation-history-store.ts
rm -f stores/ai-image-generation-store.ts
rm -f stores/ai-settings-store.ts
rm -f stores/ai-video-generation-store.ts
rm -f stores/character-store.ts
rm -f stores/sounds-store.ts

echo "===== 3. engine/lib/ai + tts ====="
rm -rf engine/lib/ai
rm -rf engine/lib/tts

echo "===== 4. 相关 types ====="
rm -f types/character.ts
rm -f types/sounds.ts

echo "===== 5. 常量 ====="
rm -f constants/tts-constants.ts
rm -f constants/transcription-constants.ts

echo "===== 6. 组件（properties 里的语音面板）====="
rm -f ui/editor/panels/properties/text-speech-panel.tsx

echo "===== 完成，请跑 npm run type-check 看待修缺口 ====="
