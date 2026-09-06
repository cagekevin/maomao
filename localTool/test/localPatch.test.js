/**
 * 局部提取与图像融合 · 后端算法 + 接口单测（node --test / ESM）
 * ------------------------------------------------------------
 * 运行：cd localTool && npm test （脚本 = tsc && node --test test/*.test.js）
 * 覆盖：
 *   - localPatchOps：fileFingerprint / computePaddedRect / cropLocalPatch
 *                    buildFeatherMask / applyLimitedColorMatch / mergeLocalPatches
 *   - 接口：crop / merge / fingerprint（缺上下文、>16 张、源变 409、宽高比越限）
 * DB/落盘隔离：MAOMAO_DATA_DIR 指向 os.tmpdir 独立目录，绝不触碰真实 ~/.maomao-localtool。
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Jimp from 'jimp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');
const importSrc = (rel) => import(pathToFileURL(path.join(SRC, rel)).href);

// ── 隔离数据目录（在 import 业务模块前设置，database 运行时读 env）──
const TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'maomao-localpatch-'));
process.env.MAOMAO_DATA_DIR = TEST_DIR;

let ops, routes;
before(async () => {
  ops = await importSrc(path.join('utils', 'localPatchOps.ts'));
  routes = await importSrc(path.join('routes', 'localPatch.ts'));
});

const uploadDir = () => path.join(TEST_DIR, 'uploads');
const outputDir = () => path.join(uploadDir(), 'local-patch');

/** 纯色图：用 hex 背景构造（new Jimp 的函数背景在 0.22 不可靠，退回 0xAARRGGBB 数值）。 */
function solid(w, h, { r, g, b }) {
  const hex = (((r & 0xff) << 24) | ((g & 0xff) << 16) | ((b & 0xff) << 8) | 0xff) >>> 0;
  return new Jimp(w, h, hex);
}
function pixel(img, x, y) {
  return Jimp.intToRGBA(img.getPixelColor(x, y));
}
/** 写 PNG 到 local-patch 子目录，返回 /files/local-patch/<name> URL（jimp 0.22 无 getBufferSync，用异步）。 */
async function writeOut(img, name) {
  fs.mkdirSync(outputDir(), { recursive: true });
  const buf = await img.getBufferAsync(Jimp.MIME_PNG);
  const filePath = path.join(outputDir(), name);
  fs.writeFileSync(filePath, buf);
  return `/files/local-patch/${name}`;
}
function diskOf(url) {
  const clean = url.replace(/^https?:\/\/[^/]+\//, '/').replace(/^\/files\//, '');
  return path.join(uploadDir(), clean);
}

// ── req/res 桩（对齐 stage2-routes.test.js）──
function makeRes() {
  const r = {
    status: 0,
    headers: {},
    body: null,
    writableEnded: false,
    on() {
      return r;
    },
    writeHead(code, h) {
      r.status = code;
      if (h) r.headers = { ...r.headers, ...h };
      return r;
    },
    end(data) {
      r.writableEnded = true;
      if (data !== undefined)
        r.body = (r.body || '') + (Buffer.isBuffer(data) ? data.toString('utf-8') : String(data));
      return r;
    },
  };
  return r;
}
function makeJsonReq(body) {
  const data = Buffer.from(JSON.stringify(body));
  const req = { headers: { 'content-type': 'application/json' }, body: data };
  req.on = (ev, cb) => {
    if (ev === 'data' && data.length) cb(data);
    if (ev === 'end') cb();
    return req;
  };
  return req;
}
const parseBody = (res) => (res.body ? JSON.parse(res.body) : null);

// ════════════════════════════════════════════════════════════════
// fileFingerprint
// ════════════════════════════════════════════════════════════════
test('[fingerprint] 同文件同指纹，改内容指纹变', async () => {
  const p = path.join(outputDir(), 'fp.png');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, Buffer.from('aaa'));
  const a = await ops.fileFingerprint(p);
  const a2 = await ops.fileFingerprint(p);
  assert.equal(a, a2);
  fs.writeFileSync(p, Buffer.from('bbb'));
  const b = await ops.fileFingerprint(p);
  assert.notEqual(a, b);
  assert.equal(a.length, 64); // sha256 hex
});

