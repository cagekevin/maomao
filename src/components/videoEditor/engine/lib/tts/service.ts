import type { EditorCore } from '@/components/videoEditor/engine/core';
import {
  buildUploadAudioElement,
  wouldElementOverlap,
} from '@/components/videoEditor/engine/timeline';

export interface TtsResult {
  duration: number;
  buffer: AudioBuffer;
  blob: Blob;
}

export async function generateSpeechFromText({
  text: _text,
  voice: _voice,
}: {
  text: string;
  voice?: string;
}): Promise<TtsResult> {
  // 更新(2026-09-14)：cutia 原调 Next 服务端路由 `/api/tts/generate`
  // （转发第三方 api.milorapart.top），我们**不搬 Next 服务端** → 此处改调 localTool。
  //
  // ⚠️ **当前为诚实占位**（用户裁定「方案甲」）：
  //   localTool 尚未实现该端点 → 调用即**明确报错**，不静默、不假装成功。
  //   将来接入（三步，原骨架即此三步，需要时见 git 历史）：
  //     ① `POST ${apiBase}/api/tts`（apiBase 见 config.ts；localTool 侧新增路由走其 `netProxy` 出站收口）；
  //     ② 取回 `{ audio: base64 }` → 解码为 ArrayBuffer；
  //     ③ `new AudioContext().decodeAudioData(...)` 得 `buffer`，与 `blob` 一起返回。
  //   本函数**有意不使用** `text` / `voice`（`_` 前缀 = 有意不用；接入时去掉前缀即可）。
  // 依据：docs/133 §〇.4（误删审计）+ 用户 2026-09-14 裁定。
  //
  // 【2026-09-19 · TD-18-25】原不可达骨架（`fetch '/api/tts/generate'` + 解析 + 解码）**已删**：
  //   ① 它位于本 `throw` 之后 = **永不可达**，只靠一条压制「不可达」告警的 eslint 注释存活
  //      （那条注释本身就是"这里是死代码"的自供状）；
  //   ② 它带着一枚**永不执行**的 `catch-ok` 豁免标记（`PARSE_FALLBACK`）—— 那是 `asyncGuard`
  //      原语之外**最后一处**手写 `PARSE_FALLBACK`（删后 `src` 归零），留着就是污染普查口径；
  //   ③ 它指向**我们已决定不搬**的 Next 路由 ⇒ 留着只会把后来人引向错端点。
  //   原以为删它会留下死代码，实测「它的专属 helper `base64ToArrayBuffer`」一并删除（唯一消费者即骨架）。
  throw new Error('语音生成（TTS）待接入：localTool 尚无 /api/tts 端点。详见 docs/133。');
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
      // ⚠️ 【TD-18-26 · 接入 TTS 时**必须先改**这一行】`ephemeral: true` 是错的语义：
      //   全仓唯一一处（`grep -rn 'ephemeral: *true' src` 仅此）；
      //   而 `storage/service.ts:413-414` 定义 `ephemeral` = 「**故意**不落盘（合法状态）」
      //   的临时预览素材（`loadMediaAsset` 见无 url 即返 null）。
      //   语音是用户要**留在时间轴里**的成品素材 ⇒ 标 ephemeral 会让"接 TTS 后刷新即丢"。
      // 【当前为什么不能改】`generateSpeechFromText`（`:39`）无条件 `throw`（TTS 未接入，用户裁定方案甲）
      //   ⇒ 本行 `addMediaAsset` 在 `:89` **运行不可达**，改了无法验证（探针红不了）。
      //   按 A8「状态不许预支」：只登记 + 留痕，不预付修复（见 `18-跨区-TD18-25TTS幽灵预留证伪与清偿-2026-09-19.md`）。
      // 【正确形态】接入 TTS 时：删 `ephemeral: true`（默认 false ⇒ 走持久落盘分支）；
      //   若将来要为"可重生成的语音"另立判据，须先经 Step 1 三问 + 用户拍板，不得在消费端顺手决定。
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
