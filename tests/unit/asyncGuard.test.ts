import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  withTimeout,
  isTimeoutError,
  TimeoutError,
  loadImageWithTimeout,
  releaseQuietly,
  releaseQuietlyAsync,
  tryParse,
  attemptQuietly,
  attemptQuietlyAsync,
} from '../../src/components/base/utils/net/asyncGuard.ts';

describe('asyncGuard.withTimeout（R2 统一异步超时）', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('正常 resolve：超时前完成 → 返回原值', async () => {
    const p = Promise.resolve(42);
    const r = await withTimeout(p, 5000);
    expect(r).toBe(42);
  });

  it('正常 reject：超时前失败 → 透传原错误（非超时）', async () => {
    const p = Promise.reject(new Error('真实失败'));
    const err = await withTimeout(p, 5000).catch((e) => e);
    expect(err.message).toBe('真实失败');
    expect(isTimeoutError(err)).toBe(false);
  });

  it('超时：超过 ms 未完成 → reject TimeoutError', async () => {
    const never = new Promise(() => {}); // 永不 resolve
    const p = withTimeout(never, 1000, '自定义超时');
    let settled = false;
    p.catch(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(1001);
    expect(settled).toBe(true);
    await expect(p).rejects.toThrow('自定义超时');
  });

  it('超时错误可被 isTimeoutError 识别，真实失败不可', async () => {
    expect(isTimeoutError(new TimeoutError())).toBe(true);
    expect(isTimeoutError(new Error('普通错误'))).toBe(false);
    expect(isTimeoutError(null)).toBe(false);
  });

  it('无效 ms（<=0）直接透传原 Promise，不加超时', async () => {
    const p = Promise.resolve('v');
    expect(await withTimeout(p, 0)).toBe('v');
  });

  it('超时触发 onTimeout 回调（供取消底层任务）', async () => {
    const never = new Promise(() => {});
    const onTimeout = vi.fn();
    const p = withTimeout(never, 1000, '超时', undefined, onTimeout);
    p.catch(() => {});
    await vi.advanceTimersByTimeAsync(1001);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    await expect(p).rejects.toThrow('超时');
  });

  it('超时中止传入的 signal（真实定时器；jsdom 的 AbortSignal 无 abort()，走 dispatchEvent fallback）', async () => {
    vi.useRealTimers();
    const never = new Promise(() => {});
    const ctl = new AbortController();
    let aborted = false;
    ctl.signal.addEventListener('abort', () => {
      aborted = true;
    });
    const p = withTimeout(never, 30, '超时', ctl.signal);
    p.catch(() => {});
    expect(aborted).toBe(false);
    await new Promise((r) => setTimeout(r, 60));
    expect(aborted).toBe(true);
  });

  it('正常完成时不触发 onTimeout 也不 abort signal', async () => {
    const ctl = new AbortController();
    const onTimeout = vi.fn();
    const p = withTimeout(Promise.resolve('v'), 5000, '超时', ctl.signal, onTimeout);
    expect(await p).toBe('v');
    expect(onTimeout).not.toHaveBeenCalled();
    expect(ctl.signal.aborted).toBe(false);
  });
});

