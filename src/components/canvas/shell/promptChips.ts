/**
 * promptChips —— prompt 富文本的「芯片」转换层（无 React，但**依赖 DOM**：`document.createElement` /
 * `Node.ELEMENT_NODE`；可单测，测试环境需 jsdom）。
 *
 * 【口径更正 2026-09-13 / TD-05-5】原文件头自称「纯逻辑层（无 DOM 环境依赖）」，与实现不符——
 * 本文件实为 **DOM 工具层**（芯片 ↔ DOM 节点）。文档诚实化，防后续误在无 DOM 环境（如 SSR/Node）引用本模块。
 * 真正的纯函数是其中的匹配/解析部分（`findAutoLinkOccurrences`/`resolvePromptChips` 等）。
 *
 * 职责：把 prompt 里的 `@{id:label}` 素材引用与 DOM 芯片互转，以及生成前把芯片解析回
 * 「纯文本 + 参考图」。是唯一入口，禁止在别处手写 /@\{/ 正则或就地解析。
 *
 * 序列化约定（与参考仓库 AI-Canvas-tauri 一致）：
 *   芯片 → 字符串：`@{id:label}`
 *   字符串 → 芯片：用 `promptChipRe()` 解析（工厂返回新实例，避免 /g 的 lastIndex 共享状态）
 *   旧数据（无 `@{...}` 格式的纯文本 `@素材名`）→ 解析不到 → 原样显示为文字，向后兼容不崩。
 *
 * 数据模型（token 统一形态，来自 refImages / refTexts）：
 *   { id, label, url?, kind: 'image' | 'text', sourceNodeId? }
 *
 * 注意：本文件只做纯转换，不做文件系统/网络访问；缩略图 URL 一律由调用方经 token.url 提供。
 *
 * 更新(2026-09-07，docs/PromptInput-@名自动转缩略图 §8.5)：
 *  - autoLinkAssetsByName 重构为复用 findAutoLinkOccurrences（最长优先、非重叠），
 *    使「批量全量重建」与「运行期就地提交」共用同一匹配源，根治两套规则分叉；
 *  - 新增 extendable（@名 是否可扩展为更长素材名）、isTerminatedByBreak（BREAK 集
 *    单一真源在 promptMention.ts）、commitOccurrencesInRun（就地 DOM 手术转换）。
 *
 * 更新(2026-11-01，docs/plan/151 §4 第 0 步 · 修已存在的「静默丢图」bug)：
 *  - 现象：`data.prompt` 持久化的芯片是 `@{id:label|thumb}`。id 与当前 refImages 对不上时
 *    （上游断线重连 / data.images 被 Agent 重写 / 剧本盒重新派发），`renderPromptToNodes` 有
 *    match[3] thumb 兜底 ⇒ **界面芯片照常显示缩略图**；而 `resolvePromptChips` 的回调签名只有
 *    `(_match, id, label)`，把 group3 整个丢弃 ⇒ 发送时该参考图被静默丢弃、零提示。
 *  - 修法：回调收第 4 参 `thumb`，id 查不到时按 thumb 兜底，仍产出 `[img=图片N]` 并进 resolvedRefImages；
 *    兜底键走 `imageKeyOf`（**唯一实现在 `base/utils/media/imageIdentity.ts`**；第 0 步此处曾是
 *    局部等价实现，第 1 步已按计划删除并改为 import），保证「同一失配芯片多次出现仍算同一张」。
 *  - ★安全校验：thumb **不能直接当发送 url** —— 一律过 `normalizeImageUrlForSendSync`
 *    （`base/utils/media/assetUrl.ts`，与异步出口共用同一份「缩略图端点」判据）：端点还原为原图，
 *    不可还原则**丢弃该图**，绝不静默发坏图。禁 `decodeThumb(thumb)` 直接塞进发送数组。
 *  - 兜底命中时打 `logger.debug('promptChips', …)`（默认安静，不新增 console）。
 */