// ════════════════════════════════════════════════════════════════
// computePaddedRect
// ════════════════════════════════════════════════════════════════
test('[computePaddedRect] 外扩 10% 且钳制图内', () => {
  const r = ops.computePaddedRect({ x: 100, y: 100, w: 100, h: 100 }, 1000, 1000, 0.1);
  assert.equal(r.x, 90);
  assert.equal(r.y, 90);
  // 外扩 100*0.1=10，x2=100+100-1+10=209，w=209-90+1=120
  assert.equal(r.w, 120);
  assert.equal(r.h, 120);
  // 紧贴左上 → 外扩被钳到 0，右/下外扩生效
  const edge = ops.computePaddedRect({ x: 0, y: 0, w: 50, h: 50 }, 500, 500, 0.1);
  assert.equal(edge.x, 0);
  assert.equal(edge.y, 0);
  assert.ok(edge.w > 50);
  assert.ok(edge.h > 50);
});

// ════════════════════════════════════════════════════════════════
// cropLocalPatch
// ════════════════════════════════════════════════════════════════
test('[crop] 裁出 paddedRect 且生成 cropContext', async () => {
  const url = await writeOut(solid(200, 200, { r: 255, g: 0, b: 0 }), 'crop_src.png');
  const { img, cropContext } = await ops.cropLocalPatch(
    diskOf(url),
    { x: 50, y: 50, w: 60, h: 60 },
    { sourceUrl: url },
  );
  assert.equal(cropContext.source.width, 200);
  assert.equal(cropContext.source.height, 200);
  assert.equal(cropContext.rect.w, 60);
  assert.equal(img.getWidth(), cropContext.paddedRect.w);
  assert.equal(img.getHeight(), cropContext.paddedRect.h);
  assert.equal(cropContext.contextId.length, 16); // 8 bytes hex
  assert.equal(cropContext.version, 2);
});

test('[crop] 选区 <32px 拒绝', async () => {
  const url = await writeOut(solid(100, 100, { r: 1, g: 1, b: 1 }), 'crop_small.png');
  await assert.rejects(
    ops.cropLocalPatch(diskOf(url), { x: 10, y: 10, w: 20, h: 20 }),
    (e) => e.name === 'LocalPatchError' && e.status === 400,
  );
});

test('[crop] 选区越界拒绝', async () => {
  const url = await writeOut(solid(100, 100, { r: 1, g: 1, b: 1 }), 'crop_oob.png');
  await assert.rejects(
    ops.cropLocalPatch(diskOf(url), { x: 90, y: 90, w: 50, h: 50 }),
    (e) => e.name === 'LocalPatchError' && e.status === 400,
  );
});

// ════════════════════════════════════════════════════════════════
// buildFeatherMask / applyLimitedColorMatch
// ════════════════════════════════════════════════════════════════
test('[feather] 内部实心 255，边角渐变小，无生硬接缝', () => {
  const mask = ops.buildFeatherMask(66, 66, { x: 6, y: 6, w: 54, h: 54 });
  const inner = pixel(mask, 33, 33);
  assert.equal(inner.a, 255);
  const corner = pixel(mask, 0, 0);
  assert.ok(corner.a < 100, '边角 alpha 应显著小于 255');
  const mid = pixel(mask, 6, 6); // rect 边缘（比 corner 靠近内部）
  assert.ok(mid.a >= corner.a && mid.a <= 255);
});

test('[colorMatch] ±24 限幅：绿 patch 拼入红区被拉向红但仍偏绿', () => {
  const patch = solid(20, 20, { r: 0, g: 255, b: 0 });
  const origRegion = solid(20, 20, { r: 255, g: 0, b: 0 });
  ops.applyLimitedColorMatch(patch, origRegion, 24);
  const c = pixel(patch, 10, 10);
  assert.ok(c.r >= 24 && c.r < 100, `红应被 +24 抬升且在限幅内，实际 r=${c.r}`);
  assert.ok(c.g >= 231 && c.g <= 255, `绿应被 -24，实际 g=${c.g}`);
});

