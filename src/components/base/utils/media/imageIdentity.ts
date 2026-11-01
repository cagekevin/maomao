/**
 * 参考素材（图片）**身份**的唯一实现 —— docs/plan/151 第 1 步（2026-11-01）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么单独成文件（且落在 `base/utils/media/` 而非 `base/core/`）】
 *
 * `base/core` 现有全是**零业务语义**的基础设施（config / contracts / utils / idGen / logger）；
 * 「参考素材形状」是**媒体域**概念，与同目录的 `assetType.ts`（媒体判型真值源）同层。
 * 若放进 core，下一个 AI 会照抄"往 core 塞业务语义"的做法，把地基变成杂物间。
 *
 * 【三条硬规则（docs/plan/151 §2；违反即回归）】
 *
 *  R1 生成只在诞生点，且必须落盘
 *      `makeImageId()` 只能在「这个 id 会进 `node.data`」的写边界调用。
 *      读取路径**禁止**调用 —— 每次 render 变一个随机 UUID ⇒ 破坏 React key、破坏去重、
 *      且同一个图在两次 render 里成了两个身份（比"没有 id"更糟）。
 *
 *  R2 身份键 = id 优先；退化键 = 内容派生；**永不下标**
 *      `imageKeyOf(item)`：有 `id` 用它；没有则 `img_<hash(url)>`。
 *      「下标」（`img-<序号>` / 数组长度 / 遍历序号）**不是身份**：上游断线重连、
 *      重排、Agent 重写 data 都会让它指向另一张图 —— 这正是 docs/plan/151 要根治的病根。
 *
 *  R3 判同只有一个实现
 *      去重 / 建表 / 比对一律走 `imageKeyOf`，禁止各写一套 `im.id ?? im.url` 或"只按 url"。
 *
 * 【退化键不是身份（必须知道的三条边界）】
 *  1. **撞键**：同内容两帧（抽帧静止画面）→ 同 `url` → 同键 → `mergeRefImages` 会合并成 1 张。
 *     这是刻意的已知代价：退化键只允许出现在**读路径**（旧数据兜底），且必须显式接受"同内容合并"语义。
 *  2. **落盘即换键**：URL 形态在生命周期里会变（dataURL → `/files/<sha1>.png` → 绝对 URL，
 *     见 `filesApi.ts persistInlineOrKeep` + `utils.ts toAbsoluteFileUrl`）⇒ `hash(url)` 跟着变。
 *     ⇒ **绝不能用 url 哈希当身份**（那会让同一张图在落盘前后换身份，比下标还不稳定）。
 *     真正跨刷新稳定的身份是**写边界物化的 UUID**（第 2 步）。
 *  3. **冒号必须替换**：芯片字符串格式 `@{id:label|thumb}` 的 group1 是 `([^:]+)`
 *     （`canvas/shell/promptChipFormat.ts promptChipRe`）⇒ 键里带 `:` 会**破坏芯片解析**
 *     （`hashString` 返回形如 `12:ab3`，含冒号，必须换成 `_`）。
 *
 * 【为什么读取路径不许生成随机 UUID】见 R1。读取路径要"有个稳定的键"时，只能
 * `imageKeyOf({ url })`（确定性、可重复、同 url 必得同键）。
 *
 * 【更新(2026-11-01 · docs/plan/151 第 2 步：物化 id）】本文件新增三个符号，构成「读/写两边界」：
 *   · `ExtractedImage`      —— `data.extractedImages` 的元素形态（`string[]` → `{id,url}[]`）；
 *   · `readExtractedImages` —— **读侧归一**（旧裸字符串 + 新对象两形态都能读；缺 id 用退化键，
 *                             **绝不生成随机 UUID**）；
 *   · `withImageIds`        —— **写侧物化**（唯一允许给一批图生成真 UUID 的地方，调用方每批只调一次）。
 * 为什么不写数据迁移：前端无画布迁移入口（grep `migrate|upgrade` = 0 命中，快照 `data` 整包透传）
 * ⇒ 旧画布读出来仍是裸 `string[]`，只能靠「读时补确定性键 + 写时换 UUID」渐进升级。
 *
 * 【更新(2026-11-01 · docs/plan/151 第 3 步)】新增 `applyImageOrder`：按 `data.imageOrder` 顺序表重排
 * 图片列表（表内优先 / 表外追加 / 失效丢弃）。它是 §8.1 语义决策的落地点 —— 发送数组与缩略图条
 * **同源**，`[img=图片N]` 的 N = 重排后数组下标（用户拖了顺序，模型看到的顺序也跟着变）。
 * ════════════════════════════════════════════════════════════════
 */

