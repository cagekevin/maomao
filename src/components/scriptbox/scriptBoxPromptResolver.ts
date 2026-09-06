/**
 * 剧本盒子·Playbook 解析层（消费入口，纯函数、无副作用）。
 *
 * 【职责】所有生成入口/UI 一律经本层从 playbook 取 system 片段，禁止各自拼回退链。
 *  单一数据源 = getPlaybook(playbookId)[key]，无第二级、无「留空即跟随」的隐式语义。
 *  §4.1：resolveSystem / resolveImageGenSys / resolveConstraints / resolveNegatives。
 *
 * 【依赖方向】resolver(scriptbox) → playbookStore(scriptbox)。依赖单向，纯读。
 *  引擎 scriptBoxEngine(scriptbox) → 本层；scriptBoxPrompts(scriptbox) 的具名纯函数 → 本层。
 *  更新(2026-08-31)：本文件自 base/ 迁入 scriptbox/（解 base⇄scriptbox 循环，见 download/REPORT）。
 */
import { getPlaybook, getAllPlaybooks } from '../scriptbox/scriptBoxPlaybookStore';
import type { Playbook } from '../scriptbox/scriptBoxPlaybookIO';
// 共享类型自 scriptBoxTypes 取（解 resolver⇄workflows/IO 纯类型环，见该文件头注释）；re-export 保持对外 API 不变。
import type { ImageGenTemplate, ScriptBoxConstraints, ScriptBoxNegatives } from './scriptBoxTypes';
export type { ImageGenTemplate, ScriptBoxConstraints, ScriptBoxNegatives };

/** 取某类文本 system（script/shot/audit/qg）。无回退：只读 playbook 原值；空则返回空串（调用方自行处置）。 */
export function resolveSystem(playbookId: string, key: 'script' | 'shot' | 'audit' | 'qg'): string {
  const pb = getPlaybook(playbookId);
  return typeof pb[key] === 'string' ? pb[key] : '';
}

/** 取某生图类型模板对象 { label, sys }。取当前 playbook 的 imageGenTemplates，不存在回退其 keyframe。 */
export function resolveImageGenSys(
  playbookId: string,
  type: string,
  defaultType = 'keyframe',
): ImageGenTemplate {
  const pb = getPlaybook(playbookId);
  const tpls = pb.imageGenTemplates;
  return tpls[type] || tpls[defaultType] || { label: type, sys: '' };
}

/** 取资产生图参考图模板 { character, scene, prop }（ZgPrompt 用，值为模板字符串）。 */
export function resolveAssetTemplates(playbookId: string): Record<string, string> {
  const pb = getPlaybook(playbookId);
  // Playbook.assetTemplates 为 Record<string, unknown>（存储值不可信）：逐值校验 string 再返回，
  // 保证下游按字符串模板拼接不会拿到非字符串（F24，取代整体 `as Record<string, string>`）。
  const t = pb.assetTemplates;
  const out: Record<string, string> = {};
  if (t && typeof t === 'object') {
    for (const [k, v] of Object.entries(t)) {
      if (typeof v === 'string') out[k] = v;
    }
  }
  return out;
}

/** 取正向约束 { image, video }（§4.3 已砍 custom 位）。 */
export function resolveConstraints(playbookId: string): ScriptBoxConstraints {
  const pb = getPlaybook(playbookId);
  return { image: pb.constraints?.image || '', video: pb.constraints?.video || '' };
}

/** 取负面词 { common, image, video }（§4.4 新增 common 位）。 */
export function resolveNegatives(playbookId: string): ScriptBoxNegatives {
  const pb = getPlaybook(playbookId);
  return {
    common: pb.negative?.common || '',
    image: pb.negative?.image || '',
    video: pb.negative?.video || '',
  };
}

/** 所有 playbook（供管理面板/下拉）。 */
export function resolveAll(): Playbook[] {
  return getAllPlaybooks();
}