import { BREAK } from './promptMention.ts';
import { logger } from '@/components/base/core/log/logger';
// 发送侧同步守卫：thumb 兜底拿到的 URL 必须先过它（缩略图端点 → 原图 / 不可还原即丢弃）。
// 同一份「是不是缩略图端点」判据与异步出口 normalizeAssetUrlForSend 共用（见 assetUrl.ts 文件头 2026-11-01）。
import { normalizeImageUrlForSendSync } from '@/components/base/utils/media/assetUrl';
// 身份键（R2/R3）：唯一实现在 imageIdentity.ts。第 0 步此处曾有一份**局部等价实现**（临时占位），
// 第 1 步按计划删掉并改为 import —— 不留第二份身份规则（CLAUDE.md §5.4(9) 单一规则原则）。
import { imageKeyOf } from '@/components/base/utils/media/imageIdentity';

/**
 * ★ TD-22-68 断环（2026-09-20）：`promptChipRe` 的真源已下沉到零依赖的
 * `./promptChipFormat.ts`（格式契约），本文件**从它取用**（内部 exec/replace 两处）。
 * 为什么搬：本文件是 **DOM 工具层**，而纯逻辑的 `creative/creativePresets.ts` 也要这个正则
 * ⇒ 会把「纯逻辑依赖 DOM 工具层」的倒置拖进 `hooks/useNodeData` 的整条链。
 * 详见 `promptChipFormat.ts` 文件头的取证。
 *
 * 【不在此转发】原 `export { promptChipRe }` 已撤：域外消费者（`creativePresets`）改直连叶子，
 * 经本文件转发即无人消费的冗余出口（死代码闸会如实报）。
 */
import { buildChipText, decodeChipThumb, promptChipRe } from './promptChipFormat.ts';

/** 芯片 token 的素材元信息（renderPromptToNodes 的 metaMap 值形态；导出供调用方标注 Map 泛型） */
export interface ChipMeta {
  kind?: string | undefined;
  url?: string | undefined;
  label?: string | undefined;
}

/** 零宽空格：芯片前后光标落点占位 */
export const ZWSP: string = '\u200B';

/**
 * 缩略图字符串片段 → URL 解码。
 * 更新(2026-11-01 · docs/plan/151 §7-1)：实现已下沉到格式契约 `promptChipFormat.decodeChipThumb`
 * （与编码侧 `buildChipText/encodeThumb` 成对同住）—— 此前本文件持有一份**同语义副本**，
 * 而 `rewriteChipIds` 也需要解码 ⇒ 两份必然漂移（实测已漂出二次编码 bug）。现只留一处。
 */
const decodeThumb = decodeChipThumb;

/**
 * 判断节点是否为「芯片元素」（携带 data-ref-id 的 span）。
 * @param {Node|null} node
 * @returns {boolean}
 */
export function isChipEl(node: Node | null): boolean {
  return (
    !!node && node.nodeType === Node.ELEMENT_NODE && (node as Element).hasAttribute('data-ref-id')
  );
}

/**
 * 判断节点是否为 <br> 元素。
 * @param {Node|null} node
 * @returns {boolean}
 */
export function isBrEl(node: Node | null): boolean {
  return !!node && node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'BR';
}

/**
 * 确保芯片前有光标落点（零宽空格）：
 *   - 前一个兄弟为空 / <br> / 另一个芯片 → 插一个 ZWSP 文本节点；
 *   - 前一个兄弟是空文本 → 填 ZWSP；
 *   - 否则（已有文本内容）不处理。
 * 这样光标才能停在芯片前面（行首芯片、以及 @{a}{b} 相邻芯片之间都能落点）。
 * @param {Node} chip 芯片元素
 */
export function ensureCaretSlotBeforeChip(chip: Node): void {
  const previous = chip.previousSibling;
  if (!previous || isBrEl(previous) || isChipEl(previous)) {
    chip.parentNode?.insertBefore(document.createTextNode(ZWSP), chip);
  } else if (previous.nodeType === Node.TEXT_NODE && !previous.textContent) {
    previous.textContent = ZWSP;
  }
}

/**
 * 遍历根下所有芯片，补齐每个芯片前的光标落点（删字/换行后调用，防止行首芯片无法聚焦）。
 * @param {HTMLElement} root
 */
export function normalizeChipSlots(root: HTMLElement): void {
  const chips = root.querySelectorAll('[data-ref-id]');
  for (const chip of Array.from(chips)) ensureCaretSlotBeforeChip(chip);
}

