/**
 * extract-icons.cjs —— 从 @hugeicons/core-free-icons 抽取本项目实际用到的图标，
 * 生成 ve-icons.js（运行时向 <head> 注入 <svg><symbol> 库，供 <use href="#i-xxx"> 引用）。
 * 用法：node extract-icons.cjs
 */
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "../../node_modules/@hugeicons/core-free-icons/dist/cjs/index.js");
const OUT = path.join(__dirname, "ve-icons.js");

/** myId -> hugeicons 导出名（缺省回退时打印警告并跳过） */
const MAP = {
  cut: "ScissorIcon",
  triml: "AlignLeftIcon",
  trimr: "AlignRightIcon",
  copy: "Copy01Icon",
  snow: "SnowIcon",
  trash: "Delete02Icon",
  bkmk: "Bookmark02Icon",
  magnet: "MagnetIcon",
  ripple: "Link04Icon",
  zin: "SearchAddIcon",
  zout: "SearchMinusIcon",
  drag: "DragDropIcon",
  eye: "ViewIcon",
  eyeoff: "ViewOffSlashIcon",
  vol: "VolumeHighIcon",
  voloff: "VolumeOffIcon",
  tabMedia: "Folder03Icon",
  tabSounds: "HeadphonesIcon",
  tabText: "TextIcon",
  tabStickers: "Happy01Icon",
  tabEffects: "MagicWand05Icon",
  tabTransitions: "ArrowRightDoubleIcon",
  tabCaptions: "ClosedCaptionIcon",
  tabFilters: "ColorsIcon",
  tabAdjust: "SlidersHorizontalIcon",
  tabAi: "AiBrain01Icon",
  tabSettings: "Settings01Icon",
  play: "PlayIcon",
  pause: "PauseIcon",
  fullscreen: "FullScreenIcon",
  more: "MoreVerticalIcon",
  upload: "CloudUploadIcon",
  pc: "ComputerIcon",
  search: "Search01Icon",
  swap: "Exchange01Icon",
  music: "MusicNote03Icon",
  voice: "AiVoiceGeneratorIcon",
  edit: "Edit02Icon",
  flip: "FlipHorizontalIcon",
  reverse: "ArrowTurnBackwardIcon",
  paste: "TaskAdd02Icon",
  empty: "Settings05Icon",
  exportTop: "TransitionTopIcon",
  cmd: "CommandIcon",
  back: "ArrowLeft02Icon",
};

const kebab = (s) => s.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());

function renderIcon(def) {
  // def: Array<[tag, attrs]>
  return def
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .filter(([k]) => k !== "key")
        .map(([k, v]) => `${kebab(k)}="${v}"`)
        .join(" ");
      return `<${tag} ${a}/>`;
    })
    .join("");
}

// 包是 ESM（package.json type:module），require 会挂 —— 直接文本解析：
// 图标形如  const ScissorIcon = [\n  [...],\n  [...]\n];
const src = fs.readFileSync(SRC, "utf8");
const parse = (name) => {
  const re = new RegExp(`const ${name} = (\\[[\\s\\S]*?\\n\\]);`);
  const m = src.match(re);
  if (!m) return null;
  try {
    return eval(m[1]); // 定义是纯字面量数组，受信源码内
  } catch {
    return null;
  }
};

const symbols = [];
const missing = [];
for (const [myId, exportName] of Object.entries(MAP)) {
  const def = parse(exportName);
  if (!Array.isArray(def)) {
    missing.push(exportName);
    continue;
  }
  symbols.push(`<symbol id="i-${myId}" viewBox="0 0 24 24">${renderIcon(def)}</symbol>`);
}

// cutia 本地图标：OcVideoIcon（视频轨）
const cutia = fs.readFileSync(path.join(__dirname, "../../src/components/videoEditor/ui/cutia-ui-icons/ui.tsx"), "utf8");
const m = cutia.match(/OcVideoIcon[\s\S]*?viewBox="([^"]+)"([\s\S]*?)<\/svg>/);
if (m) symbols.push(`<symbol id="i-video" viewBox="${m[1]}">${m[2].replace(/<path/g, '<path fill="currentColor" ')}</symbol>`);
else missing.push("OcVideoIcon(cutia)");

// lucide 的 5 个（X / SplitSquareHorizontal / Download / Copy / Check / RotateCcw）——官方 path 手拷
const LUCIDE = {
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  splitSquare: '<rect width="14" height="14" x="5" y="5" rx="1"/><path d="M12 3v18M3 12h18"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  copyL: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  rotateCcw: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
};
for (const [id, inner] of Object.entries(LUCIDE)) {
  symbols.push(`<symbol id="i-${id}" viewBox="0 0 24 24">${inner}</symbol>`);
}

const js = `/* ve-icons.js —— 由 extract-icons.cjs 生成，勿手改。
 * 来源：@hugeicons/core-free-icons（真机同款 path，strokeWidth 1.5）+ cutia OcVideoIcon + lucide 6 枚。 */
(function () {
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">' + ${JSON.stringify(symbols.join(""))} + '</svg>';
  document.head.insertAdjacentHTML("beforeend", svg);
})();
`;
fs.writeFileSync(OUT, js);
console.log("written:", OUT, "symbols:", symbols.length);
if (missing.length) console.log("MISSING:", missing.join(", "));
