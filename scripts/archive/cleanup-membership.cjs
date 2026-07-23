// 删除会员计划 · App.js 批量清理脚本
// 用法：node scripts/cleanup-membership.cjs
// 按 SOP §4.1 用 indexOf + substring 定位，兼容 Windows \r\n

const fs = require('fs');
const appPath = 'src/App.js';
let content = fs.readFileSync(appPath, 'utf8');

// ====== 1. 删除 Vg 登录弹窗函数 (function Vg({ ... })  ~ 结尾 }) ======
const vgStart = content.indexOf('\nfunction Vg({');
const vgEnd = content.indexOf('\nvar Ug = new class {', vgStart);
if (vgStart > 0 && vgEnd > 0) {
  content = content.slice(0, vgStart) + content.slice(vgEnd);
  console.log('[ok] 1. Vg 登录弹窗函数已删除');
}

// ====== 2. 删除登录弹窗 UI (false && Oe && X.jsx("div"...)) ======
const loginModalStart = content.indexOf(', false && Oe && X.jsx(`div`, {\n      className: `fixed inset-0 bg-black/70');
// 找结束: 下一个 }, ...) 模式 —— 找 X.jsx(g_, 的下一个 });
// 特征是 }, X.jsx(g_, {
const loginModalEnd = content.indexOf('\n    }), X.jsx(g_, {\n      open: Ae,');
if (loginModalStart > 0 && loginModalEnd > 0) {
  content = content.slice(0, loginModalStart) + content.slice(loginModalEnd);
  console.log('[ok] 2. 登录弹窗 UI 已删除');
}

// ====== 3. 删除 nr() 调用（全部在 false && 块内） ======
// nr 已从 urlTools 导出中删除，删掉调用防止 ReferenceError
const nrPatterns = [
  'href: nr(',
  'window.open(nr()',
  'window.open(nr(',
];
for (const pat of nrPatterns) {
  let idx = content.indexOf(pat);
  while (idx > 0) {
    // 向前找到所属的 X.jsx(... 开头
    let lineStart = content.lastIndexOf('\n', idx);
    let nextLineEnd = content.indexOf('\n', idx);
    let line = content.slice(lineStart, nextLineEnd);
    console.log('[ok] 3. nr() 调用行:', line.trim().slice(0, 80));
    // 把 nr(...) 替换为 ''（空字符串占位）
    content = content.replace(pat === 'href: nr(' ? /href:\s*nr\([^)]*\)/g : /window\.open\(nr\([^)]*\)[^)]*\)/g,
      pat.startsWith('href') ? 'href: `#`' : 'undefined');
    idx = content.indexOf(pat);
  }
}

// ====== 4. 删除 Jh/Zh/Xh/qh/Yh 函数块 ======
// Yh/Xh/Jh/Zh/qh 都在 L28285-L28310 区域
const jhStart = content.indexOf('\nvar qh = `$');
// 找到 Zh 函数结束后的下一行
const zhPattern = '\nasync function Zh(';
const zhIdx = content.indexOf(zhPattern);
if (zhIdx > 0) {
  // 找到 Zh 函数结束的 }（模块顶层）
  let searchFrom = zhIdx + zhPattern.length;
  let braceCount = 0;
  let zhEnd = searchFrom;
  for (let i = searchFrom; i < content.length; i++) {
    if (content[i] === '{') braceCount++;
    else if (content[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        zhEnd = i + 1;
        break;
      }
    }
  }
  // 从 qh 声明开始到 Zh 结束
  const qhIdx = content.indexOf('var qh =');
  if (qhIdx > 0 && zhEnd > 0) {
    // 删 qh/Jh/Yh/Xh/Zh 整个块，到 Zh 函数结束的下一行
    let deleteEnd = content.indexOf('\n', zhEnd);
    content = content.slice(0, qhIdx) + content.slice(deleteEnd);
    console.log('[ok] 4. Jh/Zh/Xh/qh/Yh 已删除');
  }
}

// ====== 5. 删除 expired membership gate (过期闸门) ======
const gateStart = content.indexOf('Q.getObject(Z.MEMBERSHIP).then(e => {');
if (gateStart > 0) {
  let braceCount = 0;
  let gateEnd = gateStart;
  for (let i = gateStart; i < content.length; i++) {
    if (content[i] === '(' || content[i] === '{') braceCount++;
    else if (content[i] === ')') {
      braceCount--;
      if (braceCount === 0) {
        gateEnd = i + 1;
        break;
      }
    }
  }
  // 从 .then 开头到结束
  content = content.slice(0, gateStart) + content.slice(gateEnd);
  console.log('[ok] 5. 过期闸门已删除');
}

