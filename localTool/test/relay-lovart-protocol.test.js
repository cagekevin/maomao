/**
 * relay·lovart(9004) 协议路径固化测试
 *
 * 背景：relay 暂经 9004 网关（Lovart 原生直连为远期）。9004 把 OpenAI 兼容 /v1/* 请求翻译到
 * Lovart，并统一返回【双层信封】 { code, data }。ai-relay 的 lovart-image/video/chat preset 的
 * 路径字段（taskIdPath / statusPath / result.urlPath / textPath）必须带 `data.` 前缀，
 * 否则抽空。本测试用【真实 9004 响应样例】断言 preset 路径配置能抽对 —— 防止路径字符串被改坏。
 *
 * 真机依据（2026-09-03 已验证）：
 *  - image 提交 → {code, data:[{status:"submitted", task_id:"task_x"}]}（数组）
 *  - video 提交 → {code, data:{id, status:"submitted", task_id:"task_x"}}（对象）
 *  - chat 非流式 → {code, data:{choices:[{message:{content:"..."}}]}}
 *  - 轮询完成 → {code, data:{status:"completed", result:{images:[{url:["..."]}]}}}
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');
const importSrc = (rel) => import(pathToFileURL(path.join(SRC, rel)).href);

const { getModelProtocolPreset } = await importSrc('ai-relay/protocol/presets.ts');
const { readModelProtocolFirstScalar, readModelProtocolUrls } = await importSrc('ai-relay/protocol/response.ts');

test('lovart-image：提交信封数组 → taskIdPath 抽 task_id', () => {
  const p = getModelProtocolPreset('lovart-image');
  const taskIdPath = p.response.taskIdPath; // 期望 'data.0.task_id'
  assert.equal(taskIdPath, 'data.0.task_id', 'image 提交是 data 数组，taskIdPath 必须 data.0');
  const sample = { code: 200, data: [{ status: 'submitted', task_id: 'task_img_1' }] };
  assert.equal(readModelProtocolFirstScalar(sample, taskIdPath), 'task_img_1');
});

test('lovart-video：提交信封对象 → taskIdPath 抽 data.task_id', () => {
  const p = getModelProtocolPreset('lovart-video');
  const taskIdPath = p.response.taskIdPath; // 期望 'data.task_id'
  assert.equal(taskIdPath, 'data.task_id', 'video 提交是 data 对象，taskIdPath 必须 data.task_id（勿回退成裸 task_id）');
  const sample = { code: 200, data: { id: 'task_vid_1', status: 'submitted', task_id: 'task_vid_1' } };
  assert.equal(readModelProtocolFirstScalar(sample, taskIdPath), 'task_vid_1');
});

test('lovart-image poll：完成信封 → result.urlPath 抽图片 url', () => {
  const p = getModelProtocolPreset('lovart-image');
  const urlPath = p.poll.response.result.urlPath; // 'data.result.images.0.url.0'
  const sample = {
    code: 200,
    data: { id: 'task_img_1', status: 'completed', result: { images: [{ url: ['http://cdn/x.png'] }] } },
  };
  const urls = readModelProtocolUrls(sample, urlPath);
  assert.deepEqual(urls, ['http://cdn/x.png']);
});

test('lovart-image poll：statusPath 抽 completed', () => {
  const p = getModelProtocolPreset('lovart-image');
  const st = readModelProtocolFirstScalar(
    { code: 200, data: { status: 'completed' } },
    p.poll.response.statusPath,
  );
  assert.equal(st, 'completed');
});

test('lovart-chat：非流式信封 → textPath 抽 content（含 data. 前缀）', () => {
  const p = getModelProtocolPreset('lovart-chat');
  assert.equal(p.response.result.textPath, 'data.choices.0.message.content',
    'chat 走 9004 双层信封，textPath 必须带 data. 前缀');
  const sample = {
    code: 200,
    data: { choices: [{ index: 0, message: { role: 'assistant', content: 'Hi!' } }] },
  };
  assert.equal(readModelProtocolFirstScalar(sample, p.response.result.textPath), 'Hi!');
});

test('lovart-chat：submit 固定 stream:false（非流式，防 9004 返 SSE）', () => {
  const p = getModelProtocolPreset('lovart-chat');
  assert.equal(p.submit.body.stream, false, 'chat 必须显式 stream:false，否则 9004 默认流式返 SSE 解析失败');
});

test('lovart-chat：temperature/response_format 有传才进 body（纯模板剔项，TextNode JSON 依赖）', async () => {
  const { renderTemplate } = await importSrc('ai-relay/protocol/template.ts');
  const p = getModelProtocolPreset('lovart-chat');
  // 有传 temperature + response_format
  const full = renderTemplate(p.submit.body, { model: 'm', messages: [{ role: 'user', content: 'x' }], temperature: 0.7, response_format: 'json_object' });
  assert.equal(full.temperature, 0.7);
  assert.equal(full.response_format, 'json_object');
  // 未传 temperature/response_format → 整项剔除（不写进 body，避免上游报不认识的字段）
  const bare = renderTemplate(p.submit.body, { model: 'm', messages: [{ role: 'user', content: 'x' }] });
  assert.equal(bare.temperature, undefined);
  assert.equal(bare.response_format, undefined);
  assert.equal(bare.stream, false);
});
