import { useEffect, type ReactNode } from "react";
import { ObjectTreePanel } from "../../editor/panels/ObjectTreePanel";
import { RightPanel } from "../../editor/panels/RightPanel";
import { CurveEditorDialog } from "../../editor/panels/CurveEditorDialog";
import { AnimationTimelineBar } from "../../editor/canvas/AnimationTimelineBar";
import { useDirectorStore } from "../../editor/store/directorStore";
import { useDirectorViewportShortcuts } from "../useDirectorViewportShortcuts";

/** 播放推进：在 shell 层用 rAF 推进 currentTime（脱离 r3f 调和层，避免每次 store 变化牵动 Canvas 子树导致无限重渲染） */
function PlaybackTicker() {
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      const store = useDirectorStore.getState();
      if (!store.isPlaying) {
        last = now;
        return;
      }
      const dt = (now - last) / 1000;
      last = now;
      const duration = store.project.timeline?.duration ?? 5;
      const next = store.currentTime + dt;
      if (next >= duration) {
        if (store.loopPlayback) {
          store.setCurrentTime(0);
        } else {
          store.pause();
          store.setCurrentTime(duration);
        }
      } else {
        store.setCurrentTime(next);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  return null;
}

export function DirectorDeskShell({ children }: { children: ReactNode }) {
  // 视口快捷键仅在导演台全屏存活期间生效，关闭即移除（不污染主画布）
  useDirectorViewportShortcuts();
  const viewportPanelsCollapsed = useDirectorStore((state) => state.viewportPanelsCollapsed);
  const animationModuleCollapsed = useDirectorStore((state) => state.animationModuleCollapsed);
  const setAnimationModuleCollapsed = useDirectorStore((state) => state.setAnimationModuleCollapsed);

  return (
    <div
      className={`director-shell director-shell-fullbleed${viewportPanelsCollapsed ? " is-sidebars-collapsed" : ""} is-animation-open`}
    >
      <section className="viewport-column" aria-label="3D视口">
        {children}
      </section>
      <aside
        className="left-sidebar director-sidebar"
        aria-hidden={viewportPanelsCollapsed ? "true" : undefined}
        aria-label="场景"
      >
        <ObjectTreePanel />
      </aside>
      <aside
        className="right-sidebar director-sidebar"
        aria-hidden={viewportPanelsCollapsed ? "true" : undefined}
        aria-label="属性"
      >
        <RightPanel />
      </aside>
      <PlaybackTicker />
      {/* 底部动画栏容器恒定存在（DirectorCanvas 测量其高度让工具栏永远浮在其上方） */}
      <div className="animation-module-area">
        {animationModuleCollapsed ? (
          <div className="animation-module-strip" role="region" aria-label="动画栏已折叠">
            <button
              type="button"
              className="animation-module-strip-toggle"
              aria-label="展开动画栏"
              title="展开动画栏（时间轴）"
              onClick={() => setAnimationModuleCollapsed(false)}
            >
              <span aria-hidden="true">◀</span>
              <span>展开动画</span>
            </button>
          </div>
        ) : (
          <AnimationTimelineBar />
        )}
      </div>
      <CurveEditorDialog />
    </div>
  );
}
