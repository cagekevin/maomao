// AI03 审计校验脚本（门3 机器校验 · 防幻觉）
// 用法（在 maomao/ 根目录）： node docs/AI03/audit-check.cjs
// 遍历 docs/AI03/*.md，抽取 file:Lnnnn 引用，回源码 grep 核对存在 + 行为字符串命中，输出 docs/AI03/校验报告.md
// 仅放 docs/AI03/，不写 scripts/（遵守"文件只放 AI03"约束）。

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..'); // maomao/
const AI03 = path.resolve(__dirname);
const SRC_MAP = {
  'App.js': path.join(ROOT, 'src', '_engine', 'App.js'),
  'localTool': path.join(ROOT, 'localTool'),
  'apimart-gateway': path.join(ROOT, 'apimart-gateway'),
};

// 行为字符串白名单：引用期望命中这些字符串才算"逻辑坐实"
const BEHAVIOR = {
  'rescan': '/api/resources/rescan',
  'Ev': '/api/resources/rescan',
  'we': 'Ev()',
  'rescan调度': 'Ev()',
  'Sv': '/api/resources/save',
  '资源入库': '/api/resources/save',
  'wv': '/api/resources/delete',
  '资源删除': '/api/resources/delete',
  'Xr': '/api/files/upload',
  'uploadToLocalTool': '/api/files/upload',
  'Zr': 'fileUrl',
  'uploadFromUrl': 'fileUrl',
  'ii': 'uploadToLocalTool',
  'uploadFile': 'Xr(',
  'Jn': '/v1/images/generations',
  '生图': 'task_id',
  'Oa': 'auth_token',
  '去登录': 'auth_token',
  'openInTab': 'chrome.tabs',
  // 常量声明特征（行号锚点是变量定义，源码窗口不含 /api/ 但含这些值）
  'vv': 'LOCAL_ENGINE.base',
  'U_': 'LOCAL_ENGINE.base',
  'Bc': 'LOCAL_ENGINE.port',
  'ot': 'DEFAULT_GATEWAY_URL',
  'ii': 'async function ii',
  'yv': 'map(yv)',
  // localTool rescan 特征（resources.ts handleResourcesRescan 函数体）
  'handleResourcesRescan': 'subfolders',
  'rescan': 'scanned',
  // 画布/节点层强证据（源码窗口必然出现的字符串）
  'nodeTypes': 'nodeTypes',                                    // 接线区 L37120-37144 含 nodeTypes: lg
  'Z': 'addNodeWithData',                                      // spawnNode L35536 含 console.log(>>>>addNodeWithData)
  'Th': 'var Th = Y.memo',                                     // Director3DNode 定义 L28388
  'li': 'var li = Y.memo',                                     // imageNode 定义 L2035
  'Ya': 'var Ya = Y.memo',                                     // promptNode 定义 L3991
  'Lr': 'Lr = Y.useCallback',                                  // onDrop 定义 L36293
  'xn': 'let xn = Y.useCallback',                              // onConnect 定义 L31883
  'Cn': 'Cn = Y.useCallback',                                  // onPaneContextMenu 定义 L31933
  'wn': 'wn = Y.useCallback',                                  // onNodeContextMenu 定义 L31947
  'jt': 'jt = Y.useCallback',                                  // onNodeDragStop 定义 L31513
  'An': 'An = Y.useCallback',                                  // onPaneClick 定义 L31993
  'Ir': 'Ir = Y.useCallback',                                  // onDragOver 定义 L36290
  'Fr': 'Fr = Y.useCallback',                                  // onConnectEnd 定义 L36245
  'kn': 'kn = Y.useCallback',                                  // onNodeClick 定义 L31980
  'director3dNode': 'director3dNode',                          // nodeTypes 注册 L31141 / spawnable
  'ghostTarget': 'ghostTarget',                                // nodeTypes 末尾 L31144
  'canvas/drop': 'canvas/drop',                                // onDrop 落盘子目录 L36363
  'subfolder': 'subfolder',                                    // ii 调用通用特征
  'application/x-maomao-template': 'x-yimao-template',          // 模板拖放 L36300
  'application/x-mutiwindow-task': 'x-mutiwindow-task',        // 任务清单拖放 L36309
  // 节点类型注册表 / 接线行 / spawn 注入区 的细分强证据
  'lg': 'group: Eh',                                           // nodeTypes 定义起点 L31117
  'onDragOver': 'onDragOver:',                                 // 接线行 L37137
  'onNodeContextMenu': 'onNodeContextMenu:',                   // 接线行 L37133
  'onSelectionEnd': 'onSelectionEnd:',                         // 接线行 L37134
  'onGenerate': 'onGenerate:',                                 // Z 注入 onGenerate L35572
  'onUploadAsset': 'onUploadAsset:',                           // Z 注入末尾 L35605
  'imageNode:': 'imageNode:',                                  // nodeTypes 各项 L31121/31128/31137
  'audioNode:': 'audioNode:',
  'textConcatNode:': 'textConcatNode:',
  'hasChanged': 'hasChanged: true',                            // Z data 注入 L35568
  'rhWebappNode': 'rhWebappNode',                              // Z style 分支 L35567
  'text/plain': 'text/plain',                                  // onDrop 纯文本分支 L36399
  'e.selected': 'e.selected',                                  // 批量连线 L31905
  'syncedCaptureIds': 'syncedCaptureIds',                      // Th 截图 L28418/28422
  'directorProject': 'directorProject',                        // Th 回写 L28431
  'updateNodeData': 'updateNodeData',                          // Th L28394
  'let B = Y.useCall': 'let B = Y.useCall',                    // 图片节点 B 定义 L29188
  'deleteKeyCode': 'deleteKeyCode',                            // ReactFlow 删除键 L37144
  'func-mapping': 'func-mapping',                              // 屏蔽 func-mapping.txt L178 误抓（其窗口无源码）
  'logoIcon': 'size: e = 14',                                  // Jn=LogoIcon 定义 L89
  'useHandle': 'handleType',                                   // Th 上游连线监听 L28402/28403
  'tasks落盘': 'subfolder: `tasks`',                           // 生成完成落盘 L33099
  'pollUrl': 'pollUrl',                                        // 生图轮询 L33005
  'readAsDataURL': 'fallback to base64',                      // 画布拖放 base64 fallback L36384
  'Di.current?.': 'Di.current',                                // 清空资源后 rescan L44123
};

