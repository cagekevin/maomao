import { describe, expect, test } from 'bun:test';
import type { TimelineTrack } from '@videoEditor/types/timeline';
import { getAllTools } from '../index';
import { resolveFrameInspection } from '../frame-tools';

const tracks: TimelineTrack[] = [
  {
    id: 'audio-track',
    name: 'Audio',
    type: 'audio',
    muted: false,
    elements: [],
  },
  {
    id: 'overlay-track',
    name: 'Overlay',
    type: 'text',
    hidden: false,
    elements: [],
  },
];

describe('resolveFrameInspection', () => {
  test('isolates a visual track and renders the last valid frame at project end', () => {
    expect(
      resolveFrameInspection({
        time: 10,
        trackId: 'overlay-track',
        tracks,
        duration: 10,
        fps: 25,
        canvasSize: { width: 3840, height: 2160 },
      }),
    ).toEqual({
      success: true,
      tracks: [tracks[1]],
      renderTime: 9.96,
      outputSize: { width: 1280, height: 720 },
      scope: 'track',
      trackId: 'overlay-track',
    });
  });

  test('rejects invalid times and non-visual tracks', () => {
    const base = {
      tracks,
      duration: 10,
      fps: 25,
      canvasSize: { width: 1920, height: 1080 },
    };

    expect(resolveFrameInspection({ ...base, time: -1 })).toEqual({
      success: false,
      message: 'Time must be between 0 and 10 seconds',
    });
    expect(resolveFrameInspection({ ...base, time: 1, trackId: 'missing' })).toEqual({
      success: false,
      message: "Track 'missing' not found",
    });
    expect(resolveFrameInspection({ ...base, time: 1, trackId: 'audio-track' })).toEqual({
      success: false,
      message: "Track 'audio-track' has no visual content",
    });
  });

  test('makes an isolated hidden visual track visible without mutating it', () => {
    const hiddenTrack: TimelineTrack = {
      id: 'hidden-track',
      name: 'Hidden',
      type: 'text',
      hidden: true,
      elements: [],
    };

    const result = resolveFrameInspection({
      time: 1,
      trackId: hiddenTrack.id,
      tracks: [hiddenTrack],
      duration: 10,
      fps: 25,
      canvasSize: { width: 1920, height: 1080 },
    });

    expect(result).toMatchObject({
      success: true,
      tracks: [{ hidden: false }],
    });
    expect(hiddenTrack.hidden).toBe(true);
  });
});

test('registers frame inspection for the agent', () => {
  expect(getAllTools().some((tool) => tool.name === 'inspect_frame')).toBe(true);
});
