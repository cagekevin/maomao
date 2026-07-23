// 品牌更名 · 扫描 + 可疑项分类脚本
// 输出一份带分类标注的清单，减少人工对照工作量
const fs = require('fs');
const path = require('path');

const ROOT = 'g:/01画布项目/maomao';
const EXCLUDE_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.codebuddy', 'Temp']);
const EXCLUDE_FILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'scan-brand.cjs', 'brand-scan-report.md']);
const TEXT_EXT = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.json', '.md', '.txt', '.ps1', '.command', '.sh', '.example',
  '.css', '.html', '.yml', '.yaml', '.toml', '.py', '.env'
]);

// 文件分类
function fileCategory(rel) {
  if (rel.startsWith('docs/archive/reference/decompiled/')) return 'archive/decompiled';
  if (rel.startsWith('docs/archive/reference/App.original.js')) return 'archive/original';
  if (rel.startsWith('docs/archive/')) return 'archive/其他';
  if (rel.startsWith('docs/')) return 'docs';
  if (rel.startsWith('src/')) return 'src';
  if (rel.startsWith('localTool/')) return 'localTool';
  if (rel.startsWith('scripts/')) return 'scripts';
  return '根目录';
}

// 判断是否需要重命名的文件名
function needRenameFilename(name) {
  return /yimao/i.test(name) || /一毛/.test(name);
}

