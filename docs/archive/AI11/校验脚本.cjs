// 门3 机器校验：扫描 docs/AI11 下 md 引用的 App.js:Lnnnn / config.js / localTool 锚点，
// 回源码 grep 确认符号/字符串存在。输出 校验报告-AI11.md。
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const AI11 = __dirname;
const APP = 'G:/01画布项目/maomao/src/_engine/App.js';
const CONFIG = 'G:/01画布项目/maomao/src/_engine/config.js';
const FILES_TS = 'G:/01画布项目/maomao/localTool/src/routes/files.ts';
const RES_TS = 'G:/01画布项目/maomao/localTool/src/routes/resources.ts';
const LT_INDEX = 'G:/01画布项目/maomao/localTool/src/index.ts';
const GW_MAIN = 'G:/01画布项目/maomao/apimart-gateway/main.py';

function readLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n');
}

const appLines = readLines(APP);
const cfgLines = readLines(CONFIG);
const filesLines = readLines(FILES_TS);
const resLines = readLines(RES_TS);
const ltLines = readLines(LT_INDEX);
const gwLines = readLines(GW_MAIN);

// 提取所有 md 里的 App.js:Lnnnn
const mdFiles = fs.readdirSync(AI11).filter(f => f.endsWith('.md') && f !== '校验报告-AI11.md');
let checks = []; // {file, line, ref, target, found, ctx}

for (const mf of mdFiles) {
  const txt = fs.readFileSync(path.join(AI11, mf), 'utf8');
  // 匹配 App.js Lnnnn / App.js:Lnnnn / (@Lnnnn) 多种格式
  const re = /App\.js[ :]L?(\d+)/g;
  let m;
  while ((m = re.exec(txt))) {
    const ln = parseInt(m[1], 10);
    const srcLine = appLines[ln - 1] || '';
    checks.push({ file: mf, ref: `App.js:L${ln}`, target: 'App.js', ln, ctx: srcLine.trim().slice(0, 90) });
  }
  // config.js
  const re2 = /config\.js[ :]L?(\d+)/g;
  while ((m = re2.exec(txt))) {
    const ln = parseInt(m[1], 10);
    const srcLine = cfgLines[ln - 1] || '';
    checks.push({ file: mf, ref: `config.js:L${ln}`, target: 'config.js', ln, ctx: srcLine.trim().slice(0, 90) });
  }
  // files.ts / resources.ts / index.ts / main.py
  const re3 = /((?:files\.ts|resources\.ts|index\.ts|main\.py))[ :]L?(\d+)/g;
  while ((m = re3.exec(txt))) {
    const srcMap = { 'files.ts': filesLines, 'resources.ts': resLines, 'index.ts': ltLines, 'main.py': gwLines };
    const srcLines = srcMap[m[1]] || [];
    const isFiles = m[1] === 'files.ts';
    const ln = parseInt(m[2], 10);
    const srcLine = srcLines[ln - 1] || '';
    checks.push({ file: mf, ref: `${m[1]}:L${ln}`, target: m[1], ln, ctx: srcLine.trim().slice(0, 90) });
  }
  // (@Lnnnn) / @Lnnnn → 上下文均为 App.js
  const re4 = /\(@L(\d+)\)|@L(\d+)/g;
  while ((m = re4.exec(txt))) {
    const ln = parseInt(m[1] || m[2], 10);
    const srcLine = appLines[ln - 1] || '';
    checks.push({ file: mf, ref: `App.js:L${ln}`, target: 'App.js', ln, ctx: srcLine.trim().slice(0, 90) });
  }
}

