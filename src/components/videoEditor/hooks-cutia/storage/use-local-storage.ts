import { useState, useEffect, useCallback, useRef } from 'react';
import {
  contentGet,
  contentGetAsync,
  contentSetAsync,
} from '@/components/base/core/contentStore.ts';
import {
  isLegacyRawKey,
  readLegacyRawKey,
  removeLegacyRawKey,
} from '@/components/base/storage/index.ts';
import { reportDegrade } from '@/components/base/core/degrade.ts';

/**
 * 本地持久化偏好 hook（cutia 搬迁带入，2026-09-16 收口 M7 裸写 · TD-02-33/37）。
 *
 * 【原实现的问题（取证）】直接 `localStorage.getItem/setItem`：① 绕过横切存储唯一入口 contentStore；
 *   ② 键名不带 `yimao:` 前缀、且**不在 STORAGE_KEYS 登记**（`editor-caption-*` 三键）→ 备份/云同步清单
 *   恒漏收（换机即丢）；③ 两处 `catch { // catch-ok: READ_FALLBACK }` 静默吞，且**写入处**的理由是从读处
 *   抄错的（写失败被伪装成"内存态 fallback"，用户看不到偏好没存上）。
 * 【收口后】① 读写一律经 contentStore（键由调用方登记，见 contracts.ts）；② 读取用**异步**版，
 *   天然避开 storageAdapter 的「未就绪窗口」（同步读在扩展环境预填完成前只会拿到"还不知道"，
 *   与"确实没有"同值 → 会把默认值误当真相）；③ 失败不再静默：读取失败降级用默认值 + `reportDegrade` 留痕；
 *   写入失败同样 `reportDegrade` 留痕（`persist:failed` 全局总线已于 2026-09-17 删除，失败一律由各站点自确认）。
 * 【迁移】新物理键带 `yimao:` 前缀 → 首次读做一次性迁移（旧裸键 → 新键 → 删旧键，幂等、写成功才删）。
 */
export function useLocalStorage<T>({
  key,
  defaultValue,
}: {
  key: string;
  defaultValue: T;
}): [T, ({ value }: { value: T | ((previousValue: T) => T) }) => void, boolean] {
  const [value, setValue] = useState<T>(defaultValue);
  const [isReady, setIsReady] = useState(false);
  const valueRef = useRef(defaultValue);

  // avoid hydration mismatch by reading after mount
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await migrateLegacyRawKeyOnce(key);
      let stored: unknown;
      try {
        stored = await contentGetAsync(key);
      } catch (error) {
        // 读失败「不等于」没有值：降级用默认值，但必须留痕（原实现这里是静默吞）
        reportDegrade({ layer: 'videoEditor/caption-prefs', key, e: error as Error });
        stored = undefined;
      }
      if (!cancelled && stored !== undefined && stored !== null) {
        valueRef.current = stored as T;
        setValue(stored as T);
      }
      if (!cancelled) setIsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  // sync to contentStore after hydration
  useEffect(() => {
    if (!isReady) return;
    const persist = async () => {
      try {
        await contentSetAsync(key, value);
      } catch (error) {
        reportDegrade({ layer: 'videoEditor/caption-prefs', key, e: error as Error });
      }
    };
    void persist();
  }, [key, value, isReady]);

  const setValueWithCallback = useCallback(
    ({ value: nextValue }: { value: T | ((previousValue: T) => T) }) => {
      const resolvedValue =
        typeof nextValue === 'function'
          ? (nextValue as (previousValue: T) => T)(valueRef.current)
          : nextValue;

      valueRef.current = resolvedValue;
      setValue(resolvedValue);
    },
    [],
  );

  return [value, setValueWithCallback, isReady];
}

/**
 * 一次性迁移：旧**裸** localStorage 键（无 `yimao:` 前缀）→ contentStore 新键。
 * 幂等（新键有值即返回）；**新键写成功才删旧键**（写失败保留，下次读再试）。
 */
async function migrateLegacyRawKeyOnce(key: string): Promise<void> {
  if (!isLegacyRawKey(key)) return;
  if (contentGet(key) !== undefined) return;
  const legacy = readLegacyRawKey(key);
  if (legacy.status === 'missing') return;
  if (legacy.status === 'corrupt') {
    // 旧键损坏：新版读不出、也无从迁移 —— 留痕（否则表现为"偏好莫名回到默认值"且无人知道为什么）
    reportDegrade({
      layer: 'videoEditor/caption-prefs',
      key,
      e: new Error(`旧裸键内容损坏，已跳过迁移（rawLength=${legacy.raw.length}）`),
    });
    return;
  }
  try {
    await contentSetAsync(key, legacy.value);
  } catch (error) {
    reportDegrade({ layer: 'videoEditor/caption-prefs', key, e: error as Error });
    return;
  }
  removeLegacyRawKey(key);
}
