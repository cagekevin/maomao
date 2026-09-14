import { expect, test } from 'bun:test';
import { resolveCanvasSizePresetValue } from '../settings';

test('keeps custom selected when the current size matches a preset', () => {
  expect(
    resolveCanvasSizePresetValue({
      width: 1920,
      height: 1080,
      originalCanvasSize: null,
      customSelected: true,
    }),
  ).toBe('custom');
});

test('resolves 1366 by 768 to its preset', () => {
  expect(
    resolveCanvasSizePresetValue({
      width: 1366,
      height: 768,
      originalCanvasSize: null,
    }),
  ).toBe('768p');
});
