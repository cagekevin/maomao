/**
 * 核心纯函数工具集 —— 全仓通用工具的唯一入口（收口点）。
 *
 * 本文件收口了多处「曾被各模块各写一份、已漂移」的通用逻辑；下列函数即为对应语义的
 * 唯一真源，业务代码一律从本文件 import，禁止在调用方就地手抄替代
 * （单一规则原则，见 CLAUDE.md §5.4(9)「同一件事只允许一种实现」）：
 *  · clamp(v, lo?, hi?)               通用数值钳制唯一真源（TD-18-6 收口，第二份已删）
 *  · deepClone<T>                     深拷贝唯一入口（业务代码禁止手写 JSON.parse(JSON.stringify())，也禁裸 structuredClone）
 *  · fileNameFromUrl                  URL→文件名唯一实现（曾 12 份内联，TD-16-14 / TD-08-20 收口）
 *  · toAbsoluteFileUrl                /files/ 相对路径→完整 URL 唯一实现（TD-06-7 收口，消除循环依赖）
 *  · dataUrlToBlob / safeFileName     各自语义唯一实现（曾散落多文件，已收口）
 *  · canvasToImageDataUrl             canvas → 图像 dataURL 唯一出口（**产出即校验**，禁假成功；边界见函数头）
 *  · debounce / throttle / formatTime  防抖 / 节流 / 时间格式化唯一入口
 * 改本文件必须同步本文件头注释（CLAUDE.md §零 决策记录铁律）。
 */

import { useEffect, type DependencyList } from 'react';
import { API_BASE } from './config.ts';
// 解析兜底统一走唯一原语（`PARSE_FALLBACK` 的唯一实现），不再逐处手写 catch（2026-09-17 拆回潮）。
import { tryParse } from '../utils/net/asyncGuard.ts';

/**
 * 相对 `/files/` 路径 → 完整可访问 URL（localTool 本地引擎端口）。
 *
 * 【为什么住在 core/utils（TD-06-7 收口，2026-09-13）】此前同语义有两份实现：
 *  - `assetUrl.ts::toAbsoluteFileUrl`（40+ 消费方走它）
 *  - `imageCompress.ts::toLoadableUrl`（为避免 `assetUrl → imageCompress → assetUrl` **循环依赖**而复制）
 *
 * 本函数**唯一依赖** `API_BASE`（core/config，零 import 的叶常量）——它本不必住在 `assetUrl`（业务层）。
 * 现下沉到本纯工具叶模块：`assetUrl` 与 `imageCompress` 都从此处取 → **环消失、两份合一**，
 * 且 `assetUrl` 保持同名 re-export（40+ 消费方零改动）。
 */
export function toAbsoluteFileUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return url ?? '';
  return url.startsWith('/files/') ? `${API_BASE}${url}` : url;
}

/**
 * URL → 文件名（basename）**探测原语 · 全库唯一实现**。
 *
 * 【为什么收口（TD-16-14 / TD-08-20 · 2026-09-16）】此前全库有 **12 份**内联手写
 * `decodeURIComponent(new URL(u).pathname.split('/').pop())` 或更简陋的 `u.split('/').pop()`，
 * 口径互不统一且已漂移出三类不一致：
 *   · **漏 decode**：编码名（`my%20clip.png`）显示成裸 `%20`（VideoExtractNode 等）；
 *   · **漏剥 `?` `#`**：`a.png?token=1` 取到 `a.png?token=1`（imageCompress / ImageZoomDialog）；
 *   · **裸 split**：相对路径＋查询串下取到查询片段（VideoGenerate / AssetNode 等）。
 * 统一为「先用 `URL` 解析（自动剥 `?#`）→ 取 pathname → 末段 → decode 一次」。
 *
 * @param url 任意 URL（绝对 http / 相对 /files/ / data: / blob:）；空/非法 → ''
 * @returns 解码后的文件名；取不到 → ''
 */
export function fileNameFromUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '';
  const r = tryParse(() => {
    const pathname = new URL(url, 'http://localhost').pathname;
    const seg = pathname.slice(pathname.lastIndexOf('/') + 1);
    return seg ? decodeURIComponent(seg) : '';
  });
  return r.ok ? r.value : '';
}

