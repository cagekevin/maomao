// @vitest-environment node
/**
 * filesApi 单测（批 2，API 封装层）。
 * 覆盖：saveInlineToLocal / saveResultToTasks / saveTextToTasks / uploadFileToLocal
 *   的成功路径与各类边界（非 data:/blob:/空/fetch 失败 → null，不抛）。
 * 策略：node + mock fetch（/api/files/upload）。依赖全局 Blob/FormData/atob（node 18+ 自带）。
 * 注：saveInlineToLocal 候选 B 起收口为纯透传 {dataUri, subfolder}，文件名/sha1/校验已移交后端，
 *   前端不再用 crypto.subtle（sha1Hex 已删），故无需 webcrypto stub。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// setup.mjs 已把 globalThis.fetch 定义为共享 vi.fn；此处做类型对齐以启用 .mock* / mock.calls。
const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

const api = await import('@/components/base/api/filesApi.ts');

function uploadResp(url: any) {
  return { ok: true, status: 200, json: async () => ({ code: 0, data: { url } }) };
}
function failResp() {
  return { ok: false, status: 500, json: async () => ({}) };
}

beforeEach(() => fetchMock.mockReset());
afterEach(() => vi.unstubAllGlobals());

const DATA_PNG = 'data:image/png;base64,iVBORw0KGgo=';

// ── 【TD-08-28】contentId 透传契约：生产者（后端落盘权威）给全 ⇒ 消费者不再自算 sha1 ──
describe('filesApi — contentId 透传（TD-08-28）', () => {
  const respWithCid = (url: string, contentId?: string) => ({
    ok: true,
    status: 200,
    json: async () => ({ code: 0, data: { url, contentId } }),
  });

  it('multipart 上传：后端回传 contentId → `UploadOutcome.contentId` 上浮（files.ts:175）', async () => {
    fetchMock.mockResolvedValue(respWithCid('http://x/a.png', 'sha1:abc'));
    expect(await api.uploadFileToLocal(new Blob(['x'], { type: 'image/png' }))).toEqual({
      ok: true,
      url: 'http://x/a.png',
      contentId: 'sha1:abc',
    });
  });

  it('fileUrl 远程落盘：contentId 上浮（files.ts:410）—— 网页图本地化不必再 fetch 整图重算', async () => {
    fetchMock.mockResolvedValue(respWithCid('http://x/web/a.png', 'sha1:def'));
    expect(
      await api.downloadRemoteToLocal('https://cdn.example.com/a.png', { folder: 'web' }),
    ).toEqual({ ok: true, url: 'http://x/web/a.png', contentId: 'sha1:def' });
  });

  it('后端响应未带 contentId → 为 undefined（如实，前端不补算）', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://x/a.png'));
    const r = await api.uploadFileToLocal(new Blob(['x'], { type: 'image/png' }));
    expect(r).toEqual({ ok: true, url: 'http://x/a.png' });
    expect((r as { contentId?: string }).contentId).toBeUndefined();
  });

  it('inline（base64/dataUri）分支：后端已补回 contentId ⇒ 同样上浮（三分支口径一致）', async () => {
    // 【2026-09-17 补生产者】此前后端 base64 分支只回 `{url}`（`saveBase64ToFile` 内部算了 contentId 却没往外给），
    // 前端本分支 contentId 恒 undefined。现生产者回传，前端如实透传 —— 消费者（`persistUrlToUploads` →
    // `PersistOutcome.contentId`）三条来源分支（inline / uploaded / already-local）口径一致。
    fetchMock.mockResolvedValue(respWithCid('http://x/a.png', 'sha1:ghi'));
    expect(await api.saveInlineToLocal(DATA_PNG)).toEqual({
      ok: true,
      url: 'http://x/a.png',
      contentId: 'sha1:ghi',
    });
  });
});

describe('filesApi — saveInlineToLocal', () => {
  it('合法 data: URL → 落盘返回 18080 绝对地址', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://127.0.0.1:18080/files/canvas/abc.png'));
    // 【2026-09-17】契约由 `string|null` 改为**判别联合**（失败必带生产者 message）。
    const r = await api.saveInlineToLocal(DATA_PNG);
    expect(r).toEqual({ ok: true, url: 'http://127.0.0.1:18080/files/canvas/abc.png' });
  });
  it('候选 B 收口为透传：body JSON 传 {dataUri, subfolder}（不再前端自算 sha1 文件名）', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://x/a.png'));
    await api.saveInlineToLocal(DATA_PNG, 'tasks');
    const [reqUrl, opts] = fetchMock.mock.calls[0];
    expect(reqUrl).toContain('/api/files/upload');
    const body = JSON.parse(opts.body);
    expect(body.dataUri).toBe(DATA_PNG);
    expect(body.subfolder).toBe('tasks');
  });
  it('subfolder 缺省 → canvas', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://x/a.png'));
    await api.saveInlineToLocal(DATA_PNG);
    const [, opts] = fetchMock.mock.calls[0];
    expect(JSON.parse(opts.body).subfolder).toBe('canvas');
  });
  it('非 data: URL → ok:false + message（不抛；与"上传失败"必须可区分）', async () => {
    expect(await api.saveInlineToLocal('http://x/y.png')).toEqual({
      ok: false,
      message: expect.any(String),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('上传失败（!res.ok / fetch reject / 200 但无 url）→ ok:false + 生产者 message（不抛）', async () => {
    fetchMock.mockResolvedValue(failResp());
    expect(await api.saveInlineToLocal(DATA_PNG)).toEqual({
      ok: false,
      message: expect.any(String),
    });
    fetchMock
      .mockImplementationOnce(async () => {
        throw new Error('net');
      })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    // 200 但后端没回 url ＝ **落盘未完成** —— 必须落在 ok:false（原来与"成功"共用 null）。
    expect(await api.saveInlineToLocal(DATA_PNG)).toEqual({
      ok: false,
      message: expect.any(String),
    });
  });
});

// 【TD-01-17】`saveResultToTasks` 契约已由 `string | null` 改为**判别联合** `SaveTasksOutcome`
// （`null` 曾兼表「无需落盘」与「落盘失败」两种相反语义 → 编排层无法区分，失败被当成功 = 假成功）。
// 本组断言随之更新为判别联合口径：`ok/skipped/reason` 三态可区分。
describe('filesApi — saveResultToTasks', () => {
  it('data: 结果 → 落盘 tasks 目录，返回 ok + 持久 url（skipped=false）', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://127.0.0.1:18080/files/tasks/gen.png'));
    expect(await api.saveResultToTasks(DATA_PNG, 'image')).toEqual({
      ok: true,
      url: 'http://127.0.0.1:18080/files/tasks/gen.png',
      skipped: false,
    });
  });
  it('[TD-02-58] blob: 临时地址 → 委托唯一原语后**真上传落盘**（blob 刷新即失效，原 skipped 等于丢结果）', async () => {
    // 【契约变更】原用例锁的是本文件**第二份分流**的口径（blob → skipped:true + 不发请求），
    // 与唯一原语 `persistUrlToUploads`（blob 先取字节再上传）**分叉**。现委托原语：真落盘，skipped:false。
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        blob: async () => new Blob(['x'], { type: 'image/png' }),
      })
      .mockResolvedValueOnce(uploadResp('http://127.0.0.1:18080/files/tasks/blob.png'));
    expect(await api.saveResultToTasks('blob:http://x/y', 'image')).toEqual({
      ok: true,
      url: 'http://127.0.0.1:18080/files/tasks/blob.png',
      skipped: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2); // ① 取 blob 字节 ② 上传
  });
  it('http 上游 url → fileUrl 幂等下载落盘', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://127.0.0.1:18080/files/tasks/up.png'));
    expect(await api.saveResultToTasks('http://cdn/x.png', 'image')).toEqual({
      ok: true,
      url: 'http://127.0.0.1:18080/files/tasks/up.png',
      skipped: false,
    });
  });
  it('空 url → ok + skipped:true（无内容可落，非失败）', async () => {
    expect(await api.saveResultToTasks('', 'image')).toEqual({ ok: true, url: '', skipped: true });
  });
  it('落盘失败 → ok:false + reason（**绝不返回 ok:true**，否则编排层会宣告假成功）', async () => {
    fetchMock.mockResolvedValue(failResp());
    const out = await api.saveResultToTasks(DATA_PNG, 'image');
    expect(out.ok).toBe(false);
    // 【TD-02-58 合同变更】`reason` 不再由本层改写 —— 原实现把原语的 `upload-failed` 重贴成 `exception`
    // （消费者替生产者**重新归类失败** = 越权，CLAUDE.md §5.1）。现原样转发唯一原语的判词，message 亦保留生产者原文。
    expect(out.ok ? '' : out.reason).toBe('upload-failed');
    expect(out.ok ? '' : out.message).toEqual(expect.any(String));
  });
  it('已是本机 /files/ → ok + skipped:true（relay 后端已落盘，防 uploads/tasks 双落盘重复文件）', async () => {
    const out = await api.saveResultToTasks('http://127.0.0.1:18080/files/tasks/a.png', 'image');
    expect(out).toEqual({
      ok: true,
      url: 'http://127.0.0.1:18080/files/tasks/a.png',
      skipped: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('filesApi — saveResultToTasks 类型→扩展名映射', () => {
  const DATA_PNG = 'data:image/png;base64,iVBORw0KGgo=';
  /** 从上传请求体取"声明的显示名"（【TD-02-58】委托唯一原语后，data: 走 base64 JSON 分支 ⇒ 名字在 displayName） */
  function bodyName(opts: any) {
    const body = typeof opts.body === 'string' ? JSON.parse(opts.body) : opts.body;
    return String(body?.displayName ?? '');
  }
  it('type=image → .png', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://x/a.png'));
    await api.saveResultToTasks(DATA_PNG, 'image');
    expect(bodyName(fetchMock.mock.calls[0][1])).toMatch(/\.png$/);
  });
  it('type=text → .txt', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://x/a.txt'));
    await api.saveResultToTasks(DATA_PNG, 'text');
    expect(bodyName(fetchMock.mock.calls[0][1])).toMatch(/\.txt$/);
  });
  it('type=video → .mp4', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://x/a.mp4'));
    await api.saveResultToTasks(DATA_PNG, 'video');
    expect(bodyName(fetchMock.mock.calls[0][1])).toMatch(/\.mp4$/);
  });
  it('type=audio → .m4a', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://x/a.m4a'));
    await api.saveResultToTasks(DATA_PNG, 'audio');
    expect(bodyName(fetchMock.mock.calls[0][1])).toMatch(/\.m4a$/);
  });
  it('未知 type → 兜底 .bin', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://x/a.bin'));
    await api.saveResultToTasks(DATA_PNG, 'weird');
    expect(bodyName(fetchMock.mock.calls[0][1])).toMatch(/\.bin$/);
  });
});