// 关键符号复核（门3 增强）：对每个引用行，确认是否含预期的混淆名/路由串
const EXPECT = {
  'App.js:L1888': ['function ii'],
  'App.js:L1802': ['function Xr'],
  'App.js:L1827': ['function Zr'],
  'App.js:L1856': ['function ri'],
  'App.js:L42838': ['function Sv'],
  'App.js:L42857': ['function wv'],
  'App.js:L42883': ['function Ev'],
  'App.js:L43015': ['we = Y.useCallback'],
  'App.js:L32490': ['let Jn = Y.useCallback'],
  'App.js:L32796': ['/v1/images/generations'],
  'App.js:L33005': ['/v1/tasks/${taskId}'],
  'App.js:L33049': ['ii(u, { subfolder'],
  'App.js:L38481': ['dispatchEvent'],
  'App.js:L43527': ['resourceAdded'],
  'App.js:L43539': ['Zr(i.url'],
  'App.js:L36243': ['ve(null)'],
  'App.js:L31883': ['xn = Y.useCallback'],
  'App.js:L43881': ['Xr = async'],
  'App.js:L43893': ['Zr = async'],
  'App.js:L4141': ['new Set(['],
  'App.js:L1608': ['syncAllToLocalTool'],
  'App.js:L1591': ['syncToLocalTool'],
  'App.js:L31426': ['Ev().then'],
  'App.js:L44354': ['Se.current'],
  'App.js:L44377': ['n.uploadFile'],
  'App.js:L44369': ['startsWith'],
  'App.js:L19098': ['uploadFile: Y.useCallback'],
  'App.js:L36784': ['ei = Y.useCallback'],
  'App.js:L36822': ['ti = Y.useCallback'],
  'App.js:L43950': ['ei = async'],
  'App.js:L43974': ['ti = async'],
  'index.ts:L122': ['/api/status'],
  'index.ts:L135': ['/api/files/upload'],
  'index.ts:L184': ['/api/resources/save'],
  'index.ts:L196': ['/api/resources/rescan'],
  'index.ts:L206': ['/api/jianying/send'],
  'main.py:L591': ['/v1/images/generations'],
  'main.py:L873': ['/v1/tasks/{task_id}'],
  'main.py:L882': ['/v1/tasks/{task_id}/confirm'],
  'main.py:L922': ['/v1/balance'],
  'config.js:L36': ['USE_LOCAL_ENGINE'],
  'config.js:L15': ['get base()'],
  'config.js:L30': ['DEFAULT_ENDPOINT'],
  'files.ts:L137': ['copyFileSync'],
  'files.ts:L253': ['copyFileSync'],
  'resources.ts:L120': ["source='local-tool'"],
  // round3: 画布持久化与节点序列化
  'App.js:L1642': ['saveCanvasState(e, t)'],
  'App.js:L1646': ['loadCanvasState(e)'],
  'App.js:L1650': ['saveCanvasStateWithVersion(e, t, n)'],
  'App.js:L1636': ['setLocalforage(e, t)'],
  'App.js:L1627': ['getLocalforage(e)'],
  'App.js:L1476': ['Q = {'],
  'App.js:L1297': ['var wr = {'],
  'App.js:L1364': ['var Mr = {'],
  'App.js:L1418': ['Nr = {'],
  'App.js:L1446': ['Pr = {'],
  'App.js:L31141': ['director3dNode: Th'],
  'App.js:L37127': ['nodeTypes: lg'],
  'App.js:L28388': ['var Th = Y.memo'],
  'App.js:L28276': ['function wh({'],
  'App.js:L42001': ['ov = new Set'],
  'App.js:L42002': ['sv = new Set'],
  'App.js:L42013': ['function dv(e)'],
  'App.js:L42032': ['function fv(e)'],
  'App.js:L42064': ['function pv(e)'],
  'App.js:L1345': ['function jr(e)'],
  // round4: 多窗口通信与生成调度
  'App.js:L89': ['function Jn({'],
  'App.js:L32490': ['let Jn = Y.useCallback'],
  'App.js:L34786': ['sr = Y.useCallback'],
  'App.js:L34794': ['cr = Y.useCallback'],
  'App.js:L34759': ['ar = Y.useCallback'],
  'App.js:L34350': ['tr = Y.useCallback'],
  'App.js:L34804': ['lr = Y.useCallback'],
  'App.js:L31428': ['mutiwindow-task-completed'],
  'App.js:L36001': ['mutiwindow-images'],
  'App.js:L36034': ['mutiwindow-clipboard'],
  'App.js:L38481': ['dispatchEvent'],
  'App.js:L16376': ['mutiwindow-clipboard'],
  'App.js:L43774': ['mutiwindow-open-builtin-settings'],
  'App.js:L12830': ['/v1/audio/transcriptions'],
  'App.js:L34815': ['/v1/chat/completions'],
  'App.js:L28321': ['window.addEventListener'],
  'App.js:L846': ['function tr(e)'],
  'App.js:L863': ['function ar(e, t)'],
  // round5: 资源面板与导出发布流
  'App.js:L42838': ['function Sv'],
  'App.js:L42857': ['function wv'],
  'App.js:L42866': ['function Tv'],
  'App.js:L42883': ['function Ev'],
  'App.js:L43527': ['resourceAdded'],
  'App.js:L42492': ['/workflow-apps/publish'],
  'App.js:L42064': ['function pv(e)'],
  'App.js:L38287': ['function Dg'],
  'App.js:L38232': ['function Tg'],
  'App.js:L38242': ['Sg(e'],
  'App.js:L29193': ['dataTransfer.files'],
  'App.js:L29203': ['text/uri-list'],
  'App.js:L40512': ['onDelete: () => m'],
  'App.js:L382': ['发送到资源'],
  'App.js:L31309': ['onDeleteCustomNodeTemplate'],
  // round6: 后端双基址与数据流一致性
  'App.js:L42808': ['var vv = LOCAL_ENGINE.base'],
  'config.js:L15': ['get base()'],
  'App.js:L844': ['var $n = Vn'],
  'App.js:L1732': ['var Hr = localEngineBase'],
  'App.js:L38213': ['function Sg'],
  'App.js:L38215': ['Sg(e, t)'],
  'App.js:L845': ['er = `/api`'],
  'App.js:L43212': ['ot = DEFAULT_GATEWAY_URL'],
  'config.js:L30': ['DEFAULT_ENDPOINT'],
  'config.js:L59': ['DEFAULT_GATEWAY_URL'],
  'App.js:L1832': ['/api/files/upload'],
  'App.js:L1871': ['/api/files/thumbnail'],
  'App.js:L33005': ['/v1/tasks/${taskId}'],
  'App.js:L34815': ['/v1/chat/completions'],
  // round7: 全局快捷键与剪贴板
  'App.js:L36920': ['r.ctrlKey'],
  'App.js:L36932': ['r.key.toLowerCase() === `q`'],
  'App.js:L36950': ['r.key === `z`'],
  'App.js:L36962': ['r.key === `d`'],
  'App.js:L37003': ['addEventListener(`keydown`'],
  'App.js:L36129': ['jr = async () =>'],
  'App.js:L36155': ['navigator.clipboard.writeText'],
  'App.js:L35898': ['kr = Y.useCallback'],
  'App.js:L35915': ['navigator.clipboard.readText'],
  'App.js:L35932': ['Date.now()'],
  'App.js:L16362': ['P = async e =>'],
  'App.js:L16374': ['navigator.clipboard.writeText'],
  'App.js:L16376': ['mutiwindow-clipboard'],
  'App.js:L36001': ['mutiwindow-images'],
  'App.js:L36034': ['mutiwindow-clipboard'],
  'App.js:L28319': ['copySelectedObjects'],
  'App.js:L22294': ['copySelectedObjects: () =>'],
  'App.js:L36162': ['Mr = async () =>'],
};

