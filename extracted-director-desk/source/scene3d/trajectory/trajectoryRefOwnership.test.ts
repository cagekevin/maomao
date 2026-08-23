// 结构保证：轨迹直驱表的注册权归 marker 组件所有（2026-08-04 僵尸 ref 根治的看门狗）。
//
// 背景：曾经由播放层 ObjectRefBinder 用 findSceneObjectByRuntimeId 扫一次 scene、把解引用
// 结果冻结注册进表。取景调整会把相机 marker 整组卸载重挂（scene3dSceneContent 里
// `!cameraViewEditing ? cameras.map(...) : null`），重挂后表里攥的还是已离场的旧 Object3D
// → 每帧盖章全落僵尸，marker 不再跟播放头动。根治 = 注册跟组件生命周期走（自注册），
// 见 docs/plan/2026-08-04-trajectory-zombie-ref-selfregistration.md。
//
// 这里钉死三条结构不变量，违反任何一条 = 僵尸类 bug 的门被重新打开：
// ① 盖 SCENE3D_RUNTIME_ID_KEY 章（= 参与按 id 直驱）的文件，盖几个章就得配几个自注册 hook——
//    新加一种带 runtime id 的 marker 而不自注册，播放对它就是静默失效。
// ② 播放层（trajectory/）不得再出现「扫描 + 注册」旁路。
// ③ 不得存在整表清空 API：注册表由挂载生命周期维护，全局 clear 会抹掉活注册且无人补。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SCENE3D_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const SRC_ROOT = path.resolve(SCENE3D_ROOT, '..', '..', '..', '..')

function collectSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return collectSourceFiles(full)
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) return []
    return [full]
  })
}

const count = (source: string, pattern: RegExp) => (source.match(pattern) ?? []).length

describe('轨迹直驱表注册权（marker 自注册）', () => {
  it('① 盖 runtime id 章的文件，章数 === 自注册 hook 数', () => {
    const offenders: string[] = []
    for (const file of collectSourceFiles(SRC_ROOT)) {
      const source = fs.readFileSync(file, 'utf8')
      // JSX userData 盖章写法：`[SCENE3D_RUNTIME_ID_KEY]: xxx`
      const stamps = count(source, /\[SCENE3D_RUNTIME_ID_KEY\]:/g)
      if (stamps === 0) continue
      const registrations = count(source, /useScene3DObjectRefRegistration\(/g)
      if (stamps !== registrations) {
        offenders.push(`${path.relative(SRC_ROOT, file)} 盖章${stamps}处/自注册${registrations}处`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('② 播放层不得按 id 扫 scene 注册（冻结快照 = 僵尸之源）', () => {
    const playback = fs.readFileSync(path.join(SCENE3D_ROOT, 'trajectory', 'TrajectoryPlayback.tsx'), 'utf8')
    expect(playback).not.toMatch(/findSceneObjectByRuntimeId/)
    expect(playback).not.toMatch(/registerScene3DObjectRef/)
  })

  it('③ 全仓不存在整表清空 API', () => {
    const offenders = collectSourceFiles(SRC_ROOT)
      .filter((file) => /clearScene3DObjectRefs/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_ROOT, file))
    expect(offenders).toEqual([])
  })
})
