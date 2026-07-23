// 合并 9 个 agent 的函数体重写结果到 App.js
// 用法: node scripts/merge-rewrites.cjs
const fs = require('fs');
const path = require('path');

const TASK_DIR = 'docs/annotate-body-tasks';
const SRC = 'src/App.js';

// 读取 App.js 行
const lines = fs.readFileSync(SRC, 'utf-8').split('\n');

// 收集所有 agent 提交的重写代码
const rewrites = [];
for (let n = 1; n <= 9; n++) {
  const f = path.join(TASK_DIR, `AB${String(n).padStart(2, '0')}.md`);
  if (!fs.existsSync(f)) continue;
  const content = fs.readFileSync(f, 'utf-8');

  // 提取代码块: | type | varName | \`\`\`js\n...code...\n\`\`\`\n|
  const blocks = [...content.matchAll(/\|\s*(\w+)\s*\|\s*(\w+)\s*\|\s*```js\n([\s\S]*?)```/g)];
  for (const m of blocks) {
    const nodeType = m[1];
    const varName = m[2];
    const newBody = m[3].trim();
    if (newBody) rewrites.push({ nodeType, varName, newBody });
  }
}

console.log(`找到 ${rewrites.length} 个重写结果`);

if (rewrites.length === 0) {
  console.log('(agent 还没提交结果)');
  process.exit(0);
}

// 对每个重写，找到原函数体并替换
let content = lines.join('\n');
let replaced = 0;
for (const rw of rewrites) {
  // 找 var VarName = Y.memo(({...}) => { ... }) 或 function VarName({
  let pattern;
  if (rw.varName === 'Nh') {
    // 特殊: ghostTarget 可能不是 Y.memo
    pattern = new RegExp(`(${rw.varName}\\s*=\\s*Y\\.memo\\(\\()`, 'g');
  } else {
    // 尝试找 Y.memo 块
    pattern = new RegExp(`(${rw.varName}\\s*=\\s*Y\\.memo\\(\\()`, 'g');
  }

  const match = content.match(pattern);
  if (!match) {
    console.log(`⚠️  找不到 ${rw.varName} 的定义`);
    continue;
  }

  // 简单策略：找函数体结束
  const startIdx = content.indexOf(match[0]);
  // 找到对应的闭合 }) 或 }
  let depth = 1;
  let idx = startIdx + match[0].length;
  for (; idx < content.length && depth > 0; idx++) {
    if (content[idx] === '(') depth++;
    else if (content[idx] === ')') depth--;
  }
  // 现在 idx 在函数参数后，找 => { ... }
  while (idx < content.length && content[idx] !== '{') idx++;
  const bodyStart = idx;
  // 找匹配的 }
  depth = 1;
  idx++;
  for (; idx < content.length && depth > 0; idx++) {
    if (content[idx] === '{') depth++;
    else if (content[idx] === '}') depth--;
  }
  const bodyEnd = idx;

  // 提取函数签名（参数部分）
  const signature = content.slice(startIdx, bodyStart + 1);

  // 替换
  const oldBodyLength = bodyEnd - bodyStart - 1;
  const newCode = signature + '\n' + rw.newBody + '\n}';
  content = content.slice(0, startIdx) + newCode + content.slice(bodyEnd);
  replaced++;
  console.log(`✅ ${rw.nodeType} (${rw.varName})`);
}

fs.writeFileSync(SRC, content);
console.log(`\n已替换 ${replaced}/${rewrites.length} 个函数`);
console.log('请运行: npm run build && node scripts/check-build.cjs');