/**
 * 序列化：把 contentEditable 根 DOM 转回 `@{id:label}` 字符串。
 *   - 文本节点 → 原文；<br> → '\n'；芯片元素 → `@{id:label}`；其余递归子节点。
 *   - 剔除 ZWSP，剥掉尾部换行。
 * @param {HTMLElement} root
 * @returns {string}
 */
export function serializeDOM(root: HTMLElement): string {
  let result = '';
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent || '';
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    if (el.hasAttribute('data-ref-id')) {
      const id = el.getAttribute('data-ref-id');
      const label = el.getAttribute('data-ref-label') || '';
      const thumb = el.getAttribute('data-ref-thumb');
      // 缩略图 URL 编码进字符串，刷新/重建后可自恢复；无 thumb 时回落旧格式（向后兼容）
      result += buildChipText(id ?? '', label, thumb ?? undefined);
      return;
    }
    if (el.tagName === 'BR') {
      result += '\n';
      return;
    }
    for (const child of Array.from(node.childNodes)) walk(child);
  };
  for (const child of Array.from(root.childNodes)) walk(child);
  return result.split(ZWSP).join('').replace(/\n+$/, '');
}

/**
 * 建芯片元素（contentEditable=false 的 span）。
 *   - kind='image' 且有缩略图 → 显示缩略图；否则显示 `@` 图标 + 标签。
 *   - 存 data-ref-id / data-ref-label / data-ref-thumb，供 serializeDOM / 删除 / 光标处理识别。
 *     data-ref-thumb 携带缩略图 URL，根治「刷新/重建后缩略图变兜底」（字符串自带，不依赖外部素材列表）。
 * @param {string} id    素材唯一 id
 * @param {string} label 芯片显示名
 * @param {string} kind  'image' | 'text'
 * @param {string} [thumbnailUrl] 图片缩略图 URL（仅 kind='image' 时用）
 * @returns {HTMLSpanElement}
 */
export function buildChipEl(
  id: string,
  label: string,
  kind: 'image' | 'text' = 'text',
  thumbnailUrl?: string,
): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'prompt-chip';
  span.contentEditable = 'false';
  span.setAttribute('data-ref-id', id);
  span.setAttribute('data-ref-label', label);
  if (thumbnailUrl) span.setAttribute('data-ref-thumb', thumbnailUrl);
  span.title = label;

  const icon = document.createElement('span');
  icon.className = 'prompt-chip-icon';
  icon.setAttribute('aria-hidden', 'true');
  if (kind === 'image' && thumbnailUrl) {
    icon.classList.add('has-thumbnail');
    const img = document.createElement('img');
    img.src = thumbnailUrl;
    img.className = 'prompt-chip-thumb';
    img.alt = '';
    icon.appendChild(img);
  } else {
    icon.textContent = kind === 'image' ? '🖼' : '@';
  }
  span.appendChild(icon);

  const labelEl = document.createElement('span');
  labelEl.className = 'prompt-chip-label';
  labelEl.textContent = label.length > 16 ? `${label.slice(0, 14)}…` : label;
  span.appendChild(labelEl);
  return span;
}

/**
 * 反序列化：把 `@{id:label}` 文本渲染成 Node[]（文本 + 芯片 + <br>）。
 *   - `\n` 拆成 <br>；`@{...}` 解析为芯片（有 metaMap 缩略图则显示缩略图，kind='image'）；
 *   - 芯片之间用 ZWSP 分隔保证光标可聚焦。
 *   - label 以 metaMap 为准（改名后字符串里是旧名，metaMap 是当前最新名）。
 * @param {string} text
 * @param {Map<string,{kind:string,url?:string,label?:string}>} metaMap id → {kind,url,label}（查缩略图/类型/最新名）
 * @returns {Node[]}
 */