describe('filesApi — saveTextToTasks', () => {
  it('合法文本 → 落盘 txt 返回 url（判别联合）', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://127.0.0.1:18080/files/tasks/gen.txt'));
    expect(await api.saveTextToTasks('hello world')).toEqual({
      ok: true,
      url: 'http://127.0.0.1:18080/files/tasks/gen.txt',
    });
  });
  it('空/非字符串 → ok:false + message', async () => {
    expect(await api.saveTextToTasks('   ')).toEqual({
      ok: false,
      message: expect.any(String),
    });
    expect(await api.saveTextToTasks(123 as unknown as string)).toEqual({
      ok: false,
      message: expect.any(String),
    });
  });
  it('自定义 name 前缀清洗非法字符/空格', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://x/t.txt'));
    await api.saveTextToTasks('内容', 'a/b:c*d?e');
    const [, opts] = fetchMock.mock.calls[0];
    for (const [k, v] of opts.body.entries()) {
      if (k === 'file') expect(v.name).toMatch(/^a_b_c_d_e_\d{8}_\d{6}\.txt$/);
    }
  });
  it('上传失败（!res.ok）→ ok:false 不抛', async () => {
    fetchMock.mockResolvedValue(failResp());
    expect(await api.saveTextToTasks('hi')).toEqual({ ok: false, message: expect.any(String) });
  });
  it('fetch reject → ok:false 不抛', async () => {
    // 首次（落盘上传）抛错；后续（logger 上报 /api/logs）正常，避免未捕获拒绝
    fetchMock
      .mockImplementationOnce(async () => {
        throw new Error('net');
      })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    expect(await api.saveTextToTasks('hi')).toEqual({ ok: false, message: expect.any(String) });
  });
});