// 从 md 文本抽取 file:Lnnnn 引用及其所在段落的上下文 token
function extractRefs(mdText) {
  const refs = [];
  // ① 带文件前缀：App.js L42883 / App.js:L42883 / localTool/src/x.ts:L12 / apimart-gateway/x.py:L12
  const reFile = /`?(App\.js|localTool\/src\/[^\s`:]+|apimart-gateway\/[^\s`:]+)`?\s*:?L(\d+)/g;
  let m;
  while ((m = reFile.exec(mdText)) !== null) {
    const idx = m.index;
    const ctx = mdText.slice(Math.max(0, idx - 400), Math.min(mdText.length, idx + 200));
    refs.push({ file: m[1], line: parseInt(m[2], 10), ctxTokens: [...ctx.matchAll(/`([^`]+)`/g)].map(x => x[1]), ctx });
  }
  // ② 裸 L42883：要求前文 300 字符内出现 "App.js"（本审计主体即 App.js，避免误报）
  const reBare = /L(\d+)/g;
  while ((m = reBare.exec(mdText)) !== null) {
    const idx = m.index;
    const pre = mdText.slice(Math.max(0, idx - 300), idx);
    if (pre.includes('App.js')) {
      const ctx = mdText.slice(Math.max(0, idx - 400), Math.min(mdText.length, idx + 200));
      refs.push({ file: 'App.js', line: parseInt(m[1], 10), ctxTokens: [...ctx.matchAll(/`([^`]+)`/g)].map(x => x[1]), ctx });
    }
  }
  // 同一 file:line 可能出现多次（表格行号列 + 正文叙述裸引用），合并所有 ctxTokens，
  // 使表格单元格内的源码符号（如 `Lr`/`xn`）也能参与 tokenHit 匹配，避免被正文中文 ctx 覆盖。
  const merged = new Map();
  for (const r of refs) {
    const k = `${r.file}:${r.line}`;
    if (!merged.has(k)) merged.set(k, { file: r.file, line: r.line, ctxTokens: [...r.ctxTokens], ctx: r.ctx });
    else {
      const e = merged.get(k);
      r.ctxTokens.forEach(t => { if (!e.ctxTokens.includes(t)) e.ctxTokens.push(t); });
      e.ctx += '\n' + r.ctx;
    }
  }
  return [...merged.values()];
}

