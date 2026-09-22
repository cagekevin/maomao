/**
 * 用例⑧「Skill 使用计数」—— 某个 Skill 被用过几次。
 *
 * 【为什么必须住模块内】它是 `agent_skill_usage` 这个键上的一层语义（+1／读次数）。
 * 此前住 `runtime/skillStore.ts`，于是"谁能写这个键"有了两个答案（本模块的 repository 与 legacy 层）——
 * 域外唯一出口因此被旁路（TD-11-19）。语义跟着键走：键的唯一读写口在 `skillRepository`，
 * 语义层就该在同一个模块里。
 *
 * 【失败怎么算】统计类数据可降级：写失败由 `confirmPersist`（在 repository 内）**如实留痕**，
 * 不阻断发送链路，也**不假装成功**。
 */
import { readUsageMap, writeUsageMap } from './skillRepository.ts';

/** 记录一次使用（+1），返回最新次数（无 id ⇒ 0，不写脏键） */
export function markSkillUsed(id: string): number {
  if (!id) return 0;
  const map = readUsageMap();
  const next = (Number(map[id]) || 0) + 1;
  map[id] = next;
  writeUsageMap(map);
  return next;
}

/** 读某 Skill 的使用次数（无记录 = 0） */
export function getSkillUsage(id: string): number {
  const map = readUsageMap();
  const n = Number(map[id]);
  return Number.isFinite(n) ? n : 0;
}
