/**
 * Skill 包 facade（`src/routes/skills.ts`）单测 —— 技能库 `~/.maomao-localtool/skills/` 的唯一读写口。
 *
 * 覆盖（每条断言"改坏实现必红"）：
 *   · 空库是合法状态（不是错误）：`{code:0}` + 空 groups/packages + 真 root 路径；
 *   · 整包原子写 → 列目录能看到；`?withContent=1` 带正文；**默认排除 `scripts/`**；
 *   · `scope=content|package` 的边界（package 才含 scripts —— 模型/网页永不读脚本）；
 *   · 覆盖写是"提交集合"语义（旧文件不残留，**不是合并**）；
 *   · 整包删除进 `.trash/`（不真删，可人工捞回）+ 删后 groups 不含它；
 *   · 路径安全：包内 `../evil.md` → 400 且**磁盘上无越权写**；分类段 `..%2Fetc` / `.hidden` → 400；
 *   · open-dir 只测"守卫路径"（404 / 400），**不测成功路径** —— 成功路径会真的拉起访达/资源管理器。
 *
 * 运行：cd localTool && npm test（= tsc --noEmit && node --test --import tsx test/*.test.js）
 */
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');
const importSrc = (rel) => import(pathToFileURL(path.join(SRC, rel)).href);

// 隔离数据目录（必须在 import 业务模块前设置，避免污染 ~/.maomao-localtool）
const TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'maomao-skills-'));
process.env.MAOMAO_DATA_DIR = TEST_DIR;

const {
  handleSkillsList,
  handleSkillsRead,
  handleSkillsSave,
  handleSkillsDelete,
  handleSkillsCreateGroup,
  handleSkillsOpenDir,
} = await importSrc(path.join('routes', 'skills.ts'));
const { getSkillsDir } = await importSrc(path.join('db', 'database.ts'));

const skillsDir = getSkillsDir();

function makeRes() {
  const r = {
    status: 0,
    headers: {},
    body: null,
    on() {
      return r;
    },
    writeHead(code, h) {
      r.status = code;
      if (h) r.headers = { ...r.headers, ...h };
      return r;
    },
    end(data) {
      if (data !== undefined) r.body = (r.body || '') + String(data);
      return r;
    },
  };
  return r;
}

/** 假 req：parseJsonBody 先注册 'data' 再注册 'end'，故注册时同步回调即可（顺序天然正确）。 */
function makeReq(body) {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body), 'utf-8')];
  return {
    on(event, cb) {
      if (event === 'data') for (const c of chunks) cb(c);
      if (event === 'end') cb();
      return this;
    },
  };
}

/** 调 handler 并返回 `{ status, json }`。 */
async function call(handler, { url, body } = {}) {
  const res = makeRes();
  await handler(makeReq(body), res, new URL(url, 'http://127.0.0.1:18080'));
  return { status: res.status, json: res.body ? JSON.parse(res.body) : null };
}

const list = (qs = '') => call(handleSkillsList, { url: `/api/skills${qs}` });
const read = (cat, slug, qs = '') =>
  call(handleSkillsRead, {
    url: `/api/skills/${encodeURIComponent(cat)}/${encodeURIComponent(slug)}${qs}`,
  });
const save = (cat, slug, files) =>
  call(handleSkillsSave, {
    url: `/api/skills/${encodeURIComponent(cat)}/${encodeURIComponent(slug)}`,
    body: { files },
  });
const del = (cat, slug) =>
  call(handleSkillsDelete, {
    url: `/api/skills/${encodeURIComponent(cat)}/${encodeURIComponent(slug)}`,
  });
const mkGroup = (name) =>
  call(handleSkillsCreateGroup, { url: '/api/skills/group', body: { name } });

const SKILL_MD = '---\nname: 漫画生成\n---\n正文';

beforeEach(() => {
  fs.rmSync(skillsDir, { recursive: true, force: true });
});

