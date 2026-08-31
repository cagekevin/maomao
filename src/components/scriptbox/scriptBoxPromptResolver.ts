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
import { getPlaybook, getAllPlaybooks } from '../scriptbox/scriptBoxPlaybookStore'
import type { Playbook } from '../scriptbox/scriptBoxPlaybookIO'

/** 生图模板条目 { label, sys } */
export interface ImageGenTemplate {
  label: string
  sys: string
}

/** 正向约束 { image, video }（§4.3 已砍 custom 位） */
export interface ScriptBoxConstraints {
  image: string
  video: string
}

/** 负面词 { common, image, video }（§4.4 新增 common 位） */
export interface ScriptBoxNegatives {
  common: string
  image: string
  video: string
}

/** 取某类文本 system（script/shot/audit/qg）。无回退：只读 playbook 原值；空则返回空串（调用方自行处置）。 */
export function resolveSystem(playbookId: string, key: 'script' | 'shot' | 'audit' | 'qg'): string {
  const pb = getPlaybook(playbookId)
  return typeof pb[key] === 'string' ? pb[key] : ''
}

/** 取某生图类型模板对象 { label, sys }。取当前 playbook 的 imageGenTemplates，不存在回退其 keyframe。 */
export function resolveImageGenSys(playbookId: string, type: string, defaultType = 'keyframe'): ImageGenTemplate {
  const pb = getPlaybook(playbookId)
  const tpls = pb.imageGenTemplates
  return tpls[type] || tpls[defaultType] || { label: type, sys: '' }
}

/** 取资产生图参考图模板 { character, scene, prop }（ZgPrompt 用，值为模板字符串）。 */
export function resolveAssetTemplates(playbookId: string): Record<string, string> {
  const pb = getPlaybook(playbookId)
  return (pb.assetTemplates as Record<string, string>) || {}
}

/** 取正向约束 { image, video }（§4.3 已砍 custom 位）。 */
export function resolveConstraints(playbookId: string): ScriptBoxConstraints {
  const pb = getPlaybook(playbookId)
  return { image: pb.constraints?.image || '', video: pb.constraints?.video || '' }
}

/** 取负面词 { common, image, video }（§4.4 新增 common 位）。 */
export function resolveNegatives(playbookId: string): ScriptBoxNegatives {
  const pb = getPlaybook(playbookId)
  return { common: pb.negative?.common || '', image: pb.negative?.image || '', video: pb.negative?.video || '' }
}

/** 所有 playbook（供管理面板/下拉）。 */
export function resolveAll(): Playbook[] {
  return getAllPlaybooks()
}