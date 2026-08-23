/**
 * Global Portal layer contract.
 *
 * Portals are siblings under document.body, so React ownership does not determine which
 * surface is on top. Keep the ordered tiers here and make every global overlay consume them.
 */
export const NOMI_OVERLAY_Z_INDEX = {
  floatingPanel: 4000,
  applicationModal: 9000,
  dialog: 9100,
  popover: 9200,
  confirmation: 9300,
  feedback: 2147483647,
} as const

function highestLayerZIndex(element: Element): number {
  let current: Element | null = element
  let highest = 0
  while (current) {
    const value = Number.parseInt(window.getComputedStyle(current).zIndex || '0', 10)
    if (Number.isFinite(value)) highest = Math.max(highest, value)
    current = current.parentElement
  }
  return highest
}

const OPEN_ESCAPE_POPUP_SELECTOR = [
  '[role="listbox"]',
  '[role="menu"]',
  '[data-nomi-escape-layer="true"]',
].join(', ')

const ESCAPE_OWNING_TARGET_SELECTOR = [
  '[data-mantine-stop-propagation="true"]',
  '[data-nomi-escape-owner="true"]',
].join(', ')

export type SettingsEscapeOwnership = {
  dialogAbove: boolean
  openPopup: boolean
  targetOwnsEscape: boolean
  targetWasRemoved: boolean
}

export function shouldYieldSettingsEscape(ownership: SettingsEscapeOwnership): boolean {
  return ownership.dialogAbove || ownership.openPopup || ownership.targetOwnsEscape || ownership.targetWasRemoved
}

function isVisiblyOpen(element: HTMLElement): boolean {
  if (element.hidden || element.getClientRects().length === 0) return false
  const style = window.getComputedStyle(element)
  return style.display !== 'none' && style.visibility !== 'hidden'
}

function isPopupAtOrAboveDialog(candidate: HTMLElement, dialog: HTMLElement): boolean {
  if (dialog.contains(candidate)) return true
  const candidateLayer = highestLayerZIndex(candidate)
  const ownLayer = highestLayerZIndex(dialog)
  if (candidateLayer !== ownLayer) return candidateLayer > ownLayer
  return Boolean(dialog.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_FOLLOWING)
}

/** Settings owns Escape only when no later Portal dialog is visually above it. */
export function hasOpenDialogAbove(dialog: HTMLElement): boolean {
  const ownLayer = highestLayerZIndex(dialog)
  return [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].some((candidate) => {
    if (candidate === dialog || candidate.getClientRects().length === 0) return false
    const candidateLayer = highestLayerZIndex(candidate)
    if (candidateLayer !== ownLayer) return candidateLayer > ownLayer
    return Boolean(dialog.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_FOLLOWING)
  })
}

/**
 * Snapshot the owner before React/Mantine handles Escape. Popup state can disappear
 * synchronously during the target handler, so Settings must not decide from the later DOM.
 */
export function getSettingsEscapeOwnership(
  dialog: HTMLElement,
  target: EventTarget | null,
  targetWasRemoved = false,
): SettingsEscapeOwnership {
  const targetElement = target instanceof Element ? target : null
  return {
    dialogAbove: hasOpenDialogAbove(dialog),
    targetOwnsEscape: Boolean(targetElement?.closest(ESCAPE_OWNING_TARGET_SELECTOR)),
    openPopup: [...document.querySelectorAll<HTMLElement>(OPEN_ESCAPE_POPUP_SELECTOR)].some(
      (candidate) => isVisiblyOpen(candidate) && isPopupAtOrAboveDialog(candidate, dialog),
    ),
    targetWasRemoved,
  }
}

export function settingsEscapeTargetWasRemoved(target: EventTarget | null): boolean {
  return target instanceof Node && !target.isConnected
}