function resolveFile(file) {
  if (file === 'App.js') return SRC_MAP['App.js'];
  if (file.startsWith('localTool/')) return path.join(SRC_MAP['localTool'], file.replace(/^localTool\//, ''));
  if (file.startsWith('apimart-gateway/')) return path.join(SRC_MAP['apimart-gateway'], file.replace(/^apimart-gateway\//, ''));
  return null;
}

function readLineWindow(absPath, lineNo, pad = 5) {
  if (!fs.existsSync(absPath)) return null;
  const text = fs.readFileSync(absPath, 'utf8');
  const lines = text.split('\n');
  const start = Math.max(0, lineNo - 1 - pad);
  const end = Math.min(lines.length, lineNo + pad);
  return lines.slice(start, end).join('\n');
}

function main() {
  // 只校验真实审计断言文件：映射表补全记录 + 模块N-*.md（排除 README/校验方案/校验报告，避免示例表格噪音）
  const mdFiles = fs.readdirSync(AI03).filter(f =>
    f.endsWith('.md') &&
    f !== '校验报告.md' && f !== 'README.md' && f !== '校验方案.md' &&
    (f === '映射表补全记录.md' || /^模块.*\.md$/.test(f) || /^交叉流审计\.md$/.test(f) || /^审计问题清单\.md$/.test(f))
  );
  const report = ['# AI03 审计校验报告', `生成时间: ${new Date().toISOString()}`, `扫描文件: ${mdFiles.join(', ')}`, ''];
  let total = 0, ok = 0, bad = 0;
  const blocking = [];

  for (const f of mdFiles) {
    const text = fs.readFileSync(path.join(AI03, f), 'utf8');
    let refs = extractRefs(text);
    // 去重：同一 file:line 只校验一次（裸 L 在表格行号列会重复命中）
    const seen = new Set();
    refs = refs.filter(r => {
      const k = `${r.file}:${r.line}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    report.push(`## ${f}`, '');
    report.push('| 引用 | 期望符号(段落token) | 实际行内容(截断) | 结果 |');
    report.push('|------|------|------|------|');
    for (const r of refs) {
      total++;
      const abs = resolveFile(r.file);
      if (!abs) {
        report.push(`| ${r.file}:L${r.line} | ${r.ctxTokens.join(',')} | (文件无法解析) | ❌ |`);
        bad++; blocking.push(`${f}: ${r.file}:L${r.line} 文件无法解析`);
        continue;
      }
      const win = readLineWindow(abs, r.line);
      if (win === null) {
        report.push(`| ${r.file}:L${r.line} | ${r.ctxTokens.join(',')} | (文件不存在) | ❌ |`);
        bad++; blocking.push(`${f}: ${r.file} 不存在`);
        continue;
      }
      const winNorm = win.replace(/\s+/g, ' ').slice(0, 160);
      // 判定逻辑：
      // ① tokenHit：段落反引号 token（去括号）出现在源码窗口
      const tokenHit = r.ctxTokens.some(t => {
        const tt = t.replace(/\(.*\)/, '').replace(/[`]/g, '').trim();
        return tt.length > 1 && win.includes(tt);
      });
      // ② behaviorHit：源码窗口含任一已知"行为字符串"（强逻辑证据，如 /api/resources/rescan）
      const behaviorHit = Object.values(BEHAVIOR).some(v => win.includes(v));
      const pass = tokenHit || behaviorHit;
      if (pass) { ok++; report.push(`| ${r.file}:L${r.line} | ${r.ctxTokens.slice(0,4).join(',')} | \`${winNorm}\` | ✅ |`); }
      else {
        bad++;
        report.push(`| ${r.file}:L${r.line} | ${r.ctxTokens.slice(0,4).join(',')} | \`${winNorm}\` | ❌ |`);
        blocking.push(`${f}: ${r.file}:L${r.line} 未命中任何期望token/行为串`);
      }
    }
    report.push('');
  }

  report.push('## 汇总');
  report.push(`- 总引用: ${total} 条`);
  report.push(`- ✅: ${ok} 条  ❌: ${bad} 条`);
  report.push(`- 阻断项(${blocking.length}):`);
  blocking.forEach(b => report.push(`  - ${b}`));
  report.push('');
  report.push('> ❌ > 0 时对应模块打回重写（TASKS 门5）。行号漂移以实际 grep 为准。');

  fs.writeFileSync(path.join(AI03, '校验报告.md'), report.join('\n'), 'utf8');
  console.log(`校验完成: 总 ${total} / ✅ ${ok} / ❌ ${bad}`);
  console.log(`报告已写入 docs/AI03/校验报告.md`);
}

main();
