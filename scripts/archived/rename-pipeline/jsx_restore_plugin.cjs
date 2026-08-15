/**
 * babel 插件：把 rolldown 编译产物中的 JSX 运行时调用还原为真正的 JSX 语法。
 *   (0, X.jsx)(type, props, key?)        -> <type {...props} key={key} />
 *   (0, X.jsxs)(type, props, key?)       -> <type {...props} key={key} />
 *   (0, X.jsx)(X.Fragment, {children})   -> <X.Fragment>...</X.Fragment>
 * 注意 rolldown 把所有字符串字面量编译成反引号模板字符串(`div`)，本插件对此做了特判。
 * 纯语法等价转换，不改逻辑。仅用于「只读副本」临时还原（scripts 不进入构建）；
 * 构建源码始终使用 (0, X.jsx)(...) 形式。
 */
const t = require('@babel/types');

function templateToLiteral(node) {
  if (
    node &&
    node.type === 'TemplateLiteral' &&
    node.quasis.length === 1 &&
    node.expressions.length === 0
  ) {
    return t.stringLiteral(node.quasis[0].value.cooked);
  }
  return node;
}

function getJsxCallee(callee) {
  let c = callee;
  if (c.type === 'SequenceExpression') {
    c = c.expressions[c.expressions.length - 1];
  }
  if (c.type === 'MemberExpression' && !c.computed) {
    const prop = c.property;
    if (
      prop.type === 'Identifier' &&
      (prop.name === 'jsx' || prop.name === 'jsxs' || prop.name === 'jsxDEV')
    ) {
      return c;
    }
  }
  return null;
}

function exprToJSXName(node) {
  if (!node) return t.jsxIdentifier('__JSXNAME__');
  if (node.type === 'TemplateLiteral' && node.quasis.length === 1 && node.expressions.length === 0) {
    return t.jsxIdentifier(node.quasis[0].value.raw);
  }
  if (node.type === 'StringLiteral') return t.jsxIdentifier(node.value);
  if (node.type === 'Identifier') return t.jsxIdentifier(node.name);
  if (node.type === 'MemberExpression' && !node.computed) {
    return t.jsxMemberExpression(
      exprToJSXName(node.object),
      t.jsxIdentifier(node.property.name),
    );
  }
  return t.jsxIdentifier('__JSXNAME__');
}

function getChildren(propsArg) {
  if (propsArg && propsArg.type === 'ObjectExpression') {
    for (const prop of propsArg.properties) {
      if (prop.type === 'ObjectProperty') {
        const k = prop.key;
        const kn =
          k.type === 'Identifier'
            ? k.name
            : k.type === 'StringLiteral'
              ? k.value
              : null;
        if (kn === 'children') return prop.value;
      }
    }
  }
  return null;
}

function attrsFromProps(propsArg, extraKey) {
  const attributes = [];
  if (propsArg && propsArg.type === 'ObjectExpression') {
    for (const prop of propsArg.properties) {
      if (prop.type === 'SpreadElement') {
        attributes.push(t.jsxSpreadAttribute(prop.argument));
        continue;
      }
      if (prop.type !== 'ObjectProperty') continue;
      const key = prop.key;
      let name;
      if (key.type === 'Identifier') name = key.name;
      else if (key.type === 'StringLiteral') name = key.value;
      else continue;
      if (name === 'children') continue;
      const val = templateToLiteral(prop.value);
      if (val.type === 'StringLiteral') {
        attributes.push(t.jsxAttribute(t.jsxIdentifier(name), val));
      } else {
        attributes.push(
          t.jsxAttribute(t.jsxIdentifier(name), t.jsxExpressionContainer(val)),
        );
      }
    }
  }
  if (extraKey) {
    attributes.push(
      t.jsxAttribute(t.jsxIdentifier('key'), t.jsxExpressionContainer(extraKey)),
    );
  }
  return attributes;
}

function textNeedsExprContainer(v) {
  return /[{}<>&]/.test(v);
}
function buildChild(el) {
  if (el == null) return t.jsxExpressionContainer(t.nullLiteral());
  switch (el.type) {
    case 'StringLiteral':
      return textNeedsExprContainer(el.value)
        ? t.jsxExpressionContainer(t.stringLiteral(el.value))
        : t.jsxText(el.value);
    case 'TemplateLiteral':
      if (el.quasis.length === 1 && el.expressions.length === 0) {
        const v = el.quasis[0].value.cooked;
        return textNeedsExprContainer(v)
          ? t.jsxExpressionContainer(t.stringLiteral(v))
          : t.jsxText(v);
      }
      return t.jsxExpressionContainer(el);
    case 'JSXElement':
    case 'JSXFragment':
      return el;
    case 'BooleanLiteral':
    case 'NumericLiteral':
    case 'NullLiteral':
      return t.jsxExpressionContainer(el);
    default:
      return t.jsxExpressionContainer(el);
  }
}

function buildChildren(childrenExpr) {
  if (!childrenExpr) return [];
  if (childrenExpr.type === 'ArrayExpression') {
    return childrenExpr.elements.map((el) => buildChild(el));
  }
  return [buildChild(childrenExpr)];
}

function callToJSX(node) {
  const args = node.arguments;
  const typeArg = args[0];
  const propsArg = args[1];
  const keyArg = args[2];
  const name = exprToJSXName(typeArg);
  const attributes = attrsFromProps(propsArg, keyArg);
  const children = buildChildren(getChildren(propsArg));
  const selfClosing = children.length === 0;
  return t.jsxElement(
    t.jsxOpeningElement(name, attributes, selfClosing),
    selfClosing ? null : t.jsxClosingElement(name),
    children,
    selfClosing,
  );
}

module.exports = function jsxCallToJsx() {
  return {
    name: 'jsx-call-to-jsx',
    visitor: {
      TemplateLiteral(path) {
        const n = path.node;
        if (
          n.quasis.length === 1 &&
          n.expressions.length === 0 &&
          path.parent.type !== 'TaggedTemplateExpression'
        ) {
          path.replaceWith(t.stringLiteral(n.quasis[0].value.cooked));
        }
      },
      CallExpression(path) {
        if (!getJsxCallee(path.node.callee)) return;
        if (!path.node.arguments || path.node.arguments.length < 1) return;
        let replacement;
        try {
          replacement = callToJSX(path.node);
        } catch (e) {
          return;
        }
        path.replaceWith(replacement);
      },
    },
  };
};