describe('asyncGuard.loadImageWithTimeout（统一图片加载入口）', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('onload 成功 → resolve HTMLImageElement', async () => {
    const img: {
      src: string;
      crossOrigin: string;
      onload: (() => void) | null;
      onerror: (() => void) | null;
    } = { src: '', crossOrigin: '', onload: null, onerror: null };
    global.Image = vi.fn(() => img) as unknown as typeof Image;
    const p = loadImageWithTimeout('http://x/a.png');
    img.onload!();
    expect(await p).toBe(img);
  });

  it('onerror 失败 → reject 明确错误', async () => {
    const img: {
      src: string;
      crossOrigin: string;
      onload: (() => void) | null;
      onerror: (() => void) | null;
    } = { src: '', crossOrigin: '', onload: null, onerror: null };
    global.Image = vi.fn(() => img) as unknown as typeof Image;
    const p = loadImageWithTimeout('http://x/a.png');
    img.onerror!();
    await expect(p).rejects.toThrow('图片加载失败');
  });

  it('超时未加载 → reject TimeoutError（不再永久挂起）', async () => {
    vi.useFakeTimers();
    const img: {
      src: string;
      crossOrigin: string;
      onload: (() => void) | null;
      onerror: (() => void) | null;
    } = { src: '', crossOrigin: '', onload: null, onerror: null };
    global.Image = vi.fn(() => img) as unknown as typeof Image;
    const p = loadImageWithTimeout('http://x/a.png', { timeoutMs: 1000 });
    let settled = false;
    p.catch(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(1001);
    expect(settled).toBe(true);
    await expect(p).rejects.toThrow('图片加载超时');
  });

  it('设置 crossOrigin = anonymous（跨域 canvas 不污染）', () => {
    const img: {
      src: string;
      crossOrigin: string;
      onload: (() => void) | null;
      onerror: (() => void) | null;
    } = { src: '', crossOrigin: '', onload: null, onerror: null };
    global.Image = vi.fn(() => img) as unknown as typeof Image;
    loadImageWithTimeout('http://x/a.png');
    expect(img.crossOrigin).toBe('anonymous');
  });

  // TD-16-2 收口：默认不再恒设 anonymous —— 同源 URL 走 SSOT 裁决（同源不设）。
  // 旧实现（`crossOrigin = 'anonymous'` 恒设）在此先红：同源 `/files/*` 走 CORS 模式 → 污染 canvas。
  it('同源 URL（默认）→ 不设 crossOrigin（SSOT 裁决，canvas 保持可读）', () => {
    const img: {
      src: string;
      crossOrigin: string;
      onload: (() => void) | null;
      onerror: (() => void) | null;
    } = { src: '', crossOrigin: '', onload: null, onerror: null };
    global.Image = vi.fn(() => img) as unknown as typeof Image;
    loadImageWithTimeout('/files/a.png');
    expect(img.crossOrigin).toBeFalsy();
  });

  it('显式 crossOrigin: null → 去掉 crossOrigin（loadImageOrNull 二级重试用）', () => {
    const img: {
      src: string;
      crossOrigin: string;
      onload: (() => void) | null;
      onerror: (() => void) | null;
    } = { src: '', crossOrigin: 'anonymous', onload: null, onerror: null };
    global.Image = vi.fn(() => img) as unknown as typeof Image;
    loadImageWithTimeout('/files/a.png', { crossOrigin: null });
    expect(img.crossOrigin).toBeFalsy();
  });
});

describe('asyncGuard.releaseQuietly / releaseQuietlyAsync（RELEASE_FAIL 唯一实现 · TD-02-26 成本层收口）', () => {
  it('同步：act 正常 → 执行一次、返回 undefined', () => {
    const act = vi.fn();
    expect(releaseQuietly(act)).toBeUndefined();
    expect(act).toHaveBeenCalledTimes(1);
  });

  it('同步：act 抛错 → 吞掉不外抛（释放失败不阻断主流程）', () => {
    // 真实场景：ImageBitmap.close 对已关闭对象抛 InvalidStateError
    const boom = () => {
      throw new DOMException('already closed', 'InvalidStateError');
    };
    expect(() => releaseQuietly(boom)).not.toThrow();
  });

  it('异步：act 正常 → resolve，且等待 act 完成', async () => {
    let done = false;
    await releaseQuietlyAsync(async () => {
      await Promise.resolve();
      done = true;
    });
    expect(done).toBe(true);
  });

  it('异步：act reject → 吞掉不外抛', async () => {
    await expect(
      releaseQuietlyAsync(async () => {
        throw new Error('cancel failed');
      }),
    ).resolves.toBeUndefined();
  });

  it('异步：act 同步抛错同样被吞（形态容错）', async () => {
    await expect(
      releaseQuietlyAsync(() => {
        throw new Error('sync throw');
      }),
    ).resolves.toBeUndefined();
  });
});

