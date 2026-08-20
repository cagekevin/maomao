/**
 * requestModes（请求形态层）单元测试
 * ------------------------------------------------------------
 * 运行：node --test test/requestModes.test.js   （先 ts 编译出 dist）
 * 覆盖：state 2 对模块 2 的断言——形态分派 / responses body / 响应解析 / markdown 兜底 / tool 归一 / 友好错误
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, '..', 'dist');
const mod = await import(pathToFileURL(path.join(dist, 'routes', 'requestModes.js')));

test('imageModePath：四形态端点映射，未知回退 openai（M2-1/M2-5 保守）', () => {
  assert.equal(mod.imageModePath('openai'), 'images/generations');
  assert.equal(mod.imageModePath('openai-json'), 'images/generations');
  assert.equal(mod.imageModePath('openai-responses'), 'responses');
  assert.equal(mod.imageModePath('openai-video-proxy'), 'videos');
  assert.equal(mod.imageModePath('whatever'), 'images/generations'); // 未知/空 → 默认 openai
  assert.equal(mod.imageModePath(undefined), 'images/generations');
});

test('isResponsesMode：仅认 responses 系（单一真相，不嗅探）', () => {
  assert.equal(mod.isResponsesMode('openai-responses'), true);
  assert.equal(mod.isResponsesMode('responses'), true);
  assert.equal(mod.isResponsesMode('openai'), false);
  assert.equal(mod.isResponsesMode(undefined), false);
});

test('buildResponsesImageBody：带 tools + input_text/input_image，size 进 tool（M2-1/M2-3/E7）', () => {
  const body = mod.buildResponsesImageBody({
    model: 'gpt-5.6', prompt: '画一只猫', images: ['data:image/png;base64,xxx'], size: '1024x1024',
  });
  assert.equal(body.model, 'gpt-5.6');
  assert.deepEqual(body.tools, [{ type: 'image_generation', size: '1024x1024' }]);
  assert.equal(body.tool_choice, 'auto');
  assert.deepEqual(body.input, [
    { type: 'input_text', text: '画一只猫' },
    { type: 'input_image', image_url: 'data:image/png;base64,xxx' },
  ]);
});

test('buildResponsesImageBody：无参考图时仅 input_text；空图被过滤（E7 只收 image）', () => {
  const body = mod.buildResponsesImageBody({ model: 'm', prompt: '无图', images: ['', '  '] });
  assert.deepEqual(body.input, [{ type: 'input_text', text: '无图' }]);
  assert.deepEqual(body.tools, [{ type: 'image_generation' }]);
});

test('parseResponsesImage：从 output[].image_generation_call 取 result（M2-1 响应提取）', () => {
  const data = {
    output: [
      { type: 'output_text', text: 'ok' },
      { type: 'image_generation_call', status: 'completed', result: 'https://cdn/x.png' },
    ],
  };
  assert.equal(mod.parseResponsesImage(data), 'https://cdn/x.png');
  // 非 completed / 无 result → undefined
  assert.equal(mod.parseResponsesImage({ output: [{ type: 'image_generation_call', status: 'in_progress' }] }), undefined);
  assert.equal(mod.parseResponsesImage({ output: [] }), undefined);
});

test('extractMarkdownImage：markdown 优先，裸 URL 兜底（H2）', () => {
  assert.equal(mod.extractMarkdownImage('看！![图](https://cdn/gh/a.png) 结束'), 'https://cdn/gh/a.png');
  assert.equal(mod.extractMarkdownImage('https://cdn.abc.com/b.png 后续'), 'https://cdn.abc.com/b.png');
  assert.equal(mod.extractMarkdownImage('没有图片'), undefined);
});

test('parseResponsesJson：无 image_generation_call 时从 output_text 兜底 markdown 图片（H2）', () => {
  const data = { output: [{ type: 'output_text', text: '生成结果：\n![img](https://cdn/f.png)' }] };
  assert.equal(mod.parseResponsesJson(data), 'https://cdn/f.png');
  // markdown 兜底失败也返回 undefined（不抛错）
  assert.equal(mod.parseResponsesJson({ output: [{ type: 'output_text', text: '没有图' }] }), undefined);
});

test('normalizeToolCalls：responses function_call 归一成统一 tool_calls（M2-4）', () => {
  const unified = mod.normalizeToolCalls({
    output: [{ type: 'function_call', name: 'create_node', arguments: '{"x":1}', call_id: 'call_1' }],
  });
  assert.equal(unified.length, 1);
  assert.equal(unified[0].id, 'call_1');
  assert.equal(unified[0].function.name, 'create_node');
  assert.equal(unified[0].function.arguments, '{"x":1}');
  // chat/completions message.tool_calls 原样透传
  const chat = mod.normalizeToolCalls([
    { id: 'tc2', type: 'function', function: { name: 'draw', arguments: '{}' } },
  ]);
  assert.equal(chat[0].function.name, 'draw');
  // 无工具 → 空数组
  assert.equal(mod.normalizeToolCalls({ output: [{ type: 'output_text', text: 'hi' }] }).length, 0);
});

test('friendlyRequestError：命中各关键词给中文提示，未命中返回空串原样透传（G1）', () => {
  assert.match(mod.friendlyRequestError('unsupported reasoning_effort parameter'), /chat\/completions 用工具/);
  assert.equal(mod.friendlyRequestError('invalid api key'), 'API Key 无效或已过期');
  assert.equal(mod.friendlyRequestError('HTTP 401 Unauthorized'), 'API Key 无效或已过期');
  assert.equal(mod.friendlyRequestError('You exceeded rate limit'), '请求过于频繁，稍后再试');
  assert.ok(mod.friendlyRequestError('model not found, use ep-')?.includes('ep-'));
  assert.equal(mod.friendlyRequestError('完全正常的上游返回'), '');
});

test('SUPPORTED_IMAGE_REQUEST_MODES 含四形态（与 ProviderForm 一致）', () => {
  assert.deepEqual([...mod.SUPPORTED_IMAGE_REQUEST_MODES].sort(), ['openai', 'openai-json', 'openai-responses', 'openai-video-proxy'].sort());
});

test('resolveChatMode：默认 chat，responses 系归 responses，gpt-5.6 自动归 responses（M2-2/M2-5）', () => {
  // 手动配置优先
  assert.equal(mod.resolveChatMode(undefined), 'chat');
  assert.equal(mod.resolveChatMode('chat'), 'chat');
  assert.equal(mod.resolveChatMode('responses'), 'responses');
  assert.equal(mod.resolveChatMode('openai-responses'), 'responses');
  // 未配置时按模型自动判断：gpt-5.6 系 → responses
  assert.equal(mod.resolveChatMode(undefined, 'gpt-5.6-luna'), 'responses');
  assert.equal(mod.resolveChatMode(undefined, 'gpt-5.6-terra'), 'responses');
  // 非 gpt-5.6 → chat（deepseek 走 chat/completions）
  assert.equal(mod.resolveChatMode(undefined, 'deepseek-v4-flash'), 'chat');
  assert.equal(mod.resolveChatMode(undefined, 'gpt-5.5'), 'chat');
});

test('buildResponsesChatBody：messages 映射 input + tool name 顶层（M2-2 契约线）', () => {
  const body = mod.buildResponsesChatBody({
    model: 'gpt-5.6',
    messages: [
      { role: 'system', content: '你是助手' },
      { role: 'user', content: [{ type: 'text', text: 'hi' }] },
      { role: 'tool', tool_call_id: 'c1', content: '{"ok":true}' },
    ],
    toolSchemas: [{ function: { name: 'create_node', description: '建节点', parameters: { type: 'object' } } }],
    temperature: 0.6,
  });
  assert.equal(body.model, 'gpt-5.6');
  assert.equal(body.tool_choice, 'auto');
  // tools 顶层 name（不许 function 嵌套）
  assert.deepEqual(body.tools, [{ type: 'function', name: 'create_node', description: '建节点', parameters: { type: 'object' } }]);
  assert.deepEqual(body.input[0], { role: 'system', content: [{ type: 'input_text', text: '你是助手' }] });
  assert.deepEqual(body.input[1], { role: 'user', content: [{ type: 'input_text', text: 'hi' }] });
  assert.deepEqual(body.input[2], { type: 'function_call_output', call_id: 'c1', output: '{"ok":true}' });
});

test('buildResponsesChatBody：assistant 历史 tool_calls → function_call 项（M2-4）', () => {
  const body = mod.buildResponsesChatBody({
    model: 'm',
    messages: [
      { role: 'user', content: '看图' },
      { role: 'assistant', content: '', tool_calls: [{ id: 'c_1', type: 'function', function: { name: 'create_node', arguments: '{"x":1}' } }] },
    ],
  });
  assert.deepEqual(body.input.find((i) => i.type === 'function_call'), { type: 'function_call', call_id: 'c_1', name: 'create_node', arguments: '{"x":1}' });
});

test('parseResponsesChatJson：output[] 拼 content + 归一 tool_calls（M2-2/M2-4）', () => {
  const r = mod.parseResponsesChatJson({
    output: [
      { type: 'message', content: [{ type: 'output_text', text: '已处理' }] },
      { type: 'function_call', name: 'execute_plan', arguments: '{"p":1}', call_id: 'c9' },
    ],
  });
  assert.equal(r.content, '已处理');
  assert.equal(r.toolCalls[0].id, 'c9');
  assert.equal(r.toolCalls[0].function.name, 'execute_plan');
  assert.equal(r.toolCalls[0].function.arguments, '{"p":1}');
});

test('parseResponsesSSEChunk：流式事件并入 acc（M2-3）', () => {
  const acc = { content: '', reasoning: '', toolCalls: [] };
  mod.parseResponsesSSEChunk('data: {"type":"response.output_text.delta","delta":"你好"}', acc);
  mod.parseResponsesSSEChunk('data: {"type":"response.function_call_arguments.delta","name":"create_node","call_id":"c7","delta":"{\\"x\\""}', acc);
  mod.parseResponsesSSEChunk('data: {"type":"response.function_call_arguments.delta","delta":":1}"}', acc);
  assert.equal(acc.content, '你好');
  assert.equal(acc.toolCalls[0].id, 'c7');
  assert.equal(acc.toolCalls[0].function.name, 'create_node');
  assert.equal(acc.toolCalls[0].function.arguments, '{"x":1}');
});