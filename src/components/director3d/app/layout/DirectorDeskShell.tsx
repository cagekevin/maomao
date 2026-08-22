import type { ReactNode } from "react";
import { ObjectTreePanel } from "../../editor/panels/ObjectTreePanel";
import { RightPanel } from "../../editor/panels/RightPanel";
import { useDirectorStore } from "../../editor/store/directorStore";
import { useDirectorViewportShortcuts } from "../useDirectorViewportShortcuts";

export function DirectorDeskShell({ children }: { children: ReactNode }) {
  // 视口快捷键仅在导演台全屏存活期间生效，关闭即移除（不污染主画布）
  useDirectorViewportShortcuts();
  const viewportPanelsCollapsed = useDirectorStore((state) => state.viewportPanelsCollapsed);

  return (
    <div
      className={`director-shell director-shell-fullbleed${viewportPanelsCollapsed ? " is-sidebars-collapsed" : ""}`}
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
    </div>
  );
}