export function renderPromptToNodes(text: string, metaMap?: Map<string, ChipMeta> | null): Node[] {
  const nodes: Node[] = [];
  const pushChip = (chip: Node): void => {
    const previous = nodes[nodes.length - 1];
    if (!previous || isBrEl(previous) || isChipEl(previous))
      nodes.push(document.createTextNode(ZWSP));
    nodes.push(chip);
  };
  const pushTextWithBreaks = (text: string): void => {
    if (!text) return;
    text.split('\n').forEach((line: string, index: number) => {
      if (index > 0) nodes.push(document.createElement('br'));
      if (line) nodes.push(document.createTextNode(line));
    });
  };

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = promptChipRe(); // TD-05-5：本次调用独占实例，无 lastIndex 共享
  while ((match = re.exec(text)) !== null) {
    pushTextWithBreaks(text.slice(lastIndex, match.index));
    const id = match[1];
    if (id === undefined) {
      lastIndex = re.lastIndex; // 正则第 1 组缺失（不可达）：推进游标防死循环
      continue;
    }
    const meta = metaMap ? metaMap.get(id) : undefined;
    // label：优先 metaMap 的当前名（上游改名后字符串里是旧名，metaMap 是新的）
    const label = (meta && meta.label && String(meta.label).trim()) || match[2] || '';
    // kind：字符串自带缩略图 → 必为图片；否则以 metaMap 为准，再回落文本
    const url = match[3] ? decodeThumb(match[3]) : meta?.url || '';
    const kind: 'image' | 'text' = url ? 'image' : meta?.kind === 'image' ? 'image' : 'text';
    pushChip(buildChipEl(id, label, kind, url));
    lastIndex = re.lastIndex;
  }
  pushTextWithBreaks(text.slice(lastIndex));
  return nodes;
}

/**
 * 生成前解析：把 prompt 里的 `@{id:label}` 芯片解析为「纯文本 + 参考图」。
 *   - 图片素材芯片 → 其 url 加入 refImages 参考图列表（同一图去重），位置替换为显式垫图引用
 *     `[img=图片N]`（seedance 富文本垫图语法，避免裸词「图片N」被模型当成画面描述词汇而忽略垫图）；
 *   - **id 失配但字符串自带 thumb** → 按 thumb 兜底仍产出参考图（2026-11-01 · docs/plan/151 第 0 步）：
 *     thumb 先过 `normalizeImageUrlForSendSync`（缩略图端点 → 原图；不可还原 → **丢弃该图**，不发坏图），
 *     兜底键 `imageKeyOf({ id, url: thumbUrl })` 保证同一失配芯片多次出现仍算同一张，并打一条 debug 日志；
 *   - 文本素材芯片 → 替换为其 label（作为纯文本随 prompt 发出）；
 *   - 创作库预设芯片（id 以 `cp_` 开头，第 4 参 `presets` 提供）→ 命中则替换为该条 `prompt`
 *     片段（**原文照搬，不 trim / 不压换行 / 不剥标签头**，§一.4）；未命中 → 置空但留可见标记
 *     `⚠缺失预设「名称」` 并打红日志（I2，诚实结果契约，禁静默吞）；
 *   - 其它找不到对应素材 → 替换为空（不产生垃圾字符）。
 * @param {string} rawPrompt 含 `@{id:label}` 的原始 prompt
 * @param {Array<{id?:string,url?:string}>} refImages 可用图片素材（按 id 查 url；id/url 缺省的项忽略）
 * @param {Array<{id?:string,label?:string}>} refTexts 可用文本素材（按 id 查 label；id/label 缺省的项忽略）
 * @param {Record<string,{prompt?:string}>} [presets] 创作库预设字典 `cp_<kind>-<n>` → {prompt}。
 *   缺省 = 行为与今天完全一致（三参调用向后兼容，I3）。仅当传入时才启用 `cp_` 分支。
 * @returns {{ text: string, refImages: Array<{id:string,url:string}> }}
 */
