/**
 * providerConfigStore — 出厂模板播种语义（单一真源回归防护）
 * ------------------------------------------------------------
 * 运行：node --test test/providerSeed.test.js
 *
 * 背景：此前 provider 有「两套 JSON」——初始化种子 api.config.json 与运行态
 * config/providers/<id>.json。种子只在「目录为空」时整体迁移一次，之后便是冻结的
 * 僵尸副本，用户保存不回写它 → 看到「保存没覆盖之前的」。
 *
 * 修复后契约：
 *  - 种子文件更名为 providers.default.json，定位为「只读出厂模板」；
 *  - 播种语义 = 「该平台缺失才补」，已存在的用户配置永不被模板覆盖（幂等）；
 *  - 运行态真源唯一 = config/providers/<id>.json。
 *
 * 隔离：MAOMAO_DATA_DIR 指向临时目录，绝不触碰真实 ~/.maomao-localtool。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, '..', 'src');

// 必须在 import 被测模块之前设好数据目录（getDataDir 读 process.env）
const TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'maomao-seed-test-'));
process.env.MAOMAO_DATA_DIR = TEST_DIR;

const store = await import(pathToFileURL(path.join(src, 'providerConfigStore.ts')));
const { getProviderSeedFile } = await import(pathToFileURL(path.join(src, 'paths.ts')));

const PROVIDERS_DIR = path.join(TEST_DIR, 'providers');

function writeSeedFile(content) {
  const p = path.join(TEST_DIR, 'seed.json');
  fs.writeFileSync(p, JSON.stringify(content, null, 2), 'utf-8');
  return p;
}

function readWritten(id) {
  return JSON.parse(fs.readFileSync(path.join(PROVIDERS_DIR, `${id}.json`), 'utf-8'));
}

test('播种：缺失平台按模板写入 config/providers/<id>.json', () => {
  const seedPath = writeSeedFile({
    providers: [{ id: 'seed-a', name: 'A', base_url: 'https://a.test', image_models: [] }],
  });
  const n = store.seedFromDefaultFile(seedPath);
  assert.equal(n, 1);
  const written = readWritten('seed-a');
  assert.equal(written.id, 'seed-a');
  assert.equal(written.name, 'A');
});

test('播种：已存在的用户配置永不被模板覆盖（关键回归）', () => {
  // 用户先保存了自定义模型
  store.writeProviderConfigFile('seed-b', {
    id: 'seed-b',
    name: '用户改过的名字',
    base_url: 'https://user.test',
    image_models: [{ id: 'user-model' }],
  });
  // 模板里 seed-b 是另一套内容
  const seedPath = writeSeedFile({
    providers: [
      { id: 'seed-b', name: '模板名字', base_url: 'https://seed.test', image_models: [] },
    ],
  });
  store.seedFromDefaultFile(seedPath);
  const after = readWritten('seed-b');
  assert.equal(after.name, '用户改过的名字', '播种不得覆盖用户已保存的配置');
  assert.equal(after.base_url, 'https://user.test');
  assert.deepEqual(after.image_models, [{ id: 'user-model' }], '用户模型清单必须保留');
});

test('播种幂等：重复调用不产生副作用，且返回 0（无新增）', () => {
  const seedPath = writeSeedFile({ providers: [{ id: 'seed-a', name: 'A' }] });
  const n1 = store.seedFromDefaultFile(seedPath);
  const n2 = store.seedFromDefaultFile(seedPath);
  assert.equal(n1, 0, '已播种过的平台不再重复写');
  assert.equal(n2, 0);
});

test('播种：模板文件不存在时静默返回 0（不阻塞服务）', () => {
  assert.equal(store.seedFromDefaultFile(path.join(TEST_DIR, 'nope.json')), 0);
});

test('播种：无 id 的条目被跳过（不产生脏文件）', () => {
  const seedPath = writeSeedFile({ providers: [{ name: 'no-id' }, null, 'bad'] });
  assert.equal(store.seedFromDefaultFile(seedPath), 0);
});

test('seed 路径：默认指向 providers.default.json（api.config.json 已退役）', () => {
  const p = getProviderSeedFile();
  assert.ok(p.endsWith('providers.default.json'), `实际: ${p}`);
  assert.ok(!p.includes('api.config.json'));
});

test.after(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});
