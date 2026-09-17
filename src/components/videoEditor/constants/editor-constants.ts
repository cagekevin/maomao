// DEV 判定真源收口到 base/core/config（遵循 config.ts「import.meta.env 集中读取」契约，消除第二份字面量定义）。
export { IS_DEV } from '../../base/core/config';

export const PANEL_CONFIG = {
  panels: {
    tools: 25,
    preview: 50,
    properties: 25,
    mainContent: 50,
    timeline: 50,
    agent: 20,
  },
};