// ════════════════════════════════════════════════════════════════
// mergeLocalPatches
// ════════════════════════════════════════════════════════════════
test('[merge] 单图拼接回原位置，padded 外不受影响', async () => {
  const url = await writeOut(solid(200, 200, { r: 255, g: 0, b: 0 }), 'merge_src.png');
  const { img: local, cropContext } = await ops.cropLocalPatch(diskOf(url), {
    x: 50,
    y: 50,
    w: 60,
    h: 60,
  });
  const green = solid(local.getWidth(), local.getHeight(), { r: 0, g: 255, b: 0 });
  const patchUrl = await writeOut(green, 'merge_patch.png');

  const merged = await ops.mergeLocalPatches(
    diskOf(url),
    [{ patchPath: diskOf(patchUrl), cropContext }],
    { colorMatch: false },
  );
  const pr = cropContext.paddedRect;
  const cIn = pixel(merged, pr.x + 5, pr.y + 5);
  const cOut = pixel(merged, 0, 0);
  assert.ok(cIn.g > cIn.r, 'padded 内应为绿');
  assert.ok(cOut.r > cOut.g && cOut.r > 200, 'padded 外应为原红');
});

test('[merge] 源图文件变更 → 409', async () => {
  const url = await writeOut(solid(200, 200, { r: 255, g: 0, b: 0 }), 'merge_change_src.png');
  const { cropContext } = await ops.cropLocalPatch(diskOf(url), { x: 50, y: 50, w: 60, h: 60 });
  // 篡改源图 → 源指纹变
  fs.writeFileSync(
    diskOf(url),
    await solid(200, 200, { r: 0, g: 0, b: 255 }).getBufferAsync(Jimp.MIME_PNG),
  );
  const repatch = solid(cropContext.paddedRect.w, cropContext.paddedRect.h, { r: 0, g: 255, b: 0 });
  const pUrl = await writeOut(repatch, 'merge_change_patch.png');
  await assert.rejects(
    ops.mergeLocalPatches(diskOf(url), [{ patchPath: diskOf(pUrl), cropContext }], {
      colorMatch: false,
    }),
    (e) => e.status === 409,
  );
});

test('[merge] 2× 等比放大 patch 能缩回融合', async () => {
  const url = await writeOut(solid(200, 200, { r: 255, g: 0, b: 0 }), 'merge_2x_src.png');
  const { img: local, cropContext } = await ops.cropLocalPatch(diskOf(url), {
    x: 50,
    y: 50,
    w: 60,
    h: 60,
  });
  const green = solid(local.getWidth() * 2, local.getHeight() * 2, { r: 0, g: 255, b: 0 });
  const pUrl = await writeOut(green, 'merge_2x_patch.png');
  const merged = await ops.mergeLocalPatches(
    diskOf(url),
    [{ patchPath: diskOf(pUrl), cropContext }],
    { colorMatch: false },
  );
  const pr = cropContext.paddedRect;
  const cIn = pixel(merged, pr.x + Math.floor(pr.w / 2), pr.y + Math.floor(pr.h / 2)); // 实心中心（羽化外圈不取）
  assert.ok(cIn.g > cIn.r, '2x 等比放大后应正确缩回覆盖');
});

test('[merge] 不等比拉伸 patch（宽高比变化过大）→ 400', async () => {
  const url = await writeOut(solid(200, 200, { r: 255, g: 0, b: 0 }), 'merge_stretch_src.png');
  const { cropContext } = await ops.cropLocalPatch(diskOf(url), { x: 50, y: 50, w: 60, h: 60 });
  const stretched = solid(120, 20, { r: 0, g: 255, b: 0 });
  const pUrl = await writeOut(stretched, 'merge_stretch_patch.png');
  await assert.rejects(
    ops.mergeLocalPatches(diskOf(url), [{ patchPath: diskOf(pUrl), cropContext }], {
      colorMatch: false,
    }),
    (e) => e.status === 400,
  );
});

