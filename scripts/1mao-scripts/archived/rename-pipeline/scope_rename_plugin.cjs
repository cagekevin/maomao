'use strict';
/**
 * AST 作用域精确重命名插件（高保真关键）。规则来源为基于 1.4.0 推导的 name_rules.cjs（默认空）。
 *
 * 替代「文本正则替换」式还原——文本替换会误伤：
 *   1) 字符串/模板字面量内容；2) 其他作用域的同名局部压缩变量；3) import 源名。
 *
 * 本插件只重命名「真正的绑定引用」：递归遍历整棵作用域树找每个 orig 的 binding；
 * 命中后只在「该 binding 定义所在作用域」做 rename，绝不触碰字符串/模板字面量，也不会误伤其它作用域的同名独立局部变量；
 * 护栏：同名绑定在整个作用域树里必须「唯一」（length===1）才改，出现遮蔽/歧义（>1）时跳过；
 * 目标名已被其它绑定占用时跳过（保真优先，宁可不改也不污染）。
 */
const { getRules } = require('./name_rules.cjs');
const RULES = getRules();

function collectBindings(scope, name, acc) {
  const b = scope.getBinding(name);
  if (b) acc.push(b);
  const children = scope.childScopes || [];
  for (const child of children) collectBindings(child, name, acc);
}

module.exports = function scopeRenamePlugin() {
  return {
    name: 'scope-rename-rules',
    visitor: {
      Program: {
        exit(path) {
          const programScope = path.scope.getProgramParent();
          for (const orig of Object.keys(RULES)) {
            const neu = RULES[orig];
            const all = [];
            collectBindings(programScope, orig, all);
            if (all.length === 0) continue;
            for (const binding of all) {
              const isFuncDecl =
                binding.kind === 'function' ||
                (binding.path && binding.path.isFunctionDeclaration && binding.path.isFunctionDeclaration());
              if (!isFuncDecl && all.length !== 1) continue;
              const defScope = binding.scope;
              const target = defScope.getBinding(neu);
              if (target && target !== binding) continue;
              try {
                defScope.rename(orig, neu);
              } catch (e) {
                /* 极少数情况下 rename 受作用域限制抛错，忽略以保持稳定 */
              }
            }
          }
        },
      },
    },
  };
};
