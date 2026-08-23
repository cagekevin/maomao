// i18n 单例 stub：Nomi 的 `import i18n from '.../i18n'; i18n.t(key, opts)`。
// 这里 t() 返回 key 本身（options 里替换 {xxx} 占位为传入值，尽量可读）。
const i18n = {
  t(key: string, options?: Record<string, unknown>): string {
    if (!options) return key;
    let out = key;
    for (const [name, value] of Object.entries(options)) {
      out = out.replace(new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, "g"), String(value));
    }
    return out;
  },
};

export default i18n;