// 对每一行内容做可疑项分析
function analyzeLine(fileRel, lineText) {
  const items = [];

  // 1. 反编译/原始 vendor 代码 —— 高风险，不应改
  if (fileRel.includes('decompiled') || fileRel.includes('.original.js') || fileRel.includes('.raw.js')) {
    return [{ tag: 'SKIP-反编译归档', note: '反编译/原始vendor代码，改动会失真，不应修改', line: lineText }];
  }

  // 2. Drag / MIME type —— 改了拖拽功能会坏
  if (/application\/x-yimao-(layer|puzzle|template)/i.test(lineText)) {
    items.push({ tag: '可疑-MIME类型', note: '拖拽数据格式标识，改后拖拽功能会失效，需同步所有生产/消费处', line: lineText });
  }

  // 3. BroadcastChannel 名称 —— 改了跨窗口同步会坏
  if (/yimao_canvas_sync/i.test(lineText)) {
    items.push({ tag: '可疑-通信通道名', note: 'BroadcastChannel名称，改后跨窗口同步失效，需确认所有收发端同步', line: lineText });
  }

  // 4. 环境变量 —— 改了部署会坏
  if (/YIMAO_DATA_DIR/i.test(lineText)) {
    items.push({ tag: '可疑-环境变量', note: '环境变量名，改后需同步所有部署配置', line: lineText });
  }

  // 5. 数据目录路径 —— 改了历史数据路径变化
  if (/\.yimao-localtool/i.test(lineText)) {
    items.push({ tag: '可疑-数据目录', note: '本地数据存储目录，改后需迁移或保持兼容', line: lineText });
  }

  // 6. npm 包名
  if (/yimao-localtool/i.test(lineText)) {
    items.push({ tag: '可疑-npm包名', note: 'npm包名，改后影响npm发布/安装', line: lineText });
  }

  // 7. version 字符串
  if (/2\.0\.0-yimao-clone/i.test(lineText)) {
    items.push({ tag: '可疑-版本标识', note: '版本号中的标识串，改后版本语义变化', line: lineText });
  }

  // 8. CustomEvent 事件名
  if (/yimao:presetsChanged|yimao:promptRecent|yimao:openPromptSettings/i.test(lineText)) {
    items.push({ tag: '可疑-自定义事件名', note: 'CustomEvent/事件名，需确认所有监听处同步修改', line: lineText });
  }

  // 9. localStorage / storage key
  if (/yimao-workflow-backup/i.test(lineText)) {
    items.push({ tag: '可疑-导出文件名', note: '导出文件默认名，改后不影响功能但可能用户不习惯', line: lineText });
  }

  // 10. 文件上传路径前缀
  if (/filename:\s*`yimao\//i.test(lineText)) {
    items.push({ tag: '可疑-上传路径', note: '文件上传目标路径，改后需确认后端存储桶同步', line: lineText });
  }

  // 11. 用户可见的 placeholder 提示
  if (/yimaoai/i.test(lineText) && !/yimaoAiApp/.test(lineText)) {
    items.push({ tag: '可疑-placeholder', note: '输入框placeholder提示文字，用户可见', line: lineText });
  }

  // 12. 硬编码的 App ID
  if (/yimaoAiApp/i.test(lineText)) {
    items.push({ tag: '可疑-AppID', note: '硬编码的应用ID，可能是服务端标识，改后需后端配合', line: lineText });
  }

  // 13. 内置用户名检测（白名单逻辑）
  if (/yimao\|jiangwei\|weishao/i.test(lineText)) {
    items.push({ tag: '可疑-用户名检测', note: '硬编码的内置用户名白名单，改后原用户名匹配会失效', line: lineText });
  }

  // 14. 纯品牌展示文案（一毛AI画布）—— 安全
  if (/一毛AI画布/.test(lineText)) {
    items.push({ tag: '安全-品牌文案', note: '纯品牌名称展示，直接替换为猫猫AI画布', line: lineText });
  }

  // 15. 其他含一毛的文案
  if (/一毛/.test(lineText) && !/一毛AI画布/.test(lineText)) {
    items.push({ tag: '待确认-中文', note: '含"一毛"但非固定短语，需人工确认语义', line: lineText });
  }

  // 16. 纯品牌英文名（小写 yimao）—— 需要判断
  if (!items.length && /yimao/i.test(lineText)) {
    items.push({ tag: '待确认-yimao', note: '含yimao但未被其他规则匹配，需人工确认', line: lineText });
  }

  return items;
}

function walkAndScan() {
  const allItems = [];
  const renameFiles = [];

  function walk(dir, relPrefix) {
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const ent of ents) {
      const abs = path.join(dir, ent.name);
      const rel = relPrefix ? path.join(relPrefix, ent.name) : ent.name;
      if (ent.isDirectory()) {
        if (EXCLUDE_DIRS.has(ent.name)) continue;
        walk(abs, rel);
      } else {
        if (EXCLUDE_FILES.has(ent.name)) continue;
        const ext = path.extname(ent.name).toLowerCase();
        if (!TEXT_EXT.has(ext)) continue;
        if (needRenameFilename(ent.name)) renameFiles.push(rel);
        let content;
        try { content = fs.readFileSync(abs, 'utf8'); }
        catch { continue; }
        const lines = content.split(/\r?\n/);
        lines.forEach((rawLine, i) => {
          if (!/yimao/i.test(rawLine) && !/一毛/.test(rawLine)) return;
          const items = analyzeLine(rel, rawLine.trim());
          for (const item of items) {
            allItems.push({ file: rel, line: i + 1, cat: fileCategory(rel), ...item });
          }
        });
      }
    }
  }

  walk(ROOT, '');
  return { allItems, renameFiles };
}

const { allItems, renameFiles } = walkAndScan();

// 生成报告
let out = '# 品牌更名扫描 + 可疑项分类报告\n\n';
out += `> 共 **${allItems.length}** 条匹配，**${renameFiles.length}** 个文件待重命名\n\n`;

// 按分类统计
const tagCount = {};
for (const it of allItems) {
  tagCount[it.tag] = (tagCount[it.tag] || 0) + 1;
}

out += '## 一、分类统计\n\n';
out += '| 分类 | 数量 | 说明 |\n|---|---|---|\n';
for (const [tag, cnt] of Object.entries(tagCount).sort()) {
  const sample = allItems.find(it => it.tag === tag);
  out += `| ${tag} | ${cnt} | ${sample.note} |\n`;
}

out += '\n## 二、需重命名的文件\n\n';
out += '| 当前文件名 |\n|---|\n';
for (const f of renameFiles.sort()) out += `| ${f} |\n`;

out += '\n## 三、按分类逐条明细\n\n';
const byTag = {};
for (const it of allItems) (byTag[it.tag] ||= []).push(it);
for (const tag of Object.keys(byTag).sort()) {
  out += `### ${tag} (${byTag[tag].length}条)\n\n`;
  out += '| 文件 | 行 | 内容 |\n|---|---|---|\n';
  for (const it of byTag[tag]) {
    out += `| ${it.file} | ${it.line} | ${it.line.replace(/\|/g, '\\|')} |\n`;
  }
  out += '\n';
}

const outPath = path.join(ROOT, 'Temp', 'brand-scan-report.md');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out);
console.log(`完成！共 ${allItems.length} 条匹配，${renameFiles.length} 个待重命名文件`);
console.log(`报告: ${outPath}`);

// 打印简要统计
for (const [tag, cnt] of Object.entries(tagCount).sort()) {
  console.log(`  ${tag}: ${cnt}`);
}
