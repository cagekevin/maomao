/**
 * 用例「**带上某个 Skill 去用**」——把技能选进**当前对话**，并让用户**看得见**。
 *
 * 【为什么要一个用例，而不是让调用方自己拼】两件事必须一起发生，缺一件就退化成假动作：
 *  ① 选中态的真源 = 当前对话快照（`conv.skills`，id 列表）；
 *  ② 面板收起时只写①，用户**什么也看不到** ⇒ 仍是"点了没反应"（TD-11-22 的旧实相：
 *     按钮只弹了一句"已切换到该技能"，零状态变更）。
 *
 * 【为什么归本域】它要写的那两份真相分别属：会话快照（本域）与 `agentOpen`（`base/appSettings`
 * 的唯一入口，横切层任何人都可调）—— 故这是一个**域内用例**，不由设置页自己拼（设置页是消费者）。
 *
 * 【幂等】已在当前对话选中 ⇒ 不重复加（`added:false`），不制造重复项。
 * 【诚实】写后**回读确认**：写不进去（例如还没有活动对话）⇒ `ok:false` + 可展示原因，
 * 绝不返回"成功"让 UI 去弹一句假的"已切换"。
 */
import { setSetting } from '@/components/base/store/appSettings.ts';
import { getCurrentSnapshot, normalizeSkillIds, setCurrentSkills } from './conversationSnapshot.ts';

export interface UseSkillResult {
  ok: boolean;
  /** 本次是否真的新加了一项（`false` 且 `ok` = 之前就已在当前对话里） */
  added: boolean;
  message?: string;
}

/**
 * 把 `skillId` 选进当前对话（并把 AI 面板打开，让这次动作可见）。
 *
 * 【名字里没有 `use` 是故意的】它**不是 Hook**（不调任何 Hook，就是个写状态的普通函数）。
 * 叫 `use*` 会让读者以为它只能在组件顶层调用，也会让 `react-hooks/rules-of-hooks` 误判
 * （放在事件回调里调会被报错）。改名后语义与事实一致。
 *
 * @returns 判别联合：失败带可展示 `message`（调用方只转发，不自己编话术）
 */
export function selectSkillInCurrentConversation(skillId: string): UseSkillResult {
  const id = typeof skillId === 'string' ? skillId.trim() : '';
  if (!id) return { ok: false, added: false, message: '缺少 Skill id，未做任何切换' };

  const before = normalizeSkillIds(getCurrentSnapshot().skills);
  const added = !before.includes(id);
  if (added) setCurrentSkills([...before, id]);

  // 【写后回读】不确认的话，"没有活动对话"这类写不进去的情形会被报成成功（假成功）
  const after = normalizeSkillIds(getCurrentSnapshot().skills);
  if (added && !after.includes(id)) {
    return { ok: false, added: false, message: '未能写入当前对话（可能还没有活动对话）' };
  }

  // 让这次动作可见：面板收起时"选中"等于没发生
  setSetting('agentOpen', true);
  return { ok: true, added };
}
