/**
 * 伪迹清理：webcrack 在某些情况下会把方法调用 / 构造方法替换成对应原生函数的
 * `.toString()` 文本，即 `function <NAME>() { [native code] }`，并作为「真实代码」插入：
 *   - 属性访问 / 方法调用：  x.function toString() { [native code] }()   ->  x.toString()
 *   - 构造方法 / 方法定义：  function Object() { [native code] }(e17) {}  ->  constructor(e17) {}
 *   - 普通方法：            function toString() { [native code] }(16)     ->  toString(16)
 *
 * 这是一类通用伪迹（NAME 可为 Object / toString / 任意方法名），会破坏语法
 * （成员访问后不允许出现 function 声明；class 体内不允许 function 声明）。
 *
 * 规则：
 *   1) 属性访问/方法调用：  .function NAME() { [native code] }  ->  .NAME
 *        - NAME === 'Object'  ->  '.constructor'
 *   2) 构造方法/方法定义调用形式：  function NAME() { [native code] }(  ->  NAME(
 *        - NAME === 'Object'  ->  'constructor('
 *
 * 仅在代码位置生效（不触碰字符串字面量内容）。
 *
 * 用法：node 00_sanitize.cjs <目标.js>
 */
const fs = require('fs');

const file = process.argv[2];
if (!file) {
  console.error('用法: node 00_sanitize.cjs <目标.js>');
  process.exit(1);
}

const code0 = fs.readFileSync(file, 'utf8');
const artifactRe = /function\s+[A-Za-z_$][\w$]*\(\)\s*\{\s*\[native code\]\s*\}/g;
const before = (code0.match(artifactRe) || []).length;
if (before === 0) {
  // 无伪迹，直接跳过（避免无意义写入）
  return;
}

let code = code0;
// 1) 属性访问 / 方法调用： .function NAME() { [native code] }  ->  .NAME
code = code
  .replace(/\.function\s+Object\(\)\s*\{\s*\[native code\]\s*\}/g, '.constructor')
  .replace(/\.function\s+([A-Za-z_$][\w$]*)\(\)\s*\{\s*\[native code\]\s*\}/g, '.$1');
// 2) 构造方法 / 方法定义调用形式： function NAME() { [native code] }(  ->  NAME(
code = code
  .replace(/function\s+Object\(\)\s*\{\s*\[native code\]\s*\}\s*\(/g, 'constructor(')
  .replace(/function\s+([A-Za-z_$][\w$]*)\(\)\s*\{\s*\[native code\]\s*\}\s*\(/g, '$1(');

fs.writeFileSync(file, code, 'utf8');
console.log(`  🧹 清理 webcrack 伪迹 function X(){[native code]}: ${before} 处 → ${file}`);