/**
 * URL → 相对 `/files/` 磁盘路径（去前缀 + 解码）**探测原语 · 全库唯一实现**。
 *
 * 【为什么必须命中 `/files/` 前缀】非本地 URL（远程 http 图、data URL、其它路径）→ **返回 null**，
 * 不得返回看似合法的残串（旧实现直接 `replace`，会把 `https://x/y.png` 返回成 `/y.png`，
 * 让调用方误以为拿到了本地相对路径）。前端与后端 `relativePathFromFileUrl` 同口径（同一探测原语）。
 *
 * 【与 fileNameFromUrl 的关系】本函数 = 「前缀校验」+ `fileNameFromUrl`；两者是**不同判据**，
 * 不可互相替代：取显示名只关心末段（任意 URL 都成立），磁盘定位必须确认是本机 `/files/`。
 *
 * @param url 任意 URL；非本地 `/files/` 形态 / 非法 → null
 * @returns 相对路径（如 `migrated/人物/a.png`）；取不到 → null
 */
export function relativePathFromFileUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const r = tryParse(() => {
    const pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
    if (!pathname.startsWith('/files/')) return null;
    const rel = pathname.slice('/files/'.length);
    return rel || null;
  });
  return r.ok ? r.value : null;
}

/**
 * 通用工具集中实现 —— 唯一入口，禁止散落手写替代。
 *
 * 约定：
 *  - deepClone / formatTime / debounce / throttle 一律从本文件 import
 *  - 业务代码禁止手写 `JSON.parse(JSON.stringify())`、`setTimeout` 防抖、时间格式化
 *  - ID 生成不在此，统一走 ./idGen.ts 的 generateId（TS 化后扩展名 .ts）
 */

/** 防抖/节流的包装函数返回形态（带 cancel/flush） */
type DebouncedFn<T extends (...args: any[]) => void> = {
  (...args: Parameters<T>): void;
  cancel(): void;
  flush(): void;
};
type ThrottledFn<T extends (...args: any[]) => void> = {
  (...args: Parameters<T>): void;
  cancel(): void;
};
type RafBatchFn<T extends (...args: any[]) => void> = {
  (...args: Parameters<T>): void;
  flush(): void;
  cancel(): void;
};

/**
 * 深拷贝（结构化克隆）——**全库唯一入口**（`director3d` 域内以 `cloneProjectValue` re-export）。
 *
 * 【实现改用 `structuredClone`（2026-09-18 · TD-18-9）】旧实现 `JSON.parse(JSON.stringify(v)) as T` 有三个问题：
 *   ① **假收窄**：JSON 往返返回 `any`，靠 `as T` 谎称承诺了 `T`；
 *   ② **静默丢数据**：丢 `undefined` 字段 · `Date`→字符串 · `Map`/`Set`→`{}` · 循环引用**抛 TypeError**；
 *   ③ **约束只在注释**（「含函数/Date/循环引用者请勿用」）= 假护栏，无任何机器校验。
 *   `structuredClone<T>(v: T): T` **原生返回 `T`**（无需 `as`）⇒ ① 消除；
 *   原样保留 `Date` / `Map` / `Set` / **循环引用** ⇒ ② 消除；
 *   含**函数 / Symbol / DOM 节点**者会抛 `DataCloneError` ⇒ **失败改为根部炸开**（旧实现是**静默丢弃**），
 *   与「一诚实」闸一致（错误不伪装成成功）。
 *
 * 【消费面取证（2026-09-18）】`director3d` 与 `clipboard` 传入的均为**纯 JSON 数据**
 *   （`project.ts` 里的 `Map`/`Set` 全是局部计算，不在被克隆结构内）⇒ 两实现对现有消费方**行为等价**。
 *   能力取证：`structuredClone` 在 node 与 jsdom（vitest）环境均可用。
 *   【2026-09-19 · TD-18-15】原写的两处「先例」（`nodeDataSchema.ts:120` · `d3dPersistence.ts`）
 *   现**都已收口到本函数**（全仓裸 `structuredClone` 归零）⇒ 先例即本函数自身，不再另指调用点。
 *
 * 【何时不该用】需要「丢函数 / 把 Date 归一成字符串」的**归一化**语义时，请显式走 JSON 序列化 —— 别借本函数。
 */
export function deepClone<T>(value: T): T {
  return structuredClone(value);
}

