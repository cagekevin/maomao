import { useCallback, useEffect, useState } from 'react';
import { fetchSoundLibrary, type SoundLibraryItem } from '../../base/api/localToolApi.ts';

export type SoundKind = 'effect' | 'music';

// 供视图层直接取用（免去它们各自再数一遍到 base/ 的相对路径）。
export type { SoundLibraryItem };

export interface SoundLibraryState {
  items: SoundLibraryItem[];
  isLoading: boolean;
  /** 加载失败原因；`null` = 无失败（**失败可见**，见下方注释）。 */
  error: string | null;
  /** 该分类对应的磁盘相对目录（后端给的真源）；空库时用于引导用户放文件。 */
  dir: string | null;
  /** 重新扫描（用户往目录里放了文件之后点「刷新」）。 */
  reload: () => void;
}

/**
 * 剪辑器声音库（音效 / 音乐）—— **自建本地库的唯一读取入口**（TD-22-47）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【它替代了什么】原 `useSoundSearch` + `sounds.tsx` 内联的 fetch 直打 `/api/sounds/search`
 * —— cutia（Next 同源）时代的第三方代理端点，本仓后端从未实现。请求落到 catch-all 透传，
 * `response.ok` 为假 → **静默空面板**：用户分不清「这个库是空的」和「它坏了」。
 *
 * 【本 hook 的三条契约】
 *  ① 数据源 = 后端 `/api/sounds/library`（走 `API_BASE`，**不再用同源相对路径**）；
 *  ② **失败要出声**：非 2xx / 网络错误 → `error` 非空（调用方渲染错误态 + 重试）；
 *  ③ **空库要能引导**：`dir` 非空且 `items` 为空 = 空库（合法状态）—— 调用方据此提示
 *     「把音频放进 <dir>」，而不是显示一个和"坏了"一模一样的空面板。
 * ════════════════════════════════════════════════════════════════
 */
export function useSoundLibrary({ kind }: { kind: SoundKind }): SoundLibraryState {
  const [items, setItems] = useState<SoundLibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dir, setDir] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let ignore = false;
    setIsLoading(true);
    setError(null);

    fetchSoundLibrary({ kind })
      .then((res) => {
        if (ignore) return;
        setItems(res?.data?.items ?? []);
        setDir(res?.data?.dir ?? null);
      })
      .catch((err: unknown) => {
        if (ignore) return;
        setError(err instanceof Error ? err.message : '声音库加载失败');
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [kind, nonce]);

  return { items, isLoading, error, dir, reload };
}
