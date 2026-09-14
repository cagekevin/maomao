#!/usr/bin/env python3
"""2026-09-14 · cutia 搬迁 · 移除 settings.tsx 里的 AI 设置视图与 tab。"""
import re, os

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
p = 'src/components/videoEditor/ui/editor/panels/assets/views/settings.tsx'
s = open(p, encoding='utf-8').read()

# 1. 删 AI 设置 tab 项
s = s.replace('''				{
					value: "ai",
					label: "AI",
					content: (
						<div className="p-5">
							<AISettingsView />
						</div>
					),
				},
''', '\t\t\t\t/* 更新(2026-09-14)：AI 设置 tab 随 AI 域移除（docs/130-cutia搬迁计划书）。 */\n')

# 2. 删 AI 相关 import
s = re.sub(r'import \{\n\tIMAGE_PROVIDERS,\n\tVIDEO_PROVIDERS,\n\} from "@videoEditor/engine/lib/ai/providers";\n',
           '// 更新(2026-09-14)：AI providers 随 AI 域移除。\n', s)
s = re.sub(r'import \{ isDevPlaceholderAvailable \} from "@videoEditor/engine/lib/ai/placeholder";\n', '', s)

open(p, 'w', encoding='utf-8').write(s)
print('done')
