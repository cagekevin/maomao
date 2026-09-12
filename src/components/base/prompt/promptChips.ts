/**
 * promptChips —— prompt 富文本的「芯片」纯逻辑层（无 React / 无 DOM 环境依赖，可单测）。
 *
 * 职责：把 prompt 里的 `@{id:label}` 素材引用与 DOM 芯片互转，以及生成前把芯片解析回
 * 「纯文本 + 参考图」。是唯一入口，禁止在别处手写 /@\{/ 正则或就地解析。
 *
 * 序列化约定（与参考仓库 AI-Canvas-tauri 一致）：
 *   芯片 → 字符串：`@{id:label}`
 *   字符串 → 芯片：用 PROMPT_CHIP_RE 解析
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
 */

import { BREAK } from './promptMention.ts';

/** 芯片 token 的素材元信息（renderPromptToNodes 的 metaMap 值形态） */
interface ChipMeta {
  kind?: string;
  url?: string;
  label?: string;
}

/**
 * 芯片序列化正则（唯一入口，禁止散落复制）。
 * 格式：`@{id:label}` 或 `@{id:label|thumbUrl}`（thumbUrl 可选）。
 *   - group1 = id（不含冒号）
 *   - group2 = label（不含 `|` 与 `}`，旧数据无 url 段时完全兼容）
 *   - group3 = 可选缩略图 URL（已 encodeURIComponent，防止 `}` 等字符破坏解析）
 * 旧数据 `@{id:label}`（无 `|`）也能正确匹配，向后兼容不崩。
 */
export const PROMPT_CHIP_RE: RegExp = /@\{([^:]+):([^|}]*)(?:\|([^}]+))?\}/g;

/** 零宽空格：芯片前后光标落点占位 */
export const ZWSP: string = '\u200B';

/** 缩略图 URL ↔ 字符串片段的编解码（集中处理，避免散落 try/catch） */
const encodeThumb = (url: string): string => (url ? encodeURIComponent(url) : '');
const decodeThumb = (s: string): string => {
  if (!s) return '';
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

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
 *   - 前一个兄弟为空或 <br> → 插一个 ZWSP 文本节点；
 *   - 前一个兄弟是空文本 → 填 ZWSP；
 *   - 否则（已有内容）不处理。
 * 这样光标才能停在芯片前面，避免行首芯片无法聚焦。
 * @param {Node} chip 芯片元素
 */
export function ensureCaretSlotBeforeChip(chip: Node): void {
  const previous = chip.previousSibling;
  if (!previous || isBrEl(previous)) {
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
      result += thumb ? `@{${id}:${label}|${encodeThumb(thumb)}}` : `@{${id}:${label}}`;
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
  while ((match = PROMPT_CHIP_RE.exec(text)) !== null) {
    pushTextWithBreaks(text.slice(lastIndex, match.index));
    const id = match[1];
    const meta = metaMap ? metaMap.get(id) : undefined;
    // label：优先 metaMap 的当前名（上游改名后字符串里是旧名，metaMap 是新的）
    const label = (meta && meta.label && String(meta.label).trim()) || match[2];
    // kind：字符串自带缩略图 → 必为图片；否则以 metaMap 为准，再回落文本
    const url = match[3] ? decodeThumb(match[3]) : meta?.url || '';
    const kind = url ? 'image' : meta?.kind || 'text';
    pushChip(buildChipEl(id, label, kind as 'image' | 'text', url));
    lastIndex = PROMPT_CHIP_RE.lastIndex;
  }
  pushTextWithBreaks(text.slice(lastIndex));
  return nodes;
}

/**
 * 生成前解析：把 prompt 里的 `@{id:label}` 芯片解析为「纯文本 + 参考图」。
 *   - 图片素材芯片 → 其 url 加入 refImages 参考图列表（同一 id 去重），位置替换为显式垫图引用
 *     `[img=图片N]`（seedance 富文本垫图语法，避免裸词「图片N」被模型当成画面描述词汇而忽略垫图）；
 *   - 文本素材芯片 → 替换为其 label（作为纯文本随 prompt 发出）；
 *   - 找不到对应素材 → 替换为空（不产生垃圾字符）。
 * @param {string} rawPrompt 含 `@{id:label}` 的原始 prompt
 * @param {Array<{id?:string,url?:string}>} refImages 可用图片素材（按 id 查 url；id/url 缺省的项忽略）
 * @param {Array<{id?:string,label?:string}>} refTexts 可用文本素材（按 id 查 label；id/label 缺省的项忽略）
 * @returns {{ text: string, refImages: Array<{id:string,url:string}> }}
 */
export function resolvePromptChips(
  rawPrompt: string,
  refImages: Array<{ id?: string; url?: string }> = [],
  refTexts: Array<{ id?: string; label?: string }> = [],
): { text: string; refImages: Array<{ id: string; url: string }> } {
  const imgById = new Map<string, string>();
  for (const im of refImages) if (im && im.id && im.url) imgById.set(im.id, im.url);
  const textById = new Map<string, string>();
  for (const t of refTexts) if (t && t.id && t.label) textById.set(t.id, t.label);

  const imageKeyToIndex = new Map<string, number>(); // 图引用去重：id → [img=图片N]
  const resolvedRefImages: Array<{ id: string; url: string }> = [];

  const text = String(rawPrompt || '').replace(
    PROMPT_CHIP_RE,
    (_match: string, id: string, _label: string) => {
      const imgUrl = imgById.get(id);
      if (imgUrl) {
        let idx = imageKeyToIndex.get(id);
        if (idx === undefined) {
          idx = imageKeyToIndex.size + 1;
          imageKeyToIndex.set(id, idx);
          resolvedRefImages.push({ id, url: imgUrl });
        }
        // seedance 富文本垫图语法：显式 `[img=图片N]` 声明垫图引用，而非裸词「图片N」，
        // 避免模型把「图片1」当成画面描述词汇而忽略垫图 / 凭空重画。
        return `[img=图片${idx}]`;
      }
      const textLabel = textById.get(id);
      if (textLabel) return textLabel;
      return '';
    },
  );

  return { text: text.trim(), refImages: resolvedRefImages };
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
    const thumb = a.url ? `|${encodeThumb(a.url)}` : '';
    result += `@{${a.id}:${a.label}${thumb}}`;
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
    const rel = caretOffset - lastOcc.end;
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