// ====== 6. 删除 ys() VIP 判定函数 ======
const ysStart = content.indexOf('\nfunction ys(e) {\n  return e === `VIP` || e === `SVIP` || e === `UNLIMITED`;\n}');
if (ysStart > 0) {
  const ysEnd = content.indexOf('\n', ysStart + 1);
  // 找函数结束的 }
  let searchEnd = ysStart;
  let brace = 0;
  for (let i = ysStart; i < content.length; i++) {
    if (content[i] === '{') brace++;
    else if (content[i] === '}') {
      brace--;
      if (brace === 0) { searchEnd = i + 1; break; }
    }
  }
  let deleteTo = content.indexOf('\n', searchEnd);
  content = content.slice(0, ysStart) + content.slice(deleteTo);
  console.log('[ok] 6. ys() VIP 判定已删除');
}

// ====== 7. 处理 Zh 调用者 L33998 ======
// Zh 已被删除，其调用者 return await Zh(n, i, {folder: 'templates'}) 需要替换
const zhCall = 'return await Zh(n, i, {\n            folder: `templates`\n          })';
let zhCallIdx = content.indexOf(zhCall);
if (zhCallIdx > 0) {
  content = content.replace(zhCall, 'return null; // 本地模式：模板资源上传已移除');
  console.log('[ok] 7. Zh 调用者已替换');
}

// ====== 8. 删除 GAS push/pull 中的 membership/users 键 ======
// push 键集合
let pushKeys = content.indexOf('`users`, `membership`');
if (pushKeys > 0) {
  // 检查上下文，确认是 syncToCloud/push 中的
  let ctx = content.slice(pushKeys - 50, pushKeys + 30);
  if (ctx.includes('push') || ctx.includes('syncToCloud')) {
    content = content.replace('`users`, `membership`, ', '');
    console.log('[ok] 8. GAS push 中 users/membership 已移除');
  }
}

// pull 键集合
let pullKeys = content.indexOf('`users`, `membership`, `old_membership`');
if (pullKeys > 0) {
  content = content.replace('`users`, `membership`, `old_membership`, ', '');
  console.log('[ok] 8. GAS pull 中 users/membership/old_membership 已移除');
}

// 老格式导入 membership 分支
let oldImport = content.indexOf('t.membership && (a[Z.MEMBERSHIP] = t.membership)');
if (oldImport > 0) {
  // 找到这一行的完整内容
  let lineStart = content.lastIndexOf('\n', oldImport);
  let lineEnd = content.indexOf('\n', oldImport);
  // 可能需要去掉前面的逗号和空格
  let fullLine = content.slice(lineStart, lineEnd);
  // 替换为移除该子句
  content = content.replace('t.membership && (a[Z.MEMBERSHIP] = t.membership), ', '');
  console.log('[ok] 8. 老格式 membership 导入分支已移除');
}

// ====== 9. 本地 Tool 同步键去除 MEMBERSHIP/OLD_MEMBERSHIP ======
// 在 storage/index.js 中
const storageIndexPath = 'src/utils/storage/index.js';
let storageContent = fs.readFileSync(storageIndexPath, 'utf8');
storageContent = storageContent.replace(', Z.MEMBERSHIP, Z.OLD_MEMBERSHIP', '');
fs.writeFileSync(storageIndexPath, storageContent);
console.log('[ok] 9. 本地 Tool 同步中 MEMBERSHIP/OLD_MEMBERSHIP 已移除');

// ====== 10. 删除 storageKeys.js 中在线相关键 ======
const storageKeysPath = 'src/config/storageKeys.js';
let keysContent = fs.readFileSync(storageKeysPath, 'utf8');
// 只删除 MEMBERSHIP/OLD_MEMBERSHIP/AUTH_TOKEN/CURRENT_USER_ID，保留 USERS
keysContent = keysContent.replace(/^\s*MEMBERSHIP:.*\n?/m, '');
keysContent = keysContent.replace(/^\s*OLD_MEMBERSHIP:.*\n?/m, '');
keysContent = keysContent.replace(/^\s*AUTH_TOKEN:.*\n?/m, '');
keysContent = keysContent.replace(/^\s*CURRENT_USER_ID:.*\n?/m, '');
fs.writeFileSync(storageKeysPath, keysContent);
console.log('[ok] 10. storageKeys 中在线键已移除（保留 USERS）');

// ====== 11. 删除 constants.js 中 Ca ======
const constantsPath = 'src/config/constants.js';
let constantsContent = fs.readFileSync(constantsPath, 'utf8');
constantsContent = constantsContent.replace(/^var Ca = `auth_token`;\n?/m, '');
fs.writeFileSync(constantsPath, constantsContent);
console.log('[ok] 11. constants.js Ca 已移除');

// ====== 12. 删除 config.js 中 AUTH_TOKEN_KEY ======
const configPath = 'src/config.js';
let configContent = fs.readFileSync(configPath, 'utf8');
configContent = configContent.replace(/^export const AUTH_TOKEN_KEY = 'auth_token';\n?/m, '');
fs.writeFileSync(configPath, configContent);
console.log('[ok] 12. config.js AUTH_TOKEN_KEY 已移除');

// ====== 保存 ======
fs.writeFileSync(appPath, content);
console.log('\n=== 批量清理完成 ===');
console.log('请执行: npm run build 验证');
