// 临时脚本：从 AIFISHER 真实目录生成 mockup 用的裁剪数据集 + 复制被引用的预览图。
// 产物：mockup/panel-kit-card/data.js 与 mockup/panel-kit-card/previews/*
// 只复制被引用的文件（全量 107 MB 不搬）。用完可删本脚本，产物保留。
import fs from 'node:fs';
import path from 'node:path';

const KIT = 'C:/Users/xinye/Downloads/AIFISHER-kit';
const PUB = 'C:/Users/xinye/Downloads/AIFISHER/public';
const OUT = 'g:/01画布项目/maomao/mockup/panel-kit-card';
const PREV = path.join(OUT, 'previews');

const creative = JSON.parse(fs.readFileSync(KIT + '/data/creativeCatalog.json', 'utf8'));
const mj = JSON.parse(fs.readFileSync(KIT + '/data/mjStyleCatalog.json', 'utf8'));

fs.rmSync(PREV, { recursive: true, force: true });
fs.mkdirSync(PREV, { recursive: true });

let copied = 0;
let bytes = 0;
const copy = (urlPath) => {
  // 目录里存的是 "/creative-presets/x.webp" / "/mj-styles/y.webp"
  const src = path.join(PUB, urlPath.replace(/^\//, ''));
  const name = path.basename(src);
  const dst = path.join(PREV, name);
  if (!fs.existsSync(src)) return '';
  if (!fs.existsSync(dst)) {
    fs.copyFileSync(src, dst);
    copied++;
    bytes += fs.statSync(dst).size;
  }
  return 'previews/' + name;
};

/** 每个分类取前 n 条（保持分类可切、条目数是真数） */
function pick(kind, n) {
  const byCat = new Map();
  for (const it of creative.filter((x) => x.kind === kind)) {
    if (!byCat.has(it.category)) byCat.set(it.category, []);
    const arr = byCat.get(it.category);
    if (arr.length < n) arr.push(it);
  }
  return [...byCat.entries()].map(([category, list]) => ({
    category,
    total: creative.filter((x) => x.kind === kind && x.category === category).length,
    items: list.map((it, i) => ({
      id: it.id,
      name: it.name,
      description: it.description,
      // 运镜：网格用 jpg 封面；mp4 每个分类只搬第一个（悬停播放的演示够用）
      preview: /\.(mp4|webm)$/i.test(it.preview || '') ? '' : copy(it.preview),
      poster: it.poster ? copy(it.poster) : '',
      video: i === 0 && /\.(mp4|webm)$/i.test(it.preview || '') ? copy(it.preview) : '',
      prompt: it.prompt,
    })),
  }));
}

const GROUP_LABEL = { char: '角色人像', scene: '场景环境', juwu: '巨物怪兽' };
/** MJ：按 组 → 分类 两级，每分类取前 n 条；图用 thumb（小） */
function pickMj(perCat) {
  const groups = new Map();
  for (const it of mj) {
    if (!groups.has(it.group)) groups.set(it.group, new Map());
    const cats = groups.get(it.group);
    if (!cats.has(it.category)) cats.set(it.category, []);
    const arr = cats.get(it.category);
    if (arr.length < perCat) arr.push(it);
  }
  return [...groups.entries()].map(([g, cats]) => ({
    key: g,
    label: GROUP_LABEL[g] || g,
    total: mj.filter((x) => x.group === g).length,
    categories: [...cats.entries()].map(([category, list]) => ({
      category,
      total: mj.filter((x) => x.group === g && x.category === category).length,
      items: list.map((it, i) => ({
        id: it.id,
        name: it.name,
        mixed: it.mixed,
        medium: it.medium,
        codes: it.codes,
        parameters: it.parameters,
        vibe: it.vibe,
        prompt: it.prompt,
        // 网格用缩略图；大图每个分类只搬第一个（详情态演示够用）
        thumb: copy(it.thumbnail),
        preview: i === 0 ? copy(it.preview) : '',
      })),
    })),
  }));
}

const data = {
  style: pick('style', 9),
  filter: pick('filter', 6),
  motion: pick('motion', 6),
  mj: pickMj(4),
};
console.log('copied', copied, 'files', (bytes / 1048576).toFixed(1), 'MB');

const js =
  '/* 自动生成：来自 AIFISHER 真实目录的裁剪数据集（分类与计数为真值，条目为各分类前几条）\n' +
  ' * 生成脚本 tmp/build-mockup-data.mjs；预览图见 previews/ */\n' +
  'window.__DATA__ = ' +
  JSON.stringify(data, null, 2) +
  ';\n';
fs.writeFileSync(path.join(OUT, 'data.js'), js, 'utf8');

console.log(
  'style cats',
  data.style.map((c) => c.category + '(' + c.total + ')').join(' '),
);
console.log(
  'filter cats',
  data.filter.map((c) => c.category + '(' + c.total + ')').join(' '),
);
console.log(
  'motion cats',
  data.motion.map((c) => c.category + '(' + c.total + ')').join(' '),
);
console.log(
  'mj groups',
  data.mj.map((g) => g.label + '(' + g.total + ')→' + g.categories.length + '类').join(' '),
);
console.log('sample style item', JSON.stringify(data.style[0].items[0]));
console.log('sample mj item', JSON.stringify(data.mj[0].categories[0].items[0]).slice(0, 400));
