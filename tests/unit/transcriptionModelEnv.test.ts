/**
 * 转写模型环境配置（本机模型目录 + 本机 ORT wasm + 禁远端）—— 锁三个面：
 * ① 库被指向**本机**模型目录且**禁远端**：缺文件必须明确报错，不许静默回落公网；
 * ② **ORT wasm 也指本机**：不设它，库会从 `cdn.jsdelivr.net` 取 ⇒ "以为离线其实没离线"（假成功）；
 * ③ 路径取自唯一真源 `runtimeModelUrl.ts` 的 `PREFIX_MODELS`，不在这里手写第二份 `/models/`。
 *
 * 取代原 `hfProxy.test.ts`（TD-22-57 的 `/api/hf/*` 代理链路已随模型落地本机而删除）。
 */
import { describe, it, expect } from 'vitest';
import {
  configureTranscriptionModelEnv,
  type TranscriptionModelEnv,
} from '../../src/components/videoEditor/engine/services/transcription/modelEnv.ts';
import { PREFIX_MODELS } from '../../src/components/base/core/runtimeModelUrl.ts';
import { TRANSCRIPTION_MODEL } from '../../src/components/videoEditor/constants/transcription-constants.ts';

/**
 * 造一个最小 env。
 * 返回**具体形状**（字段非可选）—— 这样断言时无需收窄（`TranscriptionModelEnv` 的字段是可选的，
 * 因为库类型如此；测试不该为此引入 `!` 假收窄）。
 */
interface ConcreteEnv {
  allowLocalModels: boolean;
  allowRemoteModels: boolean;
  localModelPath: string;
  backends: {
    onnx: { wasm: { wasmPaths?: string | { mjs?: string | URL; wasm?: string | URL } } };
  };
}

function makeEnv(): ConcreteEnv {
  return {
    allowLocalModels: false,
    allowRemoteModels: true,
    localModelPath: 'https://example.invalid/',
    backends: { onnx: { wasm: {} } },
  };
}

describe('转写模型环境配置（本机 + 禁远端）', () => {
  it('禁远端 + 开本机，并把 localModelPath 指向本机模型前缀', () => {
    const env = makeEnv();
    configureTranscriptionModelEnv(env, TRANSCRIPTION_MODEL.modelId);
    expect(env.allowLocalModels).toBe(true);
    expect(env.allowRemoteModels).toBe(false);
    expect(env.localModelPath).toBe(PREFIX_MODELS);
  });

  it('ORT wasm 也指本机（否则首次运行仍会从 CDN 取 ⇒ 假离线）', () => {
    const env = makeEnv();
    configureTranscriptionModelEnv(env, TRANSCRIPTION_MODEL.modelId);
    expect(env.backends.onnx.wasm.wasmPaths).toBe('/models/whisper-tiny/vendor/onnxruntime/');
    // 不得残留任何 CDN 前缀
    expect(String(env.backends.onnx.wasm.wasmPaths)).not.toContain('cdn.jsdelivr.net');
  });

  it('wasm 目录与模型目录同源（同一 modelId 派生，不会一处一个）', () => {
    const env = makeEnv();
    configureTranscriptionModelEnv(env, 'some-model');
    expect(env.localModelPath).toBe('/models/');
    expect(env.backends.onnx.wasm.wasmPaths).toBe('/models/some-model/vendor/onnxruntime/');
  });

  it('幂等：重复调用结果不变', () => {
    const env = makeEnv();
    configureTranscriptionModelEnv(env, TRANSCRIPTION_MODEL.modelId);
    configureTranscriptionModelEnv(env, TRANSCRIPTION_MODEL.modelId);
    expect(env.localModelPath).toBe(PREFIX_MODELS);
    expect(env.allowRemoteModels).toBe(false);
    expect(env.backends.onnx.wasm.wasmPaths).toBe('/models/whisper-tiny/vendor/onnxruntime/');
  });

  it('库 env 缺 backends.onnx.wasm 时**抛错**（不静默跳过 ⇒ 不回落 CDN）', () => {
    const env: TranscriptionModelEnv = { allowLocalModels: true };
    expect(() => configureTranscriptionModelEnv(env, 'whisper-tiny')).toThrow(
      /backends\.onnx\.wasm/,
    );
  });

  it('前缀以 / 结尾（库自行拼 `modelId/file`，少斜杠会拼错）', () => {
    expect(PREFIX_MODELS).toBe('/models/');
    expect(PREFIX_MODELS.endsWith('/')).toBe(true);
  });

  it('库算出的取件 URL = /models/<modelId>/<file>（modelId 即本机目录名，与 MANIFEST 落点一致）', () => {
    expect(TRANSCRIPTION_MODEL.modelId).toBe('whisper-tiny');
    expect(`${PREFIX_MODELS}${TRANSCRIPTION_MODEL.modelId}/config.json`).toBe(
      '/models/whisper-tiny/config.json',
    );
  });
});