import { generateId } from '../../core/idGen.ts';
import { hashString } from '../../core/utils.ts';

/**
 * 参考图素材形状 —— **唯一声明**（原 `ImageGenerate.tsx` 与 `_template/TemplateNode.tsx`
 * 逐字重复的两份 `interface RefImage` 已收敛到这里，docs/plan/151 §5.2 1-9）。
 *
 * 字段语义：
 *  - `id`：身份（`makeImageId` 产出，或退化键）—— ResourceStrip 的 React key、芯片 `@{id:…}` 的 id；
 *  - `url`：可发送/可显示地址（形态会随落盘变，见文件头 2）；
 *  - `label`：显示名（`@` 弹层候选名、缩略图底部蓝条文案）；
 *  - `sourceNodeId`：**来自连线**的上游节点 id。有它才显示红色 ×（可断开）——
 *    `data.images` 塞进来的（剧本盒资产 / Agent 写入）**没有**它，语义是"不可断开"。
 */
export interface RefImageItem {
  id: string;
  url: string;
  label?: string;
  sourceNodeId?: string;
}

/**
 * 图片身份**唯一生成点**（R1）：只在「会进 `node.data`」的诞生点调用。
 *
 * 与 `generateId` 的差别：这是**语义收口**，不是第二套实现 —— 它把"给参考图生成身份"
 * 这件事从散落的「直呼 generateId + 各种前缀/位置后缀」收到一个可 grep、
 * 可审计的入口（docs/plan/151 §9 A7 判据就靠它）。
 *
 * @param prefix 领域前缀（`img` / `ref` / `pano` …），透传给 `generateId`
 * @returns `{prefix}_{ts36}_{rand36}`（`generateId` 格式，**本步不改 id 格式**）
 */
export function makeImageId(prefix: string = 'img'): string {
  return generateId(prefix);
}

/**
 * 图片**身份键**唯一实现（R2 / R3）。
 *
 * 口径：`id` 优先；无 `id` 时退化为 `img_<hash(url)>`（冒号已替换为 `_`，见文件头 3）。
 * 空输入（`null` / `undefined` / `{}` / id 与 url 皆空）→ `''`（调用方据此丢弃该条）。
 *
 * ⚠️ 返回 `''` 是**合法结论**（"这条没有身份"），不是失败：调用方一律 `if (!key) continue`，
 * 不许把它当成"读失败"去兜底（失败与空必须可区分，CLAUDE.md §5.1）。
 *
 * @param item 任意带 `id`/`url` 的参考素材形状
 * @returns 身份键；无身份时 `''`
 */
export function imageKeyOf(
  item:
    | {
        id?: string | undefined;
        url?: string | undefined;
      }
    | null
    | undefined,
): string {
  if (!item) return '';
  if (item.id) return item.id;
  const url = item.url ?? '';
  return url ? `img_${hashString(url).replace(/:/g, '_')}` : '';
}

/**
 * `extractedImages` 的**元素形态**（docs/plan/151 §6.1，2026-11-01）。
 *
 * 【为什么从 `string[]` 升成对象数组】`string[]` 装不下身份 —— 下游只能按下标兜底
 * （`useConnectedInputs.arrayImages` 第 1 步已改成 `imageKeyOf({url})` 的**退化键**兜底），
 * 而退化键会随落盘变（dataURL → `/files/`）⇒ 跨刷新不稳定。要跨刷新稳定，只能把 id 物化进 data。
 *
 * 【旧数据兼容】画布无迁移入口（grep `migrate|upgrade` = 0 命中，快照 `data` 整包透传）
 * ⇒ 存量画布读出来仍是**裸 `string[]`**。故读侧一律经 `readExtractedImages` 归一，
 * **绝不在读路径生成随机 UUID**（R1：每次 render 变一个 id 会破坏 React key 与去重）。
 */
