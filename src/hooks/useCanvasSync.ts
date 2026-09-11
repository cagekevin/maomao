/**

 *
 * 【职责】让「快照已被别人写新」在任何形态下都可见（docs/118 §五 C4 / 不变量 I2）：
 *  - BroadcastChannel：收到「其他窗口」保存的同一项目 CANVAS_SAVED → 置 canvasConflict
 *    （同源 <1s 即时）。tabId 单源收口在 canvasSyncBus（广播侧 projectStore 也用它）。
 *  - 服务端版本轮询（3s）：BroadcastChannel **不跨 origin / 不跨浏览器 / 不跨打包进程**
 *    （打包版 127.0.0.1:18080 ↔ 开发口 localhost:5180 = 恒不连通），只有轮询能发现
 *    「远端版本 > 我加载时的版本」→ 置冲突。仅页面可见时轮询。
 *
 * 【项目变化重置】画布冲突标记只在「当前项目内」有效。切换项目后必须重置 canvasConflict，
 * 否则旧项目的冲突状态会残留到新项目。此逻辑收口在本 hook 内部：监听 getProjectId()
 * 返回值变化时自动 setCanvasConflict(false)，App 无需接触 setter。
 *
 * @param {() => string} getProjectId 返回当前项目 id 的函数（App 传 getCurrentProject().id）
 * @returns {{ canvasConflict: boolean, tabIdRef: React.RefObject<string> }}
 */
import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { CANVAS_SYNC_CHANNEL, getCanvasTabId } from '../components/base/core/canvasSyncBus.ts';
import { CANVAS_STATE_PREFIX } from '../components/base/core/contracts.ts';
import { kvGetVersion } from '../components/base/api/localToolApi.ts';
import { getLoadedVersion } from '../components/base/store/projectStore.ts';
import { logger } from '../components/base/core/logger.ts';

export interface CanvasSyncApi {
  /** 其他窗口保存了同一项目 → true（App 据此显示红色警告条） */
  canvasConflict: boolean;
  /**
   * 主动置冲突态。用途：本窗口的写被服务端 CAS 拒绝（409）时，App 把「本次改动未落盘」立刻可见
   * （docs/118 §五 C3）。除此之外冲突态仍由本 hook 内部管理（BroadcastChannel / 版本轮询 / 切项目重置）。
   */
  setCanvasConflict: (v: boolean) => void;
  /** 本窗口唯一 tabId，供广播时带上自身 id（被其他窗口过滤） */
  tabIdRef: MutableRefObject<string>;
}

export function useCanvasSync(getProjectId: () => string): CanvasSyncApi {
  // tabId 唯一来源收口到 canvasSyncBus（广播侧 projectStore.flushCanvasSave 也用它）：
  // 两侧同 id 才能保证「自己广播的消息」被自己过滤掉（否则自保存即误弹冲突红条）。
  const tabIdRef = useRef(getCanvasTabId());
  const [canvasConflict, setCanvasConflict] = useState(false);
  // 用 ref 存最新 getProjectId：监听 effect 只在挂载时注册一次（对齐官方），内部实时读当前项目 id
  const getProjectIdRef = useRef(getProjectId);
  getProjectIdRef.current = getProjectId;
  // 记录上一次项目 id，用于「切换项目后重置冲突」
  const prevProjectIdRef = useRef<string | undefined>(undefined);

  // 监听 BroadcastChannel（只在挂载时注册一次；项目切换不重建 channel）
  useEffect(() => {
    let channel: BroadcastChannel | undefined;
    try {
      channel = new BroadcastChannel(CANVAS_SYNC_CHANNEL);
      channel.onmessage = (e: MessageEvent) => {
        if (
          e?.data?.type === 'CANVAS_SAVED' &&
          e.data.projectId === getProjectIdRef.current?.() &&
          e.data.tabId !== tabIdRef.current
        ) {
          setCanvasConflict(true);
        }
      };
    } catch (err) {
      logger.warn('Canvas', 'BroadcastChannel 不可用', err?.message);
    }
    return () => {
      try {
        channel?.close();
      } catch {
        /* ignore */
      }
    };
  }, []);

  // ── 跨源冲突兜底：3s 服务端版本轮询（只读 <key>_version，不拉整包）──
  // 仅页面可见时轮询（后台窗口不轮询，避免把挂着的旧窗口当冲突源）。
  useEffect(() => {
    const tick = async () => {
      const pid = getProjectIdRef.current?.();
      if (!pid || document.visibilityState !== 'visible') return;
      try {
        const remote = await kvGetVersion(CANVAS_STATE_PREFIX + pid);
        if (remote > getLoadedVersion()) setCanvasConflict(true);
      } catch {
        /* 轮询失败静默：不打扰主链路 */
      }
    };
    const timer = setInterval(tick, 3000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  // 切换项目后重置冲突标记（官方在 projectId 变化时不应残留旧项目冲突）。
  // 用 getProjectIdRef 实时读，仅当返回的 id 变化才重置（避免每次渲染都 setState）。
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 意图是每渲染轮询 projectId（ref 守卫去重）；加 deps 数组会退化为仅挂载时检查一次，切换项目后不再重置冲突标记（行为回归）
  useEffect(() => {
    const id = getProjectIdRef.current?.();
    if (prevProjectIdRef.current !== id) {
      prevProjectIdRef.current = id;
      setCanvasConflict(false);
    }
  });

  return { canvasConflict, setCanvasConflict, tabIdRef };
}
