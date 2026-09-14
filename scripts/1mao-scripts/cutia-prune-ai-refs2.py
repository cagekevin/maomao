#!/usr/bin/env python3
"""2026-09-14 · cutia 搬迁 · 剪断 AI 域删除后的剩余引用（第二批）。"""
import re, shutil, os

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
os.chdir('src/components/videoEditor')

def edit(path, pairs):
    s = open(path, encoding='utf-8').read()
    for a, b in pairs:
        s = re.sub(a, b, s, flags=re.M)
    open(path, 'w', encoding='utf-8').write(s)
    print('ok', path)

# 1. storage/service.ts：sounds 类型占位
edit('engine/services/storage/service.ts', [
    (r'import type \{ SavedSoundsData, SavedSound, SoundEffect \} from "@videoEditor/types/sounds";\n',
     '// 更新(2026-09-14)：音效域已随 AI 删除，类型本地占位（保持持久化结构兼容）。\n'
     'type SavedSoundsData = unknown;\ntype SavedSound = unknown;\ntype SoundEffect = unknown;\n'),
])

# 2. use-editor-actions.ts：tts 占位
edit('hooks-cutia/actions/use-editor-actions.ts', [
    (r'import \{ generateAndInsertSpeech \} from "@videoEditor/engine/lib/tts/service";\n',
     '// 更新(2026-09-14)：TTS 域已删，占位为诚实失败。\n'
     'const generateAndInsertSpeech = async (): Promise<never> => {\n'
     '\tthrow new Error("语音生成未移植（tts 域已移除）");\n};\n'),
])

# 3. editor-header.tsx：删 agent-store
edit('ui/editor/editor-header.tsx', [
    (r'import \{ useAgentStore \} from "@videoEditor/stores/agent-store";\n',
     '// 更新(2026-09-14)：agent-store 已随 AI 域删除。\n'),
])

# 4. assets/index.tsx：删 AI/Sounds 视图 import
edit('ui/editor/panels/assets/index.tsx', [
    (r'import \{ AIView \} from "\./views/ai";\n', ''),
    (r'import \{ SoundsView \} from "\./views/sounds";\n', ''),
])

# 5. use-sound-search.ts：诚实占位
open('hooks-cutia/use-sound-search.ts', 'w', encoding='utf-8').write(
    '// 更新(2026-09-14)：音效搜索依赖 AI 域（sounds-store），已随 AI 一并删除。\n'
    '// 保留导出名以免破坏调用方；调用即明确报错（诚实失败，不静默）。\n'
    'export function useSoundSearch() {\n'
    '\tthrow new Error("音效搜索未移植（AI 域已移除）");\n}\n'
)
print('ok hooks-cutia/use-sound-search.ts')

# 6. panels/agent 整个目录删除
shutil.rmtree('ui/editor/panels/agent', ignore_errors=True)
print('rm ui/editor/panels/agent')