after(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

test('[skills] 空库是合法状态：code 0 + 空清单 + 真 root 路径', async () => {
  const { json } = await list();

  assert.equal(json.code, 0);
  assert.deepEqual(json.data.groups, []);
  assert.deepEqual(json.data.packages, []);
  // root 必须如实回传：UI 凭它告诉用户"文件放哪儿"，前端不自己拼路径
  assert.equal(json.data.root, skillsDir);
  assert.ok(fs.existsSync(skillsDir), '空库也应把目录建出来（否则用户没地方放文件）');
});

test('[skills] 整包写入 → 列目录可见；默认排除 scripts/（脚本不进 content 范围）', async () => {
  const w = await save('图片类', '漫画生成', [
    { relPath: 'SKILL.md', content: SKILL_MD },
    { relPath: 'references/manga.md', content: '网点与色调' },
    { relPath: 'scripts/run.sh', content: 'echo hi' },
  ]);
  assert.equal(w.json.data.written, 3, '三个文件都要落盘（scripts 只对读取设界，写入照常保全）');

  const { json } = await list();
  assert.deepEqual(json.data.groups, ['图片类']);
  assert.equal(json.data.packages.length, 1);
  assert.deepEqual(json.data.packages[0].files, ['SKILL.md', 'references/manga.md']);
  assert.ok(
    !json.data.packages[0].files.includes('scripts/run.sh'),
    'scripts/ 必须在 content 范围外',
  );
  assert.ok(fs.existsSync(path.join(skillsDir, '图片类', '漫画生成', 'scripts', 'run.sh')));
});

test('[skills] withContent=1 一次带正文（避免 N+1）；仍不含 scripts', async () => {
  await save('图片类', '漫画生成', [
    { relPath: 'SKILL.md', content: SKILL_MD },
    { relPath: 'scripts/run.sh', content: 'echo hi' },
  ]);

  const { json } = await list('?withContent=1');
  const pkg = json.data.packages[0];

  assert.deepEqual(
    pkg.contents.map((c) => c.relPath),
    ['SKILL.md'],
  );
  assert.equal(pkg.contents[0].content, SKILL_MD);
  assert.equal(pkg.contents[0].encoding, 'utf8');
});

test('[skills] scope 边界：content 无 scripts，package 才含 scripts', async () => {
  await save('图片类', '漫画生成', [
    { relPath: 'SKILL.md', content: SKILL_MD },
    { relPath: 'scripts/run.sh', content: 'echo hi' },
  ]);

  const content = await read('图片类', '漫画生成');
  const pkgScope = await read('图片类', '漫画生成', '?scope=package');

  assert.deepEqual(
    content.json.data.files.map((f) => f.relPath),
    ['SKILL.md'],
  );
  assert.deepEqual(
    pkgScope.json.data.files.map((f) => f.relPath),
    ['SKILL.md', 'scripts/run.sh'],
  );
  assert.equal(content.json.data.scope, 'content');
  assert.equal(pkgScope.json.data.scope, 'package');
});

test('[skills] 重复写入是「提交集合」语义：旧文件不残留（不是合并）', async () => {
  await save('图片类', '漫画生成', [
    { relPath: 'SKILL.md', content: SKILL_MD },
    { relPath: 'references/old.md', content: '旧资料' },
  ]);
  await save('图片类', '漫画生成', [{ relPath: 'SKILL.md', content: SKILL_MD }]);

  const { json } = await read('图片类', '漫画生成');
  assert.deepEqual(
    json.data.files.map((f) => f.relPath),
    ['SKILL.md'],
  );
  assert.ok(
    !fs.existsSync(path.join(skillsDir, '图片类', '漫画生成', 'references', 'old.md')),
    '旧文件必须在磁盘上真的消失（否则"删掉一个资料"永远删不掉）',
  );
});

test('[skills] 整包删除进 .trash/（不真删）+ 删后不再列出', async () => {
  await save('图片类', '漫画生成', [{ relPath: 'SKILL.md', content: SKILL_MD }]);

  const d = await del('图片类', '漫画生成');
  assert.equal(d.json.data.deleted, true);

  const { json } = await list();
  // 分组**不因删空而消失**：组 = 用户自己建的目录（Finder 语义），要删组由用户显式操作。
  // 若这里断言 groups === []，就等于让"删最后一个 skill"顺手替用户删掉他的分组 —— 用户会莫名丢组。
  assert.deepEqual(json.data.groups, ['图片类']);
  assert.deepEqual(json.data.packages, []);

  const trash = fs.readdirSync(path.join(skillsDir, '.trash'));
  assert.equal(trash.length, 1, '删除必须留一份在 .trash/（误删可人工捞回）');
  assert.ok(
    fs.existsSync(path.join(skillsDir, '.trash', trash[0], 'SKILL.md')),
    '.trash 里应保留原包内容',
  );
});

test('[skills] 路径安全：包内 ../evil.md → 400，且磁盘无越权写', async () => {
  const r = await save('图片类', '漫画生成', [{ relPath: '../evil.md', content: 'x' }]);

  assert.equal(r.status, 400);
  assert.ok(!fs.existsSync(path.join(skillsDir, 'evil.md')), '越权文件绝不能落盘');
  assert.ok(!fs.existsSync(path.join(skillsDir, '图片类', 'evil.md')));
});

test('[skills] 路径安全：分类/名称段非法 → 400（穿越 / 隐藏目录 / 保留内部目录）', async () => {
  const traversal = await call(handleSkillsSave, {
    url: '/api/skills/..%2Fetc/x',
    body: { files: [{ relPath: 'SKILL.md', content: SKILL_MD }] },
  });
  const hidden = await call(handleSkillsSave, {
    url: '/api/skills/.hidden/x',
    body: { files: [{ relPath: 'SKILL.md', content: SKILL_MD }] },
  });
  const reserved = await call(handleSkillsSave, {
    url: '/api/skills/%2E%2E/x',
    body: { files: [{ relPath: 'SKILL.md', content: SKILL_MD }] },
  });

  assert.equal(traversal.status, 400);
  assert.equal(hidden.status, 400, '. 开头的段会写进 .tmp/.trash 内部目录，必须拒');
  assert.equal(reserved.status, 400);
  assert.ok(!fs.existsSync(path.join(TEST_DIR, 'etc')), '不得越出技能库根');
});

test('[skills] 写越权/不存在包 → 明确的 404，而不是"空包"', async () => {
  const miss = await read('图片类', '不存在');
  const delMiss = await del('图片类', '不存在');
  const openMiss = await call(handleSkillsOpenDir, {
    url: '/api/skills/open-dir?category=图片类&slug=不存在',
  });

  assert.equal(miss.status, 404);
  assert.equal(delMiss.status, 404);
  assert.equal(openMiss.status, 404);
});

test('[skills] open-dir 守卫：非法分类名 → 400（在拉起访达之前就返回）', async () => {
  const bad = await call(handleSkillsOpenDir, {
    url: '/api/skills/open-dir?category=..%2Fetc',
  });
  assert.equal(bad.status, 400);
});

test('[skills] 残包（目录里没有 SKILL.md）不列为包 —— 不把用户手建目录当技能', async () => {
  fs.mkdirSync(path.join(skillsDir, '图片类', '半成品'), { recursive: true });

  const { json } = await list();
  assert.deepEqual(json.data.packages, []);
  assert.deepEqual(json.data.groups, ['图片类'], '分组仍在（目录确实存在），只是没有可用的包');
});

test('[skills] 新建分组：建目录 + 立刻出现在 groups；空分组不是"包"', async () => {
  const r = await mkGroup('客户项目');

  assert.equal(r.json.code, 0);
  assert.equal(r.json.data.created, true);
  assert.ok(fs.existsSync(path.join(skillsDir, '客户项目')), '分组 = 技能库下一级目录');
  const { json } = await list();
  assert.deepEqual(json.data.groups, ['客户项目']);
  assert.deepEqual(json.data.packages, [], '空分组不该被列成技能包');
});

test('[skills] 新建分组幂等：同名再来一次 → created:false（点两次不该看到失败）', async () => {
  await mkGroup('客户项目');
  const again = await mkGroup('客户项目');

  assert.equal(again.json.code, 0);
  assert.equal(again.json.data.created, false);
});

test('[skills] 新建分组：同名文件冲突 → 409（不静默当成功，否则界面显示"建好了"其实放不进技能）', async () => {
  fs.mkdirSync(skillsDir, { recursive: true });
  fs.writeFileSync(path.join(skillsDir, '撞名'), 'x');

  const r = await mkGroup('撞名');
  assert.equal(r.status, 409);
});

test('[skills] 新建分组路径安全：穿越 / 隐藏名 / 内部目录 / 前后空白 → 400，且不落到库外', async () => {
  for (const bad of ['../etc', '.hidden', '.trash', ' 空格 ', 'a/b', '']) {
    const r = await mkGroup(bad);
    assert.equal(r.status, 400, `${bad} 应被拒`);
  }
  assert.ok(!fs.existsSync(path.join(TEST_DIR, 'etc')), '不得越出技能库根');
  assert.ok(
    !fs.existsSync(path.join(skillsDir, '.trash')),
    '.trash 是 facade 内部目录，不许用户建',
  );
});

test('[skills] 二进制判据 = 能否无损当 utf8：无 NUL 的二进制不再被当文本损坏（TD-11-36）', async () => {
  // 0xFF 0xFE…：**不含 NUL**，但不是合法 UTF-8 ⇒ 旧判据（只查 NUL）会把它 toString('utf8') 换成
  // U+FFFD（不可逆），随后整包回写（改名/补 id/云写回）就把损坏写回磁盘 —— 用户的图就这样被静默毁掉。
  const bin = Buffer.from([0xff, 0xfe, 0x41, 0x42, 0x43]);
  await save('图片类', '漫画生成', [
    { relPath: 'SKILL.md', content: SKILL_MD },
    { relPath: 'references/icon.bin', encoding: 'base64', content: bin.toString('base64') },
    { relPath: 'references/notes.md', content: '中文说明' },
  ]);

  const { json } = await list('?withContent=1');
  const contents = json.data.packages[0].contents;
  const icon = contents.find((f) => f.relPath === 'references/icon.bin');
  const notes = contents.find((f) => f.relPath === 'references/notes.md');

  assert.equal(icon.encoding, 'base64', '无 NUL 的非法 UTF-8 字节也必须判成二进制');
  assert.equal(icon.content, bin.toString('base64'), 'base64 必须与原始字节一致（可无损还原）');
  assert.equal(notes.encoding, 'utf8', '正常文本仍走 utf8（新判据不能把文本误判成二进制）');
});

test('[skills] `only=SKILL.md`：判据只要正文 ⇒ 不把 references 全量搬一遍（TD-11-39）', async () => {
  await save('图片类', '漫画生成', [
    { relPath: 'SKILL.md', content: SKILL_MD },
    { relPath: 'references/a.md', content: 'A' },
    { relPath: 'references/b.md', content: 'B' },
  ]);

  const full = await list('?withContent=1');
  const only = await list('?withContent=1&only=SKILL.md');

  assert.equal(full.json.data.packages[0].contents.length, 3, '默认仍一次拉全（避免 N+1）');
  assert.deepEqual(
    only.json.data.packages[0].contents.map((f) => f.relPath),
    ['SKILL.md'],
    '只取 SKILL.md：漂移侦测只比它的正文指纹',
  );
  assert.deepEqual(
    only.json.data.packages[0].files,
    full.json.data.packages[0].files,
    'files 清单不受影响（前端据它知道"包内有什么"）',
  );
});

test('[skills] .trash 有上限且清理留痕：超出只保留最近 N 份，最旧的被清（TD-11-35）', async () => {
  const { json: base } = await list();
  const keep = base.data.trashKeep;
  assert.ok(
    Number.isInteger(keep) && keep > 0,
    'trashKeep 必须如实回传（界面据此说明能捞回多少份）',
  );

  // 造 keep+5 份"旧备份"，mtime 递增（序号越大越新）
  const trashDir = path.join(skillsDir, '.trash');
  fs.mkdirSync(trashDir, { recursive: true });
  const total = keep + 5;
  for (let i = 0; i < total; i++) {
    const dir = path.join(trashDir, `old-${String(i).padStart(3, '0')}`);
    fs.mkdirSync(dir, { recursive: true });
    const t = new Date(Date.now() - (total - i) * 60_000);
    fs.utimesSync(dir, t, t);
  }

  // 任意一次写包都会顺带清理（清理在切换成功之后跑；副流程失败不阻塞主流程）
  await save('图片类', '漫画生成', [{ relPath: 'SKILL.md', content: SKILL_MD }]);

  const left = fs.readdirSync(trashDir).sort();
  assert.equal(left.length, keep, `超过上限要清到 ${keep} 份（否则磁盘随保存次数无界增长）`);
  assert.ok(!left.includes('old-000'), '最旧的必须先被清掉');
  assert.ok(
    left.includes(`old-${String(total - 1).padStart(3, '0')}`),
    '最新的必须留着（"可捞回"这条承诺靠它）',
  );
});
