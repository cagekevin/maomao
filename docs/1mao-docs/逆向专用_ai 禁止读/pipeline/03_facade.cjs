/**
 * 第 3 步：门面替换 (读取映射表版)
 * 提取原始巨型 JS 的导出项，读取 component_map.json，生成 Re-export，覆盖原文件。
 */
const fs = require('fs');
const P = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');

const inputFile = process.argv[2];
const compDir = process.argv[3];
if (!inputFile || !compDir) {
  console.error('用法: node 03_facade.cjs <输入> <组件目录>');
  process.exit(1);
}

const compDirName = P.basename(compDir);
const rawCode = fs.readFileSync(inputFile, 'utf-8');
const ast = parser.parse(rawCode, { sourceType: 'module', plugins: ['jsx'] });
const facadeExports = new Set();

// 读取第 2 步生成的映射清单
const mapPath = P.join(compDir, 'component_map.json');
let nameMap = {};
if (fs.existsSync(mapPath)) {
  nameMap = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
}

facadeExports.add(`export * from './${compDirName}/shared.js';`);

traverse(ast, {
  ExportNamedDeclaration(nodePath) {
    const node = nodePath.node;
    // 收集 { local, exported } 列表，兼容 `export { a, b }` 与 `export const a = ...` / `export function a(){}`
    let specs = [];
    if (node.specifiers && node.specifiers.length) {
      for (const spec of node.specifiers) {
        specs.push({ local: spec.local.name, exported: spec.exported.name || spec.exported.value });
      }
    } else if (node.declaration) {
      const d = node.declaration;
      if (t.isVariableDeclaration(d)) {
        for (const dd of d.declarations) specs.push({ local: dd.id.name, exported: dd.id.name });
      } else if ((t.isFunctionDeclaration(d) || t.isClassDeclaration(d)) && d.id) {
        specs.push({ local: d.id.name, exported: d.id.name });
      }
    }
    for (const spec of specs) {
      const local = spec.local;
      const exported = spec.exported;

      // 使用映射表获取实际文件名，兜底使用原名
      const safeLocal = nameMap[local] || local;
      const isComp = fs.existsSync(P.join(compDir, `${safeLocal}.jsx`));

      if (isComp) {
        if (exported === 'default')
          facadeExports.add(`export { default } from './${compDirName}/${safeLocal}.jsx';`);
        else
          facadeExports.add(`export { default as ${exported} } from './${compDirName}/${safeLocal}.jsx';`);
      } else if (exported !== 'default') {
        facadeExports.add(`export { ${local} as ${exported} } from './${compDirName}/shared.js';`);
      }
    }
  },
  ExportDefaultDeclaration(nodePath) {
    const decl = nodePath.node.declaration;
    if (decl && decl.name) {
      const local = decl.name;
      const safeLocal = nameMap[local] || local;
      const isComp = fs.existsSync(P.join(compDir, `${safeLocal}.jsx`));

      if (isComp) {
        facadeExports.add(`export { default } from './${compDirName}/${safeLocal}.jsx';`);
      }
    }
  },
});

const finalCode =
  `/**\n * Facade Re-export\n * 逻辑已拆分至 /${compDirName}\n */\n` +
  [...facadeExports].join('\n') + '\n';

fs.writeFileSync(inputFile, finalCode, 'utf-8');
const kb = (rawCode.length / 1024).toFixed(0);
console.log(`  ✅ ${P.basename(inputFile)}: ${kb}KB → ${finalCode.split('\n').length - 3} 行`);
