// @ts-nocheck
// 摄像机朝向欧拉约定 纯逻辑测试
// 背景：cameraRotationToward 生成「先 yaw（绕 Y）再 pitch（绕 X）」的欧拉角（pitch=asin(dy), yaw=atan2(-dx,-dz)），
//   必须在 THREE Euler 'YXZ' 下应用才精确；'XYZ' 的 yaw 用 asin 有象限歧义，目标在侧方/后方时前向会偏转，
//   表现为「始终面向对象」在路径状态下对不准目标。
// 覆盖：
//   - 'YXZ' 应用后相机前向（-Z）在各方向（含侧方/后方）均精确指向目标（dot≈1）
//   - 'XYZ' 应用在侧方/后方场景显著偏离（dot 明显 < 1），佐证必须用 'YXZ'
// 依赖均为纯函数 + three，node 环境可跑（npm run test:unit:logic）。
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { cameraRotationToward } from '../../src/components/director3d/project.ts'

const forwardAfter = (position, target, order) => {
  const rotation = cameraRotationToward(position, target)
  return new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(...rotation, order))
}

const toTarget = (position, target) =>
  new THREE.Vector3(...target).sub(new THREE.Vector3(...position)).normalize()

describe('cameraRotationToward 欧拉约定', () => {
  const cases = [
    { position: [10, 2, 0], target: [0, 1, 0], label: '目标在侧方' },
    { position: [10, 2, 0], target: [5, 0, 0], label: '目标在正侧方' },
    { position: [10, 2, 0], target: [0, 0, 5], label: '目标在前方偏左' },
    { position: [10, 2, 0], target: [5, 3, -4], label: '目标在后方' },
    { position: [-3, 4, 7], target: [2, 1, -1], label: '目标在前下方' },
  ]

  it("'YXZ'（先 yaw 后 pitch）下前向精确指向目标（各方向 dot≈1）", () => {
    for (const { position, target, label } of cases) {
      const fwd = forwardAfter(position, target, 'YXZ')
      const dot = fwd.dot(toTarget(position, target))
      expect(dot, `${label}: 前向与指向目标方向的点积`).toBeCloseTo(1, 5)
    }
  })

  it("'XYZ' 在侧方/后方场景显著偏离（佐证必须用 'YXZ'）", () => {
    // 目标在正侧方（dz=0）时 'XYZ' 的 yaw 分解失效，前向明显不指向目标
    const { position, target } = cases[1]
    const dotXyz = forwardAfter(position, target, 'XYZ').dot(toTarget(position, target))
    const dotYxz = forwardAfter(position, target, 'YXZ').dot(toTarget(position, target))
    expect(dotXyz).toBeLessThan(0.999)
    expect(dotYxz).toBeCloseTo(1, 5)
  })

  it('重合点（距离≈0）返回零旋转不报错', () => {
    const rotation = cameraRotationToward([1, 1, 1], [1, 1, 1])
    expect(rotation).toEqual([0, 0, 0])
  })
})
