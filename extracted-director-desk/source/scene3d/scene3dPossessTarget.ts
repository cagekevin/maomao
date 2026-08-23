// 「操控」目标的纯判定层（角色与相机一视同仁，P4 通用第一）。possess 把「WASD 直驱」这件事
// 泛化到两类对象：选中假人=操控走位、选中相机=操控运镜。同一时刻只能操控一个（互斥），
// 否则 WASD 会被角色和相机同时抢（两条移动路径打架）。这里只放可单测的纯函数，
// 状态机/接线在 useScene3DCharacterDrive.ts + Scene3DFullscreen.tsx。

export type PossessKind = 'character' | 'camera'

export type PossessTarget = {
  kind: PossessKind
  id: string
} | null

// 当前「操控目标」：角色优先于相机（约定：若两个 id 同时非空——不该发生，互斥已在进入处兜住——
// 取角色，保证判定单值确定）。两者皆空 = 没在操控。
export function activePossessTarget(
  characterPossessId: string | null,
  cameraPossessId: string | null,
): PossessTarget {
  if (characterPossessId) return { kind: 'character', id: characterPossessId }
  if (cameraPossessId) return { kind: 'camera', id: cameraPossessId }
  return null
}

// 是否正在操控相机（运镜态）。供 Scene3DControls 判「WASD 归相机 fly、不让位给角色」、
// CameraViewEditController 判「实时把编辑器相机位姿写回这台场景相机」。
export function isPossessingCamera(target: PossessTarget): boolean {
  return target?.kind === 'camera'
}

// 是否正在操控角色（走位态）。供 keyboardDisabled（相机 WASD 让位角色）判定。
export function isPossessingCharacter(target: PossessTarget): boolean {
  return target?.kind === 'character'
}

// 录 take 时「采的是哪条主轨迹」——角色操控录走位、相机操控录运镜。决定 buildRecorded*TakeScene 走哪条。
export function takePrimaryKind(target: PossessTarget): PossessKind | null {
  return target?.kind ?? null
}