export function resolvePromptChips(
  rawPrompt: string,
  refImages: Array<{ id?: string; url?: string }> = [],
  refTexts: Array<{ id?: string; label?: string }> = [],
  presets?: Record<string, { prompt?: string }>,
  order?: readonly string[] | null,
): { text: string; refImages: Array<{ id: string; url: string }> } {
  const imgById = new Map<string, string>();
  for (const im of refImages) if (im && im.id && im.url) imgById.set(im.id, im.url);
  const textById = new Map<string, string>();
  for (const t of refTexts) if (t && t.id && t.label) textById.set(t.id, t.label);

  /**
   * 「图片 N」编号的唯一来源（docs/plan/151 §8.3 3-6 / §11.2 的 C 点）。
   *
   * 【旧口径（已废）】N = 芯片在 prompt 里**首次出现顺序**（`imageKeyToIndex.size + 1`）——
   * 于是"只 @ 第 2 张"时 C 编成「图片1」，而缩略图（A）与 @弹层（B）显示「图片2」⇒ 模型与用户
   * 指的不是同一张（既存不一致）。
   *
   * 【新口径（2026-11-01 用户裁定 §8.1）】传入 `order`（重排后的身份键数组）时，
   * **N = 该图在重排后数组里的下标 + 1** ⇒ 与缩略图条、@弹层、发送数组三处同源。
   * 未传 `order`（TemplateNode 等旧调用点）⇒ 回落旧口径，**四参调用逐字节不变**（I3 兼容）。
   */
  const orderIndexByKey = new Map<string, number>();
  if (Array.isArray(order)) {
    order.forEach((key, i) => {
      if (key && !orderIndexByKey.has(key)) orderIndexByKey.set(key, i + 1);
    });
  }
  /** 取某图的「图片 N」：优先顺序表位次，否则回落旧口径（首次出现序） */
  const indexOf = (key: string): number => {
    const fromOrder = orderIndexByKey.get(key);
    if (fromOrder !== undefined) return fromOrder;
    let idx = imageKeyToIndex.get(key);
    if (idx === undefined) {
      idx = imageKeyToIndex.size + 1;
      imageKeyToIndex.set(key, idx);
    }
    return idx;
  };

  const imageKeyToIndex = new Map<string, number>(); // 图引用去重（旧口径位次）：身份键 → [img=图片N]
  const resolvedRefImages: Array<{ id: string; url: string }> = [];

  const text = String(rawPrompt || '').replace(
    promptChipRe(), // TD-05-5：replace 传新实例（replace 内部会用完重置，但独占更稳）
    (_match: string, id: string, label: string, thumb?: string) => {
      const imgUrl = imgById.get(id);
      if (imgUrl) {
        const key = imageKeyOf({ id, url: imgUrl });
        const idx = indexOf(key);
        if (!resolvedRefImages.some((r) => r.id === id))
          resolvedRefImages.push({ id, url: imgUrl });
        // seedance 富文本垫图语法：显式 `[img=图片N]` 声明垫图引用，而非裸词「图片1」，
        // 避免模型把「图片1」当成画面描述词汇而忽略垫图 / 凭空重画。
        return `[img=图片${idx}]`;
      }
      // ── id 失配兜底（docs/plan/151 §4.2 0-2/0-3）：字符串自带 thumb ⇒ 仍按参考图发送 ──
      // 为什么必须先过发送守卫：thumb 可能是 render 侧缩略图端点（/api/files/thumbnail?...），
      // 直接塞进发送数组 = 发小图/404。守卫还原原图；不可还原（无 url 参数）返回 '' ⇒ 丢弃该图。
      // 禁：decodeThumb(thumb) 直接当发送 url（那正是 0-3 要防的坏图）。
      const thumbUrl = thumb ? normalizeImageUrlForSendSync(decodeThumb(thumb)) : '';
      if (thumbUrl) {
        const key = imageKeyOf({ id, url: thumbUrl });
        const idx = indexOf(key);
        // id 保留芯片里的 id（它就是这条数据的身份），url 用校验过的原图地址。
        if (!resolvedRefImages.some((r) => r.id === id))
          resolvedRefImages.push({ id, url: thumbUrl });
        // 默认安静的排查线索：界面看着正常、发送少一张时，开 debug 位即可看到是哪条芯片失配。
        logger.debug('promptChips', '芯片 id 失配，按 thumb 兜底', { id, label });
        return `[img=图片${idx}]`;
      }
      const textLabel = textById.get(id);
      if (textLabel) return textLabel;
      // 创作库预设分支（I2）：id 以 cp_ 开头且传入 presets 才启用；缺省时本分支不触，保持三参逐字节兼容。
      if (presets && id.startsWith('cp_')) {
        const preset = presets[id];
        // 命中 → 原文照搬 prompt 片段（位置即语义，不 trim / 不压换行 / 不剥标签头）。
        if (preset && typeof preset.prompt === 'string' && preset.prompt.length > 0) {
          return preset.prompt;
        }
        // 未命中 → 置空但留可见标记（⚠ + 缺失预设名）+ 红日志（禁静默吞用户可见内容）。
        logger.error('创作库', '预设未命中置空', { id, label });
        return `⚠缺失预设「${label || id}」`;
      }
      return '';
    },
  );

  return { text: text.trim(), refImages: resolvedRefImages };
}

