// 审计 AI01.md：提取 App.js 中每个缩写函数的真实定义行与首行，与表格声明对比
const fs = require('fs');
const path = require('path');

const appJs = path.join(__dirname, '..', 'src', 'App.js');
const ai01 = path.join(__dirname, '..', 'docs', 'ai-tasks', 'AI01.md');
const src = fs.readFileSync(appJs, 'utf8');
const lines = src.split('\n');
const md = fs.readFileSync(ai01, 'utf8');

// 从表格解析：| # | 函数 | 行号 | 你的结果 |
const rows = [];
const reRow = /^\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*~?L?(\d+)\s*\|\s*(.*?)\s*\|\s*$/;
for (const line of md.split('\n')) {
  const m = line.match(reRow);
  if (m) rows.push({ idx: m[1], name: m[2], claimedLine: +m[3], result: m[4] });
}

// 用首字母大写启发式抽取 AI01 给出的语义名（结果列第一个 token，去掉 (?) 等）
function semanticGuess(result) {
  const m = result.match(/^\s*([A-Za-z][A-Za-z0-9]+)/);
  return m ? m[1] : '';
}

// 找真实定义行：行首(空白后) 形如 `name =` 或 `function name(`
function findDef(name) {
  const out = [];
  const reAssign = new RegExp('^[ \\t]*' + name.replace(/[$]/g, '\\$') + '[ \\t]*=');
  const reFn = new RegExp('^[ \\t]*function[ \\t]+' + name.replace(/[$]/g, '\\$') + '[ \\t]*\\(');
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (reAssign.test(ln) || reFn.test(ln)) {
      out.push({ line: i + 1, text: ln.trim().slice(0, 160) });
    }
  }
  return out;
}

console.log('idx | name | claimed | actualDefLines | semanticGuess | firstDefLineSnippet');
console.log('---');
for (const r of rows) {
  const defs = findDef(r.name);
  const guess = semanticGuess(r.result);
  const defLines = defs.map(d => d.line).join(',');
  const snippet = defs.length ? defs[0].text : '(none)';
  const delta = defs.length ? (defs[0].line - r.claimedLine) : 'NA';
  console.log(`${r.idx} | ${r.name} | L${r.claimedLine} | [${defLines}] | ${guess} | ${snippet}`);
}
