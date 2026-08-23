import type { GenerationCanvasNode } from '../../model/generationCanvasTypes'
import { normalizeScene3DState } from './scene3dSerializer'

export type Scene3DCardPreview =
  | { kind: 'video'; url: string }
  | { kind: 'image'; url: string }
  | { kind: 'empty' }

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

export function readScene3DCardPreview(node: GenerationCanvasNode): Scene3DCardPreview {
  const video = node.meta?.cameraMoveVideo
  const videoUrl = video && typeof video === 'object'
    ? readNonEmptyString((video as { url?: unknown }).url)
    : null
  if (videoUrl) return { kind: 'video', url: videoUrl }

  const thumbnailUrl = readNonEmptyString(normalizeScene3DState(node.meta?.scene3dState).lastThumbnail)
  if (thumbnailUrl) return { kind: 'image', url: thumbnailUrl }
  return { kind: 'empty' }
}