export interface ExtractedImage {
  id: string;
  url: string;
}

/**
 * 读侧归一：`data.extractedImages`（**新旧两形态**）→ `ExtractedImage[]`（docs/plan/151 §6.2 2-4）。
 *
 * 三种输入逐条判定：
 *  - `{ id, url }`（新形态）→ 直接透传 id（**只取不造**）；
 *  - `{ url }`（新形态但缺 id）→ `imageKeyOf({ url })` 的**确定性退化键**（同 url 同键，可重复）；
 *  - `'<url 字符串>'`（旧形态）→ 同上，退化键。
 * 非字符串/非对象的脏项一律丢弃（它们本来就画不出来）。
 *
 * ⚠️ **退化键不是身份**（见文件头「退化键不是身份」）：它随 url 形态变化而变，只用于"旧数据先能读"；
 * 用户下次触发写入（抽帧/切图/任何 `patchData`）时，写边界 `withImageIds` 才会升级成真 UUID。
 *
 * @param list `data.extractedImages` 的原始值（任何形态，含 undefined / 脏数据）
 * @returns 归一后的 `{ id, url }[]`（顺序保持原数组顺序，供「图片 N」编号使用）
 */
export function readExtractedImages(list: unknown): ExtractedImage[] {
  if (!Array.isArray(list)) return [];
  const out: ExtractedImage[] = [];
  for (const item of list) {
    if (typeof item === 'string') {
      if (!item) continue;
      out.push({ id: imageKeyOf({ url: item }), url: item });
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const url = typeof rec['url'] === 'string' ? rec['url'] : '';
    if (!url) continue;
    const id = typeof rec['id'] === 'string' && rec['id'] ? rec['id'] : imageKeyOf({ url });
    out.push({ id, url });
  }
  return out;
}

/**
 * 写边界物化：把一批 URL 升成带**真 UUID** 的 `ExtractedImage[]`（docs/plan/151 §6.2 2-2）。
 *
 * 【什么时候调用】只在「结果落盘」的写边界（抽帧完成 / 切图完成 / 手动截取）——
 * 即 §2 R1 说的「这个 id 会进 node.data」的诞生点。
 *
 * 【为什么必须在写边界、且落盘前后 id 不变】落盘策略（`persistInlineOrKeep`：dataURL → `/files/`）
 * 会换 url。若 id 跟着 url 派生（退化键），落盘前后就是**两个身份**（第 ③ 阶段爆点）。
 * 故先落盘、再对**最终 url** 调本函数生成 id —— id 一旦物化就不再随 url 变。
 *
 * 【重复调用会重开身份】每次调用都给每个元素新 UUID。调用方必须**每批结果只调一次**
 * （把结果写进 data 后，后续读写一律走 `readExtractedImages` 透传 id，不再重调）。
 *
 * @param urls 已落盘（或最终形态）的图片 URL 列表
 * @param prefix 领域前缀（`frame` / `split` …）
 * @returns 带真 UUID 的 `{ id, url }[]`（顺序与入参一致）
 */
export function withImageIds(urls: readonly string[], prefix: string = 'img'): ExtractedImage[] {
  return urls
    .filter((u) => typeof u === 'string' && !!u)
    .map((url) => ({
      id: makeImageId(prefix),
      url,
    }));
}

/**
 * 复制/粘贴时的**身份重开**（docs/plan/151 §7 · R4「复制 = 新实例 ⇒ 必须重开身份」）。
 *
 * 【为什么需要它】`groupNodes` 克隆分支是 `{ ...n.data }`（浅拷 ⇒ `data.images[]` 与原节点**共享引用**），
 * `clipboard` 粘贴分支是 `deepClone(x.data)`（深拷，但 **id 原样带过去**）⇒ 两个节点持有**完全相同**的
 * `data.images[].id` 与 `data.prompt` 里的 `@{id}` 芯片。任一节点的图被删/换后，另一节点的芯片会指向
 * 一个"存在但不属于它"的身份（幽灵引用）。
 *
 * 【本函数做什么】产出**重开身份后的新对象**（入参不被修改）：
 *   · `data.images[]` / `data.extractedImages[]` → 每项新 UUID（`makeImageId`），并建立 旧id → 新id 映射；
 *   · `data.prompt` → 交给调用方传入的 `rewriteChips(prompt, idMap)` 重写芯片 id。
 *
 * 【为什么芯片重写由调用方注入（而不是在这里 import 芯片格式）】
 *   本文件在 `base/utils`（**横切层**），架构闸（check-arch 规则 2）明令横切层不得反向依赖业务域；
 *   芯片格式真源 `canvas/shell/promptChipFormat.ts` 属画布域。若在此 import 它，`base/utils` 就依赖了
 *   `canvas/` ⇒ 架构红。故本函数只负责"重开 id + 给映射"，**芯片字符串怎么写**由拥有格式知识的
 *   调用方（`canvas/structure` 的两个克隆/粘贴分支）注入 —— 依赖方向保持 业务 → 横切。
 *
 * 【边界（刻意不做）】
 *  - 只碰**身份字段**，不深拷其它字段（调用方自己决定怎么拷 data）；
 *  - 没有 id 的图（旧数据/连线注入）**不分配新 id**（R1：读取路径不生成随机 UUID；它们本就没有身份可撞）；
 *  - 映射为空时不调用 `rewriteChips`（避免无谓的字符串重建）。
 *
 * @param data 被克隆/粘贴的节点 data（任意形态；内部按字段嗅探，字段不存在即忽略）
 * @param rewriteChips 芯片 id 重写函数（调用方传 `(prompt, idMap) => …`，格式真源在其内部）
 * @returns 重开身份后的**新** data 对象（入参不被修改）
 */
export function reopenImageIdentities<T extends Record<string, unknown>>(
  data: T,
  rewriteChips?: (prompt: string, idMap: ReadonlyMap<string, string>) => string | undefined,
): T {
  const next: Record<string, unknown> = { ...data };
  /** 旧 id → 新 id（芯片替换的唯一依据；只收「原本就有 id」的项） */
  const idMap = new Map<string, string>();

  const reopenList = (value: unknown): unknown => {
    if (!Array.isArray(value)) return value;
    return value.map((item) => {
      if (!item || typeof item !== 'object') return item; // 旧裸字符串：无身份可重开，原样
      const rec = item as Record<string, unknown>;
      const oldId = typeof rec['id'] === 'string' && rec['id'] ? rec['id'] : '';
      if (!oldId) return { ...rec };
      const newId = makeImageId('img');
      idMap.set(oldId, newId);
      return { ...rec, id: newId };
    });
  };

  if ('images' in data) next['images'] = reopenList(data['images']);
  if ('extractedImages' in data) next['extractedImages'] = reopenList(data['extractedImages']);

  const prompt = data['prompt'];
  if (typeof prompt === 'string' && prompt && idMap.size > 0 && rewriteChips) {
    const rewritten = rewriteChips(prompt, idMap);
    if (rewritten !== undefined) next['prompt'] = rewritten;
  }
  return next as T;
}

/**
 * 按顺序表重排图片列表（docs/plan/151 §8.2 派生纯函数 · §8.1 语义决策落地）。
 *
 * 规则（**表内 id 优先 → 表外新增追加末尾 → 表内失效 id 丢弃**）：
 *  1. 顺序表里出现的身份键，按表顺序取对应项；
 *  2. 表里没有的项（用户新加/新连的图）**追加在末尾**（保持它们在入参里的相对顺序）；
 *  3. 表里存在但当前列表里已没有的键（图被删/断线）**直接丢弃**（不产生空洞）。
 *
 * 【身份键 = `imageKeyOf`（R3 判同唯一实现）】不能按下标——下标在重排/断线重连后会指向另一张图。
 *
 * 【为什么发送数组也要用它（§8.1 用户裁定 2026-11-01）】真正决定模型看图序的是**发送数组**
 * （`mergeReferenceImageUrls` 的输出），不是缩略图条。若只重排缩略图，模型看到的「图片 N」仍按旧序
 * ⇒ 用户拖了顺序、模型没跟着变（"拖了没用"）。故发送数组与缩略图条**同源**，编号 = 该数组下标。
 *
 * 【纯函数】不改入参、不改元素内容，只调整顺序（返回新数组）。
 *
 * @param items 当前图片列表（可为空/null）
 * @param order 顺序表（身份键数组）；空/缺省 = 不做重排（原样返回，保持既有行为）
 * @returns 重排后的新数组（元素引用不变）
 */
export function applyImageOrder<T extends { id?: string | undefined; url?: string | undefined }>(
  items: readonly T[] | null | undefined,
  order: readonly string[] | null | undefined,
): T[] {
  const list = Array.isArray(items) ? items : [];
  if (!Array.isArray(order) || order.length === 0) return [...list];

  // 身份键 → 首次出现的项（同键多项时保留第一个，与 mergeRefImages「保留首次出现」口径一致）
  const byKey = new Map<string, T>();
  for (const item of list) {
    const key = imageKeyOf(item);
    if (key && !byKey.has(key)) byKey.set(key, item);
  }
  const out: T[] = [];
  const used = new Set<string>();
  for (const key of order) {
    const item = byKey.get(key);
    // 表内失效 id（图已删/断线）→ 丢弃（不产生空洞）
    if (item === undefined || used.has(key)) continue;
    used.add(key);
    out.push(item);
  }
  // 表外新增 → 追加末尾（保持入参相对顺序）
  for (const item of list) {
    const key = imageKeyOf(item);
    if (key && used.has(key)) continue;
    if (key) used.add(key);
    out.push(item);
  }
  return out;
}

/**
 * 多路图片源**合并去重**（唯一实现；原住 `base/core/utils.ts`，2026-11-01 迁入，docs/plan/151 §9 A8）。
 *
 * 【语义】按**身份键**去重，保留首次出现；无键（id/url 皆空）的项丢弃。
 * 解决同一批资产图经「连线上游 + data.images」双路进入导致渲染 key 重复 / 图显示两份。
 *
 * 【为什么迁到这里（两条硬理由）】
 *  ① **判同只能有一个实现（R3）**：原实现是 `im.id ?? im.url` —— 与 `imageKeyOf` 同语义的**第二套规则**，
 *     且已漂移：`id: ''` 时空串被 `??` 当成有效键（`''` 不是 null/undefined）⇒ 该项被静默丢弃；
 *     而 `imageKeyOf` 对空 id 会回落 url。现统一走 `imageKeyOf`，行为只有一处定义。
 *  ② **不能就地改**：`core/utils.ts` 是横切层叶子，让它 import 本文件会形成
 *     `core/utils ↔ media/imageIdentity` 结构环（arch 闸实测登记为结构债，无 TDZ 实害但仍是债）。
 *     而 `mergeRefImages` 本就是**图片域语义**，住 media 才是正确层位。
 *
 * @param groups 多路图片源（每路可为数组/单项/null）
 * @returns 去重后的新数组（元素引用不变，顺序按首次出现）
 */
export function mergeRefImages<T extends { id?: string; url?: string }>(
  ...groups: Array<Array<T> | T | null | undefined>
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  groups.forEach((g) => {
    (Array.isArray(g) ? g : []).forEach((im) => {
      const key = imageKeyOf(im);
      if (!key || seen.has(key)) return;
      seen.add(key);
      merged.push(im);
    });
  });
  return merged;
}
