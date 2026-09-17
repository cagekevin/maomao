/**
 * 可引用媒体源 · 来源注册表（横切地基 · 深模块）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【职责】回答「一共有哪些东西可以被引用」—— 这是全库此前**缺席的那一层**。
 *  · 新增来源 = 写一个 provider 文件 + 在 `providers/index.ts` 加一行 import（唯一清单，不会漏）；
 *  · 消费方改 **0 行**（自动多一个来源）。
 *
 * 【为什么是注册表而不是硬编码数组】来源集合**极慢**（一年加一两个）而内容极快，
 * 两者必须分离；且手写清单必漂移（本仓母体 M3）。
 *
 * 【失败语义（诚实契约 · docs/136 §5.3）】
 *  · 未注册的来源被 query → **抛错**（fail-fast）。静默返回 `[]` 会把"代码写错了"
 *    伪装成"这个来源是空的"（同 `contentStore.checkRegistered` 的哲学）。
 *  · 重复注册同一 source → **抛错**（两个 provider 抢同一个 source = 第二份真相，必然漂移）。
 *  · `provider.list` 内部失败 → **原样上抛**，由消费方决定是"Tab 错误态"还是"toast"（本层不替它决定）。
 *  · `searchMediaRefs` 是**唯一**允许降级处：部分成功语义，**但必须把失败暴露在返回值里**。
 * ════════════════════════════════════════════════════════════════
 */
import { logger } from '../core/logger.ts';
import type {
  MediaRef,
  MediaRefProvider,
  MediaRefQuery,
  MediaRefSearchResult,
  MediaRefSource,
} from './mediaRefTypes.ts';

const providers = new Map<MediaRefSource, MediaRefProvider>();

/** 注册一个来源（**唯一写入口**；重复注册同一 source 抛错）。 */
export function registerMediaRefSource(provider: MediaRefProvider): void {
  const { source } = provider;
  if (providers.has(source)) {
    throw new Error(`[mediaRefRegistry] 来源已注册，禁止覆盖: ${source}`);
  }
  providers.set(source, provider);
}

/** 列出全部已注册来源（消费方生成 Tab 用）。 */
export function listMediaRefSources(): MediaRefProvider[] {
  return [...providers.values()];
}

/**
 * 取某来源的 provider；未注册**抛错**（fail-fast，不静默）。
 * 消费者若不确定是否注册，用 `listMediaRefSources()` 判（**不另设 hasMediaRefSource** ——
 * 它与 list 是同一真相的两种问法，且当前零消费者 = M6 幽灵预留，故不保留）。
 */
function requireProvider(source: MediaRefSource): MediaRefProvider {
  const provider = providers.get(source);
  if (!provider) {
    throw new Error(`[mediaRefRegistry] 来源未注册: ${source}`);
  }
  return provider;
}

/**
 * 校验 provider 返回的 url 是否已是绝对 URL（**只留痕，不抛**）。
 * 属 provider 实现瑕疵，不该炸掉整个面板；但必须可观测（防"静默少前缀 → 破图"）。
 */
function warnRelativeUrls(source: MediaRefSource, items: MediaRef[]): void {
  const bad = items.filter((it) => it.url && !/^(https?:|data:|blob:|\/\/)/.test(it.url));
  if (bad.length) {
    logger.warn('mediaRef', 'provider 返回了非绝对 URL（url 契约要求已归一）', {
      source,
      sample: bad[0]?.url,
      count: bad.length,
    });
  }
}

/** 单来源查询（Tab 切换用）。未注册 → 抛错；provider 失败 → 原样上抛。 */
export async function queryMediaRefs(
  source: MediaRefSource,
  query?: MediaRefQuery,
): Promise<MediaRef[]> {
  const provider = requireProvider(source);
  const items = await provider.list(query);
  warnRelativeUrls(source, items);
  return items;
}

/**
 * 跨来源搜索（`@提及` 用）——**部分成功语义**。
 *
 * 一个来源挂了不该让整个 `@` 框不可用，但**失败必须暴露在返回值里**
 * （返回 `{ items, failures }` 而非裸数组 —— 否则就是静默吞）。
 */
export async function searchMediaRefs(
  keyword: string,
  query?: MediaRefQuery,
): Promise<MediaRefSearchResult> {
  const items: MediaRef[] = [];
  const failures: MediaRefSearchResult['failures'] = [];

  await Promise.all(
    [...providers.values()].map(async (provider) => {
      try {
        const list = await provider.list({ ...query, keyword });
        warnRelativeUrls(provider.source, list);
        items.push(...list);
      } catch (e) {
        failures.push({
          source: provider.source,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }),
  );

  return { items, failures };
}

/** 仅供测试：清空注册表（生产代码不得调用）。 */
export function __resetMediaRefSourcesForTest(): void {
  providers.clear();
}
