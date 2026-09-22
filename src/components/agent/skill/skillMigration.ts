/**
 * 一次性迁移：`agent_skills` 里的旧 Skill（只有 localStorage 形态、磁盘上没有）→ 磁盘技能包。
 *
 * 【前提（已实测）】114 / 116 的文件层从未落地 ⇒ 旧数据只有 `skill_${now}` 一种 id，且磁盘技能库为空。
 * 故迁移 = 首次发现「缓存有数据 + 技能库为空」时逐条写盘。
 *
 * 【四条硬规则】
 *  ① **幂等**：技能库里已有任何 `SKILL.md` ⇒ 直接跳过（不重复迁、不产生副本）；
 *  ② **不改写旧键**：旧 `skill_${now}` id 登记进新条目的 `aliases`；旧 `agent_skill_enabled` /
 *     `agent_skill_usage` 键**原样保留**（运行时按 alias 命中）—— 改写旧键是身份断裂风险；
 *  ③ **先落盘成功才回写缓存**：只有真的写进磁盘的条目才进新缓存（否则会出现"缓存说有、磁盘没有"）；
 *  ④ **失败不删旧数据**：任一条失败 ⇒ 该条**原样保留**在缓存里并如实上报（不清、不覆盖；缓存回写失败也如实报）。
 */
import { contentFingerprint } from '@/components/base/core/utils.ts';
import { logger } from '@/components/base/core/log/logger.ts';
import { generateUUID } from '@/components/base/core/idGen.ts';
import { emptyManifest, serializeSkillMarkdown } from './skillManifest.ts';
import { slugifySkillName, uniqueSlugIn } from './skillDirName.ts';
import { UNSORTED_GROUP } from './skillGroup.ts';
import { listSkillPackages, saveSkillPackage } from './skillApi.ts';
import { SKILL_ENTRY_FILE } from './skillEntry.ts';
import { readSkillList, writeSkillList } from './skillRepository.ts';
import type { UserSkill } from './skillTypes.ts';

export interface MigrationResult {
  ok: boolean;
  /** 成功写进磁盘的条目数 */
  migrated: number;
  /** true = 未执行（技能库已有形态，或缓存本就为空） */
  skipped: boolean;
  failures: { id: string; message: string }[];
  error?: string;
}

/**
 * 需要时执行迁移（幂等，可重复调用）。
 * @returns 迁移结果；**不抛** —— 失败走 `ok:false` / `failures`，绝不静默吞
 */
export async function migrateSkillsToDiskIfNeeded(): Promise<MigrationResult> {
  const lib = await listSkillPackages({ withContent: false });
  if (!lib.ok) return { ok: false, migrated: 0, skipped: true, failures: [], error: lib.message };
  // 规则①：已有磁盘形态 ⇒ 不迁
  if (lib.data.packages.length > 0) return { ok: true, migrated: 0, skipped: true, failures: [] };

  const cur = readSkillList();
  if (!cur.ok) {
    // 缓存损坏 ⇒ **不迁**（避免把残缺列表写成磁盘包，那等于固化一次数据损坏）
    return { ok: false, migrated: 0, skipped: true, failures: [], error: cur.error };
  }
  if (cur.list.length === 0) return { ok: true, migrated: 0, skipped: true, failures: [] };

  const used = new Set<string>();
  const nextList: unknown[] = [];
  const failures: { id: string; message: string }[] = [];
  let migrated = 0;

  for (const raw of cur.list) {
    const item = raw as {
      id?: unknown;
      name?: unknown;
      description?: unknown;
      content?: unknown;
      createdAt?: unknown;
      updatedAt?: unknown;
    };
    const oldId = typeof item.id === 'string' ? item.id : '';
    const name = typeof item.name === 'string' ? item.name : '';
    const content = typeof item.content === 'string' ? item.content : '';
    const description = typeof item.description === 'string' ? item.description : '';

    if (!oldId || !name || !content) {
      // 形状不全的旧条目：不迁、**原样保留**、如实上报（静默丢 = 真删用户数据）
      failures.push({
        id: oldId || '(缺 id)',
        message: '旧条目缺 id / name / content，已原样保留未迁移',
      });
      nextList.push(raw);
      continue;
    }

    const slug = uniqueSlugIn(slugifySkillName(name), used);
    const newId = generateUUID();
    const md = serializeSkillMarkdown(emptyManifest({ id: newId, name, description }), content);
    const w = await saveSkillPackage(UNSORTED_GROUP, slug, [
      { relPath: SKILL_ENTRY_FILE, encoding: 'utf8', content: md },
    ]);

    if (!w.ok) {
      // 规则④：落盘失败 ⇒ 旧条目原样留着（用户仍能用旧的），并上报
      failures.push({ id: oldId, message: w.message });
      nextList.push(raw);
      continue;
    }

    migrated += 1;
    const entry: UserSkill = {
      kind: 'user',
      id: newId,
      category: UNSORTED_GROUP,
      slug,
      name,
      description,
      content,
      contentHash: contentFingerprint(content),
      aliases: [oldId], // 规则②：旧 id 永久可解析，**不改写**旧 enabled / usage 键
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : undefined,
      updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : undefined,
    };
    nextList.push(entry);
  }

  if (migrated > 0) {
    const w = writeSkillList(nextList);
    if (!w.ok) {
      // 磁盘已写成功、缓存回写失败：如实报（磁盘是真源，下次 hydrate 可恢复；aliases 可能需重登记）
      return {
        ok: false,
        migrated,
        skipped: false,
        failures,
        error: `已写盘 ${migrated} 个技能包，但缓存回写失败：${w.error || '未知原因'}`,
      };
    }
    logger.info('skillMigration', '旧 Skill 已迁移到磁盘', { migrated, failures: failures.length });
  }
  return { ok: failures.length === 0, migrated, skipped: false, failures };
}
