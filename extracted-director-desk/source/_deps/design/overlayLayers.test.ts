import { describe, expect, it } from 'vitest'
import { shouldYieldSettingsEscape, type SettingsEscapeOwnership } from './overlayLayers'

const ownedBySettings: SettingsEscapeOwnership = {
  dialogAbove: false,
  openPopup: false,
  targetOwnsEscape: false,
  targetWasRemoved: false,
}

describe('settings Escape ownership', () => {
  it.each([
    ['a later dialog', { dialogAbove: true }],
    ['a visible listbox or menu', { openPopup: true }],
    ['the expanded control that received the key', { targetOwnsEscape: true }],
    ['a local editor that removed its input', { targetWasRemoved: true }],
  ] as const)('yields to %s', (_label, patch) => {
    expect(shouldYieldSettingsEscape({ ...ownedBySettings, ...patch })).toBe(true)
  })

  it('lets Settings handle Escape when no more-local layer owns it', () => {
    expect(shouldYieldSettingsEscape(ownedBySettings)).toBe(false)
  })
})