/**
 * 参考图合并去重（**唯一实现**，TD-01-14）—— 「显式 @ 芯片图 + 上游连线图」→ 最终发送的 URL 列表。
 *
 * 【为什么要有它】四个生成节点（ImageGenerate / VideoGenerate / TextGenerate / TemplateNode）
 * 此前各写一份同语义代码：
 *   `const chipUrls = chipResolved.refImages.map(im => im.url)`
 *   `const upstreamUrls = <上游>.map(im => im.url)`
 *   `const refUrls = [...new Set([...chipUrls, ...upstreamUrls])].filter((u): u is string => !!u)`
 * **且已漂移**：TemplateNode/VideoGenerate 写 `!!u`，ImageGenerate/TextGenerate 写 `u != null`
 * （`u != null` 会放行空串 `''`，`!!u` 不会 → 同一份"参考图"判定，两种口径）。
 *
 * 【顺序语义 · 2026-11-01 用户裁定，见 docs/plan/151 §8.1 —— **已推翻原「芯片图在前」契约**】
 * 原写「**芯片图在前、上游图在后**，芯片顺序对应 prompt 里的「图片N」编号」。该契约有两个问题：
 *  ① 它让**发送数组序**与**缩略图条序**天然不同（只 @ 第 2 张时发送数组 = `[B, A]`，缩略图第 1 个是 A
 *     ⇒ 模型看到的 `[img=图片1]` 是 B，用户以为的「图片1」是 A，**既存错位**，与拖拽无关）；
 *  ② 它把"用户点 @ 的顺序"当编号真源，而用户真正能操作的顺序是**缩略图条**（拖拽换序）。
 * 现语义：**发送数组由调用方按 `data.imageOrder`（已重排的 refImages）构造**，`[img=图片N]` 的 N =
 * 该数组下标 ⇒ 缩略图序 / @弹层编号 / 发送数组序**三处同源**。
 * ⚠️ 本函数仍保留 `chipImages` 在前、`upstreamImages` 在后的**参数语义**（它是纯去重工具，不该知道
 * 谁在前）；"发送数组怎么排"已上移到调用方 —— ImageGenerate 现在只传一个参数（§8.1 分两批提交：
 * 先只改 ImageGenerate，其余 3 节点保持旧行为观察一轮）。
 *
 * 【依赖说明】本函数**不 import 任何东西**（保持 promptChips 的可单测纯函数面）；
 * `resolvePromptChips` 的 refImages 已保证 `url: string` 非空（`if (im && im.id && im.url)`），
 * 故此处只需处理上游侧与并集去重。
 *
 * @param {{ url?: unknown }[]} chipImages 第一组参考图（顺序敏感 —— 调用方通常直接传**已重排的 refImages**）
 * @param {{ url?: unknown }[]} upstreamImages 第二组参考图（顺序次之；ImageGenerate 已改为不传）
 * @returns {string[]} 去重后的非空 URL 列表（按入参出现顺序，首个重复保留）
 */
