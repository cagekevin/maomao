import type { EditorCore } from '@videoEditor/engine/core';
import { buildUploadAudioElement, wouldElementOverlap } from '@videoEditor/engine/timeline';

export interface TtsResult {
  duration: number;
  buffer: AudioBuffer;
  blob: Blob;
}

function base64ToArrayBuffer({ base64 }: { base64: string }): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function generateSpeechFromText({
  text,
  voice,
}: {
  text: string;
  voice?: string;
}): Promise<TtsResult> {
  // 更新(2026-09-14)：cutia 原调 Next 服务端路由 `/api/tts/generate`
  // （转发第三方 api.milorapart.top），我们**不搬 Next 服务端** → 此处改调 localTool。
  //
  // ⚠️ **当前为诚实占位**（用户裁定「方案甲」）：
  //   localTool 尚未实现该端点 → 调用即**明确报错**，不静默、不假装成功。
  //   将来接入：在 localTool 加 `/api/tts` 路由（走其 `netProxy` 出站收口），
  //   再把下一行的 URL 改为 `${apiBase}/api/tts` 即可（apiBase 见 config.ts）。
  // 依据：docs/133 §〇.4（误删审计）+ 用户 2026-09-14 裁定。
  throw new Error('语音生成（TTS）待接入：localTool 尚无 /api/tts 端点。详见 docs/133。');

  // eslint-disable-next-line no-unreachable -- 保留原实现骨架，待接入时启用
  const response = await fetch('/api/tts/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null); // catch-ok: PARSE_FALLBACK
    throw new Error(error?.error ?? `TTS request failed: ${response.status}`);
  }

  const { audio } = (await response.json()) as { audio: string };
  const arrayBuffer = base64ToArrayBuffer({ base64: audio });
  const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });

  const audioContext = new AudioContext();
  const buffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

  return {
    duration: buffer.duration,
    buffer,
    blob,
  };
}

function findAvailableAudioTrack({
  editor,
  startTime,
  endTime,
}: {
  editor: EditorCore;
  startTime: number;
  endTime: number;
}): string {
  const audioTracks = editor.timeline.getTracks().filter((t) => t.type === 'audio');

  const available = audioTracks.find(
    (track) =>
      !wouldElementOverlap({
        elements: track.elements,
        startTime,
        endTime,
      }),
  );

  if (available) {
    return available.id;
  }

  return editor.timeline.addTrack({ type: 'audio' });
}

export async function generateAndInsertSpeech({
  editor,
  text,
  startTime,
  voice,
}: {
  editor: EditorCore;
  text: string;
  startTime: number;
  voice?: string;
}): Promise<{ duration: number }> {
  const result = await generateSpeechFromText({ text, voice });

  const name = `TTS: ${text.slice(0, 30)}`;
  const file = new File([result.blob], `${name}.mp3`, {
    type: 'audio/mpeg',
  });
  const url = URL.createObjectURL(result.blob);
  const projectId = editor.project.getActive().metadata.id;

  const added = await editor.media.addMediaAsset({
    projectId,
    asset: {
      name,
      type: 'audio',
      file,
      url,
      duration: result.duration,
      ephemeral: true,
    },
  });

  // ── 修复(2026-09-15 · TD-22-37)：原直接拿返回的 id 去插时间轴 —— 素材保存失败时
  // 会插入一个**指向不存在素材的幽灵片段**（播放/渲染时断链，且刷新后素材消失）。
  // 现在按判别结果中止（MediaManager 已 toast + 回滚，此处只需不产出幽灵）。
  if (!added.ok) {
    URL.revokeObjectURL(url);
    throw new Error(`语音素材保存失败：${added.message ?? added.reason}`);
  }

  const audioElement = buildUploadAudioElement({
    mediaId: added.id,
    name,
    duration: result.duration,
    startTime,
    buffer: result.buffer,
  });

  const trackId = findAvailableAudioTrack({
    editor,
    startTime,
    endTime: startTime + result.duration,
  });

  editor.timeline.insertElement({
    placement: { mode: 'explicit', trackId },
    element: audioElement,
  });

  return { duration: result.duration };
}