/** data: URL → Blob（base64 编码）。缺省 MIME 从 data: meta 段解析（失败回退 octet-stream）。
 * 收口：dataURL 转 Blob 统一在此（曾散落 filesApi / imageCompress / imageUpscale / FaceMosaicNode 四份，
 * 其中 imageCompress 因法定「assetUrl↔imageCompress 禁反向 import」不能依赖 assetUrl，故放本通用的叶模块）。
 * @param dataUrl data:...;base64,xxx
 * @param mime 可选 MIME 覆盖（调用方已知目标类型时传，如 'image/png'）
 */
export function dataUrlToBlob(dataUrl: string, mime?: string): Blob {
  const idx = dataUrl.indexOf(',');
  const meta = dataUrl.slice(0, idx);
  const raw = dataUrl.slice(idx + 1);
  const type = mime || meta.match(/^data:([^;]+)/)?.[1] || 'application/octet-stream';
  const bin = atob(raw);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/**
 * canvas → 图像 dataURL（**产出与校验是同一个动作 · 全库唯一出口**）。
 *
 * 【为什么产出必须自带校验】画布尺寸/内存超本机上限时 canvas 分配失败，`toDataURL()` 会返回
 * `"data:,"`（规范允许，且是**真值**）。调用方若只判 `!dataUrl` 一律放行，`dataUrlToBlob`
 * 也只会产出 0 字节 Blob 而不抛错 → **空白图被写回节点 / 送给模型，用户看到"成功"**，
 * 这是最难排查的一类假成功（日志无错、链路无错、结果为空）。
 * 故把「产出」与「校验」合成同一个不可分动作：产物不是真图像 → **在根部抛出**；
 * 调用方禁止再写第二份 `startsWith('data:image/')` 判据（CLAUDE.md §5.4(9) 同一件事一种实现）。
 *
 * 【与 dataUrlToBlob 的分工】本函数守「产出端能不能相信这个字符串」，dataUrlToBlob 只做编码转换；
 * 两者都不负责"落盘失败"——那是 filesApi 降级策略的事，不可混。
 *
 * 【收口范围（2026-09-17 · TD-06-10 清偿）】`src/**` 里**同步族** canvas 图像产出已全部改经本函数
 * （图像入节点 / 送模型主路径 + 缩略图 / 视频海报 / director3d / videoEditor 引擎 / scriptbox 抽帧 /
 * FaceMosaicEditor / PanoViewer / ImageBoxNode / VideoExtractNode / OverlayEditor 遮罩）。
 * ⚠️ **这条约束没有机器守卫**（曾加 `check-canvas-to-dataurl` 闸，2026-09-17 按用户裁定删除 ——
 * 当时发现闸漏了 `toBlob` 族，我的第一反应是改覆盖声明让闸继续绿，而那不是守卫是绕过。
 * 详见 `daily/架构日志/06-跨区-图片产出唯一出口与切片落盘-2026-09-17.md` §13）。
 * ⇒ 新写画布产出**请自觉**经本函数取值（产物不是真图即在根部抛出），**不要**再自己调 `toDataURL`；
 *    **异步族 `toBlob` 走对称出口 `canvasToBlob`**（2026-09-18 · TD-06-14 收口，见其函数头）。
 *
 * @param format  目标 MIME（canvas 可编码者；见 imageCompress 的 MIME_TO_FORMAT 能力表）
 * @param quality 仅对 image/jpeg、image/webp 生效
 * @throws 产物为空 / 非 `data:image/*`（含 `"data:,"`）时抛明确错误
 */
export function canvasToImageDataUrl(
  canvas: HTMLCanvasElement,
  format: string = 'image/png',
  quality?: number,
): string {
  const dataUrl =
    quality === undefined ? canvas.toDataURL(format) : canvas.toDataURL(format, quality);
  const comma = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:image/') || comma < 0 || comma === dataUrl.length - 1) {
    throw new Error('图片超出当前设备可处理的范围，画布未能生成有效图像。');
  }
  return dataUrl;
}