export function mergeReferenceImageUrls(
  chipImages: Array<{ url?: unknown }> = [],
  upstreamImages: Array<{ url?: unknown }> = [],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const im of [...chipImages, ...upstreamImages]) {
    const url = im?.url;
    // 判据统一为「非空字符串」：空串/非串/缺省一律丢弃（治旧 `u != null` 放行空串的漂移口径）
    if (typeof url !== 'string' || url === '') continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/**
 * 名字匹配统一命中源：找出 text 里所有「@素材名」命中（最长优先、非重叠）。
 * autoLinkAssetsByName（批量全量重建）与 commitOccurrencesInRun（运行期就地提交）
 * 共用本函数，根治两套匹配规则分叉（docs/PromptInput-@名自动转缩略图 §8.5-1）。
 *
 * 规则与 autoLinkAssetsByName 完全一致：
 *  - 只做全等匹配（候选素材 label 完全相等才命中），带 @ 前缀才触发；
 *  - 多素材同名取第一个命中项；长名优先（@猫A 不被 @猫 抢先命中）；
 *  - 素材无 url / 无 id / 无 label 不参与匹配。
 * @param {string} text 待扫描文本（序列化前的纯文本）
 * @param {Array<{id:string,label:string,url?:string,kind?:string}>} assets 候选素材
 * @returns {Array<{start:number,end:number,name:string,asset:object}>} 命中（相对 text 的 [start,end)，end 不含 @）
 */
export interface AutoLinkOccurrence {
  start: number;
  end: number;
  name: string;
  asset: { id: string; label: string; url?: string; kind?: string };
}

export function findAutoLinkOccurrences(
  text: string,
  assets: Array<{ id: string; label: string; url?: string; kind?: string }> = [],
): AutoLinkOccurrence[] {
  if (!text || assets.length === 0) return [];
  // 建 label→asset 全等映射（多同名取首个：先出现者优先，同 Map.set 语义）
  const byName = new Map<string, { id: string; label: string; url?: string; kind?: string }>();
  for (const a of assets) {
    if (a && a.id && a.label && !byName.has(a.label)) byName.set(a.label, a);
  }
  if (byName.size === 0) return [];
  // 长名优先排序，避免「@猫A」被「猫」前缀抢先命中（全等匹配下仍需保证最长命中先替换）
  const names = [...byName.keys()].sort((a, b) => b.length - a.length);
  const re = new RegExp(
    `@(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'g',
  );
  const out: AutoLinkOccurrence[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const name = m[1];
    if (name === undefined) {
      re.lastIndex = m.index + m[0].length; // 第 1 组缺失（不可达）：推进防死循环
      continue;
    }
    const asset = byName.get(name);
    if (asset) {
      out.push({ start: m.index, end: m.index + m[0].length, name, asset });
      // 非重叠：跳过已消费的文本，避免命中区域被重复匹配
      re.lastIndex = m.index + m[0].length;
    }
  }
  return out;
}

/**
 * 判定 name 是否「可扩展」为更长素材名：∃ 素材 label ≠ name 且 label.startsWith(name)。
 * 用于「end == frontier 是否延迟提交」——可扩展说明用户可能继续补打（@猫 → @猫A），
 * 此刻立即转会把还在编辑的名锁死（docs/PromptInput-@名自动转缩略图 §8.2）。
 * @param {string} name 已命中的 @名
 * @param {Array<{id:string,label:string}>} assets 候选素材
 * @returns {boolean}
 */
export function extendable(
  name: string,
  assets: Array<{ id: string; label: string; url?: string; kind?: string }> = [],
): boolean {
  const n = String(name || '');
  if (!n) return false;
  return assets.some((a) => !!a && !!a.label && a.label !== n && a.label.startsWith(n));
}

/**
 * 判定字符是否为「终结字符」（空格/标点/换行等，BREAK 集合）。
 * BREAK 集单一真源在 promptMention.ts（detectMentionQuery 与自动转换共用边界）。
 * 注(2026-09-07)：组件接线当前未直接调用本函数——「终结字符」场景已被 commitOccurrencesInRun
 * 的 `end < frontier` 规则天然覆盖（打空格/标点 → 光标越过命中 → 自动封口提交）。
 * 保留本函数作为 BREAK 集的公共语义出口（供未来 query 关闭类判定/测试复用），勿因「无调用」删除。
 * @param {string} ch 单个字符
 * @returns {boolean}
 */
export function isTerminatedByBreak(ch: string): boolean {
  return BREAK.has(ch);
}

/**
 * 名字匹配唯一入口：把 prompt 里 `@素材名`（全等命中候选素材）替换成 `@{id:label|thumb}` 芯片字符串。
 * 语义与 findAutoLinkOccurrences 完全一致（由它驱动，行为无分叉）。
 * @param {string} text 待转换的 prompt 字符串（序列化前）
 * @param {Array<{id:string,label:string,url?:string,kind?:string}>} assets 候选素材
 * @returns {string} 转换后的字符串（含 `@{id:label|thumb}`）
 */
export function autoLinkAssetsByName(
  text: string,
  assets: Array<{ id: string; label: string; url?: string; kind?: string }> = [],
): string {
  const occs = findAutoLinkOccurrences(text, assets);
  if (occs.length === 0) return text;
  let result = '';
  let last = 0;
  for (const occ of occs) {
    result += text.slice(last, occ.start);
    const a = occ.asset;
    result += buildChipText(a.id, a.label, a.url);
    last = occ.end;
  }
  result += text.slice(last);
  return result;
}

/** commitOccurrencesInRun 的选项 */
export interface AutoLinkCommitOptions {
  /** 前沿：光标（打字）或粘贴片段末尾（粘贴）在该 run 文本中的偏移 */
  frontierOffset: number;
  /**
   * end == frontier 时的提交判定（组件传：!extendable && 弹层无其它候选）；
   * 缺省 = 仅提交 end < frontier 的命中（已被后续输入封口）。
   */
  atFrontier?: (occ: AutoLinkOccurrence) => boolean;
}

/**
 * 就地转换一个文本 run 内已封口的 @名（DOM 手术，不整段 innerHTML 重建）。
 * 运行期自动转换的提交引擎（docs/PromptInput-@名自动转缩略图 §8.4）：
 *  - 判定（§8.2）：end < frontier → 提交；end == frontier → 走 atFrontier；
 *    end > frontier → 延迟（还在编辑/可扩展的名不动）；
 *  - 手术：把 run 重建为 [前文文本][chip…][后文文本] 兄弟流（buildChipEl 替入），
 *    光标原本在 run 内时映射到新流末尾（可提交命中均满足 end <= frontier）；
 *  - 收尾（normalizeChipSlots / emitDOM）由组件层负责，此处不动整棵 root。
 * @param {Text} run 光标所在的文本节点（contentEditable 内）
 * @param {Array<{id:string,label:string,url?:string,kind?:string}>} assets 候选素材
 * @param {{frontierOffset:number, atFrontier?:(occ)=>boolean}} opts 提交判定选项
 * @returns {boolean} 是否发生转换
 */
export function commitOccurrencesInRun(
  run: Text,
  assets: Array<{ id: string; label: string; url?: string; kind?: string }> = [],
  opts: AutoLinkCommitOptions,
): boolean {
  const text = run.textContent || '';
  if (!text.includes('@') || assets.length === 0) return false;
  const occs = findAutoLinkOccurrences(text, assets);
  const toCommit = occs.filter((occ) =>
    occ.end < opts.frontierOffset
      ? true
      : occ.end === opts.frontierOffset
        ? opts.atFrontier
          ? opts.atFrontier(occ)
          : false
        : false,
  );
  if (toCommit.length === 0) return false;

  const parent = run.parentNode;
  if (!parent) return false;
  const sel = window.getSelection();
  const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
  const caretOffset = range && range.startContainer === run ? range.startOffset : -1;

  // 组装新流（升序）：[前文文本][chip…][后文文本]
  const newNodes: Node[] = [];
  let last = 0;
  for (const occ of toCommit) {
    if (occ.start > last) newNodes.push(document.createTextNode(text.slice(last, occ.start)));
    const a = occ.asset;
    newNodes.push(buildChipEl(a.id, a.label, (a.kind as 'image' | 'text') || 'text', a.url));
    last = occ.end;
  }
  if (last < text.length) newNodes.push(document.createTextNode(text.slice(last)));
  if (newNodes.length === 0) return false;

  for (const n of newNodes) parent.insertBefore(n, run);
  parent.removeChild(run);

  // 光标映射：可提交命中均 end <= caretOffset → 光标必在最后命中之后。
  // 若 run 末段仍是非芯片文本（如被延迟的 open query），落点 = 该文本内相对偏移。
  if (caretOffset >= 0) {
    const lastOcc = toCommit[toCommit.length - 1];
    const rel = caretOffset - (lastOcc?.end ?? 0); // 无命中 ⇒ 相对 run 起点
    const parentEl = parent as HTMLElement;
    const chips = parentEl.querySelectorAll('[data-ref-id]');
    const lastChip = chips[chips.length - 1];
    const r = document.createRange();
    if (!lastChip) {
      r.selectNodeContents(parentEl);
    } else if (rel > 0) {
      const afterNode = lastChip.nextSibling;
      if (afterNode && afterNode.nodeType === Node.TEXT_NODE) {
        r.setStart(afterNode, Math.min(rel, (afterNode.textContent || '').length));
      } else {
        r.setStartAfter(lastChip);
      }
    } else {
      r.setStartAfter(lastChip);
    }
    r.collapse(true);
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(r);
    }
  }
  return true;
}
