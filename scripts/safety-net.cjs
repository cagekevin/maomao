#!/usr/bin/env node
// 改码安全网 — 三层验证，5 秒定位坏在哪
// 用法:
//   node scripts/safety-net.cjs --snapshot   # 建立基线快照
//   node scripts/safety-net.cjs --check      # 对比当前状态和基线
//   node scripts/safety-net.cjs              # 默认 = --check

const fs = require('fs');
const crypto = require('crypto');
const SNAPSHOT = 'scripts/.snapshot.json';

// ── 1. JSX 结构快照 ──
function extractJsxStructure(src) {
  const nodes = {};
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
    // 支持 var name = Y.memo 和 function name( 两种格式
    const patterns = [
      name + '\\s*=\\s*Y\\.memo',
      'function ' + name + '\\s*\\(',
    ];
    let match = null;
    for (const p of patterns) {
      match = src.match(new RegExp(p));
      if (match) break;
    }
    if (!match) { nodes[name] = 'MISSING'; continue; }
    const start = src.indexOf(match[0]);
    let depth=1, idx=start+match[0].length;
    for(;idx<src.length&&depth>0;idx++){if(src[idx]==='(')depth++;else if(src[idx]===')')depth--;}
    while(idx<src.length&&src[idx]!=='{')idx++;
    const bodyStart=idx; depth=1; idx++;
    for(;idx<src.length&&depth>0;idx++){if(src[idx]==='{')depth++;else if(src[idx]==='}')depth--;}
    const body=src.slice(bodyStart+1,idx-1);

    // 提取 JSX 标签
    const tags=[...new Set(body.match(/X\.jsxs?\(`(\w+)`/g)||[])];
    // 提取 hook 调用
    const hooks=[...new Set(body.match(/Y\.use\w+/g)||[])];
    // 提取 on 开头的回调变量
    const callbacks=[...new Set(body.match(/(?:on\w+)\s*[:=]/g)||[])];
    const cnTexts=(body.match(/[\u4e00-\u9fff]+/g)||[]).slice(0,5);
    
    nodes[name]={
      jsxTags:tags.map(t=>t.match(/`(\w+)`/)[1]),
      hooks,hooksCount:hooks.length,
      callbacks:callbacks.length,
      cnTexts,
      bodyHash:crypto.createHash('md5').update(body).digest('hex').slice(0,8),
    };
  }
  return nodes;
}

// ── 2. 构建产物哈希 ──
function getBuildHash() {
  if (!fs.existsSync('dist')) return 'NO_DIST';
  const assets=fs.readdirSync('dist/assets');
  const engine=assets.find(f=>f.startsWith('engine-')&&f.endsWith('.js'));
  if(!engine)return 'NO_ENGINE';
  return crypto.createHash('md5').update(fs.readFileSync('dist/assets/'+engine)).digest('hex').slice(0,16);
}

// ── 3. 运行配置项测试 ──
function checkConfigs() {
  const config=fs.readFileSync('src/config.js','utf-8');
  const checks=[];
  // 关键端口不变
  if(config.includes('18080'))checks.push('✅ localTool端口18080');
  else checks.push('❌ localTool端口变了');
  if(config.includes('9004'))checks.push('✅ 网关端口9004');
  else checks.push('❌ 网关端口变了');
  if(config.includes('LOCAL_MODE_ALLOW_ALL'))checks.push('✅ 本地模式开放');
  else checks.push('⚠️ 本地模式可能受限');
  return checks;
}

// ── Main ──
const cmd=process.argv[2]||'--check';
const src=fs.readFileSync('src/App.js','utf-8');

if(cmd==='--snapshot'){
  const snap={
    time:new Date().toISOString(),
    buildHash:getBuildHash(),
    appSize:src.length,
    appLines:src.split('\n').length,
    nodes:extractJsxStructure(src),
    config:checkConfigs(),
  };
  fs.writeFileSync(SNAPSHOT,JSON.stringify(snap,null,2));
  console.log(`📸 快照已保存: ${SNAPSHOT}`);
  console.log(`   App.js: ${snap.appLines.toLocaleString()} 行, ${(snap.appSize/1024).toFixed(0)}KB`);
  console.log(`   构建: ${snap.buildHash}  节点: ${Object.keys(snap.nodes).length}`);
  process.exit(0);
}

// --check
if(!fs.existsSync(SNAPSHOT)){
  console.log('⚠️  没有基线快照，先跑: node scripts/safety-net.cjs --snapshot');
  process.exit(0);
}
const snap=JSON.parse(fs.readFileSync(SNAPSHOT,'utf-8'));
console.log(`对比基线: ${snap.time}\n`);

let issues=0;

// 层1: 物理变化
const curSize=src.length, curLines=src.split('\n').length;
console.log('── 层1: 物理变化 ──');
if(curSize!==snap.appSize)console.log(`⚠️  文件大小: ${(snap.appSize/1024).toFixed(0)}→${(curSize/1024).toFixed(0)}KB`);
if(curLines!==snap.appLines)console.log(`⚠️  行数: ${snap.appLines}→${curLines} (${curLines-snap.appLines>0?'+':''}${curLines-snap.appLines})`);
if(curSize===snap.appSize&&curLines===snap.appLines)console.log('✅ 无变化');
console.log('');

// 层2: JSX 结构
console.log('── 层2: JSX 结构 ──');
const curNodes=extractJsxStructure(src);
for(const[name,info]of Object.entries(curNodes)){
  const orig=snap.nodes[name];
  if(!orig){console.log(`🆕 ${name}: 新节点`);continue;}
  if(info==='MISSING'){console.log(`❌ ${name}: 节点丢失！`);issues++;continue;}
  if(!orig || info.bodyHash!==orig.bodyHash){
    if(!orig) { console.log(`🆕 ${name}: 新节点`); continue; }
    const added=info.jsxTags.filter(t=>!orig.jsxTags.includes(t));
    const removed=orig.jsxTags.filter(t=>!info.jsxTags.includes(t));
    if(added.length>0)console.log(`⚠️  ${name}: 新增JSX ${added.join(',')}`);
    if(removed.length>0){console.log(`❌ ${name}: 删除JSX ${removed.join(',')}`);issues++;}
    if(added.length===0&&removed.length===0)console.log(`🔸 ${name}: 函数体变更（非JSX）`);
  }
}
console.log('');

// 层3: 构建哈希
console.log('── 层3: 构建产物 ──');
const curHash=getBuildHash();
if(curHash!==snap.buildHash)console.log(`⚠️  engine.js 哈希变化: ${snap.buildHash.slice(0,8)}→${curHash.slice(0,8)}`);
else console.log('✅ 一致');
console.log('');

// 总结
if(issues===0)console.log('🎉 安全网通过 — 无破坏性变更');
else console.log(`❌ ${issues} 个问题需处理`);
process.exit(issues>0?1:0);