/**
 * canvas 异步产出**唯一出口** —— `canvasToImageDataUrl` 的**异步族对称物**（产出即校验，失败**根部抛出**）。
 *
 * 【为什么存在（2026-09-18 · TD-06-14）】`canvas.toBlob(cb, …)` 的失败语义是**回调收到 `null`**（不抛错）。
 *   全库 6 处消费点原先各写一份判据 + 各自编文案：
 *   · 1 处 `if (!blob) return;` —— **静默失败**（用户点了"导出当前帧"，什么都没发生、零提示零留痕）；
 *   · 1 处把 `null` **重分类**成「canvas 可能被跨域污染」（**无证据的因果结论**，CLAUDE.md §5.1 禁）；
 *   · 其余 3 处各自 `new Promise + reject(new Error(...))`，文案互不相同（含英文）。
 *   ⇒ 收口为**唯一出口**：判据与同步族同源（产物不是真图像即失败），文案**一份**。
 *
 * 【判据（与同步族对齐）】`null` / **0 字节** / `type` 非 `image/*` ⇒ 抛同一句用户可读文案。
 * 【不做的事】不负责"落盘失败"（那是 `filesApi` 降级策略的事）；**不替调用方决定 toast** ——
 *   失败可见性由调用方按读者分流（开发者 `logger` / 用户 `toast`）。
 *
 * @param format  目标 MIME（缺省 `image/png`；canvas 可编码者）
 * @param quality 仅对 `image/jpeg`、`image/webp` 生效
 * @throws 产物为空 / 0 字节 / 非 `image/*` 时抛明确错误（文案与同步族一致）
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: string = 'image/png',
  quality?: number,
): Promise<Blob> {
  const badImage = () => new Error('图片超出当前设备可处理的范围，画布未能生成有效图像。');
  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          // 判据与同步族同源：不是真图像就不放行（`null` = 分配失败；0 字节 = 空白图）
          if (!blob || blob.size === 0 || !blob.type.startsWith('image/')) {
            reject(badImage());
            return;
          }
          resolve(blob);
        },
        format,
        quality,
      );
    } catch (e) {
      // 同步抛 = **编程错误**（如 format 非法），不是"设备画不出来" ⇒ **原样透传**，
      // 不伪装成"图片超范围"（那会把代码 bug 重分类成环境问题 —— CLAUDE.md §5.1 禁重分类）。
      reject(e instanceof Error ? e : badImage());
    }
  });
}

/** 多路图片源合并去重（ImageGenerate/TemplateNode refImages 公共实现）：
 *  按 id（缺省回退 url）去重，保留首次出现；无 key（id/url 皆空）的项丢弃。
 *  解决同一批资产图经「连线上游 + data.images」双路进入导致渲染 key 重复 / 图显示两份。 */
export function mergeRefImages<T extends { id?: string; url?: string }>(
  ...groups: Array<Array<T> | T | null | undefined>
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  groups.forEach((g) => {
    (Array.isArray(g) ? g : []).forEach((im) => {
      const key = im && (im.id ?? im.url);
      if (!key || seen.has(key)) return;
      seen.add(key);
      merged.push(im);
    });
  });
  return merged;
}

/** 从素材取显示名（统一兼容 ResourceStrip 的 onInsert 两种形态）：
 *  - 对象 { label, ... }（富文本芯片插入，ResourceStrip 现传完整对象）→ 返回 label
 *  - 字符串 name（旧式纯文本插入回调）→ 原样返回
 * 供未升级节点的 onInsert 字符串拼接回调复用，避免把对象拼成 [object Object]。 */
export function assetLabel(asset: string | { label?: string } | null | undefined): string {
  if (typeof asset === 'string') return asset;
  return (asset && asset.label) || '';
}

/** 有效提示词 = 本地 prompt + 上游文本合并（ImageGenerate/TextGenerate/TemplateNode/VideoGenerate 公共实现）：
 *  本地主提示词在前，上游文本（refTexts）去空后追加在后，一起参与生成。返回 '' 表示空。 */
export function buildEffectivePrompt(
  localPrompt: unknown,
  refTexts?: Array<{ text?: string }>,
): string {
  const upstream = (refTexts || [])
    .map((t) => (t.text || '').trim())
    .filter(Boolean)
    .join('\n');
  return [String(localPrompt ?? '').trim(), upstream].filter(Boolean).join('\n') || '';
}

/** 通用数值钳制：把 v 钳到 [lo, hi]（lo/hi 可缺省）。收口：各节点不得各写 Math.max/min 样板。 */
export function clamp(v: number, lo?: number | null, hi?: number | null): number {
  const lower = lo == null ? -Infinity : lo;
  const upper = hi == null ? Infinity : hi;
  return Math.max(lower, Math.min(upper, v));
}

/** 视频时长钳制（VideoGenerate 滑块公共实现）：非法/0 → 下界兜底；越界钳到 [min,max]。 */
export function clampSeconds(value: unknown, min = 4, max = 15): number {
  return clamp(Number(value) || min, min, max);
}

