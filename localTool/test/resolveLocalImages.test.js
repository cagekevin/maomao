/**
 * localTool 出站图片回读测试（resolveLocalImages，E 方案 docs/72）
 * ------------------------------------------------------------
 * 覆盖：相对 /files/ → base64 / 绝对自指 → base64 / data: 幂等透传 /
 *       公网 http 透传 / 文件缺失保留原 URL / 嵌套结构（messages+image_urls）/
 *       超大图压缩≤1920 / 原对象不变
 *
 * 运行：node --test test/*.test.js（直接 import src/，无需编译）
 * 隔离：临时 MAOMAO_DATA_DIR，绝不触碰真实 ~/.maomao-localtool/ 数据。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Jimp from 'jimp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, '..', 'src');
function toFileUrl(p) { return 'file:///' + p.split(path.sep).join('/'); }

const { resolveLocalImages, resolveImagesForEgress, refFormatOf, toLoopbackUrl } =
  await import(toFileUrl(path.join(src, 'utils', 'resolveLocalImages.ts')));
const { getUploadDir } = await import(toFileUrl(path.join(src, 'db', 'database.ts')));

// ── 隔离数据目录 + 固定夹具（顶层 await 一次建好）──
process.env.MAOMAO_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'maomao-resolve-test-'));
const uploads = path.join(getUploadDir(), 'sub');
fs.mkdirSync(uploads, { recursive: true });
await new Jimp(64, 64, 0xff0000ff).writeAsync(path.join(uploads, 'a.png')); // 小图（不缩放）
await new Jimp(2048, 64, 0x00ff00ff).writeAsync(path.join(uploads, 'big.png')); // 大图（最长边 2048 > 1920）
await new Jimp(32, 32, 0x0000ffff).writeAsync(path.join(uploads, '妹.png')); // 中文文件名（URL 编码形态）

/** 解码 data: base64 → Jimp，供尺寸/格式断言 */
async function decodeDataUrl(dataUrl) {
  const b64 = dataUrl.split(',')[1];
  return Jimp.read(Buffer.from(b64, 'base64'));
}

test('相对 /files/ → data:image/png;base64（保持格式，不缩放小图）', async () => {
  const out = await resolveLocalImages('/files/sub/a.png');
  assert.match(out, /^data:image\/png;base64,/);
  const img = await decodeDataUrl(out);
  assert.equal(img.getWidth(), 64);
  assert.equal(img.getHeight(), 64);
});

test('绝对自指 URL（127.0.0.1:18080）→ 同样内联 base64', async () => {
  const out = await resolveLocalImages('http://127.0.0.1:18080/files/sub/a.png');
  assert.match(out, /^data:image\/png;base64,/);
});

test('URL 编码文件名（中文 %xx）→ 解码后正常内联 base64', async () => {
  const out = await resolveLocalImages('/files/sub/%E5%A6%B9.png');
  assert.match(out, /^data:image\/png;base64,/);
  const img = await decodeDataUrl(out);
  assert.equal(img.getWidth(), 32);
});

test('data: 已内联 base64 → 原样透传（幂等，不二次压缩）', async () => {
  const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
  const out = await resolveLocalImages(dataUrl);
  assert.equal(out, dataUrl);
});

test('公网 http(s) URL → 原样透传（不读盘）', async () => {
  assert.equal(await resolveLocalImages('http://x/a.png'), 'http://x/a.png');
  assert.equal(await resolveLocalImages('https://cdn/y.jpg'), 'https://cdn/y.jpg');
});

test('文件缺失 → 保留原 URL（失败可见，不静默丢弃）', async () => {
  const out = await resolveLocalImages('/files/sub/missing.png');
  assert.equal(out, '/files/sub/missing.png');
});

