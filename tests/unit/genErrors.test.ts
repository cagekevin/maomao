import { describe, it, expect } from 'vitest';
import { classifyError, timeoutMessage } from '../../src/components/base/utils/genErrors.ts';
import { TimeoutError } from '../../src/components/base/utils/asyncGuard.ts';

/**
 * genErrors —— 统一错误分类契约测试。
 * 覆盖 classifyError 全部 5 类识别优先级（abort > timeout > network > http > business）
 * 与 retryable 决策（仅 timeout/network 可自动重试，业务失败不重试防封号）。
 * 代码逻辑一变（如调整识别优先级/漏掉分支）测试必红。
 */
describe('genErrors.classifyError — 识别优先级', () => {
  it('AbortError（name 或 aborted 标记）→ abort，不可重试', () => {
    const byName = classifyError(new DOMException('用户取消', 'AbortError'));
    expect(byName.type).toBe('abort');
    expect(byName.retryable).toBe(false);
    expect(byName.message).toBe('用户取消');

    const byFlag = classifyError({ name: 'x', message: 'c', aborted: true });
    expect(byFlag.type).toBe('abort');
    expect(byFlag.retryable).toBe(false);
  });

  it('TimeoutError / 超时错误 → timeout，可重试', () => {
    const viaAsyncGuard = classifyError(new TimeoutError('超时'));
    expect(viaAsyncGuard.type).toBe('timeout');
    expect(viaAsyncGuard.retryable).toBe(true);

    const byName = classifyError({ name: 'TimeoutError', message: 't' });
    expect(byName.type).toBe('timeout');
    expect(byName.retryable).toBe(true);
  });

  it('网络错误（NetworkError / TypeError / isNetwork / 旧文案前缀）→ network，可重试', () => {
    expect(classifyError({ name: 'NetworkError', message: 'offline' }).type).toBe('network');
    expect(classifyError(new TypeError('Failed to fetch')).type).toBe('network');
    expect(classifyError({ name: 'x', message: 'm', isNetwork: true }).type).toBe('network');
    // 历史代码「网络错误」前缀文案向后兼容
    expect(classifyError({ name: 'Error', message: '网络错误，请重试' }).type).toBe('network');
    expect(classifyError({ name: 'NetworkError', message: 'offline' }).retryable).toBe(true);
    expect(classifyError(new TypeError('Failed to fetch')).retryable).toBe(true);
  });

  it('HTTP 错误（HttpError name 或带 status）→ http，不可重试', () => {
    expect(classifyError({ name: 'HttpError', message: 'HTTP 404', status: 404 }).type).toBe(
      'http',
    );
    expect(classifyError({ name: 'x', message: 'err', status: 500 }).type).toBe('http');
    expect(classifyError({ name: 'HttpError', status: 500 }).retryable).toBe(false);
    expect(classifyError({ name: 'x', status: 429 }).retryable).toBe(false);
  });

  it('普通业务错误 → business 兜底，不可重试', () => {
    const res = classifyError(new Error('服务不可用'));
    expect(res.type).toBe('business');
    expect(res.retryable).toBe(false);
    expect(res.message).toBe('服务不可用');
  });

  it('识别优先级：aborted 且带 status → 仍判 abort（取消优先于 http）', () => {
    const res = classifyError({ name: 'AbortError', message: 'x', status: 500 });
    expect(res.type).toBe('abort');
  });
});

describe('genErrors.timeoutMessage — 统一超时文案（保留真实秒数）', () => {
  it('以 GEN_ERRORS.timeout.label 为基底并保留秒数', () => {
    expect(timeoutMessage(300000)).toBe('请求超时（超过 300 秒未返回）');
  });
  it('秒数为 0 或非整到毫秒也正确取整', () => {
    expect(timeoutMessage(8000)).toBe('请求超时（超过 8 秒未返回）');
    expect(timeoutMessage(1)).toBe('请求超时（超过 0 秒未返回）');
  });
});
