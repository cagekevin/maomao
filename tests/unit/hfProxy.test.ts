/**
 * 转写模型出站口（TD-22-57）：`applyHfProxyHost` 必须把 transformers.js 的
 * `env.remoteHost` 指向 localTool 代理，否则 worker 会直连 huggingface.co。
 */
import { describe, it, expect } from 'vitest';
import {
  applyHfProxyHost,
  HF_PROXY_BASE,
} from '../../src/components/videoEditor/engine/services/transcription/hf-proxy.ts';

describe('hf-proxy — 转写模型唯一出站口（TD-22-57）', () => {
  it('remoteHost 指向 localTool 代理 /api/hf/', () => {
    expect(HF_PROXY_BASE.endsWith('/api/hf/')).toBe(true);
    expect(HF_PROXY_BASE.startsWith('http')).toBe(true);
  });

  it('applyHfProxyHost 把 env.remoteHost 改为代理地址（覆盖库默认 huggingface.co）', () => {
    const env: { remoteHost?: string; remotePathTemplate?: string } = {
      remoteHost: 'https://huggingface.co/',
    };
    applyHfProxyHost(env);
    expect(env.remoteHost).toBe(HF_PROXY_BASE);
    expect(env.remoteHost).not.toContain('huggingface.co');
  });

  it('显式写死 remotePathTemplate（防库版本默认漂移）', () => {
    const env: { remoteHost?: string; remotePathTemplate?: string } = {};
    applyHfProxyHost(env);
    expect(env.remotePathTemplate).toBe('{model}/resolve/{revision}/');
  });

  it('幂等：重复调用结果一致', () => {
    const env: { remoteHost?: string; remotePathTemplate?: string } = {};
    applyHfProxyHost(env);
    applyHfProxyHost(env);
    expect(env.remoteHost).toBe(HF_PROXY_BASE);
  });
});
