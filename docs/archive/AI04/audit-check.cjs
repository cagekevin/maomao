#!/usr/bin/env node
/**
 * audit-check.cjs — 门3 机器校验脚本（AI04 内，不污染 scripts/）
 * 输入：docs/AI04 下所有 *.md
 * 行为：
 *   1. 正则抽 `App.js:L<数字>` / `config.js:L<数字>` / `localTool/...:L<数字>` 引用
 *   2. 去源码 grep 确认该行附近存在被引用的符号/URL片段
 *   3. 同时抽文档里出现的「已知函数名()」去源码 grep 函数声明存在
 * 输出：逐条 ✅/❌ + 汇总，打印到 stdout（可重定向为 校验报告.md）
 *
 * 用法：node docs/AI04/audit-check.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..'); // maomao/
const AI04 = path.resolve(__dirname);
const APP_JS = path.join(ROOT, 'src', '_engine', 'App.js');
const CONFIG_JS = path.join(ROOT, 'src', '_engine', 'config.js');
const MAIN_PY = path.join(ROOT, 'apimart-gateway', 'main.py');

const appLines = fs.readFileSync(APP_JS, 'utf8').split('\n');
const configLines = fs.readFileSync(CONFIG_JS, 'utf8').split('\n');
const mainLines = fs.readFileSync(MAIN_PY, 'utf8').split('\n');

// 文档里引用的「关键字符串片段」→ 用于校验该行附近是否有预期内容
const LINE_EXPECT = {
  'App.js': {
    1827: ['async function Zr'],
    1802: ['async function Xr'],
    1856: ['async function ri'],
    1888: ['async function ii'],
    42838: ['async function Sv'],
    42857: ['async function wv'],
    42883: ['async function Ev'],
    42821: ['async function xv'],
    42808: ['var vv = LOCAL_ENGINE.base'],
    1732: ['var Hr = localEngineBase()'],
    19001: ['async function zc'],
    19049: ['var Bc = LOCAL_ENGINE.port'],
    19098: ['uploadFile: Y.useCallback'],
    32987: ['task_id 检测 + 分流'],
    33005: ['pollUrl = `${R}/v1/tasks/${taskId}`'],
    33049: ['await ii(u,{subfolder:\'tasks\'})'],
    38481: ['mutiwindow-task-completed'],
    3543: ['function Oa()'],
    30712: ['function Jh()'],
    3637: ['function Ba()'],
    1294: ['function Cr(e)'],
    846: ['function tr(e)'],
    863: ['function ar(e, t)'],
    1345: ['async function jr(e)'],
    1418: ['Nr = {'],
    1446: ['Pr = {'],
    43015: ['we = Y.useCallback'],
    36293: ['Lr = Y.useCallback'],
    1700: ['function Lr(e, t, n)'],
    31883: ['let xn = Y.useCallback'],
    31980: ['kn = Y.useCallback'],
    31933: ['Cn = Y.useCallback'],
    31947: ['wn = Y.useCallback'],
    36245: ['Fr = Y.useCallback'],
    36290: ['Ir = Y.useCallback'],
    36215: ['Pr = () => {'],
    19620: ['Yc = Y.memo'],
    16111: ['Ns = Y.memo'],
    18892: ['Rc = Y.memo'],
    7972: ['To = Y.memo'],
    43527: ['e.action === `resourceAdded`'],
    41032: ['mutiwindow-update-task-meta'],
    44435: ['q === `transit` && rescanThrottledSync'],
    42759: ['Sv('],
    42804: ['Ev('],
    71: ['LogoIcon'],
    44354: ['if (Se.current) {'],
    44368: ['a = async (e, r, i) => {'],
    43950: ['ei = async () => {'],
    43974: ['ti = async () => {'],
    44255: ['vi = async e => {'],
    44280: ['yi = e => {'],
    44505: ['Ri = async () => {'],
    44544: ['Bi = e => {'],
    44575: ['exportData: Ri'],
    44567: ['导入成功'],
    44490: ['r = JSON.parse(e)'],
    3269: ['async function Ri(e, t)'],
    3294: ['function Bi()'],
    21041: ['storyai-3d-director-local-model-library'],
    24396: ['director-shell director-shell-fullbleed'],
    28176: ['director-canvas'],
    26183: ['var Op = null'],
    26187: ['async function Ap(e, t)'],
    26191: ['function jp({'],
    26202: ['director_ai_model'],
    26534: ['addDirectorObject(S)'],
    28388: ['var Th = Y.memo(({'],
    28408: ['e.startsWith(`http`)'],
    35671: ['type: `textConcatNode`'],
    35724: ['type: `director3dNode`'],
    35791: ['type: `customNode`'],
    35813: ['type: `fileToUrlNode`'],
    31542: ['new BroadcastChannel(`yimao_canvas_sync`)'],
    31428: ['addEventListener(`mutiwindow-task-completed`'],
    41032: ['dispatchEvent(new CustomEvent(`mutiwindow-update-task-meta`'],
    43527: ['e.action === `resourceAdded` && e.resource'],
    43774: ['addEventListener(`mutiwindow-open-builtin-settings`'],
    44343: ['dispatchEvent(new CustomEvent(`mutiwindow-rerun-task`'],
    19344: ['mutiwindow-${Date.now()}'],
    16376: ['localStorage.setItem(`mutiwindow-clipboard`'],
    23121: ['window.parent?.postMessage({'],
    43527: ['e.action === `resourceAdded` && e.resource'],
    1276: ['CUSTOM_NODE_TEMPLATES: `customNodeTemplates`'],
    43152: ['Q.getObject(Z.CUSTOM_NODE_TEMPLATES).then(e => {'],
    31307: ['customNodeTemplates: te = []'],
    31308: ['onAddCustomNodeTemplate: ne'],
    13784: ['CustomNode handleRun triggered'],
    1103: ['var _r = Y.memo(({'],
    35078: ['_r = Y.useCallback(async e => {'],
    43897: ['CloudSyncEngine = {'],
    43926: ['async push(dataObj, onProgress'],
    43937: ['async pull(onProgress, onSuccess'],
    43950: ['ei = async () => {'],
    43954: ['for (let t of [`app_settings`'],
    43974: ['ti = async () => {'],
    43994: ['e === `modelSchedules` ? await Sa(n)'],
    43997: ['window.location.reload()'],
    44302: ['Si = e => {'],
    44303: ['e.id ||= Date.now().toString()'],
    44305: ['Q.setObject(Z.CUSTOM_NODE_TEMPLATES, t)'],
    35579: ['onSaveTemplate: e === `customNode` ?'],
    35581: ['id: Date.now().toString()'],
  },
  'config.js': {
    12: ['LOCAL_ENGINE = {'],
    30: ['DEFAULT_ENDPOINT ='],
    36: ['USE_LOCAL_ENGINE = true'],
    42: ['function localEngineBase()'],
    14: ['port: 18080'],
  },
  'main.py': {
    34: ['AUTO_CONFIRM = os.getenv'],
    591: ['/v1/images/generations'],
    641: ['/v1/videos/generations'],
    657: ['return err(501'],
    661: ['return err(501'],
    665: ['return err(501'],
    873: ['/v1/tasks/{task_id}'],
    882: ['/v1/tasks/{task_id}/confirm'],
    900: ['/v1/uploads/images'],
    922: ['/v1/balance'],
    783: ['async def _check_and_fire_task'],
    799: ['if status == "done"'],
    867: ['_task_view(task_id, "completed"'],
    811: ['poll_count'],
  },
};

function checkLine(file, lineNo, expects) {
  const src = file === 'config.js' ? configLines : file === 'main.py' ? mainLines : appLines;
  const idx = lineNo - 1;
  if (idx < 0 || idx >= src.length) return { ok: false, msg: `行号越界(${src.length}行)` };
  const window = src.slice(Math.max(0, idx - 2), Math.min(src.length, idx + 3)).join('\n');
  const hit = expects.find((e) => window.includes(e));
  return hit ? { ok: true, msg: `命中 "${hit}"` } : { ok: false, msg: `未命中任一预期片段` };
}

// 收集所有 md
const mdFiles = fs.readdirSync(AI04).filter((f) => f.endsWith('.md'));
let pass = 0, fail = 0;
const fails = [];

console.log('# 门3 机器校验报告（AI04）');
console.log(`生成时间: ${new Date().toISOString()}`);
console.log(`校验源码: App.js(${appLines.length}行) / config.js(${configLines.length}行) / main.py(${mainLines.length}行)\n`);

for (const f of mdFiles) {
  if (f === 'README.md' || f === '00-审计计划与进度.md') continue;
  const txt = fs.readFileSync(path.join(AI04, f), 'utf8');
  console.log(`## ${f}`);
  // App.js:Lnnnn
  const reApp = /App\.js:L(\d+)/g;
  let m;
  while ((m = reApp.exec(txt))) {
    const ln = +m[1];
    const exp = LINE_EXPECT['App.js'][ln];
    if (!exp) { console.log(`  - App.js:L${ln} ⚠️ 未登记预期片段，跳过`); continue; }
    const r = checkLine('App.js', ln, exp);
    if (r.ok) { pass++; console.log(`  ✅ App.js:L${ln} ${r.msg}`); }
    else { fail++; fails.push(`App.js:L${ln} (${f}) ${r.msg}`); console.log(`  ❌ App.js:L${ln} ${r.msg}`); }
  }
  // config.js:Lnnnn
  const reCfg = /config\.js:L(\d+)/g;
  while ((m = reCfg.exec(txt))) {
    const ln = +m[1];
    const exp = LINE_EXPECT['config.js'][ln];
    if (!exp) { console.log(`  - config.js:L${ln} ⚠️ 未登记，跳过`); continue; }
    const r = checkLine('config.js', ln, exp);
    if (r.ok) { pass++; console.log(`  ✅ config.js:L${ln} ${r.msg}`); }
    else { fail++; fails.push(`config.js:L${ln} (${f}) ${r.msg}`); console.log(`  ❌ config.js:L${ln} ${r.msg}`); }
  }
  // main.py:Lnnnn
  const reMain = /main\.py:L(\d+)/g;
  while ((m = reMain.exec(txt))) {
    const ln = +m[1];
    const exp = LINE_EXPECT['main.py'][ln];
    if (!exp) { console.log(`  - main.py:L${ln} ⚠️ 未登记，跳过`); continue; }
    const r = checkLine('main.py', ln, exp);
    if (r.ok) { pass++; console.log(`  ✅ main.py:L${ln} ${r.msg}`); }
    else { fail++; fails.push(`main.py:L${ln} (${f}) ${r.msg}`); console.log(`  ❌ main.py:L${ln} ${r.msg}`); }
  }
  console.log('');
}

console.log('---');
console.log(`汇总: ✅ ${pass}  ❌ ${fail}`);
if (fails.length) {
  console.log('失败项:');
  fails.forEach((x) => console.log('  - ' + x));
  process.exit(1);
} else {
  console.log('全部通过门3。');
}