describe('asyncGuard.tryParse（PARSE_FALLBACK 唯一实现 · TD-02-26 成本层收口）', () => {
  // 【2026-09-17 契约收紧 · **回改旧断言**】`tryParse` 已改为**判别联合**
  //（`{ok:true,value}` ／ `{ok:false,error}`），不再接受 fallback 参数、也不再"静默落默认值"
  //（原说明在 `catchOk.ts` 的 PARSE_FALLBACK 段；该登记表与 `check:catch` 闸已于 2026-09-17 一并删除）。
  // 原断言锁的是**旧签名**（第二参 fallback、失败返 undefined）
  // ⇒ 与现契约相反，且编译不过。按"失败必须透传"重写：失败必须落到 `ok:false` + `error`。
  it('解析成功 → ok:true + value', () => {
    const r = tryParse(() => JSON.parse('{"a":1}').a);
    expect(r.ok).toBe(true);
    expect(r.ok && r.value).toBe(1);
  });

  it('解析抛错 → ok:false + error（判别联合，不落默认值、不静默）', () => {
    const r = tryParse(() => JSON.parse('不是json'));
    expect(r.ok).toBe(false);
    expect(r.ok ? undefined : r.error).toBeTruthy();
  });

  it('同步抛错不外抛（调用方按 ok:false 分支处理，主流程不中断）', () => {
    let out: unknown;
    expect(() => {
      out = tryParse(() => {
        throw new Error('boom');
      });
    }).not.toThrow();
    expect((out as { ok: boolean }).ok).toBe(false);
  });

  it('真实场景：URL 解析失败 → 调用方据 ok:false 自行回退（而非原语代劳）', () => {
    const ok = tryParse(() =>
      decodeURIComponent(new URL('http://x/%E4%B8%AD').pathname.split('/').pop() || ''),
    );
    expect(ok.ok).toBe(true);
    expect(ok.ok && ok.value).toBe('中');
    const bad = tryParse(() =>
      decodeURIComponent(new URL('::::bad').pathname.split('/').pop() || ''),
    );
    expect(bad.ok).toBe(false); // 失败**透传**给调用方，由它决定要不要用默认值
  });

  it('真实场景：正则编译失败 → ok:false + error 透传给调用方（不抛、不压成 undefined）', () => {
    // 【断言同步到新契约 · 2026-09-17】原断言 `toBeUndefined()` 锁的是**旧契约**
    // （原语把失败压成 undefined，调用方无法区分"坏正则"与"没匹配"）—— 见规范 §3 Step 4 表。
    // 新契约：`tryParse` 返判别联合；回退决策**归调用方**，原语只透传失败。
    const badPattern = '('; // 拆分构造，避开 eslint 对字面量非法正则的静态校验
    const re = tryParse(() => new RegExp(badPattern));
    expect(re.ok).toBe(false);
    if (!re.ok) expect(re.error).toBeInstanceOf(SyntaxError);
  });
});

describe('asyncGuard.attemptQuietly / attemptQuietlyAsync（NON_BLOCKING 主实现 · TD-02-26 成本层收口）', () => {
  it('同步：act 成功则原样执行', () => {
    let ran = false;
    attemptQuietly(() => {
      ran = true;
    });
    expect(ran).toBe(true);
  });

  it('同步：act 抛错被吞（不阻断主流程）', () => {
    expect(() =>
      attemptQuietly(() => {
        throw new Error('boom');
      }),
    ).not.toThrow();
  });

  it('异步：act 成功则执行', async () => {
    let ran = false;
    await attemptQuietlyAsync(async () => {
      ran = true;
    });
    expect(ran).toBe(true);
  });

  it('异步：act 抛错被吞（resolves undefined，不阻断）', async () => {
    await expect(
      attemptQuietlyAsync(async () => {
        throw new Error('async boom');
      }),
    ).resolves.toBeUndefined();
  });
});
