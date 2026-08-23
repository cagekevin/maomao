import "./styles/index.css";
import { useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { DirectorDeskShell } from "./app/layout/DirectorDeskShell";
import { DirectorCanvas } from "./editor/canvas/DirectorCanvas";
import { useDirectorStore, createDefaultDirectorProject } from "./editor/store/directorStore";
import { toAbsoluteFileUrl } from "../base/filesApi.js";
import type { DirectorProject } from "./editor/schema/directorProject";

/**
 * 3D 导演台全屏界面（复刻开源 storyai-3d-director-desk 的 App.tsx）。
 *
 * 由 Director3DNode 双击节点后全屏打开。与官方"一毛"一致：
 *  - 画布上是静态缩略图节点，双击进入全屏导演台
 *  - 顶栏：导演视角 / 机位视角 切换 + 「截图并返回画布」+ 关闭
 *  - 主体：3D 视口 + 左侧场景树 + 右侧属性面板
 *
 * Props：
 *  - initialProject：节点上已保存的工程（无则新建默认工程）
 *  - initialPanoramaUrl：连接的上游全景图 URL
 *  - onExit：关闭回调，回传 { project, thumbnailDataUrl, captures }
 */
export interface Director3DExitPayload {
  project: DirectorProject;
  thumbnailDataUrl?: string | null;
  captures: Array<{ dataUrl: string; fileName?: string }>;
}

export function Director3DOverlay({
  initialProject,
  initialPanoramaUrl,
  onExit,
}: {
  initialProject?: DirectorProject | null;
  initialPanoramaUrl?: string | null;
  onExit?: (payload: Director3DExitPayload) => void;
}) {
  const replaceProject = useDirectorStore((state) => state.replaceProject);
  const addImportedAsset = useDirectorStore((state) => state.addImportedAsset);
  const projectLoadedRef = useRef(false);

  // 挂载时载入工程：优先节点已保存的工程，否则新建默认工程（只执行一次）
  useEffect(() => {
    if (projectLoadedRef.current) return;
    projectLoadedRef.current = true;

    useDirectorStore.getState().setViewportPanelsCollapsed(false);
    if (initialProject) {
      replaceProject(initialProject);
    } else {
      replaceProject(createDefaultDirectorProject({ includePersistedLocalAssets: true }));
    }

    // 应用深色主题
    document.documentElement.dataset.theme = "dark";
    document.documentElement.classList.add("dark");
  }, [initialProject, replaceProject]);

  // 响应上游图片：作为全景背景导入（连接变化 / 首次连接时生效）
  useEffect(() => {
    if (!initialPanoramaUrl) return;
    const current = useDirectorStore.getState();
    // 兼容相对 /files/ 路径 → 补全为绝对 URL（data:/http 原样）
    const normalizedUrl = toAbsoluteFileUrl(initialPanoramaUrl);
    // 当前工程已有全景且 URL 相同 → 跳过
    const existing = current.project.assets.find((a) => a.id === current.project.panoramaAssetId);
    if (existing?.url === normalizedUrl) return;
    // 移除旧全景（若有），再导入新图
    if (current.project.panoramaAssetId) {
      current.removePanoramaAsset();
    }
    current.addImportedAsset({
      kind: "panorama",
      name: "画布全景图.png",
      fileName: "画布全景图.png",
      url: normalizedUrl,
      projectionMode: "equirectangular",
    });
  }, [initialPanoramaUrl, addImportedAsset]);

  // 退出：收集工程 + 各机位截图，回传
  const handleExit = useCallback(
    (thumbnailDataUrl?: string | null, extraCaptures: Array<{ dataUrl: string; fileName?: string }> = []) => {
      const project = useDirectorStore.getState().project;
      const captures: Array<{ dataUrl: string; fileName?: string }> = [...extraCaptures];
      project.cameras.forEach((camera) => {
        (camera.captures || []).forEach((capture) => {
          captures.push({ dataUrl: capture.dataUrl, fileName: `${camera.name || "机位"}截图.png` });
        });
      });
      onExit?.({ project, thumbnailDataUrl, captures });
    },
    [onExit]
  );

  return (
    <div className="app-shell director3d-node-overlay" data-theme="dark">
      <DirectorDeskShell onExit={handleExit}>
        <DirectorCanvas />
      </DirectorDeskShell>
      {/* 悬浮退出按钮：右上角常驻，点击直接返回画布（无 top-bar） */}
      <button
        type="button"
        className="director-float-exit"
        aria-label="返回画布"
        title="返回画布"
        onClick={() => handleExit()}
      >
        <X aria-hidden="true" size={18} strokeWidth={1.9} />
      </button>
    </div>
  );
}

export default Director3DOverlay;