describe('filesApi — uploadFileToLocal', () => {
  it('原始 File/Blob → 落盘返回 url（判别联合）', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://127.0.0.1:18080/files/canvas/drop/a.png'));
    const file = new Blob(['x'], { type: 'image/png' });
    expect(await api.uploadFileToLocal(file)).toEqual({
      ok: true,
      url: 'http://127.0.0.1:18080/files/canvas/drop/a.png',
    });
  });
  it('自定义 subfolder 与 filename 生效', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://x/u.png'));
    const file = new File(['x'], 'drop.png', { type: 'image/png' });
    await api.uploadFileToLocal(file, 'gen', 'custom.png');
    const [, opts] = fetchMock.mock.calls[0];
    const fd = opts.body;
    for (const [k, v] of fd.entries()) {
      if (k === 'subfolder') expect(v).toBe('gen');
      if (k === 'file') expect(v.name).toBe('custom.png');
    }
  });
  it('无 file → ok:false + message', async () => {
    expect(await api.uploadFileToLocal(null)).toEqual({ ok: false, message: expect.any(String) });
  });
  it('上传失败（!res.ok）→ ok:false 不抛', async () => {
    fetchMock.mockResolvedValue(failResp());
    expect(await api.uploadFileToLocal(new Blob(['x']))).toEqual({
      ok: false,
      message: expect.any(String),
    });
  });
  it('fetch reject → ok:false 不抛', async () => {
    // 首次（上传）抛错；后续（logger 上报）正常
    fetchMock
      .mockImplementationOnce(async () => {
        throw new Error('net');
      })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    expect(await api.uploadFileToLocal(new Blob(['x']))).toEqual({
      ok: false,
      message: expect.any(String),
    });
  });
});

