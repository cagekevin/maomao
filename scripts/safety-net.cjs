#!/usr/bin/env node
/**
 * 改码安全网 — 三层验证，5 秒定位破坏性变更
 * 
 * 用法:
 *   node scripts/safety-net.cjs --snapshot   # 建立基线快照
 *   node scripts/safety-net.cjs --check      # 对比当前状态和基线 (或直接省略参数)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SNAPSHOT = 'scripts/.snapshot.json';
const APP_PATH = 'src/App.js';

// --- 工具函数：计算字符串 MD5 前缀 ---
function md5(str, len = 8) {
  return crypto.createHash('md5').update(str).digest('hex').slice(0, len);
}

// ── 1. JSX 结构提取引擎 ──
function extractJsxStructure(src) {
  const ObjectNodes = {};
  const varNames = [
    'ImageNodeComp','PromptNodeComp','TextNodeComp','CropNodeComp',
    'GridSplitNodeComp','GridMergeNodeComp','VideoGenNodeComp',
    'SD2VideoNodeComp','DiscountVideoNodeComp','AudioTranscribeNodeComp',
    'AudioPlayerNodeComp','CustomNodeComp','RhWebappNodeComp',
    'VideoExtractNodeComp','VideoToGifNodeComp','ImageCompressNodeComp',
    'FaceMosaicNodeComp','CompareNodeComp','TextConcatNodeComp',
    'UrlToImageNodeComp','FileToUrlNodeComp','PanoramaNodeComp',
    'Director3DNodeComp','ImageBoxNodeComp','StickyNoteNodeComp','GroupNodeComp',
  ];

  for (const name of varNames) {
    const patterns = [
      `${name}\\s*=\\s*Y\\.memo`,
      `function ${name}\\s*\\(`,
    ];
    
    const match = patterns.map(p => src.match(new RegExp(p))).find(Boolean);
    if (!match) { 
      ObjectNodes[name] = 'MISSING'; 
      continue; 
    }

    const start = src.indexOf(match[0]);
    let depth = 1;
    let idx = start + match[0].length;

    // 跨越参数括号 (...)
    for (; idx < src.length && depth > 0; idx++) {
      if (src[idx] === '(') depth++;
      else if (src[idx] === ')') depth--;
    }

    // 定位到函数体起始大括号 {
    while (idx < src.length && src[idx] !== '{') idx++;
    const bodyStart = idx; 
    depth = 1; 
    idx++;

    // 捕获整个函数体 {...}
    for (; idx < src.length && depth > 0; idx++) {
      if (src[idx] === '{') depth++;
      else if (src[idx] === '}') depth--;
    }
    
    const body = src.slice(bodyStart + 1, idx - 1);

    const tags = [...new Set(body.match(/X\.jsxs?\(`(\w+)`/g) || [])];
    const hooks = [...new Set(body.match(/Y\.use\w+/g) || [])];
    const callbacks = [...new Set(body.match(/(?:on\w+)\s*[:=]/g) || [])];
    const cnTexts = (body.match(/[\u4e00-\u9fff]+/g) || []).slice(0, 5);
    
    ObjectNodes[name] = {
      jsxTags: tags.map(t => t.match(/`(\w+)`/)[1]),
      hooks, 
      hooksCount: hooks.length,
      callbacks: callbacks.length,
      cnTexts,
      bodyHash: md5(body, 8),
    };
  }
  return ObjectNodes;
}

// ── 2. 构建产物哈希 ──
function getBuildHash() {
  const distPath = path.join('dist', 'assets');
  if (!fs.existsSync(distPath)) return 'NO_DIST';
  
  const assets = fs.readdirSync(distPath);
  const engine = assets.find(f => f.startsWith('engine-') && f.endsWith('.js'));
  
  if (!engine) return 'NO_ENGINE';
  
  const engineBuf = fs.readFileSync(path.join(distPath, engine));
  return md5(engineBuf, 16);
}

// ── 3. 运行配置项验证 ──
function checkConfigs() {
  const configPath = 'src/config.js';
  const checks = [];
  
  if (!fs.existsSync(configPath)) {
    return ['⚠️ src/config.js 文件不存在，跳过配置检查'];
  }

  const config = fs.readFileSync(configPath, 'utf-8');
  checks.push(config.includes('18080') ? '✅ localTool端口18080' : '❌ localTool端口变了');
  checks.push(config.includes('9004') ? '✅ 网关端口9004' : '❌ 网关端口变了');
  checks.push(config.includes('LOCAL_MODE_ALLOW_ALL') ? '✅ 本地模式开放' : '⚠️ 本地模式可能受限');
  
  return checks;
}

// ── Main 控制流 ──
const cmd = process.argv[2] || '--check';

if (!fs.existsSync(APP_PATH)) {
  console.error(`❌ 无法执行：找不到目标源文件 ${APP_PATH}`);
  process.exit(1);
}
const src = fs.readFileSync(APP_PATH, 'utf-8');

// ==== 生成快照 ====
if (cmd === '--snapshot') {
  const snap = {
    time: new Date().toISOString(),
    buildHash: getBuildHash(),
    appSize: src.length,
    appLines: src.split('\n').length,
    nodes: extractJsxStructure(src),
    config: checkConfigs(),
  };
  
  fs.writeFileSync(SNAPSHOT, JSON.stringify(snap, null, 2));
  console.log(`📸 基线快照已成功保存: ${SNAPSHOT}`);
  console.log(`   📄 App.js: ${snap.appLines.toLocaleString()} 行, ${(snap.appSize / 1024).toFixed(0)}KB`);
  console.log(`   📦 构建产物 Hash: ${snap.buildHash}  |  🎯 分析节点数: ${Object.keys(snap.nodes).length}`);
  process.exit(0);
}

// ==== 对比核验 ====
if (!fs.existsSync(SNAPSHOT)) {
  console.log('⚠️  当前不存在基线快照。请先执行: node scripts/safety-net.cjs --snapshot');
  process.exit(0);
}

const snap = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf-8'));
console.log(`🔍 正在对比基线快照 (创建时间: ${snap.time})\n`);

let issues = 0;

// 层1: 物理文件变化
const curSize = src.length;
const curLines = src.split('\n').length;
console.log('── 层1: 物理文件级变化 ──');

if (curSize !== snap.appSize) {
  console.log(`⚠️  体积抖动: ${(snap.appSize / 1024).toFixed(0)}KB → ${(curSize / 1024).toFixed(0)}KB`);
}
if (curLines !== snap.appLines) {
  const diff = curLines - snap.appLines;
  console.log(`⚠️  行数变更: ${snap.appLines} → ${curLines} (${diff > 0 ? '+' : ''}${diff})`);
}
if (curSize === snap.appSize && curLines === snap.appLines) {
  console.log('✅ 无物理体积变化');
}
console.log('');

// 层2: JSX 组件逻辑树
console.log('── 层2: 核心节点 JSX 树 ──');
const curNodes = extractJsxStructure(src);

for (const [name, info] of Object.entries(curNodes)) {
  const orig = snap.nodes[name];
  
  if (!orig) {
    console.log(`🆕 ${name}: 监测到新节点接入`);
    continue;
  }
  
  if (info === 'MISSING') {
    console.log(`❌ ${name}: 节点在当前源码中意外丢失！`);
    issues++;
    continue;
  }
  
  // Hash 不匹配意味着内部逻辑或 JSX 发生了改变
  if (info.bodyHash !== orig.bodyHash) {
    const added = info.jsxTags.filter(t => !orig.jsxTags.includes(t));
    const removed = orig.jsxTags.filter(t => !info.jsxTags.includes(t));
    
    if (added.length > 0) console.log(`⚠️  ${name}: 增量 JSX 注入: [${added.join(', ')}]`);
    if (removed.length > 0) {
      console.log(`❌ ${name}: 破坏性删除底层 JSX: [${removed.join(', ')}]`);
      issues++;
    }
    if (added.length === 0 && removed.length === 0) {
      console.log(`🔸 ${name}: 内部逻辑变更 (未破坏 JSX 结构)`);
    }
  }
}
console.log('');

// 层3: 构建产物哈希对比
console.log('── 层3: 编译后构建产物 ──');
const curHash = getBuildHash();
if (curHash !== snap.buildHash) {
  console.log(`⚠️  engine.js 指纹偏移: ${snap.buildHash.slice(0, 8)} → ${curHash.slice(0, 8)}`);
} else {
  console.log('✅ 产物指纹高度一致');
}
console.log('');

// 最终评估
if (issues === 0) {
  console.log('🎉 安全网评估通过 — 未检测到破坏性结构变更');
} else {
  console.log(`❌ 存在 ${issues} 个结构性隐患，请评估修改影响`);
}
process.exit(issues > 0 ? 1 : 0);