let pass = 0, fail = 0;
let report = '# 校验报告-AI11（门3 机器校验）\n\n';
report += `> 生成时间：2026-07-21。方法：正则抽取 md 内 \`App.js:Lnnnn\`/\`config.js:Lnnn\`/\`files.ts|resources.ts:Lnnn\`，回源码逐行核对存在性 + 符号一致性。\n\n`;
report += `| 文档 | 引用 | 行存在 | 符号复核 | 行内容(截断) |\n`;
report += `|------|------|--------|---------|-------------|\n`;

const uniq = [];
const seen = new Set();
for (const c of checks) {
  const key = c.ref;
  if (seen.has(key)) continue;
  seen.add(key);
  const lineExists = c.ctx.length > 0;
  const exp = EXPECT[c.ref];
  let symOk = '—';
  if (exp) {
    symOk = exp.every(s => c.ctx.includes(s)) ? '✅' : '❌';
  }
  if (lineExists && (symOk === '✅' || symOk === '—')) pass++;
  else fail++;
  report += `| ${c.file} | ${c.ref} | ${lineExists ? '✅' : '❌'} | ${symOk} | ${(c.ctx || '(空行)').replace(/\|/g, '\\|')} |\n`;
}

report += `\n## 汇总\n\n- 校验锚点总数（去重）：${seen.size}\n- 通过（行存在且符号一致/无期望）：**${pass}**\n- 失败：**${fail}**\n`;
report += `\n## 失败项明细\n\n`;
let anyFail = false;
for (const c of checks) {
  const exp = EXPECT[c.ref];
  const lineExists = c.ctx.length > 0;
  const symOk = exp ? (exp.every(s => c.ctx.includes(s)) ? '✅' : '❌') : '—';
  if (!lineExists || symOk === '❌') {
    anyFail = true;
    report += `- ${c.file} → ${c.ref}：行存在=${lineExists}，符号=${symOk}，内容=\`${c.ctx}\`\n`;
  }
}
if (!anyFail) report += `（无失败项 ✅）\n`;

fs.writeFileSync(path.join(AI11, '校验报告-AI11.md'), report);
console.log('校验完成：通过', pass, '失败', fail);
console.log('报告已写入 docs/AI11/校验报告-AI11.md');
