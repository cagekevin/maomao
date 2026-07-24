// 全面审计 vendor-mapping.txt 质量
const fs = require('fs');

const vmap = fs.readFileSync('docs/vendor-mapping.txt', 'utf-8');
const vendor = fs.readFileSync('src/vendor/vendor.js', 'utf-8');

// 1. 提取 vendor.js 真实导出
const m = vendor.match(/export\s*\{([^}]+)\}/);
const realExports = new Set();
if (m) m[1].split(',').forEach(s => {
  const n = s.trim();
  if (/^\w+$/.test(n)) realExports.add(n);
});

// 2. 解析 mapping 所有行
const allLines = vmap.split('\n').filter(l => {
  const t = l.trim();
  return t && !t.startsWith('#') && t.includes('=');
});

const parsed = [];
const issues = [];
const noiseSet = new Set(['不存在', 'N/A', '(不存在)', '(未找到)']);

for (const line of allLines) {
  const t = line.trim();
  const eq = t.indexOf('=');
  const key = t.substring(0, eq).trim();
  let raw = t.substring(eq + 1).trim();

  // 反引号包裹
  if (raw.startsWith('`')) {
    const end = raw.indexOf('`', 1);
    if (end > 0) raw = raw.substring(1, end);
  }

  const isNoise = noiseSet.has(raw) || [...noiseSet].some(w => raw.includes(w));
  const hash = raw.indexOf('#');
  const apiStr = hash >= 0 ? raw.substring(0, hash).trim() : raw;
  const desc = hash >= 0 ? raw.substring(hash + 1).trim() : '';
  const colon = apiStr.indexOf('::');
  const lib = colon >= 0 ? apiStr.substring(0, colon).trim() : 'internal';
  const api = colon >= 0 ? apiStr.substring(colon + 2).trim() : apiStr;

  // 检查问题
  const problems = [];

  if (isNoise) {
    problems.push('NOISE');
  }
  if (!realExports.has(key)) {
    problems.push('KEY_NOT_IN_VENDOR');
  }
  if (api.includes('(?)') || api.includes('？')) {
    problems.push('UNCERTAIN_API');
  }
  if (lib === 'internal' && (!desc || desc.length < 5)) {
    problems.push('VAGUE_DESC');
  }
  if (api === '' || api === 'internal' || api === 'Internal' || api === '(?)') {
    problems.push('UNKNOWN_API');
  }
  // 重复 key
  const dupKeys = allLines.filter(l => l.trim().startsWith(key + ' ='));
  if (dupKeys.length > 1) {
    problems.push('DUP_KEY');
  }

  parsed.push({ key, lib, api, desc, isNoise, problems });
  if (problems.length > 0) {
    issues.push({ key, lib, api, desc, problems });
  }
}

// 3. 输出审计报告
console.log('=== vendor-mapping.txt 质量审计 ===');
console.log('');
console.log('总行数:', allLines.length);
console.log('有效映射:', parsed.filter(p => !p.isNoise).length);
console.log('噪声条目:', parsed.filter(p => p.isNoise).length);
console.log('有问题条目:', issues.length);
console.log('');

// 分类
const uncertain = issues.filter(i => i.problems.includes('UNCERTAIN_API'));
const notInVendor = issues.filter(i => i.problems.includes('KEY_NOT_IN_VENDOR'));
const unknown = issues.filter(i => i.problems.includes('UNKNOWN_API'));
const vague = issues.filter(i => i.problems.includes('VAGUE_DESC'));
const dupKey = issues.filter(i => i.problems.includes('DUP_KEY'));
const noise = issues.filter(i => i.problems.includes('NOISE'));

console.log('  API不确定 (?):', uncertain.length);
uncertain.forEach(i => console.log('    ', i.key, '→', i.lib + '::' + i.api));

console.log('  KEY不在vendor.js:', notInVendor.length);
notInVendor.forEach(i => console.log('    ', i.key, '→', i.lib + '::' + i.api));

console.log('  未知API:', unknown.length);
unknown.forEach(i => console.log('    ', i.key, '→', i.lib + '::' + i.api));

console.log('  描述不清:', vague.length);
vague.forEach(i => console.log('    ', i.key, '→', i.desc));

console.log('  重复KEY:', dupKey.length);
dupKey.forEach(i => console.log('    ', i.key));

console.log('  噪声:', noise.length);

// 4. 未映射的 vendor 导出
const mappedKeys = new Set(parsed.map(p => p.key));
const unmapped = [...realExports].filter(k => !mappedKeys.has(k));

console.log('');
console.log('vendor.js 导出总数:', realExports.size);
console.log('已映射:', mappedKeys.size);
console.log('未映射:', unmapped.length);
if (unmapped.length > 0) {
  // 按首字母分组
  const groups = {};
  for (const n of unmapped) {
    const c = n[0];
    if (!groups[c]) groups[c] = [];
    groups[c].push(n);
  }
  Object.keys(groups).sort().forEach(c => {
    console.log(`  ${c}:`, groups[c].sort().join(', '));
  });
}
