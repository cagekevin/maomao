import { expect, test } from 'bun:test';
import { handleMediaPreviewKeyDown, useMediaPreviewStore } from './media-preview-store';

test('Escape closes an active media preview without stealing handled or editable events', () => {
  useMediaPreviewStore.getState().selectMedia({ mediaId: 'media-1' });

  handleMediaPreviewKeyDown({
    key: 'Escape',
    defaultPrevented: false,
    target: null,
  });

  expect(useMediaPreviewStore.getState().selectedMediaId).toBeNull();

  useMediaPreviewStore.getState().selectMedia({ mediaId: 'media-2' });
  handleMediaPreviewKeyDown({
    key: 'Escape',
    defaultPrevented: true,
    target: null,
  });
  expect(useMediaPreviewStore.getState().selectedMediaId).toBe('media-2');

  handleMediaPreviewKeyDown({
    key: 'Escape',
    defaultPrevented: false,
    target: { closest: () => true } as unknown as EventTarget,
  });
  expect(useMediaPreviewStore.getState().selectedMediaId).toBe('media-2');

  useMediaPreviewStore.getState().clearSelection();
});
