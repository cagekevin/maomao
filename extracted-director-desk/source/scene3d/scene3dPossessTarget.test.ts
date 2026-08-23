import { describe, it, expect } from 'vitest'
import {
  activePossessTarget,
  isPossessingCamera,
  isPossessingCharacter,
  takePrimaryKind,
} from './scene3dPossessTarget'

describe('activePossessTarget', () => {
  it('两者皆空 = 没在操控', () => {
    expect(activePossessTarget(null, null)).toBeNull()
  })

  it('只角色非空 → 操控角色', () => {
    expect(activePossessTarget('man-1', null)).toEqual({ kind: 'character', id: 'man-1' })
  })

  it('只相机非空 → 操控相机', () => {
    expect(activePossessTarget(null, 'cam-1')).toEqual({ kind: 'camera', id: 'cam-1' })
  })

  it('互斥兜底：两者同时非空（不该发生）取角色，保证单值确定', () => {
    expect(activePossessTarget('man-1', 'cam-1')).toEqual({ kind: 'character', id: 'man-1' })
  })
})

describe('possess kind 判定', () => {
  it('isPossessingCamera 只在相机态为真', () => {
    expect(isPossessingCamera({ kind: 'camera', id: 'c' })).toBe(true)
    expect(isPossessingCamera({ kind: 'character', id: 'm' })).toBe(false)
    expect(isPossessingCamera(null)).toBe(false)
  })

  it('isPossessingCharacter 只在角色态为真', () => {
    expect(isPossessingCharacter({ kind: 'character', id: 'm' })).toBe(true)
    expect(isPossessingCharacter({ kind: 'camera', id: 'c' })).toBe(false)
    expect(isPossessingCharacter(null)).toBe(false)
  })

  it('takePrimaryKind 映射到主轨迹类型', () => {
    expect(takePrimaryKind({ kind: 'camera', id: 'c' })).toBe('camera')
    expect(takePrimaryKind({ kind: 'character', id: 'm' })).toBe('character')
    expect(takePrimaryKind(null)).toBeNull()
  })
})
