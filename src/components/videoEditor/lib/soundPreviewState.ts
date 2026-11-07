/**
 * 音效试听的**状态判据**（纯函数 · 无 Audio / 无 React）。
 *
 * 【为什么抽出来（TD-22-42 收口后的可测面）】`useSoundPreview` 的三条契约里，两条是纯判据：
 *   ① 点同一条 = 停止，点别的 = 换歌；
 *   ② 旧音频迟到的 `ended` 不得清掉**新**歌的播放态（按 id 判等）。
 * 它们原先只活在 hook 闭包里，只能靠 renderHook + jsdom + 假 Audio 测（本仓已禁 TSX 测试，
 * 见 `AGENTS.md §2.3`）。抽出来后由 `soundPreviewState.test.ts` 直接锁。
 *
 * 第三条（**卸载即 pause**）依赖 Audio 生命周期，无法纯函数化 —— 由 hook 的 cleanup 保证，
 * 代码注释里写明「只 pause、不 setState」的原因。
 */

/** 可试听音效的最小形状（与 `SoundEffect` 结构兼容）。 */
export interface PreviewableSoundLike {
  id: number;
  previewUrl?: string | undefined;
}

export type PreviewToggleDecision =
  /** 点的就是当前在播的那条 ⇒ 停止 */
  | { kind: 'stop' }
  /** 没有可播地址 ⇒ 什么都不做（但要先把上一条停掉） */
  | { kind: 'idle' }
  /** 换一条 ⇒ 播它 */
  | { kind: 'play'; id: number };

/**
 * 点某条音效时的决策。
 * 顺序即优先级：**先判「是不是同一条」**（同条时即便没 url 也该停掉正在播的那条）。
 */
export function decidePreviewToggle(
  currentId: number | null,
  sound: PreviewableSoundLike,
): PreviewToggleDecision {
  if (currentId === sound.id) return { kind: 'stop' };
  if (!sound.previewUrl) return { kind: 'idle' };
  return { kind: 'play', id: sound.id };
}

/**
 * 迟到的 `ended` / `error` / play 失败是否该清理播放态。
 *
 * 判据：**这条音频还是不是我当前在播的那条**。不是 ⇒ 不动状态
 * （否则快速切歌时旧元素的回调会把新歌的播放态清掉 —— TD-22-42 的时序窗口）。
 */
export function shouldSettlePreview(currentId: number | null, settledId: number): boolean {
  return currentId === settledId;
}
