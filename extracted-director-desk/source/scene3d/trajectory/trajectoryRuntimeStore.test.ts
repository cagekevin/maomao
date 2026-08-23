// 直驱表（objectRefMap）的活性语义：注册项必须**跟随 ref.current**，不能是解引用后的
// 冻结快照——这是「取景往返后 marker 冻住」（2026-08-04）那类僵尸 bug 的表级不变量。
// marker 重挂载在这里表现为：同 id 先注册新 ref、旧实例 cleanup 再注销旧 ref（或反序），
// 任何顺序都不许把活注册挤掉。
import { beforeEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { RefObject } from 'react'
import {
  registerScene3DObjectRef,
  setScene3DObjectRuntimeRefsVisible,
  unregisterScene3DObjectRef,
  useScene3DTrajectoryRuntimeStore,
} from './trajectoryRuntimeStore'

const refOf = (object: THREE.Object3D | null): RefObject<THREE.Object3D> => ({ current: object })

const targetsOf = (objectId: string) =>
  useScene3DTrajectoryRuntimeStore.getState().objectRefMap.get(objectId)

beforeEach(() => {
  useScene3DTrajectoryRuntimeStore.getState().objectRefMap.clear()
})

describe('轨迹直驱表：注册项跟随 ref.current（活引用，非冻结快照）', () => {
  it('ref.current 换成新 Object3D 后，读到的就是新对象——不需要重注册', () => {
    const stale = new THREE.Group()
    const ref = { current: stale as THREE.Object3D }
    registerScene3DObjectRef('cam-1', ref)

    const remounted = new THREE.Group()
    ref.current = remounted

    setScene3DObjectRuntimeRefsVisible('cam-1', false)
    expect(remounted.visible).toBe(false)
    expect(stale.visible).toBe(true)
  })

  it('marker 重挂载换血：同 id 注册新 ref 后注销旧 ref，活注册保留', () => {
    const oldRef = refOf(new THREE.Group())
    const newRef = refOf(new THREE.Group())
    registerScene3DObjectRef('cam-1', oldRef)
    registerScene3DObjectRef('cam-1', newRef)
    unregisterScene3DObjectRef('cam-1', oldRef)

    expect(targetsOf('cam-1')).toHaveLength(1)
    expect(targetsOf('cam-1')?.[0]?.ref).toBe(newRef)
  })

  it('同一 ref 重复注册不产生重复项（StrictMode 双跑安全）', () => {
    const ref = refOf(new THREE.Group())
    registerScene3DObjectRef('obj-1', ref)
    registerScene3DObjectRef('obj-1', ref)
    expect(targetsOf('obj-1')).toHaveLength(1)
  })

  it('最后一个 ref 注销后条目整个移除（表自净，无需全局 clear）', () => {
    const ref = refOf(new THREE.Group())
    registerScene3DObjectRef('obj-1', ref)
    unregisterScene3DObjectRef('obj-1', ref)
    expect(targetsOf('obj-1')).toBeUndefined()
  })

  it('注销未注册过的 ref 是无害 no-op', () => {
    const registered = refOf(new THREE.Group())
    registerScene3DObjectRef('obj-1', registered)
    unregisterScene3DObjectRef('obj-1', refOf(new THREE.Group()))
    unregisterScene3DObjectRef('obj-never', refOf(new THREE.Group()))
    expect(targetsOf('obj-1')).toHaveLength(1)
  })

  it('ref.current 为 null（卸载竞态窗口）时恢复可见是安全 no-op', () => {
    registerScene3DObjectRef('obj-1', refOf(null))
    expect(() => setScene3DObjectRuntimeRefsVisible('obj-1', true)).not.toThrow()
  })
})
