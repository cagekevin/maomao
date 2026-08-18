/**
 * 提示词社区库 — 数据源配置（promptSources）。
 *
 * 来源：搬运自 infinite-canvas 仓库的 prompt-source-presets.ts 的
 * DEFAULT_PROMPT_SOURCES（6 个第三方开源提示词 GitHub 仓库的 raw JSON）。
 * 这些仓库由各自作者维护，我们仅作聚合展示，引用时保留 githubUrl 来源标注。
 *
 * 每个源返回 JSON 数组，字段经 promptHubStore.normalizeItems 归一化。
 * 想增删源，直接改这里即可（UI 不依赖具体条数）。
 */

export const PROMPT_HUB_REGISTRY_BASE =
  'https://raw.githubusercontent.com/yukkcat/image-prompts/main/dist/sources'

/**
 * @typedef {Object} PromptHubSource
 * @property {string} id
 * @property {string} name      展示名
 * @property {string} url       raw JSON 地址
 * @property {string} homepage  GitHub 仓库主页（来源标注/跳转用）
 */

/** 内置源（搬运原版，禁止为空 url） */
export const DEFAULT_PROMPT_HUB_SOURCES = [
  { id: 'banana-prompt-quicker', name: 'Banana Prompt Quicker', url: `${PROMPT_HUB_REGISTRY_BASE}/banana-prompt-quicker.json`, homepage: 'https://glidea.github.io/banana-prompt-quicker/' },
  { id: 'davidwu-gpt-image2-prompts', name: 'DavidWu GPT Image 2', url: `${PROMPT_HUB_REGISTRY_BASE}/davidwu-gpt-image2-prompts.json`, homepage: 'https://github.com/davidwuw0811-boop/awesome-gpt-image2-prompts' },
  { id: 'awesome-gpt-image', name: 'Awesome GPT Image', url: `${PROMPT_HUB_REGISTRY_BASE}/awesome-gpt-image.json`, homepage: 'https://github.com/ZeroLu/awesome-gpt-image' },
  { id: 'awesome-gpt4o-image-prompts', name: 'Awesome GPT-4o', url: `${PROMPT_HUB_REGISTRY_BASE}/awesome-gpt4o-image-prompts.json`, homepage: 'https://github.com/ImgEdify/Awesome-GPT4o-Image-Prompts' },
  { id: 'youmind-gpt-image-2', name: 'YouMind GPT Image 2', url: `${PROMPT_HUB_REGISTRY_BASE}/youmind-gpt-image-2.json`, homepage: 'https://github.com/YouMind-OpenLab/awesome-gpt-image-2' },
  { id: 'youmind-nano-banana-pro', name: 'YouMind Nano Banana Pro', url: `${PROMPT_HUB_REGISTRY_BASE}/youmind-nano-banana-pro-prompts.json`, homepage: 'https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts' },
]

export function getPromptHubSources() {
  return DEFAULT_PROMPT_HUB_SOURCES
}