describe('filesApi — downloadRemoteToLocal（网页拖图后台本地化）', () => {
  it('http(s) URL → fileUrl 落盘到指定 subfolder 返回 url', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://127.0.0.1:18080/files/web/abc.png'));
    const url = await api.downloadRemoteToLocal('https://x/cat.png', { folder: 'web' });
    expect(url).toEqual({ ok: true, url: 'http://127.0.0.1:18080/files/web/abc.png' });
    const [reqUrl, opts] = fetchMock.mock.calls[0];
    expect(reqUrl).toContain('/api/files/upload');
    const body = JSON.parse(opts.body);
    expect(body.fileUrl).toBe('https://x/cat.png');
    expect(body.subfolder).toBe('web');
  });
  it('默认 folder=canvas（未传 folder 时）', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://x/a.png'));
    await api.downloadRemoteToLocal('http://x/a.png');
    const [, opts] = fetchMock.mock.calls[0];
    expect(JSON.parse(opts.body).subfolder).toBe('canvas');
  });
  it('非 http(s)（data:/blob:/空）→ ok:false + message + skipped（无需下载）且不发请求', async () => {
    const skip = { ok: false, message: expect.any(String), skipped: true };
    expect(await api.downloadRemoteToLocal('data:image/png;base64,xx')).toEqual(skip);
    expect(await api.downloadRemoteToLocal('blob:http://x/y')).toEqual(skip);
    expect(await api.downloadRemoteToLocal('')).toEqual(skip);
    expect(await api.downloadRemoteToLocal(undefined as never)).toEqual(skip);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('上传失败（!res.ok / fetch reject）→ ok:false 不抛', async () => {
    fetchMock.mockResolvedValue(failResp());
    expect(await api.downloadRemoteToLocal('http://x/a.png')).toEqual({
      ok: false,
      message: expect.any(String),
    });
    fetchMock
      .mockImplementationOnce(async () => {
        throw new Error('net');
      })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    expect(await api.downloadRemoteToLocal('http://x/b.png')).toEqual({
      ok: false,
      message: expect.any(String),
    });
  });

  // ── 回归护栏（2026-08-28「素材拖到画布 → uploads/web 出现重复文件」）──
  // 素材从素材库拖到画布时，若画布没认出它是素材（缺 application/x-yimao-asset），
  // 会退化成「网页拖图本地化」，把本机的 /files/migrated/... 再下载一份落进 uploads/web。
  // 这里从落盘入口兜底：URL 已指向本机 uploads 时一律不再下载，调用方保持原 URL。
  it('本机 /files/ URL（绝对 + 相对）→ ok:false（不发请求，防重复落 web）', async () => {
    const skip = { ok: false, message: expect.any(String), skipped: true };
    expect(
      await api.downloadRemoteToLocal('http://127.0.0.1:18080/files/migrated/道具/a.png', {
        folder: 'web',
      }),
    ).toEqual(skip);
    expect(await api.downloadRemoteToLocal('/files/migrated/a.png', { folder: 'web' })).toEqual(
      skip,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('外网主机上的 /files/ 路径不算本地 → 照常下载（不误伤真实网页图）', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://127.0.0.1:18080/files/web/x.png'));
    expect(
      await api.downloadRemoteToLocal('https://cdn.example.com/files/a.png', { folder: 'web' }),
    ).toEqual({ ok: true, url: 'http://127.0.0.1:18080/files/web/x.png' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// ── 图像入节点·统一落盘策略（全库唯一降级规则，2026-09-11 收口）──
// 消费方：AssetNode 上传 / useAssetDropPaste 拖入粘贴 / ImageGenerate 上传参考图 / useImageHoverActions 四条出口。
// 这里钉住的规则：落盘失败一律回退内联（不返回 null 之外什么都不断），只有「连内联都拿不到」才交给调用方报错。
describe('filesApi — resolveNodeAssetUrl（File 源统一落盘策略）', () => {
  const PNG = new File(['x'], 'a.png', { type: 'image/png' });

  it('上传成功 → 持久 /files/ URL，且只发一次上传请求（不读内联）', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://127.0.0.1:18080/files/canvas/drop/a.png'));
    expect(await api.resolveNodeAssetUrl(PNG, 'canvas/drop', 'a.png')).toEqual({
      ok: true,
      url: 'http://127.0.0.1:18080/files/canvas/drop/a.png',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('落盘失败（!res.ok）→ 回退内联 dataURL（不抛、不返回 null）', async () => {
    // node 环境无 FileReader（fileToDataUrl 的回退路径依赖它），此处补最小实现
    vi.stubGlobal(
      'FileReader',
      class {
        onload: null | (() => void) = null;
        onerror: null | (() => void) = null;
        result = DATA_PNG;
        readAsDataURL() {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
    fetchMock.mockResolvedValue(failResp());
    const out = await api.resolveNodeAssetUrl(PNG, 'canvas/drop');
    // 回退内联 → **ok:true**（图仍能上屏）；"落盘失败"是内部降级，不是本函数的失败。
    // 契约要点："落盘失败但内联可用"与"连内联都读不出"从此可区分（原来都压成 null/string）。
    expect(out).toEqual({ ok: true, url: DATA_PNG });
  });

  it('落盘失败且连内联都读不出 → null（真失败，由调用方提示一次错误）', async () => {
    vi.stubGlobal(
      'FileReader',
      class {
        onload: null | (() => void) = null;
        onerror: null | (() => void) = null;
        readAsDataURL() {
          queueMicrotask(() => this.onerror?.());
        }
      },
    );
    fetchMock.mockResolvedValue(failResp());
    expect(await api.resolveNodeAssetUrl(PNG, 'canvas/drop')).toEqual({
      ok: false,
      message: expect.any(String),
    });
  });

  it('无文件 → ok:false + message 且不发请求', async () => {
    expect(await api.resolveNodeAssetUrl(null)).toEqual({
      ok: false,
      message: expect.any(String),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ── 「URL → uploads」唯一原语：分流判据收口在文件域（上层用例不得再抄一份）──
describe('filesApi — persistUrlToUploads', () => {
  it('data: → inline 分支（folder 落子目录 + name 作为行显示名）', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://127.0.0.1:18080/files/migrated/a.png'));
    const out = await api.persistUrlToUploads(DATA_PNG, { folder: 'migrated', name: '猫' });
    expect(out).toEqual({
      ok: true,
      url: 'http://127.0.0.1:18080/files/migrated/a.png',
      source: 'inline',
    });
    const [, opts] = fetchMock.mock.calls[0];
    // displayName：行 name = 用户命名（TD-12-12）；磁盘名仍是内容寻址（后端决定）
    expect(JSON.parse(opts.body)).toMatchObject({ subfolder: 'migrated', displayName: '猫' });
  });

  it('已是本机 /files/ → already-local：原样返回且不发任何请求（不重传）', async () => {
    const rel = await api.persistUrlToUploads('/files/tasks/a.png', { folder: 'migrated' });
    expect(rel).toEqual({ ok: true, url: '/files/tasks/a.png', source: 'already-local' });
    const abs = 'http://127.0.0.1:18080/files/tasks/a.png';
    const absOut = await api.persistUrlToUploads(abs, { folder: 'migrated' });
    expect(absOut).toEqual({ ok: true, url: abs, source: 'already-local' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('blob: → 前端 fetch 取 Blob 后 multipart 上传（后端拿不到 blob:）', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        blob: async () => new Blob(['x'], { type: 'image/png' }),
        json: async () => ({}),
      })
      .mockResolvedValueOnce(uploadResp('http://127.0.0.1:18080/files/migrated/n.png'));
    const out = await api.persistUrlToUploads('blob:http://x/y', {
      folder: 'migrated',
      name: '猫',
    });
    expect(out.ok && out.source).toBe('uploaded');
    expect(out.ok && out.url).toBe('http://127.0.0.1:18080/files/migrated/n.png');
    const [upUrl, opts] = fetchMock.mock.calls[1];
    expect(upUrl).toContain('/api/files/upload');
    for (const [k, v] of opts.body.entries()) {
      if (k === 'file') expect(v.name).toBe('猫.png');
    }
  });

  it('远程 http(s) → 交后端唯一下载点（JSON fileUrl），不在前端 fetch 原图', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://127.0.0.1:18080/files/migrated/r.png'));
    const out = await api.persistUrlToUploads('https://cdn/x.png', {
      folder: 'migrated',
      name: '猫',
    });
    expect(out.ok && out.url).toBe('http://127.0.0.1:18080/files/migrated/r.png');
    const [reqUrl, opts] = fetchMock.mock.calls[0];
    expect(reqUrl).toContain('/api/files/upload');
    expect(JSON.parse(opts.body)).toMatchObject({
      fileUrl: 'https://cdn/x.png',
      subfolder: 'migrated',
    });
  });

  it('不支持的协议 → unsupported（明确失败，不猜也不兜底）', async () => {
    expect(await api.persistUrlToUploads('ftp://x/a.png')).toEqual({
      ok: false,
      reason: 'unsupported',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('空 url → empty（且不登记、不发请求）', async () => {
    expect(await api.persistUrlToUploads('')).toEqual({ ok: false, reason: 'empty' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('落盘失败（!res.ok）→ upload-failed（判别联合，不归一 null）', async () => {
    fetchMock.mockResolvedValue(failResp());
    expect(await api.persistUrlToUploads(DATA_PNG)).toEqual({
      ok: false,
      reason: 'upload-failed',
      // 【2026-09-17】生产者 **message**（为什么没落盘）随场景上浮（原来只笼统一个 reason）。
      message: expect.any(String),
    });
  });

  it('异常 → exception 且带原始 message（不抛，也不伪装成 upload-failed）', async () => {
    fetchMock
      .mockImplementationOnce(async () => {
        throw new Error('net');
      })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    const out = await api.persistUrlToUploads('blob:http://x/y');
    expect(out.ok).toBe(false);
    expect(out.ok ? '' : out.reason).toBe('exception');
    expect(out.ok ? '' : out.message).toContain('net');
  });
});

describe('filesApi — showThenPersistInline（dataURL 源统一落盘策略）', () => {
  it('立即上屏 → 落盘成功 → 二次上屏换持久 URL（顺序即策略）', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://127.0.0.1:18080/files/canvas/abc.png'));
    const seen: any = [];
    await api.showThenPersistInline(DATA_PNG, (u) => seen.push(u));
    expect(seen).toEqual([DATA_PNG, 'http://127.0.0.1:18080/files/canvas/abc.png']);
  });

  it('落盘失败 → 只上屏内联一次（保留内联、不回滚、不抛）', async () => {
    fetchMock.mockResolvedValue(failResp());
    const seen: any = [];
    await api.showThenPersistInline(DATA_PNG, (u) => seen.push(u));
    expect(seen).toEqual([DATA_PNG]);
  });

  it('空 dataURL → 既不上屏也不发请求', async () => {
    const seen: any = [];
    await api.showThenPersistInline('', (u) => seen.push(u));
    expect(seen).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
