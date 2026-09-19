/**
 * TTS 诚实占位的行为锁（TD-18-25 防回潮）
 *
 * 【为什么必须锁它】`generateSpeechFromText` 当前**必须抛错**（用户裁定「方案甲」：
 *   localTool 尚无 `/api/tts` 端点 ⇒ 调用即明确报错，不静默、不假装成功）。
 *   这条「诚实」没有任何闸能保证 —— 将来有人接入 TTS 时，若顺手把它改成
 *   `return { … }`（假成功）或 `.catch(() => null)`（静默降级），本测试立刻变红。
 *
 * 【为什么只锁两件事】不锁死整句措辞（文案允许优化），只锁：
 *   ① 真的 reject（而不是 resolve 一个空壳）；② 文案说明「待接入」（读者知道该找谁）。
 */
import { describe, it, expect } from 'vitest';
import { generateSpeechFromText } from '@/components/videoEditor/engine/lib/tts/service';

describe('TTS 诚实占位（TD-18-25 防回潮锁）', () => {
  it('generateSpeechFromText 必须 reject，且文案说明「待接入」', async () => {
    await expect(generateSpeechFromText({ text: '你好', voice: 'v1' })).rejects.toThrow(/待接入/);
  });

  it('不传可选 voice 时同样 reject（参数可选不影响诚实）', async () => {
    await expect(generateSpeechFromText({ text: '你好' })).rejects.toThrow(/待接入/);
  });
});
