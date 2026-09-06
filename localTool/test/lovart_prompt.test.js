/**
 * lovart_prompt — 双路选模型的自然语言路 / 结构化路单测（B6 / B7 / C3 / A4）
 * ------------------------------------------------------------
 * 运行：node --test test/*.test.js（由 scripts/run_all_tests.cjs 门禁收编）
 * 覆盖：prompt 含可读模型名（B6）、prompt_only 模型无 tool_config 但自然语言路仍在（B7）、
 *       尺寸标识进 prompt（C3）、模型规格表分组计数 image 6 / video 5 / chat 1（A4）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, '..', 'src');
const toUrl = (p) => 'file:///' + p.split(path.sep).join('/');

const { buildLovartPrompt, buildLovartToolConfig } = await import(
  toUrl(path.join(src, 'ai-relay/providers/lovart/lovart_prompt.ts'))
);
const { LOVART_MODEL_SPECS } = await import(
  toUrl(path.join(src, 'ai-relay/providers/lovart/lovart_config.ts'))
);
const { LOVART_MODEL_MANIFEST } = await import(
  toUrl(path.join(src, 'ai-relay/manifests/lovartModelManifest.ts'))
);

test('B6 自然语言路：prompt 句子内嵌模型硬约束（对齐 main.build_gen_prefix）', () => {
  const p = buildLovartPrompt('gpt-image-2-low', 'a red dog');
  // gpt-image-2-low 未登记 _PROMPT_MODEL_NAMES → 回退 model 原串（对齐 main）
  assert.match(p, /Generate exactly ONE image using the gpt-image-2-low model\./);
  assert.match(p, /<user_prompt>\na red dog\n<\/user_prompt>/, '用户原文 <user_prompt> 包裹');
});

test('B6 视频：prompt 句子内嵌模型硬约束', () => {
  const p = buildLovartPrompt('seedance-2', 'make a wave');
  // seedance-2 未登记 _PROMPT_MODEL_NAMES → 回退 model 原串（对齐 main）
  assert.match(p, /Generate exactly ONE video using the seedance-2 model\./);
  assert.match(p, /<user_prompt>\nmake a wave\n<\/user_prompt>/);
});

test('C3 尺寸归一：size 参数写进 prompt（对齐 main：target_size 而非 [size:]）', () => {
  const p = buildLovartPrompt('gpt-image-2-low', 'a photo', '1024x1024');
  assert.match(p, /target_size: 1024x1024/);
  const noSize = buildLovartPrompt('gpt-image-2-low', 'a photo');
  assert.ok(!noSize.includes('target_size'), '未给 size 时不写 target_size');
});

test('参考图声明（对齐 main.build_gen_prefix）：IMAGE 带参考图写 Reference attached + Generate ONE', () => {
  const withRef = buildLovartPrompt('gpt-image-2-low', 'a red dog', '1024x1024', true);
  assert.match(
    withRef,
    /Reference image attached\. Generate exactly ONE image using the gpt-image-2-low model\./,
  );
  assert.match(withRef, /<user_prompt>\na red dog\n<\/user_prompt>/, '用户原文包裹');
});

test('参考图声明（对齐 main）：IMAGE 无参考图不写 Reference，但写 Generate exactly ONE image', () => {
  const noRef = buildLovartPrompt('gpt-image-2-low', 'a cat');
  assert.ok(!noRef.includes('Reference image'), '无参考图不写 Reference 声明');
  assert.match(noRef, /Generate exactly ONE image using the gpt-image-2-low model\./);
});

test('参考图声明（对齐 main）：VIDEO 写 Generate exactly ONE video（参考图经 attachments 携带）', () => {
  const p = buildLovartPrompt('seedance-2', 'make a wave', '16:9', true);
  assert.match(p, /Generate exactly ONE video using the seedance-2 model\./);
  assert.ok(!p.includes('Reference image'), 'main 不在 VIDEO 单独声明 Reference');
  // 对齐 main：VIDEO 不传 target_size（比例经 extraParams 的 aspect_ratio 表达）
  assert.ok(!p.includes('target_size'), 'VIDEO 不写 target_size');
});

test('B5 结构化路：普通模型下发 tool_config.prefer_tool_categories', () => {
  const tc = buildLovartToolConfig('gpt-image-2-low');
  assert.ok(tc && tc.prefer_tool_categories, '必须下发 prefer_tool_categories');
  // 对齐 main：低档位独立工具名（_IMAGE_RULES 首条，非合并的 generate_image_gpt_image_2）
  assert.deepEqual(tc.prefer_tool_categories.IMAGE, ['generate_image_gpt_image_2_low']);
});

test('B7 prompt_only：nano-bn-2-lite 无 tool_config（undefined）', () => {
  const tc = buildLovartToolConfig('nano-bn-2-lite');
  assert.equal(tc, undefined, 'prompt_only 模型不下发 tool_config');
});

test('回归：别名前缀不误吞——nano-bn-2 与 nano-bn-2-lite 各自命中（空串规则可达）', () => {
  // main.py 缺陷修复：'nano-bn-2' 是 'nano-bn-2-lite' 的前缀子串，
  // 若短规则排前面，lite 会被误吞成 generate_image_nano_banana_2，导致其空串规则永不可达。
  assert.deepEqual(
    buildLovartToolConfig('nano-bn-2').prefer_tool_categories.IMAGE,
    ['generate_image_nano_banana_2'],
    'nano-bn-2 命中 _nano_banana_2',
  );
  assert.equal(
    buildLovartToolConfig('nano-bn-2-lite'),
    undefined,
    'lite 命中空串规则 → 不下发（promptOnly）',
  );
});

test('回归：别名前缀不误吞——seedance-2 与 seedance-2.0-mini 各自命中', () => {
  assert.deepEqual(
    buildLovartToolConfig('seedance-2').prefer_tool_categories.VIDEO,
    ['generate_video_seedance_v2_0'],
    'seedance-2 命中 v2_0',
  );
  assert.equal(
    buildLovartToolConfig('seedance-2.0-mini'),
    undefined,
    'mini 命中空串规则 → 不下发（promptOnly）',
  );
  assert.deepEqual(
    buildLovartToolConfig('kling-v3-omni').prefer_tool_categories.VIDEO,
    ['generate_video_kling_v3_omni'],
    'kling 独立工具名',
  );
});

test('别名容错：归一化 + 模糊匹配（对齐 main.resolve_prefer_models）', () => {
  // 归一化：大写 + 下划线 → 小写连字符
  assert.deepEqual(buildLovartToolConfig('GPT_Image_2_Low').prefer_tool_categories.IMAGE, [
    'generate_image_gpt_image_2_low',
  ]);
  // 别名：'seedance2' 命中 seedance-2 规则
  assert.deepEqual(buildLovartToolConfig('seedance2').prefer_tool_categories.VIDEO, [
    'generate_video_seedance_v2_0',
  ]);
});

test('A4 模型规格表分组：image 6 / video 5 / chat 1', () => {
  const byCat = {};
  for (const id of Object.keys(LOVART_MODEL_SPECS)) {
    const cat = LOVART_MODEL_SPECS[id].category;
    byCat[cat] = (byCat[cat] || 0) + 1;
  }
  assert.equal(byCat.IMAGE, 6);
  assert.equal(byCat.VIDEO, 5);
  assert.equal(byCat.CHAT, 1);
});

test('A4 manifest 与规格表一致：image 6 / video 5 / text 1，且每 id 都有规格', () => {
  const byCat = {};
  for (const m of LOVART_MODEL_MANIFEST) {
    byCat[m.category] = (byCat[m.category] || 0) + 1;
  }
  assert.equal(byCat.image, 6);
  assert.equal(byCat.video, 5);
  assert.equal(byCat.text, 1);
  for (const m of LOVART_MODEL_MANIFEST) {
    assert.ok(LOVART_MODEL_SPECS[m.id], `manifest 模型 ${m.id} 缺规格`);
  }
});