test('嵌套结构：messages 的 image_url.url + image_urls[] + reference_images[] 全转换，非图字段原样', async () => {
  const payload = {
    messages: [
      { role: 'user', content: '看这张图' },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: '/files/sub/a.png' } },
          { type: 'text', text: '描述' },
        ],
      },
    ],
    image_urls: ['/files/sub/a.png', 'http://public/x.png'],
    reference_images: ['http://127.0.0.1:18080/files/sub/a.png'],
    prompt: '提示词原样，不含 /files/',
    count: 3,
    flag: true,
  };
  const out = await resolveLocalImages(payload);
  assert.match(out.messages[1].content[0].image_url.url, /^data:image\/png;base64,/);
  assert.match(out.image_urls[0], /^data:image\/png;base64,/);
  assert.equal(out.image_urls[1], 'http://public/x.png');
  assert.match(out.reference_images[0], /^data:image\/png;base64,/);
  // 非图字段不受影响
  assert.equal(out.messages[0].content, '看这张图');
  assert.equal(out.messages[1].content[1].text, '描述');
  assert.equal(out.prompt, '提示词原样，不含 /files/');
  assert.equal(out.count, 3);
  assert.equal(out.flag, true);
  // 原对象不变（深拷贝，不改写输入）
  assert.equal(payload.image_urls[0], '/files/sub/a.png');
});

test('同一文件被多次引用 → 只转换一次（缓存，结果一致）', async () => {
  const out = await resolveLocalImages(['/files/sub/a.png', '/files/sub/a.png']);
  assert.equal(out[0], out[1]);
  assert.match(out[0], /^data:image\/png;base64,/);
});

test('超大图（最长边 2048）→ 压缩到 ≤1920', async () => {
  const out = await resolveLocalImages('/files/sub/big.png');
  const img = await decodeDataUrl(out);
  assert.ok(img.getWidth() <= 1920, `width=${img.getWidth()}`);
  assert.equal(img.getWidth(), 1920);
});

test('幂等：已转换的 base64 再入 → 原样返回', async () => {
  const once = await resolveLocalImages('/files/sub/a.png');
  const twice = await resolveLocalImages(once);
  assert.equal(twice, once);
});

/* ═══ 出站形态裁决（resolveImagesForEgress / refFormatOf / toLoopbackUrl）═══ */

test('refFormatOf：仅 lovart 走 cdn，其余走 base64', () => {
  assert.equal(refFormatOf('lovart'), 'cdn');
  assert.equal(refFormatOf('modelscope'), 'base64');
  assert.equal(refFormatOf('anything-else'), 'base64');
});

test('toLoopbackUrl：相对 /files/ 补成回环 URL；绝对自指/公网/data 原样', () => {
  assert.equal(toLoopbackUrl('/files/sub/a.png'), 'http://127.0.0.1:18080/files/sub/a.png');
  assert.equal(toLoopbackUrl('http://127.0.0.1:18080/files/sub/a.png'), 'http://127.0.0.1:18080/files/sub/a.png');
  assert.equal(toLoopbackUrl('http://localhost:18080/files/sub/a.png'), 'http://localhost:18080/files/sub/a.png');
  assert.equal(toLoopbackUrl('http://public/x.png'), 'http://public/x.png');
  assert.equal(toLoopbackUrl('data:image/png;base64,abc'), 'data:image/png;base64,abc');
});

test('resolveImagesForEgress cdn：本机 /files/ 转回环 URL（不 base64）；公网/data 原样', async () => {
  const out = await resolveImagesForEgress(['/files/sub/a.png', 'http://public/x.png', 'data:image/png;base64,abc'], 'cdn');
  assert.equal(out[0], 'http://127.0.0.1:18080/files/sub/a.png', '本机图给回环 URL，不预 base64');
  assert.equal(out[1], 'http://public/x.png', '公网 URL 原样');
  assert.equal(out[2], 'data:image/png;base64,abc', 'data: 原样（blob 无法避免 base64）');
});

test('resolveImagesForEgress base64：行为与 resolveLocalImages 一致（本机图→base64）', async () => {
  const out = await resolveImagesForEgress('/files/sub/a.png', 'base64');
  assert.match(out, /^data:image\/png;base64,/);
});

test('resolveImagesForEgress cdn 嵌套：messages 的 image_url.url 转回环，非图字段原样', async () => {
  const payload = {
    messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: '/files/sub/a.png' } }, { type: 'text', text: '描述' }] }],
    prompt: '原样',
  };
  const out = await resolveImagesForEgress(payload, 'cdn');
  assert.equal(out.messages[0].content[0].image_url.url, 'http://127.0.0.1:18080/files/sub/a.png');
  assert.equal(out.messages[0].content[1].text, '描述');
  assert.equal(out.prompt, '原样');
});
