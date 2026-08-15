// 逆向辅助：从「1.4.0 命名规则表」自动生成「压缩名 -> 语义名」规则。
//
// 【1.4.0 红线】任务书明确：根目录三本字典（func/var/vendor-mapping.txt）建自另一构建
// （工作区 maomao 改造版 + 1.3.5 样本），与 1.4.0 发售样本并非同一构建，压缩名已变，
// 且含已知错条（如 Zr=logout 实为真身 uploadFileByUrl）。严禁直接复用。
//
// 因此：本文件当前对 1.4.0 返回【空规则】（getRules() = {}），apply_rename 退化为安全空跑。
// 要真正给 1.4.0 做语义重命名，必须基于 1.4.0 样本重新推导规则后写入 name_rules_140.json。

const fs = require('fs');
const path = require('path');

const RULES_FILE = path.join(__dirname, 'name_rules_140.json');

const RESERVED = new Set([
  'true', 'false', 'null', 'undefined', 'this', 'var', 'let', 'const', 'function',
  'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break',
  'continue', 'new', 'class', 'extends', 'super', 'import', 'export', 'from', 'typeof',
  'instanceof', 'in', 'of', 'void', 'delete', 'throw', 'try', 'catch', 'finally', 'yield',
  'await', 'async', 'static', 'get', 'set',
]);

function sanitizeName(s) {
  let v = String(s).replace(/::/g, '_').replace(/[^A-Za-z0-9_$]/g, '');
  if (!v) return null;
  if (!/^[A-Za-z_$]/.test(v)) v = '_' + v;
  if (RESERVED.has(v)) return null;
  return v;
}

let _cache = null;
function getRules() {
  if (_cache) return _cache;
  const merged = {};
  if (fs.existsSync(RULES_FILE)) {
    try {
      const arr = JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'));
      for (const { from, to } of arr) {
        const target = sanitizeName(to);
        if (target && !RESERVED.has(target) && !merged[from]) merged[from] = target;
      }
      console.log(`[name_rules] 已从 ${path.basename(RULES_FILE)} 载入 ${Object.keys(merged).length} 条 1.4.0 规则`);
    } catch (e) {
      console.warn('[name_rules] 规则表解析失败，返回空规则：', e.message);
    }
  } else {
    console.log('[name_rules] 未找到 1.4.0 专属规则表（name_rules_140.json），返回空规则（安全空跑）。');
  }
  _cache = merged;
  return merged;
}

module.exports = { getRules };
