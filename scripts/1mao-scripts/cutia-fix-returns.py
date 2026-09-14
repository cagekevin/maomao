#!/usr/bin/env python3
"""2026-09-14 · cutia 搬迁 · 修 useEffect 分支 return 不一致（TS7030）。"""
import os

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
os.chdir('src/components/videoEditor')

# 1. use-timeline-zoom.ts
p = 'hooks-cutia/timeline/use-timeline-zoom.ts'
s = open(p, encoding='utf-8').read()
s = s.replace('''		if (scrollElement.scrollWidth > 0) {
			restoreScroll();
		} else {''', '''		if (scrollElement.scrollWidth > 0) {
			restoreScroll();
			return undefined;
		} else {''')
open(p, 'w', encoding='utf-8').write(s)
print('ok zoom')

# 2. color-picker.tsx
p2 = 'ui/ui/color-picker.tsx'
s2 = open(p2, encoding='utf-8').read()
s2 = s2.replace('''			if (isOpen) {
				document.addEventListener("mousedown", handleClickOutside);
				return () =>
					document.removeEventListener("mousedown", handleClickOutside);
			}
		}, [isOpen]);''', '''			if (isOpen) {
				document.addEventListener("mousedown", handleClickOutside);
				return () =>
					document.removeEventListener("mousedown", handleClickOutside);
			}
			return undefined;
		}, [isOpen]);''')
open(p2, 'w', encoding='utf-8').write(s2)
print('ok picker')