/** 文件名安全化（磁盘文件名 base）：trim → 非法字符替换为 sep → 可选去尾部扩展名 → 空白替换为 sep。
 * 收口：各处文件名清洗统一走这里（resourceStore.safeResourceBase / filesApi.safeName / videoEngine 等），
 * 不再各写 replace 样板。处理顺序与 resourceStore.safeResourceBase 逐字节一致（其行为有单测钉住）。
 * @param name 名字
 * @param o - sep 非法字符/空白替换成的字符，默认 '_'；stripExt 是否去掉尾部 `.ext`，默认 false；fallback 为空时回退名，默认 '' */
export function safeFileName(
  name: unknown,
  o: { sep?: string; stripExt?: boolean; fallback?: string } = {},
): string {
  const { sep = '_', stripExt = false, fallback = '' } = o;
  let b = String(name ?? '').trim();
  b = b.replace(/[\\/:*?"<>|]/g, sep);
  if (stripExt) b = b.replace(/\.[a-z0-9]{2,5}$/i, '');
  b = b.replace(/\s+/g, sep);
  return b || fallback;
}

/**
 * 存储键模板 → 编译后正则（模块级缓存）。收口（2026-08-30）：contentStore / kvStore / storageQuota
 * 原各有逐字相同的 getPatternRegex，统一收敛到本函数，新增使用方一律 import 本函数、禁止再复制。
 * 语义：把 STORAGE_KEYS 的 `{xxx}` 动态键模板（如 canvas-state-v1-{projectId}）编译成
 * `^canvas-state-v1-.+$`；模板数量有限（契约层登记量级），按模板 lazy 编译一次缓存，天然防无限膨胀。
 *
 * 【转义集补全 2026-09-13】原集 `[.+^$()|[\]\\]` **漏了 `* ? | ]` 等元字符** → 模板里出现 `*`（如
 * `a*b-{x}`）会直接抛 `Nothing to repeat`，或含 `|` 时语义变成"或"（键匹配错乱）。现补齐为
 * JS 正则全部元字符（对齐 `escapeRegExp` 通行实现）。
 * @param template 含 {占位} 的模板
 */
const patternRegexCache = new Map<string, RegExp>();
export function compilePatternRegex(template: string): RegExp {
  let re = patternRegexCache.get(template);
  if (!re) {
    const parts = template.split(/\{[^}]+\}/);
    // 转义全部正则元字符：. + * ? ^ $ ( ) [ ] { } | \
    const escaped = parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.+');
    re = new RegExp('^' + escaped + '$');
    patternRegexCache.set(template, re);
  }
  return re;
}

/**
 * 稳定序列化（键排序的 JSON.stringify）—— 全项目「内容是否相同」判定的唯一序列化入口。
 *
 * 收口理由：JS 对象的键顺序不保证稳定，直接 `JSON.stringify(a) === JSON.stringify(b)`
 * 会因键序不同误判「内容变了」，在云同步场景就是「明明一样却报冲突」。
 * 凡需内容比对/指纹的地方一律走本函数，禁止就地 stringify（各写一份即产生第二种排序规则，
 * 是误判的源头）。与 compilePatternRegex 同族，属通用工具层。
 *
 * @param value 任意可 JSON 化的值（对象/数组/原始值/undefined）
 * @returns 键序稳定的字符串；同内容必得同串
 */
export function stableStringify(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/**
 * 字符串 → 短指纹（FNV-1a 32 位，与 promptHubStore 的 signature 同族）。
 * 用途：给大对象（云同步整包）算内容指纹存台账，避免把整包内容复制一份落盘。
 * 返回 `长度:hash36`，长度参与签名以降低碰撞误判。
 * @param input 待哈希字符串（应先经 stableStringify 稳定化）
 */
export function hashString(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${input.length}:${(hash >>> 0).toString(36)}`;
}

/**
 * 任意值 → 内容指纹（稳定序列化 + 哈希）。判定「数据改没改过」的标准做法。
 * 同内容必得同指纹；内容任一处变化指纹必变（弱碰撞概率忽略）。
 */
export function contentFingerprint(value: unknown): string {
  return hashString(stableStringify(value));
}

/**
 * 时间格式化。opts：
 *  - 默认 `{ locale: 'zh-CN' }` → `new Date(ts).toLocaleString('zh-CN', { hour12: false })`（TaskCenter）
 *  - `{ mode: 'time' }` → HH:mm:ss（logger）
 *  - `{ mode: 'file' }` → yyyymmdd_HHmmss，落盘文件名时间戳（filesApi）
 */
export function formatTime(
  ts: number | string | Date = Date.now(),
  opts: { mode?: 'file' | 'time' } = {},
): string {
  const d = typeof ts === 'number' || typeof ts === 'string' ? new Date(ts) : ts;
  // 【TD-18-8 · 2026-09-18】非法时间不再落**空串**（空串与「字段缺失 / 真空」不可区分 = 失败伪装成功），
  //   改用仓内既有哨兵 '—'。本层在 logger 之下无法留痕 ⇒ 以**返回值**表达失败（消费者原样呈现）。
  //   已核三个传 `undefined` 的调用点（`logger` ×2 / `filesApi` ×2）⇒ 走 `Date.now()`，永不到此分支。
  if (Number.isNaN(d.getTime())) return '—';
  if (opts.mode === 'file') {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }
  if (opts.mode === 'time') {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  // Intl 受限环境（极老浏览器 / 裁剪构建）→ 落空串；走唯一解析兜底原语（2026-09-17）。
  const r = tryParse(() => d.toLocaleString('zh-CN', { hour12: false }));
  return r.ok ? r.value : '';
}

/**
 * 字节数的**结构化**分解（`{ value, unit }`）—— 字节渲染的**唯一真源**。
 *
 * 【为什么需要（2026-09-18 · TD-18-8 附带收口 · ADR-0004）】`StorageMonitor` 的环形图要把
 *   「数字 / 单位」**分两行**渲染，此前它写的是 `formatBytes(n).split(' ')[0] / [1]` ——
 *   **从生产者的显示字符串里反解析数据**：等于给 `formatBytes` 加了一条**未文档化的结构契约**
 *   （返回值必须恰好两段、空格分隔），且属三铁律③「消费者自造」（能调生产者却自己拆串）。
 *   现由生产者给出结构化出口，消费方改委托。
 *
 * 【诚实】非法输入（NaN / 负数，含后端字段缺失导致的 `NaN`）→ **`null`**（无可用值），
 *   **不伪装成 `'0 B'`**。注意与**真空**的区别：显式 `0` 是**合法真实值**，走 `'0 B'`。
 *   ⚠️ 本层在 `logger` **之下**（logger 依赖本文件的 `formatTime`）⇒ 无法留痕，失败只能由返回值表达（ADR-0003）。
 */
export function formatBytesParts(bytes: number): { value: string; unit: string } | null {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return null; // 非法：无可用值
  if (n < 1024) return { value: String(n), unit: 'B' };
  if (n < 1048576) return { value: (n / 1024).toFixed(1), unit: 'KB' };
  if (n < 1073741824) return { value: (n / 1048576).toFixed(2), unit: 'MB' };
  return { value: (n / 1073741824).toFixed(2), unit: 'GB' };
}

/**
 * 格式化字节大小（B/KB/MB/GB）**· 全库唯一实现**（= `formatBytesParts` 的渲染）。
 *
 * 【为什么收口（TD-18-4 · 2026-09-16）】此前 `videoEngine.ts` 私有复制了一份仅 B/KB/MB 的
 * **退化子集**（`>1GB` 视频显示成 `1536.00 MB`、非法值无兜底），并由 `VideoProcessNode` 引用 →
 * 生效中的第二份真相源。现两处统一走本函数，`videoEngine` 同名 re-export（消费方零改动）。
 * 本版：覆盖到 GB 级存储占用，并区分**真空与非法**（2026-09-18 · TD-18-8 / ADR-0003）。
 *   - 真空（显式 0）→ `'0 B'`（合法真实值）；
 *   - 非法（NaN / 负数）→ 哨兵 `'—'`（**无可用值**），**不伪装成 0 字节**。
 */
export function formatBytes(bytes: number): string {
  const p = formatBytesParts(bytes);
  return p ? `${p.value} ${p.unit}` : '—';
}

/**
 * 秒 → 时长显示（`m:ss`，如 `1:05`）**· 全库唯一实现**。
 *
 * 【为什么收口（TD-22-64 · 2026-09-18）】此前**两处各写一份同名** `formatDuration`：
 * `videoEditor/ui/editor/panels/assets/views/media.tsx`（素材卡时长徽标）与
 * `nodes/VideoProcessNode.tsx`（节点 meta 行）—— 语义相同、代码几乎逐字相同，
 * 唯后者多一个「非有限 → `'0:00'`」的**发明值**。现两处统一走本函数。
 * 落点在 `base/core/`：`nodes/` 与 `videoEditor/` 两域都只准**依赖 base**（`check:arch` 规则 2 反向判据），
 * base 是唯一能同时被两者 import 的层（两域均有 import 本文件的先例）。
 *
 * 【判据：真空 / 非法（对齐同文件 `formatBytes` · ADR-0003/0004）】
 *   · 显式 `0` → `'0:00'`（**合法真实值**）；
 *   · 无可用值（`null` / `undefined`）与非法（NaN / ±Infinity / 负数）→ 哨兵 `'—'`，
 *     **不伪装成 `'0:00'`** —— 旧写法把「读不出时长」显示成「0 分 0 秒」＝对用户撒谎。
 *
 * 【为什么**不**走 `formatTimeCode({format:'MM:SS'})`】那是**时间码**（帧/厘秒精度，分钟到 60 进位且
 * **丢弃小时**：3661s → `'01:01'`）；本函数是**时长显示**（按**总分钟**：3661s → `'61:01'`）。
 * 两者判据不同，强行合并会让 ≥1 小时素材**显示错**（该债原拟解法即此，取证后否掉）。
 * `formatTimeCode` 仍是时间码的唯一真源，本函数不替代它。
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** 防抖（返回包装函数 + cancel + flush） */
export function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): DebouncedFn<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  const wrapped = (...args: Parameters<T>) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  };
  wrapped.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  // flush：立即执行最后一次待提交（失焦/卸载落盘兜底，避免防抖窗口内丢数据）
  wrapped.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (lastArgs) fn(...lastArgs);
    lastArgs = null;
  };
  return wrapped;
}

/** 节流（返回包装函数 + cancel） */
export function throttle<T extends (...args: any[]) => void>(fn: T, ms: number): ThrottledFn<T> {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  const wrapped = (...args: Parameters<T>) => {
    const now = Date.now();
    const remain = ms - (now - last);
    lastArgs = args;
    if (remain <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      last = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        last = Date.now();
        if (lastArgs) fn(...lastArgs);
      }, remain);
    }
  };
  wrapped.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return wrapped;
}

/**
 * rAF 合并原语（P3 收口：高频 pointermove/wheel 合并到每帧只执行 1 次）。
 *
 * 场景：拖拽/缩放手柄/滚轮缩放等高频事件，若每个事件都同步做状态更新/样式写入，
 * 一帧内会重复计算多次，浪费主线程。本原语只记录「最新入参」，由 requestAnimationFrame
 * 合并到下一帧统一执行一次 fn（last-args-wins）。
 *
 * 用法（对齐方案 P3 注意点）：
 *  - 入参是「绝对值/最新值」时直接透传：`const batch = createRafBatch((x, y) => ...)`，move 里 `batch(e.clientX, e.clientY)`。
 *  - 入参是「累计增量」时：move 里累加到 pending 再 `batch(pending)`，fn 里消费后清零（保证每帧增量不丢）。
 *  - end/卸载前必须 flush() 最后一次状态，否则松手位置差一帧；真正结束用 cancel() 丢弃待执行帧。
 */
export function createRafBatch<T extends (...args: any[]) => void>(fn: T): RafBatchFn<T> {
  let rafId: number | null = null;
  let lastArgs: Parameters<T> | null = null;
  const wrapped = (...args: Parameters<T>) => {
    lastArgs = args;
    if (rafId != null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      const a = lastArgs;
      lastArgs = null;
      if (a) fn(...a);
    });
  };
  wrapped.flush = () => {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    const a = lastArgs;
    lastArgs = null;
    if (a) fn(...a);
  };
  wrapped.cancel = () => {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastArgs = null;
  };
  return wrapped;
}

/**
 * effect 内防抖 hook（封装「依赖变化 → 重建定时器 → cleanup 清除」模式）。
 * 等价于手写 `useEffect(() => { const t = setTimeout(fn, ms); return () => clearTimeout(t) }, deps)`。
 * condition=false 时跳过（不设定时器），等价于手写 effect 里提前 `if (cond) return`。
 */
export function useDebouncedEffect(
  fn: () => void,
  deps: DependencyList,
  delay: number,
  condition = true,
): void {
  useEffect(() => {
    if (!condition) return undefined;
    const timer = setTimeout(fn, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