// ════════════════════════════════════════════════════════════════
// 接口（handler 契约）
// ════════════════════════════════════════════════════════════════
test('[crop handler] 返回 file.url + cropContext 且落盘新文件', async () => {
  const srcUrl = await writeOut(solid(200, 200, { r: 255, g: 0, b: 0 }), 'hc_src.png');
  const res = makeRes();
  await routes.handleLocalPatchCrop(
    makeJsonReq({
      source_url: srcUrl,
      selection: { x: 40, y: 40, w: 50, h: 50 },
      padding_ratio: 0.1,
    }),
    res,
  );
  assert.equal(res.status, 200);
  const body = parseBody(res);
  assert.equal(body.code, 0);
  assert.equal(body.data.file.kind, 'image');
  assert.ok(body.data.file.cropContext.contextId);
  assert.ok(fs.existsSync(diskOf(body.data.file.url)));
});

test('[crop handler] 缺 selection → 400', async () => {
  const srcUrl = await writeOut(solid(100, 100, { r: 1, g: 1, b: 1 }), 'hc_nosele.png');
  const res = makeRes();
  await routes.handleLocalPatchCrop(makeJsonReq({ source_url: srcUrl }), res);
  assert.equal(res.status, 400);
});

test('[merge handler] 缺上下文 → 400；>16 张 → 400', async () => {
  const srcUrl = await writeOut(solid(100, 100, { r: 120, g: 60, b: 20 }), 'hm_src.png');
  const res1 = makeRes();
  await routes.handleLocalPatchMerge(
    makeJsonReq({ original_url: srcUrl, patches: [{ patch_url: srcUrl, crop_context: null }] }),
    res1,
  );
  assert.equal(res1.status, 400);
  // >16 张（复用同一合法 patch）
  const cropRes = makeRes();
  await routes.handleLocalPatchCrop(
    makeJsonReq({ source_url: srcUrl, selection: { x: 10, y: 10, w: 40, h: 40 } }),
    cropRes,
  );
  const ctx = parseBody(cropRes).data.file.cropContext;
  const pUrl = await writeOut(solid(40, 40, { r: 0, g: 200, b: 0 }), 'hm_patch.png');
  const many = Array.from({ length: 17 }, () => ({ patch_url: pUrl, crop_context: ctx }));
  const res2 = makeRes();
  await routes.handleLocalPatchMerge(makeJsonReq({ original_url: srcUrl, patches: many }), res2);
  assert.equal(res2.status, 400);
});

test('[merge handler] 正常融合 → file 带 localPatchFullImage/ContextReset', async () => {
  const srcUrl = await writeOut(solid(200, 200, { r: 255, g: 0, b: 0 }), 'hm_ok_src.png');
  const cropRes = makeRes();
  await routes.handleLocalPatchCrop(
    makeJsonReq({ source_url: srcUrl, selection: { x: 40, y: 40, w: 60, h: 60 } }),
    cropRes,
  );
  const ctx = parseBody(cropRes).data.file.cropContext;
  const pUrl = await writeOut(
    solid(ctx.paddedRect.w, ctx.paddedRect.h, { r: 0, g: 255, b: 0 }),
    'hm_ok_patch.png',
  );
  const res = makeRes();
  await routes.handleLocalPatchMerge(
    makeJsonReq({
      original_url: srcUrl,
      patches: [{ patch_url: pUrl, crop_context: ctx }],
      color_match: false,
    }),
    res,
  );
  assert.equal(res.status, 200);
  const f = parseBody(res).data.file;
  assert.equal(f.localPatchFullImage, true);
  assert.equal(f.localPatchContextReset, true);
  assert.ok(fs.existsSync(diskOf(f.url)));
});

test('[fingerprint handler] 返回指纹与字节数', async () => {
  const srcUrl = await writeOut(solid(50, 50, { r: 1, g: 2, b: 3 }), 'hf_src.png');
  const res = makeRes();
  await routes.handleLocalPatchFingerprint(makeJsonReq({ source_url: srcUrl }), res);
  assert.equal(res.status, 200);
  const d = parseBody(res).data;
  assert.equal(d.fingerprint.length, 64);
  assert.ok(d.size > 0);
});
