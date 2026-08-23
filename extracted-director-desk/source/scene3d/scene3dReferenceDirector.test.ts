import { describe, expect, it } from 'vitest'
import type { GenerationCanvasEdge, GenerationCanvasNode } from '../../model/generationCanvasTypes'
import {
  referenceSlotForScene3DCaptureTitle,
  scene3DReferenceTargetLabel,
  shouldAttachScene3DFrameReference,
  summarizeScene3DReferenceTarget,
} from './scene3dReferenceDirector'

function node(id: string, kind: GenerationCanvasNode['kind'], patch: Partial<GenerationCanvasNode> = {}): GenerationCanvasNode {
  return {
    id,
    kind,
    title: id,
    position: { x: 0, y: 0 },
    prompt: '',
    references: [],
    history: [],
    status: 'idle',
    meta: {},
    ...patch,
  }
}

const edge = (source: string, target: string): GenerationCanvasEdge => ({
  id: `edge-${source}-${target}`,
  source,
  target,
  mode: 'reference',
})

describe('scene3dReferenceDirector', () => {
  it('finds the downstream video target and marks Seedance omni as video_ref capable', () => {
    const scene = node('s3d', 'scene3d')
    const video = node('shot', 'video', {
      title: '镜头 01',
      meta: { archetype: { id: 'seedance-2-apimart', modeId: 'omni' } },
    })

    const summary = summarizeScene3DReferenceTarget(scene.id, [scene, video], [edge(scene.id, video.id)])

    expect(summary.state).toBe('video-ref')
    expect(scene3DReferenceTargetLabel(summary)).toBe('video_ref · 镜头 01')
    expect(summary.currentFrameSupport).toEqual({ firstFrame: true, lastFrame: false })
    expect(summary.anyFrameSupport).toEqual({ firstFrame: true, lastFrame: true })
    expect(shouldAttachScene3DFrameReference(summary, 'first_frame')).toBe(true)
    expect(shouldAttachScene3DFrameReference(summary, 'last_frame')).toBe(true)
  })

  it('reports prompt fallback when a downstream video node has no video_ref archetype', () => {
    const scene = node('s3d', 'scene3d')
    const video = node('shot', 'video', { title: '旧视频节点' })

    const summary = summarizeScene3DReferenceTarget(scene.id, [scene, video], [edge(scene.id, video.id)])

    expect(summary.state).toBe('prompt-fallback')
    expect(scene3DReferenceTargetLabel(summary)).toBe('prompt · 旧视频节点')
    expect(shouldAttachScene3DFrameReference(summary, 'first_frame')).toBe(false)
  })

  it('does not treat non-video downstream nodes as reference video targets', () => {
    const scene = node('s3d', 'scene3d')
    const image = node('img', 'image')

    const summary = summarizeScene3DReferenceTarget(scene.id, [scene, image], [edge(scene.id, image.id)])

    expect(summary.state).toBe('not-connected')
    expect(scene3DReferenceTargetLabel(summary)).toBe('未连接视频镜头')
  })

  it('maps exported camera move frame capture titles to first/last frame slots', () => {
    expect(referenceSlotForScene3DCaptureTitle('相机 A · 运镜首帧')).toBe('first_frame')
    expect(referenceSlotForScene3DCaptureTitle('相机 A · 运镜尾帧')).toBe('last_frame')
    expect(referenceSlotForScene3DCaptureTitle('相机 A')).toBeNull()
  })
})
