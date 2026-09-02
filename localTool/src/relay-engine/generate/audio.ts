/**
 * generate/audio — 音频生成入口。
 *
 * 覆盖两类：语音合成（TTS：voice / format / speed）与音乐生成（lyrics / title / bpm / duration）。
 * 变量名与协议变量总表一致，协议模板引用哪个字段就写哪个。
 */
import type { GenerateAudioInput, GenerateMediaResult } from '../contract';
import { compactVariables, resolveModelRef, resolveProtocol, runModel } from './run';

export async function generateAudio(input: GenerateAudioInput): Promise<GenerateMediaResult> {
  const model = resolveModelRef(input.model, 'audio');
  const protocol = resolveProtocol(input.protocol ?? model.protocol, 'audio');
  const variables = compactVariables({
    model: model.model,
    prompt: input.prompt,
    n: input.n ?? 1,
    ...(input.voice ? { audioVoice: input.voice } : {}),
    ...(input.format ? { audioFormat: input.format } : {}),
    ...(input.speed !== undefined ? { audioSpeed: input.speed } : {}),
    ...(input.duration !== undefined ? { duration: input.duration } : {}),
    ...(input.title ? { musicTitle: input.title } : {}),
    ...(input.lyrics ? { musicLyrics: input.lyrics } : {}),
    ...(input.bpm !== undefined ? { musicBpm: input.bpm } : {}),
  });

  const result = await runModel({
    connection: input.connection,
    protocol,
    category: 'audio',
    variables,
    signal: input.signal,
  });
  if (!result.urls?.length) throw new Error('音频模型未返回结果 URL');
  return { urls: result.urls, ...(result.text ? { text: result.text } : {}), ...(result.taskId ? { taskId: result.taskId } : {}) };
}
