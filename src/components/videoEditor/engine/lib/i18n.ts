type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

const _t: TranslateFn = (key) => key;

export const i18next = {
  t(key: string, options?: Record<string, unknown>): string {
    return _t(key, options);
  },
};
