#!/usr/bin/env python3
"""2026-09-14 · 恢复 StorageService 的音效存储方法（随误删的 sounds 一起恢复）。
依据：docs/133 §〇.4（误删审计）。原文取自 /tmp/cutia 原仓库。
"""
import os, re

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
p = 'src/components/videoEditor/engine/services/storage/service.ts'
s = open(p, encoding='utf-8').read()

# 1. 恢复类型占位（原为 import from types/sounds）
s = s.replace(
    '// 更新(2026-09-14)：音效域已随 AI 删除（含其类型与 adapter），见 docs/130-cutia搬迁计划书。\n',
    '// 音效域类型（2026-09-14 恢复：原误判为 AI 相关而删，实测零 AI 依赖 —— docs/133 §〇.4）。\n'
    'import type { SavedSoundsData, SavedSound, SoundEffect } from "@videoEditor/types/sounds";\n'
)

# 2. 恢复 adapter 声明
s = s.replace(
    '\tprivate projectsAdapter: IndexedDBAdapter<SerializedProject>;\n',
    '\tprivate projectsAdapter: IndexedDBAdapter<SerializedProject>;\n'
    '\tprivate savedSoundsAdapter: IndexedDBAdapter<SavedSoundsData>;\n'
)

# 3. 恢复 adapter 初始化
s = s.replace(
    '''			"projects",
			this.config.version,
		);
''',
    '''			"projects",
			this.config.version,
		);

		this.savedSoundsAdapter = new IndexedDBAdapter<SavedSoundsData>(
			this.config.savedSoundsDb,
			"saved-sounds",
			this.config.version,
		);
'''
)

# 4. 恢复音效方法（插在「音效域移除」注释处）
METHODS = '''
	async loadSavedSounds(): Promise<SavedSoundsData> {
		try {
			const savedSoundsData = await this.savedSoundsAdapter.get("user-sounds");
			return (
				savedSoundsData || {
					sounds: [],
					lastModified: new Date().toISOString(),
				}
			);
		} catch (error) {
			console.error("Failed to load saved sounds:", error);
			return { sounds: [], lastModified: new Date().toISOString() };
		}
	}

	async saveSoundEffect({
		soundEffect,
	}: {
		soundEffect: SoundEffect;
	}): Promise<void> {
		try {
			const currentData = await this.loadSavedSounds();

			if (currentData.sounds.some((sound) => sound.id === soundEffect.id)) {
				return; // Already saved
			}

			const savedSound: SavedSound = {
				id: soundEffect.id,
				name: soundEffect.name,
				username: soundEffect.username,
				previewUrl: soundEffect.previewUrl,
				downloadUrl: soundEffect.downloadUrl,
				duration: soundEffect.duration,
				tags: soundEffect.tags,
				license: soundEffect.license,
				savedAt: new Date().toISOString(),
			};

			const updatedData: SavedSoundsData = {
				sounds: [...currentData.sounds, savedSound],
				lastModified: new Date().toISOString(),
			};

			await this.savedSoundsAdapter.set("user-sounds", updatedData);
		} catch (error) {
			console.error("Failed to save sound effect:", error);
			throw error;
		}
	}

	async removeSavedSound({ soundId }: { soundId: number }): Promise<void> {
		try {
			const currentData = await this.loadSavedSounds();

			const updatedData: SavedSoundsData = {
				sounds: currentData.sounds.filter((sound) => sound.id !== soundId),
				lastModified: new Date().toISOString(),
			};

			await this.savedSoundsAdapter.set("user-sounds", updatedData);
		} catch (error) {
			console.error("Failed to remove saved sound:", error);
			throw error;
		}
	}

	async isSoundSaved({ soundId }: { soundId: number }): Promise<boolean> {
		try {
			const currentData = await this.loadSavedSounds();
			return currentData.sounds.some((sound) => sound.id === soundId);
		} catch (error) {
			console.error("Failed to check if sound is saved:", error);
			return false;
		}
	}

	async clearSavedSounds(): Promise<void> {
		try {
			await this.savedSoundsAdapter.remove("user-sounds");
		} catch (error) {
			console.error("Failed to clear saved sounds:", error);
			throw error;
		}
	}
'''

s = s.replace(
    '''	/* 更新(2026-09-14)：音效（sounds）域随 AI 一并删除 —— loadSavedSounds /
	   saveSoundEffect / removeSavedSound / isSoundSaved / clearSavedSounds 全部移除。
	   见 docs/130-cutia搬迁计划书。 */
''',
    METHODS
)

open(p, 'w', encoding='utf-8').write(s)
print('done')
