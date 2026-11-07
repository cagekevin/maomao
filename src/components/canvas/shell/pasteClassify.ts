/**
 * 剪贴板 / 拖拽载荷的**分类判据**（纯函数 · 无 React / 无 DOM 事件）。
 *
 * 【为什么抽出来】原分类埋在 `useAssetDropPaste` 的闭包里（574 行 hook），只有渲染测试能碰到它。
 * 而这里恰恰决定「粘贴一段东西到底该建什么节点」—— 判错就是把节点组当纯文本贴、把表格贴成图片。
 * 抽成纯函数后由 `pasteClassify.test.ts` 直接锁（AGENTS.md §2.3：判据下沉再测）。
 *
 * 【协议归属】`mutiwindow-nodes` / `mutiwindow-images` 是**画布自己的剪贴板协议**，
 * 故住在画布域（`canvas/shell`），不下沉到 `base/utils`。
 */
import { tryParse } from '@/components/base/utils/net/asyncGuard.ts';
import { sanitizePastedText } from '@/components/base/utils/net/clipboard.ts';

export type PastedTextDecision =
  /** 空 / 纯空白 / 图片组为空 ⇒ 什么都不做 */
  | { kind: 'empty' }
  /** 节点组（含连线）⇒ 交给宿主重建，本层不解释失败 */
  | { kind: 'node-group' }
  /** 图片组 ⇒ 网格摆放若干 assetNode */
  | { kind: 'image-group'; images: string[] }
  /** 普通文本 ⇒ 建 textGenerateNode（已清洗） */
  | { kind: 'text'; text: string };

/**
 * 剪贴板文本 → 该建什么。
 *
 * 判据顺序（不可换）：
 * 1. 空 ⇒ empty（不建节点、不提示）
 * 2. `{type:'mutiwindow-nodes'}` ⇒ node-group（**用原始文本**，不能先清洗：清洗会破坏 JSON 缩进以外的结构？）
 *    注：实际原因是宿主需要原样 JSON 重建连线，清洗只对纯文本有意义。
 * 3. `{type:'mutiwindow-images', images:[...]}` ⇒ image-group（非字符串项过滤掉；全空 ⇒ empty）
 * 4. 其余 ⇒ text（经 `sanitizePastedText` 压缩空行/去脏字符；清洗后为空 ⇒ empty）
 *
 * 注意 3 与 4 的差别：**普通 JSON 不当节点组**（没有 mutiwindow 标记就是一段文字），
 * 但仍走文本清洗 —— 原测试「普通 JSON 被清洗」锁的就是这条。
 */
export function classifyPastedText(rawText: string): PastedTextDecision {
  if (!rawText || !rawText.trim()) return { kind: 'empty' };

  const rawR = tryParse(() => JSON.parse(rawText));
  const parsedRaw = rawR.ok ? rawR.value : undefined;
  const d =
    parsedRaw && typeof parsedRaw === 'object'
      ? (parsedRaw as { type?: unknown; images?: unknown })
      : null;

  if (d?.type === 'mutiwindow-nodes') return { kind: 'node-group' };

  if (d?.type === 'mutiwindow-images') {
    const images = (Array.isArray(d.images) ? d.images : []).filter(
      (x): x is string => typeof x === 'string',
    );
    return images.length ? { kind: 'image-group', images } : { kind: 'empty' };
  }

  const text = sanitizePastedText(rawText);
  return text ? { kind: 'text', text } : { kind: 'empty' };
}

/**
 * 拖入「非文件」内容时的 URL 候选：`text/uri-list` 优先（拖网页图的标准 MIME），
 * 其次 `text/plain`；两者都可能多行（uri-list 每行一个 URL），**取首行**。
 */
export function pickDropCandidate(uriList: string, plain: string): string {
  return (uriList.trim() || plain.trim()).split(/\r?\n/)[0]?.trim() || '';
}
